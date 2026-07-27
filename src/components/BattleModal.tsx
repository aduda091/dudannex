import { Button, Modal, Progress, Result, Space, Statistic, Typography } from 'antd';
import { CONQUEST_SHARE, fmtPercent, fmtShort } from '../game/engine';
import { useGame } from '../state/GameProvider';
import type { Battle } from '../game/types';

const { Text } = Typography;

/** Two force-strength curves drawn straight from the battle history. */
function BattleGraph({ battle }: { battle: Battle }) {
  const { samples } = battle;
  const peak = Math.max(battle.attackerStart, battle.defenderStart, 1);
  const span = Math.max(samples[samples.length - 1]?.t ?? 1, 1);
  const W = 460;
  const H = 90;

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

export function BattleModal() {
  const { state, retreat, dismissBattle } = useGame();
  const battle = state.battle;
  if (!battle) return null;

  const ongoing = battle.outcome === 'ongoing';
  const attackerPct = (battle.attacker / battle.attackerStart) * 100;
  const defenderPct = (battle.defender / battle.defenderStart) * 100;

  const title =
    battle.outcome === 'won'
      ? `${battle.targetName} has fallen`
      : battle.outcome === 'lost'
        ? `Defeat in ${battle.targetName}`
        : battle.outcome === 'retreat'
          ? `Withdrawal from ${battle.targetName}`
          : `The battle for ${battle.targetName}`;

  return (
    <Modal
      open
      title={title}
      closable={!ongoing}
      maskClosable={false}
      onCancel={dismissBattle}
      width={560}
      footer={
        ongoing ? (
          <Button danger onClick={retreat}>
            Order withdrawal
          </Button>
        ) : (
          <Button type="primary" onClick={dismissBattle}>
            Continue
          </Button>
        )
      }
    >
      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        <div>
          <div className="battle-row">
            <Text strong style={{ color: '#69b1ff' }}>
              Your forces
            </Text>
            <Text>
              {fmtShort(battle.attacker)}{' '}
              <Text type="secondary">/ {fmtShort(battle.attackerStart)}</Text>
            </Text>
          </div>
          <Progress
            percent={Math.max(0, attackerPct)}
            showInfo={false}
            strokeColor="#1668dc"
            status={ongoing ? 'active' : 'normal'}
          />
        </div>

        <div>
          <div className="battle-row">
            <Text strong style={{ color: '#ff7875' }}>
              {battle.targetName}
            </Text>
            <Text>
              {fmtShort(battle.defender)}{' '}
              <Text type="secondary">/ {fmtShort(battle.defenderStart)}</Text>
            </Text>
          </div>
          <Progress
            percent={Math.max(0, defenderPct)}
            showInfo={false}
            strokeColor="#dc4446"
            status={ongoing ? 'active' : 'normal'}
          />
        </div>

        <div>
          <div className="battle-row">
            <Text type="secondary" style={{ fontSize: 12 }}>
              Campaign progress
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {battle.elapsed.toFixed(2)}s / {battle.length.toFixed(2)}s to cover the
              ground
            </Text>
          </div>
          <Progress
            percent={Math.min(100, (battle.elapsed / battle.length) * 100)}
            showInfo={false}
            size="small"
            strokeColor="#d89614"
          />
        </div>

        <BattleGraph battle={battle} />

        <Space size={32}>
          <Statistic
            title="Elapsed"
            value={`${battle.elapsed.toFixed(2)}s`}
            valueStyle={{ fontSize: 15 }}
          />
          <Statistic
            title="Your losses"
            value={fmtShort(battle.attackerStart - battle.attacker)}
            valueStyle={{ fontSize: 15 }}
          />
          <Statistic
            title="Enemy losses"
            value={fmtShort(battle.defenderStart - battle.defender)}
            valueStyle={{ fontSize: 15 }}
          />
        </Space>

        {battle.outcome === 'won' && (
          <Result
            status="success"
            style={{ padding: '8px 0' }}
            title={`${battle.targetName} annexed`}
            subTitle={`${fmtShort(battle.attacker)} troops march home. The territory
              contributes ${fmtPercent(CONQUEST_SHARE)} of its economy today
              and more as it integrates.`}
          />
        )}
        {battle.outcome === 'lost' && (
          <Result
            status="error"
            style={{ padding: '8px 0' }}
            title="The offensive is destroyed"
            subTitle={`${battle.targetName} holds with ${fmtShort(
              battle.defender,
            )} troops left. They will not recover those losses — try again with more.`}
          />
        )}
        {battle.outcome === 'retreat' && (
          <Result
            status="warning"
            style={{ padding: '8px 0' }}
            title="Forces withdrawn"
            subTitle={`${fmtShort(battle.attacker)} brought home. ${
              battle.targetName
            } is left holding ${fmtShort(battle.defender)}.`}
          />
        )}
      </Space>
    </Modal>
  );
}
