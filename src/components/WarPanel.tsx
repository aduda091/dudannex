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
import { COUNTRY_STATS } from '../data/countryStats';
import {
  countryName,
  enemyArmy,
  fmtShort,
  forecast,
} from '../game/engine';
import { useGame } from '../state/GameProvider';
import { AttackModal } from './AttackModal';

const { Text } = Typography;

export function WarPanel({ onFocusCountry }: { onFocusCountry?: (id: string) => void }) {
  const { state, derived } = useGame();
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
    }))
    .filter((t) => t.name.toLowerCase().includes(needle))
    .sort((a, b) => a.army - b.army);

  const battling = state.battle?.outcome === 'ongoing';

  return (
    <div className="panel">
      {battling && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          message={`Fighting in ${state.battle?.targetName}`}
          description="You can only run one offensive at a time."
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
          return (
            <Card key={t.id} size="small" className="item-card">
              <div className="item-head">
                <Space size={6}>
                  <Text strong>{t.name}</Text>
                  {damaged && (
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
                    disabled={battling || derived.deployable <= 0}
                    onClick={() => setTarget(t.id)}
                  >
                    Attack
                  </Button>
                </Space>
              </div>
              <Space size={20} style={{ marginTop: 6 }}>
                <Statistic
                  title="Defenders"
                  value={fmtShort(t.army)}
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
