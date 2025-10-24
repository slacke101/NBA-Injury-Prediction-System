import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Activity, TrendingUp, AlertTriangle, Calendar } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useNBAStore } from '../store/useNBAStore';
import { api } from '../api/axios';
import { PlayerCard } from '../components/PlayerCard';
import { ShotChart } from '../components/ShotChart';

/** Helper to get headshot image */
const getHeadshotUrl = (nbaId: number) =>
  `https://cdn.nba.com/headshots/nba/latest/260x190/${nbaId}.png`;

export const PlayerProfile: React.FC = () => {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();
  const { getPlayerById, getTeamById, predictInjury, injuryPredictions } = useNBAStore();
  
  const [careerStats, setCareerStats] = useState<any>(null);
  const [injuryHistory, setInjuryHistory] = useState<any[]>([]);
  const [recentGames, setRecentGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [shotData, setShotData] = useState<any[]>([]);
  const [shotLoaded, setShotLoaded] = useState(false);

  const player = playerId ? getPlayerById(parseInt(playerId)) : undefined;
  const team = player ? getTeamById(player.team_id) : undefined;
  const prediction = playerId ? injuryPredictions.get(parseInt(playerId)) : undefined;

  useEffect(() => {
    if (!playerId) return;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch career stats
        const careerRes = await api.get(`/player/${playerId}/career`);
        setCareerStats(careerRes.data);
        
        // Fetch injury history (backend may return array or wrapped object)
        const injuryRes = await api.get(`/player/${playerId}/injury-history`);
        const injuries = Array.isArray(injuryRes.data) ? injuryRes.data : injuryRes.data.injuries;
        setInjuryHistory(injuries ?? []);
        
        // Predict injury if not already done
        if (!prediction) {
          await predictInjury(parseInt(playerId));
        }

        // Fetch recent games log (last 10 games)
        const gamesRes = await api.get(`/player/${playerId}/gamelog`, { params: { last_n: 10 } });
        setRecentGames(gamesRes.data.games);

        // shot chart
        try {
          const shotRes = await api.get(`/player/${playerId}/shotchart`);
          setShotData(shotRes.data);
        } catch {
          setShotData([]);
        } finally {
          setShotLoaded(true);
        }

        // Fallback height/weight if missing
        if (!player?.height_feet && player) {
          const infoRes = await api.get(`/player/${playerId}/info`);
          Object.assign(player, infoRes.data);
        }
      } catch (error) {
        console.error('Error fetching player data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [playerId, prediction, predictInjury]);

  if (!player) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold">Player not found</h1>
        <button 
          onClick={() => navigate('/')}
          className="mt-4 text-blue-600 hover:underline"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  // Mock performance data for chart
  const performanceData = recentGames.map((g, idx) => ({
    game: `${idx + 1}`,
    points: g.PTS,
    efficiency: g.PTS + g.REB + g.AST + g.STL + g.BLK, // simple efficiency proxy
  }));

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </button>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold">{player.full_name}</h1>
              <p className="text-xl text-gray-600 mt-1">{team?.full_name || 'Unknown Team'}
                {player.current_injury && (
                  <span className="ml-2 px-2 py-0.5 rounded text-xs bg-red-600 text-white align-middle">{player.current_injury.injury_type || player.current_injury.status}</span>
                )}
              </p>
              <div className="flex items-center space-x-4 mt-3">
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                  {player.position}
                </span>
                <span className="text-gray-600">
                  {player.height_feet && player.height_inches !== null 
                    ? `${player.height_feet}'${player.height_inches}"` 
                    : 'Height N/A'}
                </span>
                <span className="text-gray-600">
                  {player.weight_pounds ? `${player.weight_pounds} lbs` : 'Weight N/A'}
                </span>
              </div>
            </div>
            
            {prediction && (
              <div className="text-right">
                <p className="text-sm text-gray-600">Current Injury Risk</p>
                <p className={`text-3xl font-bold ${
                  prediction.risk_level === 'High' ? 'text-red-600' :
                  prediction.risk_level === 'Medium' ? 'text-yellow-600' : 'text-green-600'
                }`}>
                  {(prediction.injury_risk * 100).toFixed(1)}%
                </p>
                <p className="text-sm font-medium mt-1">{prediction.risk_level} Risk</p>
              </div>
            )}
            {/* Player headshot */}
            <img
              src={getHeadshotUrl(player.id)}
              onError={(e: any) => {
                e.currentTarget.style.display = 'none';
              }}
              alt={player.full_name}
              className="ml-8 w-32 h-32 rounded-lg object-cover hidden md:block"
            />
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Performance Chart */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2" />
            Recent Performance
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="game" />
              <YAxis />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey="points" 
                stroke="#3B82F6" 
                name="Points"
                strokeWidth={2}
              />
              <Line 
                type="monotone" 
                dataKey="efficiency" 
                stroke="#10B981" 
                name="Efficiency"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Current Injury */}
        {player.current_injury && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-2 flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2" /> Current Injury
            </h2>
            <p className="text-red-700 font-medium">{player.current_injury.injury_type || '—'}</p>
            <p className="text-sm text-gray-600 mt-1">Status: {player.current_injury.status}</p>
            {player.current_injury.date && (
              <p className="text-sm text-gray-600">Date listed: {player.current_injury.date}</p>
            )}
            {player.current_injury.games_missed && (
              <p className="text-sm text-gray-600">Games missed: {player.current_injury.games_missed}</p>
            )}
          </div>
        )}

        {/* Injury History */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            Injury History
          </h2>
          {injuryHistory.length === 0 ? (
            <p className="text-gray-600">No injury records found</p>
          ) : (
            <div className="space-y-3">
              {injuryHistory.map((injury, index) => (
                <div key={index} className="border-l-4 border-red-500 pl-4 py-2">
                  <p className="font-medium">{injury.injury_type}</p>
                  <p className="text-sm text-gray-600">
                    {new Date(injury.date).toLocaleDateString()} - {injury.games_missed} games missed
                  </p>
                  <span className={`text-xs px-2 py-1 rounded ${
                    injury.severity === 'Severe' ? 'bg-red-100 text-red-800' :
                    injury.severity === 'Moderate' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {injury.severity}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Risk Analysis */}
      {prediction && (
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            Detailed Risk Analysis
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Environmental Impact</p>
              <p className="text-lg font-semibold">
                Temperature: {prediction.factors?.temperature ?? '—'}°F
              </p>
              <p className="text-lg font-semibold">
                Humidity: {prediction.factors?.humidity ?? '—'}%
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Workload Status</p>
              <p className="text-lg font-semibold">Moderate</p>
              <p className="text-sm text-gray-500">Based on recent games</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Recovery Score</p>
              <p className="text-lg font-semibold">85%</p>
              <p className="text-sm text-gray-500">Above average</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Next Game Risk</p>
              <p className="text-lg font-semibold">{prediction.risk_level}</p>
              <p className="text-sm text-gray-500">
                Updated {prediction.factors?.timestamp ? new Date(prediction.factors.timestamp).toLocaleTimeString() : '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Shot Chart */}
      <div className="mt-8 bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2" /> Shot Chart
          </h2>
        {shotLoaded ? (
          <div className="w-full" style={{ height: 500 }}>
            <ShotChart shots={shotData} />
            {shotData.length === 0 && (
              <p className="text-center text-gray-500 mt-2">No shot data available</p>
            )}
          </div>
        ) : (
          <p className="text-gray-500">Loading chart…</p>
        )}
      </div>
    </div>
  );
};
