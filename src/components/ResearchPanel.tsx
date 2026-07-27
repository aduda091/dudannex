import { Button, Card, Divider, Space, Tag, Tooltip, Typography } from 'antd';
import { CheckCircleFilled, LockOutlined } from '@ant-design/icons';
import { BUILDING_BY_ID, CATEGORY_LABEL, TECHS, TECH_BY_ID } from '../game/content';
import { fmtDuration, fmtShort, isTechAvailable, timeTo } from '../game/engine';
import { useGame } from '../state/GameProvider';
import { EffectTags } from './EffectTags';

const { Text, Paragraph } = Typography;

const CATEGORY_COLOR: Record<string, string> = {
  industry: 'gold',
  science: 'cyan',
  military: 'red',
  civic: 'purple',
};

export function ResearchPanel() {
  const { state, derived, research } = useGame();

  const done = TECHS.filter((t) => state.techs.includes(t.id));
  const available = TECHS.filter((t) => isTechAvailable(state, t.id));
  const locked = TECHS.filter(
    (t) => !state.techs.includes(t.id) && !isTechAvailable(state, t.id),
  );

  return (
    <div className="panel">
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        {available.map((t) => {
          const affordable = state.research >= t.cost;
          const wait = timeTo(state.research, t.cost, derived.researchRate);
          return (
            <Card key={t.id} size="small" className="item-card">
              <div className="item-head">
                <Space size={6}>
                  <Text strong>{t.name}</Text>
                  <Tag color={CATEGORY_COLOR[t.category]} bordered={false}>
                    {CATEGORY_LABEL[t.category]}
                  </Tag>
                </Space>
                <Tooltip
                  title={affordable ? 'Research now' : `Ready in ${fmtDuration(wait)}`}
                >
                  <Button
                    size="small"
                    type={affordable ? 'primary' : 'default'}
                    disabled={!affordable}
                    onClick={() => research(t.id)}
                  >
                    {fmtShort(t.cost)} RP
                  </Button>
                </Tooltip>
              </div>
              <Paragraph type="secondary" style={{ fontSize: 12, margin: '4px 0 6px' }}>
                {t.blurb}
              </Paragraph>
              <EffectTags effects={t.effects} />
              {t.unlocks && t.unlocks.length > 0 && (
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Unlocks{' '}
                  {t.unlocks.map((u) => BUILDING_BY_ID.get(u)?.name ?? u).join(', ')}
                </Text>
              )}
            </Card>
          );
        })}

        {available.length === 0 && locked.length > 0 && (
          <Text type="secondary">Nothing researchable — finish a prerequisite first.</Text>
        )}

        {locked.length > 0 && (
          <>
            <Divider plain style={{ margin: '8px 0' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Locked
              </Text>
            </Divider>
            {locked.map((t) => (
              <Card key={t.id} size="small" className="locked-card">
                <Space align="start">
                  <LockOutlined />
                  <div>
                    <Text type="secondary">{t.name}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      Needs{' '}
                      {t.requires
                        .filter((r) => !state.techs.includes(r))
                        .map((r) => TECH_BY_ID.get(r)?.name ?? r)
                        .join(' + ')}
                    </Text>
                  </div>
                </Space>
              </Card>
            ))}
          </>
        )}

        {done.length > 0 && (
          <>
            <Divider plain style={{ margin: '8px 0' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Researched ({done.length})
              </Text>
            </Divider>
            <div>
              {done.map((t) => (
                <Tooltip key={t.id} title={t.blurb}>
                  <Tag
                    icon={<CheckCircleFilled />}
                    color="success"
                    bordered={false}
                    style={{ marginBottom: 4 }}
                  >
                    {t.name}
                  </Tag>
                </Tooltip>
              ))}
            </div>
          </>
        )}
      </Space>
    </div>
  );
}
