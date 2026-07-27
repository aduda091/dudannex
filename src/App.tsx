import { useState } from 'react';
import { Modal, Result, Tabs, Typography } from 'antd';
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
  const { state, derived, offlineGain, acknowledgeOffline } = useGame();
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
            <div className="brand-name">Dudannex</div>
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
            battleTargetId={
              state.battle?.outcome === 'ongoing' ? state.battle.targetId : null
            }
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

      <Modal open={won} footer={null} closable={false} width={520}>
        <Result
          status="success"
          title={<Title level={3}>The map is one colour</Title>}
          subTitle={`Every country on Earth answers to ${countryName(
            state.homeId,
          )}. It took ${fmtDuration((Date.now() - state.startedAt) / 1000)}, ${
            state.battlesWon
          } victories and ${state.techs.length} technologies.`}
        />
      </Modal>
    </div>
  );
}
