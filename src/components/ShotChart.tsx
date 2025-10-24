import React from 'react';

interface Shot {
  LOC_X: number;
  LOC_Y: number;
  SHOT_DISTANCE: number;
  ACTION_TYPE: string;
  SHOT_TYPE: string;
  EVENT_TYPE?: 'made' | 'missed' | 'block' | 'pass' | 'possession';
  made?: boolean; // legacy flag
}

interface ShotChartProps {
  shots: Shot[];
  width?: number;
  height?: number;
}

// Court dimensions in nba_api coords: x -250..250, y 0..470
const xScale = (x: number, w: number) => ((x + 250) / 500) * w;
const yScale = (y: number, h: number) => (1 - y / 470) * h; // invert

export const ShotChart: React.FC<ShotChartProps> = ({ shots, width = 500, height = 470 }) => {
  const courtImg = '/shot_court.jpg';
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <img src={courtImg} alt="court" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: 'absolute', top: 0, left: 0 }}
        width="100%"
        height="100%"
      >
        {shots.map((s, idx) => {
          const type: string = s.EVENT_TYPE || (s.made ? 'made' : 'missed');
          const colorMap: Record<string, string> = {
            made: '#10B981',
            missed: '#EF4444',
            block: '#8B5CF6',
            pass: '#3B82F6',
            possession: '#FBBF24',
          };
          return (
            <circle
              key={idx}
              cx={xScale(s.LOC_X, width)}
              cy={yScale(s.LOC_Y, height)}
              r={4}
              fill={colorMap[type] || '#8884d8'}
              opacity={0.8}
            >
              <title>
                {`${s.SHOT_DISTANCE} ft – ${s.ACTION_TYPE} (${s.SHOT_TYPE}) – ${type}`}
              </title>
            </circle>
          );
        })}
      </svg>
    </div>
  );
};
