import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd';
import { AimOutlined, WarningOutlined } from '@ant-design/icons';
import { COUNTRY_STATS, baseProduction } from '../data/countryStats';
import {
  countryName,
  enemyArmy,
  fmtRate,
  fmtShort,
  forecast,
} from '../game/engine';
import { useGame } from '../state/GameProvider';
import { AttackModal } from './AttackModal';
import { Flag } from './Flag';

const { Text } = Typography;

export function WarPanel({ onFocusCountry }: { onFocusCountry?: (id: string) => void }) {
  const { state, derived, setWarRoomOpen } = useGame();
  const [filter, setFilter] = useState('');
  const [target, setTarget] = useState<string | null>(null);

  // Rebuilt every tick on purpose — the frontier and enemy strengths both move,
  // and the list is short enough that memoising would only add bookkeeping.
  const needle = filter.trim().toLowerCase();
  const targets = derived.frontier
    .map((id) => ({
      id,
      name: countryName(id),
      army: enemyArmy(state, id),
      pop: COUNTRY_STATS[id]?.pop ?? 0,
      // What this country is adding to its own army every second, right now.
      rearming: baseProduction(COUNTRY_STATS[id]) * derived.armamentRate,
    }))
    .filter((t) => t.name.toLowerCase().includes(needle))
    .sort((a, b) => a.army - b.army);

  const engaged = state.battles.filter((b) => b.outcome === 'ongoing');
  const frontsFull = engaged.length >= derived.maxFronts;

  return (
    <div className="panel">
      {engaged.length > 0 && (
        <Alert
          type={frontsFull ? 'warning' : 'info'}
          showIcon
          icon={<WarningOutlined />}
          message={`${engaged.length} of ${derived.maxFronts} front${
            derived.maxFronts === 1 ? '' : 's'
          } engaged`}
          description={
            frontsFull
              ? `Fighting in ${engaged
                  .map((b) => b.targetName)
                  .join(', ')}. Research more staff capacity to open another front.`
              : `Fighting in ${engaged.map((b) => b.targetName).join(', ')}. You can still open ${
                  derived.maxFronts - engaged.length
                } more.`
          }
          action={
            <Button size="small" onClick={() => setWarRoomOpen(true)}>
              War room
            </Button>
          }
          style={{ marginBottom: 12 }}
        />
      )}

      <Input.Search
        placeholder="Filter bordering countries"
        allowClear
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        style={{ marginBottom: 12 }}
      />

      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        {targets.map((t) => {
          const f = forecast(state, t.id, derived.deployable);
          const damaged = state.damaged[t.id] !== undefined;
          const underAttack = engaged.some((b) => b.targetId === t.id);
          return (
            <Card key={t.id} size="small" className="item-card">
              <div className="item-head">
                <Space size={6}>
                  <Flag countryId={t.id} height={13} />
                  <Text strong>{t.name}</Text>
                  {underAttack && (
                    <Tag color="processing" bordered={false}>
                      at war
                    </Tag>
                  )}
                  {damaged && !underAttack && (
                    <Tag color="orange" bordered={false}>
                      bloodied
                    </Tag>
                  )}
                </Space>
                <Space size={4}>
                  {onFocusCountry && (
                    <Button
                      size="small"
                      icon={<AimOutlined />}
                      onClick={() => onFocusCountry(t.id)}
                    />
                  )}
                  <Button
                    size="small"
                    danger={!f.win}
                    type={f.win ? 'primary' : 'default'}
                    disabled={underAttack || frontsFull || derived.deployable <= 0}
                    onClick={() => setTarget(t.id)}
                  >
                    {underAttack ? 'Engaged' : 'Attack'}
                  </Button>
                </Space>
              </div>
              <Space size={20} style={{ marginTop: 6 }}>
                <Statistic
                  title="Defenders"
                  value={fmtShort(t.army)}
                  suffix={
                    <span style={{ fontSize: 11, color: '#d89614' }}>
                      +{fmtRate(t.rearming)}
                    </span>
                  }
                  valueStyle={{ fontSize: 14 }}
                />
                <Statistic
                  title="Force needed"
                  value={fmtShort(f.required)}
                  valueStyle={{
                    fontSize: 14,
                    color: derived.deployable >= f.required ? '#49aa19' : '#d89614',
                  }}
                />
                <Statistic
                  title="Population"
                  value={`${fmtShort(t.pop)}M`}
                  valueStyle={{ fontSize: 14 }}
                />
              </Space>
            </Card>
          );
        })}
        {targets.length === 0 && (
          <Empty
            description={
              filter ? 'No border matches that name' : 'No bordering countries left'
            }
          />
        )}
      </Space>

      <AttackModal targetId={target} onClose={() => setTarget(null)} />
    </div>
  );
}
