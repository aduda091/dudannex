import { Tag } from 'antd';
import { fmtPercent, fmtShort } from '../game/engine';
import type { EffectKey, Effects } from '../game/types';

type Render = (v: number) => string;

const pct: Render = (v) => `${v > 0 ? '+' : ''}${fmtPercent(v)}`;
/** For effects where a positive value is a reduction, e.g. "-8.00% costs". */
const neg: Render = (v) => `${v > 0 ? '-' : '+'}${fmtPercent(Math.abs(v))}`;
const flat: Render = (v) => `${v > 0 ? '+' : ''}${fmtShort(v)}`;

const LABELS: Record<EffectKey, { text: (v: number) => string; good: boolean }> = {
  prodFlat: { text: (v) => `${flat(v)} industry/s`, good: true },
  prodMult: { text: (v) => `${pct(v)} industry`, good: true },
  resFlat: { text: (v) => `${flat(v)} research/s`, good: true },
  resMult: { text: (v) => `${pct(v)} research`, good: true },
  manpowerFlat: { text: (v) => `${flat(v)} army cap`, good: true },
  manpowerMult: { text: (v) => `${pct(v)} army cap`, good: true },
  effMult: { text: (v) => `${pct(v)} attack strength`, good: true },
  convMult: { text: (v) => `${pct(v)} recruitment rate`, good: true },
  popMult: { text: (v) => `${pct(v)} population growth`, good: true },
  assimMult: { text: (v) => `${pct(v)} integration speed`, good: true },
  costRed: { text: (v) => `${neg(v)} building costs`, good: true },
  lossRed: { text: (v) => `${neg(v)} own casualties`, good: true },
  garrisonRed: { text: (v) => `${neg(v)} garrison needs`, good: true },
};

export function EffectTags({ effects }: { effects: Partial<Effects> }) {
  const entries = Object.entries(effects) as [EffectKey, number][];
  return (
    <span className="effect-tags">
      {entries.map(([key, value]) => {
        const label = LABELS[key];
        if (!label || value === 0) return null;
        const positive = label.good === value > 0;
        return (
          <Tag key={key} color={positive ? 'blue' : 'volcano'} bordered={false}>
            {label.text(value)}
          </Tag>
        );
      })}
    </span>
  );
}
