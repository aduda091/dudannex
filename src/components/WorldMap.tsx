import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Button, Space, Tooltip } from 'antd';
import {
  AimOutlined,
  MinusOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { WORLD } from '../game/engine';

const MIN_WIDTH = WORLD.width / 14; // deepest zoom
const MAX_WIDTH = WORLD.width; // fully zoomed out

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const FULL_VIEW: ViewBox = { x: 0, y: 0, w: WORLD.width, h: WORLD.height };

export interface WorldMapProps {
  /**
   * `id:bucket` pairs for every owned country. Bucketing integration keeps this
   * string stable between ticks so the 175 paths are not re-rendered 10x/second.
   */
  ownedKey: string;
  /** Comma-joined ids of countries you can attack. */
  frontierKey: string;
  homeId: string | null;
  selectedId: string | null;
  /** Comma-joined ids of every country currently under attack. */
  battleTargetKey: string;
  /** Country to centre the view on when `focusNonce` changes. */
  focusId: string | null;
  /** Bumped by the parent to request a re-centre, even on the same country. */
  focusNonce: number;
  onSelect: (id: string) => void;
}

/** Coarse ownership shading: how firmly a territory is actually yours. */
export function integrationBucket(integration: number): 0 | 1 | 2 {
  if (integration >= 0.995) return 2;
  if (integration >= 0.75) return 1;
  return 0;
}

function WorldMapImpl({
  ownedKey,
  frontierKey,
  homeId,
  selectedId,
  battleTargetKey,
  focusId,
  focusNonce,
  onSelect,
}: WorldMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<ViewBox>(FULL_VIEW);
  const [hovered, setHovered] = useState<string | null>(null);

  const owned = new Map<string, number>();
  for (const pair of ownedKey.split(',')) {
    if (!pair) continue;
    const [id, bucket] = pair.split(':');
    owned.set(id, Number(bucket));
  }
  const frontier = new Set(frontierKey.split(',').filter(Boolean));
  const atWar = new Set(battleTargetKey.split(',').filter(Boolean));

  const drag = useRef<{
    startX: number;
    startY: number;
    origin: ViewBox;
    matrix: DOMMatrix | null;
    moved: boolean;
  } | null>(null);

  const clamp = useCallback((v: ViewBox): ViewBox => {
    const w = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, v.w));
    const h = (w / WORLD.width) * WORLD.height;
    return {
      w,
      h,
      x: Math.min(Math.max(v.x, -w * 0.15), WORLD.width - w * 0.85),
      y: Math.min(Math.max(v.y, -h * 0.15), WORLD.height - h * 0.85),
    };
  }, []);

  const zoomBy = useCallback(
    (factor: number, anchor?: { x: number; y: number }) => {
      setView((v) => {
        const w = v.w / factor;
        const ax = anchor?.x ?? v.x + v.w / 2;
        const ay = anchor?.y ?? v.y + v.h / 2;
        const scale = w / v.w;
        return clamp({
          w,
          h: v.h * scale,
          x: ax - (ax - v.x) * scale,
          y: ay - (ay - v.y) * scale,
        });
      });
    },
    [clamp],
  );

  /** Screen coordinates -> map coordinates, honouring viewBox letterboxing. */
  const toUser = (clientX: number, clientY: number, matrix?: DOMMatrix | null) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const m = matrix ?? svg.getScreenCTM()?.inverse();
    if (!m) return { x: 0, y: 0 };
    const pt = new DOMPoint(clientX, clientY).matrixTransform(m);
    return { x: pt.x, y: pt.y };
  };

  // Centre on a requested country, zooming in if the view is wider than a
  // regional look. Keyed on the nonce so repeat requests still fire.
  useEffect(() => {
    if (!focusId || focusNonce === 0) return;
    const target = WORLD.countries.find((c) => c.id === focusId);
    if (!target) return;
    setView((v) => {
      const w = Math.min(v.w, WORLD.width / 6);
      const h = (w / WORLD.width) * WORLD.height;
      return clamp({ w, h, x: target.cx - w / 2, y: target.cy - h / 2 });
    });
    // `focusId` alone must not re-trigger: the nonce is the signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNonce]);

  // Registered natively so it can be non-passive and stop the page scrolling.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const anchor = toUser(e.clientX, e.clientY);
      zoomBy(e.deltaY < 0 ? 1.2 : 1 / 1.2, anchor);
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [zoomBy]);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = {
      startX: e.clientX,
      startY: e.clientY,
      origin: view,
      matrix: svgRef.current?.getScreenCTM()?.inverse() ?? null,
      moved: false,
    };
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const from = toUser(d.startX, d.startY, d.matrix);
    const to = toUser(e.clientX, e.clientY, d.matrix);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (Math.abs(e.clientX - d.startX) + Math.abs(e.clientY - d.startY) > 4) {
      d.moved = true;
    }
    setView(clamp({ ...d.origin, x: d.origin.x - dx, y: d.origin.y - dy }));
  };

  const endDrag = (e: React.PointerEvent<SVGSVGElement>) => {
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    drag.current = null;
  };

  const handleClick = (id: string) => {
    if (drag.current?.moved) return;
    onSelect(id);
  };

  const hoveredCountry = hovered
    ? WORLD.countries.find((c) => c.id === hovered)
    : null;

  return (
    <div className="map-shell">
      <svg
        ref={svgRef}
        className="map-svg"
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={() => setHovered(null)}
      >
        <rect
          x={-WORLD.width}
          y={-WORLD.height}
          width={WORLD.width * 3}
          height={WORLD.height * 3}
          fill="#0a1420"
        />
        <g>
          {WORLD.countries.map((c) => {
            const bucket = owned.get(c.id);
            const isOwned = bucket !== undefined;
            const isFrontier = frontier.has(c.id);
            const classes = ['country'];
            if (isOwned) classes.push('owned', `owned-${bucket}`);
            if (isFrontier) classes.push('frontier');
            if (c.id === homeId) classes.push('home');
            if (c.id === selectedId) classes.push('selected');
            if (atWar.has(c.id)) classes.push('battling');
            return (
              <path
                key={c.id}
                d={c.d}
                className={classes.join(' ')}
                onPointerEnter={() => setHovered(c.id)}
                onClick={() => handleClick(c.id)}
              />
            );
          })}
        </g>
        {hoveredCountry && (
          <text
            className="map-label"
            x={hoveredCountry.cx}
            y={hoveredCountry.cy}
            fontSize={view.w / 48}
            textAnchor="middle"
          >
            {hoveredCountry.name}
          </text>
        )}
      </svg>

      <div className="map-controls">
        <Space.Compact direction="vertical">
          <Tooltip title="Zoom in" placement="left">
            <Button icon={<PlusOutlined />} onClick={() => zoomBy(1.4)} />
          </Tooltip>
          <Tooltip title="Zoom out" placement="left">
            <Button icon={<MinusOutlined />} onClick={() => zoomBy(1 / 1.4)} />
          </Tooltip>
          <Tooltip title="Fit the world" placement="left">
            <Button icon={<AimOutlined />} onClick={() => setView(FULL_VIEW)} />
          </Tooltip>
        </Space.Compact>
      </div>

      {/* One entry per state a country can actually be drawn in — including the
          middle integration shade, which previously had no swatch at all. */}
      <div className="map-legend">
        <span><i className="sw home" /> Homeland</span>
        <span><i className="sw full" /> Integrated</span>
        <span><i className="sw mid" /> Integrating</span>
        <span><i className="sw partial" /> Occupied</span>
        <span><i className="sw front" /> Can attack</span>
      </div>
    </div>
  );
}

export const WorldMap = memo(WorldMapImpl);
