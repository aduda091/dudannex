import { useState } from 'react';
import { Button, Descriptions, Drawer, Progress, Space, Statistic, Tag, Typography } from 'antd';
import { COUNTRY_STATS, baseMilitary, baseProduction, baseResearch } from '../data/countryStats';
import {
  COUNTRY_BY_ID,
  canAttack,
  countryName,
  enemyArmy,
  fmtPercent,
  fmtRate,
  fmtShort,
  forecast,
} from '../game/engine';
import { useGame } from '../state/GameProvider';
import { AttackModal } from './AttackModal';
import { Flag } from './Flag';

const { Text } = Typography;

export function CountryDrawer({
  countryId,
  onClose,
}: {
  countryId: string | null;
  onClose: () => void;
}) {
  const { state, derived } = useGame();
  const [attacking, setAttacking] = useState<string | null>(null);

  const country = countryId ? COUNTRY_BY_ID.get(countryId) : null;
  const stats = countryId ? COUNTRY_STATS[countryId] : null;
  const owned = countryId ? state.owned[countryId] : undefined;
  const isOwned = owned !== undefined;
  const attackable = countryId ? canAttack(state, countryId) : false;
  const f = countryId && !isOwned ? forecast(state, countryId, derived.deployable) : null;

  return (
    <>
      <Drawer
        open={!!country}
        onClose={onClose}
        placement="right"
        width={380}
        title={
          country && (
            <Space size={8}>
              <Flag countryId={country.id} height={18} />
              {country.name}
            </Space>
          )
        }
        extra={
          isOwned ? (
            <Tag color={countryId === state.homeId ? 'gold' : 'blue'} bordered={false}>
              {countryId === state.homeId ? 'Homeland' : 'Yours'}
            </Tag>
          ) : (
            <Tag bordered={false}>Foreign</Tag>
          )
        }
      >
        {country && stats && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {isOwned && owned < 1 && (
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Integration — {fmtPercent(owned)} of this country's economy
                  and manpower currently answers to you.
                </Text>
                {/* The sentence above already gives the figure, and antd's own
                    label would print the raw float. */}
                <Progress percent={owned * 100} showInfo={false} strokeColor="#d89614" />
              </div>
            )}

            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="Population">
                {fmtShort(stats.pop)} million
              </Descriptions.Item>
              <Descriptions.Item label="GDP">
                ${fmtShort(stats.gdp)} billion
              </Descriptions.Item>
              <Descriptions.Item label="Active personnel">
                {fmtShort(stats.troops)} thousand
              </Descriptions.Item>
              <Descriptions.Item label="Defence budget">
                ${fmtShort(stats.budget)} billion
              </Descriptions.Item>
            </Descriptions>

            <Space size={24}>
              <Statistic
                title="Industry"
                value={fmtRate(baseProduction(stats) * (owned ?? 1))}
                valueStyle={{ fontSize: 15 }}
              />
              <Statistic
                title="Research"
                value={fmtRate(baseResearch(stats) * (owned ?? 1))}
                valueStyle={{ fontSize: 15 }}
              />
              <Statistic
                title={isOwned ? 'Original army' : 'Standing army'}
                value={fmtShort(
                  isOwned ? baseMilitary(stats) : enemyArmy(state, country.id),
                )}
                valueStyle={{ fontSize: 15 }}
              />
            </Space>

            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Borders
              </Text>
              <div style={{ marginTop: 4 }}>
                {country.neighbors.map((n) => (
                  <Tag
                    key={n}
                    bordered={false}
                    color={n in state.owned ? 'blue' : undefined}
                    style={{ marginBottom: 4 }}
                  >
                    <Space size={5}>
                      <Flag countryId={n} height={11} />
                      {countryName(n)}
                    </Space>
                  </Tag>
                ))}
              </div>
            </div>

            {!isOwned && f && (
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  You would need about <Text strong>{fmtShort(f.required)}</Text> troops
                  to take this. You have {fmtShort(derived.deployable)} deployable.
                </Text>
                <Button
                  type="primary"
                  danger={!f.win}
                  block
                  style={{ marginTop: 10 }}
                  disabled={!attackable || derived.deployable <= 0}
                  onClick={() => setAttacking(country.id)}
                >
                  {attackable
                    ? `Invade ${country.name}`
                    : 'Not on your border'}
                </Button>
              </div>
            )}
          </Space>
        )}
      </Drawer>

      <AttackModal
        targetId={attacking}
        onClose={() => {
          setAttacking(null);
          onClose();
        }}
      />
    </>
  );
}
