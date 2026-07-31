import { useState } from 'react';
import { Button, Modal, Popconfirm, Result, Space, Tabs, Typography } from 'antd';
import {
  BankOutlined,
  BuildOutlined,
  ExperimentOutlined,
  RocketOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { WorldMap, integrationBucket } from './components/WorldMap';
import { ResourceBar } from './components/ResourceBar';
import { EmpirePanel } from './components/EmpirePanel';
import { BuildPanel } from './components/BuildPanel';
import { ResearchPanel } from './components/ResearchPanel';
import { WarPanel } from './components/WarPanel';
import { SavePanel } from './components/SavePanel';
import { BattleModal } from './components/BattleModal';
import { CountryDrawer } from './components/CountryDrawer';
import { StartScreen } from './components/StartScreen';
import { countryName, fmtDuration, hasWon } from './game/engine';
import { useGame } from './state/GameProvider';

const { Text, Title } = Typography;

export function App() {
  const { state, derived, offlineGain, acknowledgeOffline, acknowledgeVictory, reset } =
    useGame();
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ id: string | null; nonce: number }>({
    id: null,
    nonce: 0,
  });
  const [tab, setTab] = useState('empire');

  /** Open a country's details and pan the map to it. */
  const focusCountry = (id: string) => {
    setSelected(id);
    setFocus((f) => ({ id, nonce: f.nonce + 1 }));
  };

  // Primitive props keep the 175-path map out of the 10Hz render loop. The
  // strings are rebuilt every frame — cheap at this size — but their *values*
  // only change when ownership or the frontier actually moves, so React.memo
  // skips the map. Memoising on `state.owned` would not work: it is mutated in
  // place, so its identity never changes.
  const ownedKey = Object.entries(state.owned)
    .map(([id, v]) => `${id}:${integrationBucket(v)}`)
    .sort()
    .join(',');
  const frontierKey = derived.frontier.slice().sort().join(',');

  if (!state.homeId) return <StartScreen />;

  const won = hasWon(state);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">◈</span>
          <div>
            <div className="brand-name">
              Dudannex
              {state.speed > 1 && (
                <span className="speed-badge">{state.speed}×</span>
              )}
            </div>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {countryName(state.homeId)}
            </Text>
          </div>
        </div>
        <ResourceBar />
      </header>

      <main className="workspace">
        <section className="map-pane">
          <WorldMap
            ownedKey={ownedKey}
            frontierKey={frontierKey}
            homeId={state.homeId}
            selectedId={selected}
            battleTargetKey={state.battles
              .filter((b) => b.outcome === 'ongoing')
              .map((b) => b.targetId)
              .sort()
              .join(',')}
            focusId={focus.id}
            focusNonce={focus.nonce}
            onSelect={setSelected}
          />
        </section>

        <aside className="side-pane">
          <Tabs
            activeKey={tab}
            onChange={setTab}
            size="small"
            items={[
              {
                key: 'empire',
                label: (
                  <span>
                    <BankOutlined /> Empire
                  </span>
                ),
                children: <EmpirePanel />,
              },
              {
                key: 'build',
                label: (
                  <span>
                    <BuildOutlined /> Build
                  </span>
                ),
                children: <BuildPanel />,
              },
              {
                key: 'research',
                label: (
                  <span>
                    <ExperimentOutlined /> Research
                  </span>
                ),
                children: <ResearchPanel />,
              },
              {
                key: 'war',
                label: (
                  <span>
                    <RocketOutlined /> War
                  </span>
                ),
                children: <WarPanel onFocusCountry={focusCountry} />,
              },
              {
                key: 'save',
                label: (
                  <span>
                    <SaveOutlined /> Save
                  </span>
                ),
                children: <SavePanel />,
              },
            ]}
          />
        </aside>
      </main>

      <BattleModal />
      <CountryDrawer countryId={selected} onClose={() => setSelected(null)} />

      <Modal
        open={offlineGain !== null}
        onOk={acknowledgeOffline}
        onCancel={acknowledgeOffline}
        footer={null}
        title="While you were away"
      >
        <Text>
          Your economy ran for {fmtDuration(offlineGain ?? 0)} without you. Industry,
          research and recruitment have all been credited.
        </Text>
      </Modal>

      {/* Winning used to be a dead end: a modal with no close, no footer and
          nothing clickable behind it. It is dismissible now, and offers a way
          out that is not "reload the page". */}
      <Modal
        open={won && !state.victorySeen}
        onCancel={acknowledgeVictory}
        footer={null}
        width={540}
      >
        <Result
          status="success"
          title={<Title level={3}>The map is one colour</Title>}
          subTitle={`Every country on Earth answers to ${countryName(
            state.homeId,
          )}. It took ${fmtDuration((Date.now() - state.startedAt) / 1000)}${
            state.speed > 1 ? ` of real time at ${state.speed}x` : ''
          }, ${state.battlesWon} victories, ${state.battlesLost} defeats and ${
            state.techs.length
          } technologies.`}
          extra={
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Space wrap>
                <Button type="primary" onClick={acknowledgeVictory}>
                  Look at the map
                </Button>
                <Popconfirm
                  title="Start a new game?"
                  description="This erases the current save. Export it from the Save tab first if you want to keep it."
                  okText="New game"
                  okButtonProps={{ danger: true }}
                  onConfirm={reset}
                >
                  <Button danger>Start a new game</Button>
                </Popconfirm>
              </Space>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Your finished run is still on the Save tab if you want to export
                it before starting over.
              </Text>
            </Space>
          }
        />
      </Modal>
    </div>
  );
}
