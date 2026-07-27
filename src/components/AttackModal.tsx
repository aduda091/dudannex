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

  useEffect(() => {
    if (targetId) setShare(100);
  }, [targetId]);

  if (!targetId) return null;

  const commit = (derived.deployable * share) / 100;
  const f = forecast(state, targetId, commit);
  const stats = COUNTRY_STATS[targetId];
  const prize = stats ? baseProduction(stats) * CONQUEST_SHARE : 0;

  return (
    <Modal
      open
      title={`Invade ${countryName(targetId)}`}
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
          <Text type="secondary">Commit {share}% of your deployable army</Text>
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
