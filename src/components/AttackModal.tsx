import { useEffect, useState } from 'react';
import { Alert, Descriptions, Modal, Slider, Space, Typography } from 'antd';
import { COUNTRY_STATS, baseProduction } from '../data/countryStats';
import {
  CONQUEST_SHARE,
  DEFENDER_BONUS,
  countryName,
  fmtDuration,
  fmtShort,
  forecast,
} from '../game/engine';
import { useGame } from '../state/GameProvider';
import { Flag } from './Flag';

const { Text } = Typography;

/** Commit-your-forces dialog, with an honest forecast of the result. */
export function AttackModal({
  targetId,
  onClose,
}: {
  targetId: string | null;
  onClose: () => void;
}) {
  const { state, derived, declareWar } = useGame();
  const [share, setShare] = useState(100);

  // Default to a comfortable winning margin rather than the whole army —
  // sending everything at one neighbour is what stops you opening a second
  // front, and it is almost never what you want even with only one.
  useEffect(() => {
    if (!targetId) return;
    const pool = derived.deployable;
    if (pool <= 0) {
      setShare(100);
      return;
    }
    const needed = forecast(state, targetId, pool).required * 1.5;
    const pct = Math.ceil((needed / pool) * 100);
    setShare(Math.max(5, Math.min(100, pct)));
    // Recomputed only when the target changes; the slider is yours after that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId]);

  if (!targetId) return null;

  const commit = (derived.deployable * share) / 100;
  const f = forecast(state, targetId, commit);
  const stats = COUNTRY_STATS[targetId];
  const prize = stats ? baseProduction(stats) * CONQUEST_SHARE : 0;

  return (
    <Modal
      open
      title={
        <Space size={8}>
          <Flag countryId={targetId} height={18} />
          {`Invade ${countryName(targetId)}`}
        </Space>
      }
      okText={f.win ? 'Give the order' : 'Attack anyway'}
      okButtonProps={{ danger: !f.win, disabled: commit <= 0 }}
      onOk={() => {
        declareWar(targetId, commit);
        onClose();
      }}
      onCancel={onClose}
      width={520}
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <div>
          <Text type="secondary">
            Commit {share}% of your deployable army — {fmtShort(commit)} of{' '}
            {fmtShort(derived.deployable)}
            {derived.maxFronts > 1 && (
              <>
                {' · '}
                {derived.maxFronts - derived.activeFronts} front
                {derived.maxFronts - derived.activeFronts === 1 ? '' : 's'} free
              </>
            )}
          </Text>
          <Slider
            min={5}
            max={100}
            value={share}
            onChange={setShare}
            marks={{ 25: '25%', 50: '50%', 75: '75%', 100: 'All' }}
            tooltip={{ formatter: (v) => fmtShort((derived.deployable * (v ?? 0)) / 100) }}
          />
        </div>

        <Descriptions size="small" column={2} bordered>
          <Descriptions.Item label="Your force">{fmtShort(commit)}</Descriptions.Item>
          <Descriptions.Item label="Defenders">{fmtShort(f.defender)}</Descriptions.Item>
          <Descriptions.Item label="Defender bonus">
            ×{DEFENDER_BONUS.toFixed(2)}
          </Descriptions.Item>
          <Descriptions.Item label="Minimum to win">
            {fmtShort(f.required)}
          </Descriptions.Item>
          <Descriptions.Item label="Expected survivors">
            {fmtShort(f.survivors)}
          </Descriptions.Item>
          <Descriptions.Item label="Estimated duration">
            {fmtDuration(f.duration)}
          </Descriptions.Item>
        </Descriptions>

        {f.win ? (
          <Alert
            type="success"
            showIcon
            message="Projected victory"
            description={`Annexing ${countryName(targetId)} adds ${fmtShort(
              prize,
            )} industry/s immediately, rising as the territory integrates.`}
          />
        ) : (
          <Alert
            type="error"
            showIcon
            message="Projected defeat"
            description={`You need about ${fmtShort(
              f.required,
            )} to break them. Everything you commit will be lost — though the enemy will be weakened for a second attempt.`}
          />
        )}

        <Text type="secondary" style={{ fontSize: 12 }}>
          Troops you hold back keep garrisoning at home and can reinforce a later
          push. You can order a withdrawal at any point during the battle.
        </Text>
      </Space>
    </Modal>
  );
}
