import React from 'react';
import { TrendingUp, TrendingDown, Users, Activity, AlertCircle, Shield } from 'lucide-react';
import { Player, InjuryPrediction } from '../store/useNBAStore';

interface StatsOverviewProps {
  players: Player[];
  predictions: Map<number, InjuryPrediction>;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ players, predictions }) => {
  const activePlayers = players.filter(p => p.is_active).length;
  
  const riskStats = {
    high: 0,
    medium: 0,
    low: 0,
    total: predictions.size
  };

  predictions.forEach(pred => {
    switch (pred.risk_level) {
      case 'High': riskStats.high++; break;
      case 'Medium': riskStats.medium++; break;
      case 'Low': riskStats.low++; break;
    }
  });

  const avgRisk = predictions.size > 0
    ? Array.from(predictions.values()).reduce((sum, pred) => sum + pred.injury_risk, 0) / predictions.size
    : 0;

  const stats = [
    {
      title: 'Active Players',
      value: activePlayers,
      icon: Users,
      color: 'blue',
      trend: '+12',
      trendUp: true
    },
    {
      title: 'Players Analyzed',
      value: predictions.size,
      icon: Activity,
      color: 'purple',
      trend: `${((predictions.size / activePlayers) * 100).toFixed(0)}%`,
      trendUp: true
    },
    {
      title: 'High Risk Players',
      value: riskStats.high,
      icon: AlertCircle,
      color: 'red',
      trend: riskStats.high > 5 ? 'Concerning' : 'Stable',
      trendUp: false
    },
    {
      title: 'Average Risk Score',
      value: `${(avgRisk * 100).toFixed(1)}%`,
      icon: Shield,
      color: avgRisk > 0.5 ? 'yellow' : 'green',
      trend: avgRisk > 0.5 ? 'Monitor' : 'Good',
      trendUp: avgRisk <= 0.5
    }
  ];

  const getColorClasses = (color: string) => {
    const colors: Record<string, string> = {
      blue: 'bg-blue-100 text-blue-600',
      purple: 'bg-purple-100 text-purple-600',
      red: 'bg-red-100 text-red-600',
      yellow: 'bg-yellow-100 text-yellow-600',
      green: 'bg-green-100 text-green-600'
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <div key={index} className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-xl shadow hover:shadow-lg ring-1 ring-slate-100 hover:ring-accent/40 transition transform hover:-translate-y-0.5 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className={`p-3 rounded-full bg-opacity-20 ${getColorClasses(stat.color)} backdrop-blur-sm`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div className="flex items-center space-x-1 text-sm">
              {stat.trendUp ? (
                <TrendingUp className="w-4 h-4 text-green-500" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-500" />
              )}
              <span className={stat.trendUp ? 'text-green-600' : 'text-red-600'}>
                {stat.trend}
              </span>
            </div>
          </div>
          <h3 className="text-gray-600 text-sm font-medium">{stat.title}</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
        </div>
      ))}
    </div>
  );
};
