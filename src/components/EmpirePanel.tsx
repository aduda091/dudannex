import { Card, Col, Divider, List, Progress, Row, Slider, Statistic, Tag, Typography } from 'antd';
import { COUNTRY_STATS, baseProduction } from '../data/countryStats';
import { countryName, fmtDuration, fmtRate, fmtShort } from '../game/engine';
import { useGame } from '../state/GameProvider';

const { Text, Paragraph } = Typography;

const LOG_COLOR: Record<string, string> = {
  war: 'red',
  build: 'blue',
  tech: 'cyan',
  system: 'default',
};

export function EmpirePanel() {
  const { state, derived, setMobilization } = useGame();

  const territories = Object.entries(state.owned)
    .map(([id, integration]) => ({
      id,
      integration,
      output: baseProduction(COUNTRY_STATS[id]) * integration,
    }))
    .sort((a, b) => b.output - a.output);

  const partial = territories.filter((t) => t.integration < 1).length;
  const uptime = (Date.now() - state.startedAt) / 1000;

  return (
    <div className="panel">
      <Card size="small" title="War economy">
        <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 0 }}>
          Split your industrial output between the treasury, which pays for
          buildings, and recruitment, which turns output into soldiers.
        </Paragraph>
        <Slider
          min={0}
          max={100}
          value={Math.round(state.mobilization * 100)}
          onChange={(v) => setMobilization(v / 100)}
          marks={{ 0: 'Build', 50: '', 100: 'Recruit' }}
          tooltip={{ formatter: (v) => `${v}% to recruitment` }}
        />
        <Row gutter={12} style={{ marginTop: 4 }}>
          <Col span={8}>
            <Statistic
              title="To treasury"
              value={fmtRate(derived.treasuryRate)}
              valueStyle={{ fontSize: 15 }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="To recruitment"
              value={fmtRate(derived.recruitRate)}
              valueStyle={{ fontSize: 15 }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="Army cap"
              value={fmtShort(derived.armyCap)}
              valueStyle={{ fontSize: 15 }}
            />
          </Col>
        </Row>
        {state.army >= derived.armyCap - 0.01 && state.mobilization > 0 && (
          <Text type="warning" style={{ fontSize: 12 }}>
            Army is at its manpower ceiling — recruitment spending is falling
            back to the treasury. Build Conscription Bureaus or take more land.
          </Text>
        )}
      </Card>

      <Card size="small" title="Standing" style={{ marginTop: 12 }}>
        <Row gutter={[12, 12]}>
          <Col span={8}>
            <Statistic
              title="Total industry"
              value={fmtRate(derived.industryRate)}
              valueStyle={{ fontSize: 15 }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="Attack strength"
              value={`×${derived.attackMultiplier.toFixed(2)}`}
              valueStyle={{ fontSize: 15 }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="Battles"
              value={`${state.battlesWon}W / ${state.battlesLost}L`}
              valueStyle={{ fontSize: 15 }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="Technologies"
              value={state.techs.length}
              valueStyle={{ fontSize: 15 }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="Integrating"
              value={partial}
              valueStyle={{ fontSize: 15 }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="Time played"
              value={fmtDuration(uptime)}
              valueStyle={{ fontSize: 15 }}
            />
          </Col>
        </Row>
      </Card>

      <Divider plain style={{ margin: '16px 0 8px' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Territories ({territories.length})
        </Text>
      </Divider>
      <List
        size="small"
        dataSource={territories.slice(0, 40)}
        renderItem={(t) => (
          <List.Item>
            <div style={{ width: '100%' }}>
              <div className="battle-row">
                <Text>
                  {countryName(t.id)}
                  {t.id === state.homeId && (
                    <Tag color="gold" bordered={false} style={{ marginLeft: 6 }}>
                      home
                    </Tag>
                  )}
                </Text>
                <Text type="secondary">{fmtRate(t.output)}</Text>
              </div>
              {t.integration < 1 && (
                <Progress
                  percent={t.integration * 100}
                  showInfo={false}
                  size="small"
                  strokeColor="#d89614"
                />
              )}
            </div>
          </List.Item>
        )}
      />
      {territories.length > 40 && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          …and {territories.length - 40} more.
        </Text>
      )}

      <Divider plain style={{ margin: '16px 0 8px' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Dispatches
        </Text>
      </Divider>
      <List
        size="small"
        dataSource={state.log.slice(0, 25)}
        locale={{ emptyText: 'Nothing has happened yet.' }}
        renderItem={(entry) => (
          <List.Item>
            <Tag color={LOG_COLOR[entry.kind]} bordered={false}>
              {entry.kind}
            </Tag>
            <Text style={{ fontSize: 12, flex: 1 }}>{entry.text}</Text>
          </List.Item>
        )}
      />
    </div>
  );
}
