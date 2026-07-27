import { Progress, Space, Tooltip, Typography } from 'antd';
import {
  ExperimentOutlined,
  GlobalOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';
import { TOTAL_COUNTRIES, fmtCount, fmtPercent, fmtRate, fmtShort } from '../game/engine';
import { useGame } from '../state/GameProvider';

const { Text } = Typography;

function Readout({
  icon,
  label,
  value,
  sub,
  tip,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
  tip: string;
}) {
  return (
    <Tooltip title={tip}>
      <div className="readout">
        <span className="readout-icon">{icon}</span>
        <div>
          <div className="readout-label">{label}</div>
          <div className="readout-value">
            {value}
            {sub && <span className="readout-sub"> {sub}</span>}
          </div>
        </div>
      </div>
    </Tooltip>
  );
}

export function ResourceBar() {
  const { state, derived } = useGame();
  const armyPct = derived.armyCap > 0 ? (state.army / derived.armyCap) * 100 : 0;

  return (
    <div className="resource-bar">
      <Space size={4} split={<span className="readout-split" />} wrap>
        <Readout
          icon={<ToolOutlined />}
          label="Industry"
          value={fmtShort(state.industry)}
          sub={`+${fmtRate(derived.treasuryRate)}`}
          tip={`Total output ${fmtRate(derived.industryRate)}. ${fmtPercent(
            state.mobilization,
          )} of it is being spent on recruitment.`}
        />
        <Readout
          icon={<ExperimentOutlined />}
          label="Research"
          value={fmtShort(state.research)}
          sub={`+${fmtRate(derived.researchRate)}`}
          tip="Spent on technologies. Produced by your science base."
        />
        <Readout
          icon={<ThunderboltOutlined />}
          label="Deployable"
          value={fmtShort(derived.deployable)}
          sub={derived.garrison > 0.05 ? `+${fmtShort(derived.garrison)} held` : undefined}
          tip={
            `Standing army ${fmtShort(state.army)} of a possible ${fmtShort(derived.armyCap)}, ` +
            `recruiting ${fmtRate(derived.recruitRate)}. ` +
            (derived.garrison > 0.05
              ? `${fmtShort(derived.garrison)} troops are tied down policing territory that is not yet integrated — only the rest can attack.`
              : 'All of it can march.')
          }
        />
        <Readout
          icon={<TeamOutlined />}
          label="Population"
          value={`${fmtShort(derived.population)}M`}
          tip="Integration-weighted. Occupied territory only counts for part of its people."
        />
        <Readout
          icon={<GlobalOutlined />}
          label="Territory"
          value={fmtCount(derived.territories)}
          sub={`/ ${fmtCount(TOTAL_COUNTRIES)}`}
          tip="Countries under your control."
        />
      </Space>

      <div className="army-meter">
        <Text type="secondary" style={{ fontSize: 11 }}>
          Manpower
        </Text>
        <Progress
          percent={Math.min(100, armyPct)}
          showInfo={false}
          size="small"
          strokeColor={armyPct >= 99 ? '#d89614' : '#1668dc'}
        />
      </div>
    </div>
  );
}
