import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Player, InjuryPrediction } from '../store/useNBAStore';

interface InjuryRiskChartProps {
  players: Player[];
  predictions: Map<number, InjuryPrediction>;
}

export const InjuryRiskChart: React.FC<InjuryRiskChartProps> = ({ players, predictions }) => {
  const data = players.slice(0, 10).map(player => {
    const prediction = predictions.get(player.id);
    return {
      name: `${player.first_name} ${player.last_name.charAt(0)}.`,
      risk: prediction ? parseFloat((prediction.injury_risk * 100).toFixed(1)) : 0,
      level: prediction?.risk_level || 'Unknown'
    };
  });

  const getBarColor = (level: string) => {
    switch (level) {
      case 'High': return '#DC2626';
      case 'Medium': return '#F59E0B';
      case 'Low': return '#10B981';
      default: return '#6B7280';
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 shadow-lg rounded border">
          <p className="font-semibold">{label}</p>
          <p className="text-sm">Risk: {payload[0].value}%</p>
          <p className="text-sm">Level: {payload[0].payload.level}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Injury Risk Analysis</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
          <YAxis label={{ value: 'Risk %', angle: -90, position: 'insideLeft' }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar dataKey="risk" name="Injury Risk %">
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.level)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};