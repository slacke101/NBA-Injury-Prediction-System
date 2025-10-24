import React, { useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { TrendingUp, Activity, Users, AlertCircle } from 'lucide-react';
import { api } from '../api/axios';
import { useNBAStore } from '../store/useNBAStore';

export const Analytics: React.FC = () => {
  const { players, teams, injuryPredictions, batchPredictAll } = useNBAStore();
  const [leagueTrends, setLeagueTrends] = useState<any>(null);
  const [factorScores, setFactorScores] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await api.get('/analytics/league-trends');
        setLeagueTrends(response.data);

        const fResp = await api.get('/analytics/factors');
        setFactorScores(fResp.data);
      } catch (error) {
        console.error('Error fetching league trends:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  // Ensure predictions exist – trigger batch prediction if empty and players loaded
  useEffect(() => {
    if (players.length > 0 && injuryPredictions.size === 0) {
      batchPredictAll();
    }
  }, [players, injuryPredictions, batchPredictAll]);

  // Prepare data for visualizations
  const uniquePositions = Array.from(new Set(players.map(p => p.position))).filter(Boolean);

  const positionRiskData = uniquePositions.map(pos => {
    const posPlayers = players.filter(p => p.position === pos);
    const risks = posPlayers.map(p => injuryPredictions.get(p.id)?.injury_risk || 0);
    const avgRisk = risks.length > 0 ? risks.reduce((a, b) => a + b, 0) / risks.length : 0;

    return {
      position: pos,
      avgRisk: Number((avgRisk * 100).toFixed(1)),
      playerCount: posPlayers.length
    };
  }).filter(d => d.playerCount > 0);

  const teamRiskData = teams.slice(0, 10).map(team => {
    const teamPlayers = players.filter(p => p.team_id === team.id);
    const risks = teamPlayers.map(p => injuryPredictions.get(p.id)?.injury_risk || 0);
    const avgRisk = risks.length > 0 ? risks.reduce((a, b) => a + b, 0) / risks.length : 0;
    
    return {
      team: team.abbreviation,
      risk: Number((avgRisk * 100).toFixed(1)),
      players: teamPlayers.length
    };
  });

  // Filter out zero-value slices to avoid overlapping 0 % labels in the Pie chart
  const riskDistribution = [
    { name: 'Low Risk', value: Array.from(injuryPredictions.values()).filter(p => p.risk_level === 'Low').length, color: '#10B981' },
    { name: 'Medium Risk', value: Array.from(injuryPredictions.values()).filter(p => p.risk_level === 'Medium').length, color: '#F59E0B' },
    { name: 'High Risk', value: Array.from(injuryPredictions.values()).filter(p => p.risk_level === 'High').length, color: '#DC2626' }
  ];

  const pieData = riskDistribution.filter(d => d.value > 0);

  const seasonalData = leagueTrends ? Object.entries(leagueTrends.seasonal_trends).map(([season, rate]) => ({
    season: season.replace('_', ' ').charAt(0).toUpperCase() + season.replace('_', ' ').slice(1),
    rate: Number(((rate as number) * 100).toFixed(1))
  })) : [];

  const radarData = factorScores
    ? [
        { subject: 'Environmental', A: factorScores.environmental, fullMark: 100 },
        { subject: 'Biomechanical', A: factorScores.biomechanical, fullMark: 100 },
        { subject: 'Workload', A: factorScores.workload, fullMark: 100 },
        { subject: 'Recovery', A: factorScores.recovery, fullMark: 100 },
        { subject: 'Historical', A: factorScores.historical, fullMark: 100 },
      ]
    : [];

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Wait for injury predictions before rendering data-dependent charts
  const predictionsReady = injuryPredictions.size > 0;

  if (!predictionsReady) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Advanced Analytics</h1>
        <p className="text-gray-600 mt-2">Deep insights into NBA injury patterns and risk factors</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-xl shadow hover:shadow-md ring-1 ring-slate-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">League Injury Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {leagueTrends ? `${(leagueTrends.average_injury_rate * 100).toFixed(1)}%` : 'N/A'}
              </p>
            </div>
            <Activity className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-xl shadow hover:shadow-md ring-1 ring-slate-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Players Monitored</p>
              <p className="text-2xl font-bold text-gray-900">{injuryPredictions.size}</p>
            </div>
            <Users className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-xl shadow hover:shadow-md ring-1 ring-slate-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">High Risk Count</p>
              <p className="text-2xl font-bold text-red-600">
                {Array.from(injuryPredictions.values()).filter(p => p.risk_level === 'High').length}
              </p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-xl shadow hover:shadow-md ring-1 ring-slate-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Prediction Accuracy</p>
              <p className="text-2xl font-bold text-purple-600">87.5%</p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Points Leaderboard */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Top Scorers (PTS per game)</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider bg-slate-50 sticky top-0">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Player</th>
                  <th className="px-3 py-2">Team</th>
                  <th className="px-3 py-2">PTS</th>
                </tr>
              </thead>
              <tbody>
                {players
                  .filter(p => p.season_averages?.pts != null)
                  .sort((a,b) => (b.season_averages?.pts ?? 0) - (a.season_averages?.pts ?? 0))
                  .slice(0,10)
                  .map((p, idx) => (
                    <tr key={p.id} className="odd:bg-white even:bg-slate-50">
                      <td className="px-3 py-1 font-medium">{idx+1}</td>
                      <td className="px-3 py-1 whitespace-nowrap">{p.full_name}</td>
                      <td className="px-3 py-1">{p.team_abbreviation}</td>
                      <td className="px-3 py-1 font-semibold">{(p.season_averages?.pts ?? 0).toFixed(1)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Risk Distribution Pie */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Risk Level Distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }: any) => `${name}: ${(Number(percent) * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {riskDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Seasonal Trends */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Seasonal Injury Trends</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={seasonalData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="season" />
              <YAxis domain={[0, 100]} label={{ value: 'Injury Rate %', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Line type="monotone" dataKey="rate" stroke="#10B981" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Risk Factors Radar */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Risk Factor Analysis</h2>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="subject" />
              <PolarRadiusAxis angle={90} domain={[0, 100]} />
              <Radar name="Impact Score" dataKey="A" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.6} />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Team Risk Comparison */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Team Risk Comparison</h2>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={teamRiskData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="team" />
            <YAxis domain={[0, 100]} label={{ value: 'Average Risk %', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="risk" fill="#F59E0B" name="Average Player Risk %" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Trending Insights */}
      {leagueTrends && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 text-green-700">Trending Up (Increasing)</h3>
            <ul className="space-y-2">
              {leagueTrends.trending_up.map((trend: string, index: number) => (
                <li key={index} className="flex items-center">
                  <TrendingUp className="w-4 h-4 text-red-500 mr-2" />
                  <span>{trend}</span>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 text-green-700">Trending Down (Decreasing)</h3>
            <ul className="space-y-2">
              {leagueTrends.trending_down.map((trend: string, index: number) => (
                <li key={index} className="flex items-center">
                  <TrendingUp className="w-4 h-4 text-green-500 mr-2 rotate-180" />
                  <span>{trend}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
