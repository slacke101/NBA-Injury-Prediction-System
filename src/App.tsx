import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { Home, Users, BarChart3, Settings, AlertTriangle, Search } from 'lucide-react';
import './App.css';
import { useNBAStore } from './store/useNBAStore';
import { PlayerCard } from './components/PlayerCard';
import { InjuryRiskChart } from './components/InjuryRiskChart';
import { WeatherPanel } from './components/WeatherPanel';
import { StatsOverview } from './components/StatsOverview';
import { PlayerProfile } from './pages/PlayerProfile';
import { Analytics } from './pages/Analytics';
import { PlayersPage } from './pages/PlayersPage';
import { SettingsPage } from './pages/Settings';
import { Footer } from './components/Footer';

function Dashboard() {
  const navigate = useNavigate();
  const { 
    players, 
    teams, 
    loading, 
    error,
    injuryPredictions,
    fetchPlayers, 
    fetchTeams,
    predictInjury,
    batchPredictAll,
    getTeamById
  } = useNBAStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [minPts, setMinPts] = useState<number | ''>('');
  const [maxPts, setMaxPts] = useState<number | ''>('');

  useEffect(() => {
    fetchPlayers();
    fetchTeams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prefetchRef = React.useRef(false);
  useEffect(() => {
    if (!prefetchRef.current && players.length > 0) {
      prefetchRef.current = true;
      batchPredictAll();
    }
  }, [players, batchPredictAll]);

  const filteredPlayers = players.filter(player => {
    const matchesSearch = player.full_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPosition = !selectedPosition || player.position === selectedPosition;
    const matchesTeam = !selectedTeam || player.team_abbreviation === selectedTeam;
    const pts = player.season_averages?.pts ?? 0;
    const matchesMin = minPts === '' || pts >= Number(minPts);
    const matchesMax = maxPts === '' || pts <= Number(maxPts);
    return matchesSearch && matchesPosition && matchesTeam && matchesMin && matchesMax;
  });

  const positions = ['', 'G', 'F', 'C', 'G-F', 'F-C'];

  if (loading && players.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading NBA data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6">
        {/* Stats Overview */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">NBA Analytics Dashboard</h1>
          <p className="text-gray-600">Real-time injury risk analysis and player performance metrics</p>
        </div>

        <StatsOverview players={players} predictions={injuryPredictions} />

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6 mt-8">
          {/* Left Column - Weather & Risk Chart */}
          <div className="lg:col-span-2 space-y-6">
            <WeatherPanel />
            <InjuryRiskChart players={players} predictions={injuryPredictions} />
          </div>

          {/* Right Column - Players */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Player Analysis</h2>
              
              {/* Search and Filter */}
              <div className="space-y-3 mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search players..."
                    className="w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {/* Position */}
                  <select
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={selectedPosition}
                    onChange={(e) => setSelectedPosition(e.target.value)}
                  >
                    <option value="">All Positions</option>
                    {positions.slice(1).map(pos => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                  </select>
                  {/* Team */}
                  <select
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={selectedTeam}
                    onChange={(e) => setSelectedTeam(e.target.value)}
                  >
                    <option value="">All Teams</option>
                    {teams.map(t => (
                      <option key={t.abbreviation} value={t.abbreviation}>{t.abbreviation}</option>
                    ))}
                  </select>
                  {/* Points range */}
                  <input
                    type="number"
                    placeholder="Min PTS"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={minPts}
                    onChange={(e)=> setMinPts(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                  <input
                    type="number"
                    placeholder="Max PTS"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={maxPts}
                    onChange={(e)=> setMaxPts(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
              </div>

              {/* Player List */}
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {filteredPlayers.map(player => {
                  const team = getTeamById(player.team_id);
                  const prediction = injuryPredictions.get(player.id);
                  return (
                    <PlayerCard
                      key={player.id}
                      player={player}
                      team={team?.full_name}
                      prediction={prediction}
                      onClick={() => navigate(`/player/${player.id}`)}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  const [activeNav, setActiveNav] = useState('dashboard');

  return (
    <Router>
      <div className="flex h-screen bg-gray-50">
        {/* Sidebar */}
        <div className="w-64 bg-primary text-white">
          <div className="p-6">
            <h2 className="text-2xl font-bold">SportsOnCourts</h2>
            <p className="text-gray-400 text-sm mt-1">Injury Prediction System</p>
          </div>
          
          <nav className="mt-6">
            <Link
              to="/"
              onClick={() => setActiveNav('dashboard')}
              className={`flex items-center px-6 py-3 hover:bg-primary-light transition-colors ${
                activeNav === 'dashboard' ? 'bg-primary-light border-l-4 border-accent' : ''
              }`}
            >
              <Home className="w-5 h-5 mr-3" />
              Dashboard
            </Link>
            <Link
              to="/players"
              onClick={() => setActiveNav('players')}
              className={`flex items-center px-6 py-3 hover:bg-primary-light transition-colors ${
                activeNav === 'players' ? 'bg-primary-light border-l-4 border-accent' : ''
              }`}
            >
              <Users className="w-5 h-5 mr-3" />
              Players
            </Link>
            <Link
              to="/analytics"
              onClick={() => setActiveNav('analytics')}
              className={`flex items-center px-6 py-3 hover:bg-primary-light transition-colors ${
                activeNav === 'analytics' ? 'bg-primary-light border-l-4 border-accent' : ''
              }`}
            >
              <BarChart3 className="w-5 h-5 mr-3" />
              Analytics
            </Link>
            <Link
              to="/settings"
              onClick={() => setActiveNav('settings')}
              className={`flex items-center px-6 py-3 hover:bg-primary-light transition-colors ${
                activeNav === 'settings' ? 'bg-primary-light border-l-4 border-accent' : ''
              }`}
            >
              <Settings className="w-5 h-5 mr-3" />
              Settings
            </Link>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col h-full">
          <div className="flex-1 overflow-auto">
            <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/player/:playerId" element={<PlayerProfile />} />
            <Route path="/players" element={<PlayersPage />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
          </div>
          <Footer />
        </div>
      </div>
    </Router>
  );
}

export default App;