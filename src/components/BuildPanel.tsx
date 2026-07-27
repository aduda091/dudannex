import { Badge, Button, Card, Empty, Segmented, Space, Tooltip, Typography } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { ALL_BUILDINGS, buildingCost, fmtDuration, fmtShort, isBuildingUnlocked, timeTo } from '../game/engine';
import { CATEGORY_LABEL, TECH_BY_ID } from '../game/content';
import { useGame } from '../state/GameProvider';
import { EffectTags } from './EffectTags';
import type { Category } from '../game/types';

const { Text, Paragraph } = Typography;

const FILTERS: (Category | 'all')[] = ['all', 'industry', 'science', 'military', 'civic'];

export function BuildPanel() {
  const { state, derived, build } = useGame();
  const [filter, setFilter] = useState<Category | 'all'>('all');

  const visible = ALL_BUILDINGS.filter((b) => filter === 'all' || b.category === filter);

  return (
    <div className="panel">
      <Segmented
        block
        value={filter}
        onChange={(v) => setFilter(v as Category | 'all')}
        options={FILTERS.map((f) => ({
          label: f === 'all' ? 'All' : CATEGORY_LABEL[f],
          value: f,
        }))}
      />

      <Space direction="vertical" size={8} style={{ width: '100%', marginTop: 12 }}>
        {visible.map((b) => {
          const unlocked = isBuildingUnlocked(state, b.id);
          const count = state.buildings[b.id] ?? 0;
          const cost = buildingCost(state, b.id);
          const affordable = state.industry >= cost;
          const wait = timeTo(state.industry, cost, derived.treasuryRate);

          if (!unlocked) {
            const gate = b.requires ? TECH_BY_ID.get(b.requires) : undefined;
            return (
              <Card key={b.id} size="small" className="locked-card">
                <Space>
                  <LockOutlined />
                  <Text type="secondary">
                    {b.name} — requires <Text strong>{gate?.name ?? b.requires}</Text>
                  </Text>
                </Space>
              </Card>
            );
          }

          return (
            <Card key={b.id} size="small" className="item-card">
              <div className="item-head">
                <Space size={8}>
                  <Text strong>{b.name}</Text>
                  {count > 0 && <Badge count={count} color="#1668dc" overflowCount={9999} />}
                </Space>
                <Tooltip
                  title={
                    affordable
                      ? 'Build one'
                      : `Affordable in ${fmtDuration(wait)} at the current treasury rate`
                  }
                >
                  <Button
                    size="small"
                    type={affordable ? 'primary' : 'default'}
                    disabled={!affordable}
                    onClick={() => build(b.id)}
                  >
                    {fmtShort(cost)}
                  </Button>
                </Tooltip>
              </div>
              <Paragraph type="secondary" style={{ fontSize: 12, margin: '4px 0 6px' }}>
                {b.blurb}
              </Paragraph>
              <EffectTags effects={b.effects} />
              {count > 0 && (
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Next copy costs {fmtShort(cost)} · {count} built
                </Text>
              )}
            </Card>
          );
        })}
        {visible.length === 0 && <Empty description="Nothing here yet" />}
      </Space>
    </div>
  );
}
