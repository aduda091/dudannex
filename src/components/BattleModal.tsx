import { Alert, Button, Modal, Progress, Space, Tag, Typography } from 'antd';
import { CONQUEST_SHARE, fmtPercent, fmtShort } from '../game/engine';
import { useGame } from '../state/GameProvider';
import { Flag } from './Flag';
import type { Battle } from '../game/types';

const { Text } = Typography;

/** Two force-strength curves drawn straight from the battle history. */
function BattleGraph({ battle }: { battle: Battle }) {
  const { samples } = battle;
  const peak = Math.max(battle.attackerStart, battle.defenderStart, 1);
  const span = Math.max(samples[samples.length - 1]?.t ?? 1, 1);
  const W = 460;
  const H = 64;

  const line = (pick: (s: (typeof samples)[number]) => number) =>
    samples
      .map((s, i) => {
        const x = (s.t / span) * W;
        const y = H - (pick(s) / peak) * H;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="battle-graph" preserveAspectRatio="none">
      <path d={line((s) => s.attacker)} stroke="#1668dc" fill="none" strokeWidth={2} />
      <path d={line((s) => s.defender)} stroke="#dc4446" fill="none" strokeWidth={2} />
    </svg>
  );
}

const OUTCOME: Record<
  Battle['outcome'],
  { label: string; color: string; note: (b: Battle) => string }
> = {
  ongoing: { label: 'In progress', color: 'processing', note: () => '' },
  won: {
    label: 'Annexed',
    color: 'success',
    note: (b) =>
      `${fmtShort(b.attacker)} march home. The territory contributes ${fmtPercent(
        CONQUEST_SHARE,
      )} of its economy today and more as it integrates.`,
  },
  lost: {
    label: 'Destroyed',
    color: 'error',
    note: (b) =>
      `${b.targetName} holds with ${fmtShort(
        b.defender,
      )} troops left. They will not recover those losses for free — try again with more.`,
  },
  retreat: {
    label: 'Withdrawn',
    color: 'warning',
    note: (b) =>
      `${fmtShort(b.attacker)} brought home. ${b.targetName} is left holding ${fmtShort(
        b.defender,
      )}.`,
  },
};

function Front({ battle }: { battle: Battle }) {
  const { retreat } = useGame();
  const ongoing = battle.outcome === 'ongoing';
  const attackerPct = (battle.attacker / battle.attackerStart) * 100;
  const defenderPct = (battle.defender / battle.defenderStart) * 100;
  const meta = OUTCOME[battle.outcome];

  return (
    <div className={`front${ongoing ? '' : ' front-done'}`}>
      <div className="battle-row">
        <Space size={8}>
          <Flag countryId={battle.targetId} height={14} />
          <Text strong>{battle.targetName}</Text>
          <Tag color={meta.color} bordered={false}>
            {meta.label}
          </Tag>
        </Space>
        {ongoing && (
          <Button size="small" danger onClick={() => retreat(battle.targetId)}>
            Withdraw
          </Button>
        )}
      </div>

      <div className="front-bars">
        <div>
          <div className="battle-row">
            <Text style={{ fontSize: 12, color: '#69b1ff' }}>Your forces</Text>
            <Text style={{ fontSize: 12 }}>
              {fmtShort(battle.attacker)}{' '}
              <Text type="secondary">/ {fmtShort(battle.attackerStart)}</Text>
            </Text>
          </div>
          <Progress
            percent={Math.max(0, attackerPct)}
            showInfo={false}
            size="small"
            strokeColor="#1668dc"
            status={ongoing ? 'active' : 'normal'}
          />
        </div>
        <div>
          <div className="battle-row">
            <Text style={{ fontSize: 12, color: '#ff7875' }}>Defenders</Text>
            <Text style={{ fontSize: 12 }}>
              {fmtShort(battle.defender)}{' '}
              <Text type="secondary">/ {fmtShort(battle.defenderStart)}</Text>
            </Text>
          </div>
          <Progress
            percent={Math.max(0, defenderPct)}
            showInfo={false}
            size="small"
            strokeColor="#dc4446"
          />
        </div>
        <div>
          <div className="battle-row">
            <Text type="secondary" style={{ fontSize: 12 }}>
              Ground covered
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {battle.elapsed.toFixed(2)}s / {battle.length.toFixed(2)}s
            </Text>
          </div>
          <Progress
            percent={Math.min(100, (battle.elapsed / battle.length) * 100)}
            showInfo={false}
            size="small"
            strokeColor="#d89614"
          />
        </div>
      </div>

      {ongoing ? (
        <BattleGraph battle={battle} />
      ) : (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {meta.note(battle)}
        </Text>
      )}
    </div>
  );
}

export function BattleModal() {
  const { state, derived, dismissBattles, warRoomOpen, setWarRoomOpen } = useGame();
  if (state.battles.length === 0 || !warRoomOpen) return null;

  const ongoing = state.battles.filter((b) => b.outcome === 'ongoing');
  const finished = state.battles.filter((b) => b.outcome !== 'ongoing');
  const allDone = ongoing.length === 0;

  const title = allDone
    ? finished.length === 1
      ? `${finished[0].targetName}: ${OUTCOME[finished[0].outcome].label.toLowerCase()}`
      : `${finished.length} campaigns concluded`
    : `War room — ${ongoing.length} of ${derived.maxFronts} front${
        derived.maxFronts === 1 ? '' : 's'
      } engaged`;

  const committed = ongoing.reduce((s, b) => s + b.attacker, 0);

  return (
    <Modal
      open
      title={title}
      // Always dismissible: with several fronts running you need to get back to
      // the war panel to open the next one.
      closable
      maskClosable
      onCancel={() => {
        if (allDone) dismissBattles();
        setWarRoomOpen(false);
      }}
      width={600}
      footer={
        <Space>
          {finished.length > 0 && (
            <Button type={allDone ? 'primary' : 'default'} onClick={dismissBattles}>
              {allDone ? 'Continue' : `Clear ${finished.length} finished`}
            </Button>
          )}
          {!allDone && (
            <Button onClick={() => setWarRoomOpen(false)}>
              Back to the map
            </Button>
          )}
        </Space>
      }
    >
      {ongoing.length > 1 && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message={`${fmtShort(committed)} troops committed across ${ongoing.length} fronts`}
          description="Each front fights independently. Losing one does not affect the others."
        />
      )}
      <div className="front-list">
        {[...ongoing, ...finished].map((b) => (
          <Front key={b.targetId} battle={b} />
        ))}
      </div>
    </Modal>
  );
}
