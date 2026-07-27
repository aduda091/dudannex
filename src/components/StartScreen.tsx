import { useMemo, useState } from 'react';
import { Button, Card, Col, Modal, Row, Select, Statistic, Typography } from 'antd';
import { FlagOutlined } from '@ant-design/icons';
import { COUNTRY_STATS, baseMilitary, baseProduction, baseResearch } from '../data/countryStats';
import { WORLD, fmtRate, fmtShort } from '../game/engine';
import { useGame } from '../state/GameProvider';

const { Paragraph, Title, Text } = Typography;

/** A few starts that produce noticeably different opening games. */
const SUGGESTED = [
  { id: '191', note: 'A small industrial state in a crowded neighbourhood.' },
  { id: '752', note: 'Rich, educated, and short of soldiers.' },
  { id: '408', note: 'Enormous army, almost no economy to feed it.' },
  { id: '076', note: 'A continent to itself and room to grow.' },
];

export function StartScreen() {
  const { start } = useGame();
  const [choice, setChoice] = useState<string>('191');

  const options = useMemo(
    () =>
      [...WORLD.countries]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => ({ value: c.id, label: c.name })),
    [],
  );

  const stats = COUNTRY_STATS[choice];
  const country = WORLD.countries.find((c) => c.id === choice);

  return (
    <Modal
      open
      closable={false}
      maskClosable={false}
      footer={null}
      width={640}
      centered
      title={
        <span>
          <FlagOutlined /> Choose a country
        </span>
      }
    >
      <Paragraph type="secondary" style={{ marginTop: 0 }}>
        You start with one nation's real population, economy and armed forces.
        Everyone else stands still — for now. Build, research, and take the map.
      </Paragraph>

      <Select
        showSearch
        value={choice}
        onChange={setChoice}
        options={options}
        optionFilterProp="label"
        style={{ width: '100%' }}
        size="large"
      />

      {stats && country && (
        <Card size="small" style={{ marginTop: 16 }}>
          <Title level={5} style={{ marginTop: 0 }}>
            {country.name}
          </Title>
          <Row gutter={16}>
            <Col span={6}>
              <Statistic title="Population" value={`${fmtShort(stats.pop)}M`} />
            </Col>
            <Col span={6}>
              <Statistic title="Industry" value={fmtRate(baseProduction(stats))} />
            </Col>
            <Col span={6}>
              <Statistic title="Research" value={fmtRate(baseResearch(stats))} />
            </Col>
            <Col span={6}>
              <Statistic title="Army" value={fmtShort(baseMilitary(stats))} />
            </Col>
          </Row>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Borders {country.neighbors.length}{' '}
            {country.neighbors.length === 1 ? 'country' : 'countries'}:{' '}
            {country.neighbors
              .map((n) => WORLD.countries.find((c) => c.id === n)?.name)
              .filter(Boolean)
              .join(', ')}
          </Text>
        </Card>
      )}

      <div style={{ marginTop: 16 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Suggested starts
        </Text>
        <Row gutter={[8, 8]} style={{ marginTop: 8 }}>
          {SUGGESTED.map((s) => {
            const name = WORLD.countries.find((c) => c.id === s.id)?.name;
            return (
              <Col span={12} key={s.id}>
                <Card
                  size="small"
                  hoverable
                  onClick={() => setChoice(s.id)}
                  style={{
                    borderColor: choice === s.id ? '#1668dc' : undefined,
                  }}
                >
                  <Text strong>{name}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {s.note}
                  </Text>
                </Card>
              </Col>
            );
          })}
        </Row>
      </div>

      <Button
        type="primary"
        size="large"
        block
        style={{ marginTop: 20 }}
        onClick={() => start(choice)}
      >
        Take command of {country?.name}
      </Button>
    </Modal>
  );
}
