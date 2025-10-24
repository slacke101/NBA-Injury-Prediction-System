import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNBAStore } from '../store/useNBAStore';

export const PlayersPage: React.FC = () => {
  const { players, getTeamById, injuryPredictions } = useNBAStore();
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const filtered = players.filter((p) =>
    p.full_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Players</h1>

      <div className="relative mb-6 w-full md:w-96">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 103 10.5a7.5 7.5 0 0013.65 6.15z" />
        </svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search players..."
          className="pl-11 pr-3 py-2 w-full rounded-lg border focus:ring-2 focus:ring-accent ring-1 ring-gray-200 focus:outline-none shadow-sm"
        />
      </div>

      <div className="overflow-x-auto bg-white rounded-xl shadow ring-1 ring-gray-100">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase tracking-wider sticky top-0 z-10 backdrop-blur">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Team</th>
              <th className="px-4 py-3">Pos</th>
              <th className="px-4 py-3">PTS</th>
              <th className="px-4 py-3">REB</th>
              <th className="px-4 py-3">AST</th>
              <th className="px-4 py-3">Injury Risk</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const team = getTeamById(p.team_id);
              const pred = injuryPredictions.get(p.id);
              return (
                <tr
                  key={p.id}
                  className="odd:bg-white even:bg-slate-50 hover:bg-white shadow hover:shadow-md transform hover:-translate-y-0.5 transition cursor-pointer"
                  onClick={() => navigate(`/player/${p.id}`)}
                >
                  <td className="px-4 py-2 whitespace-nowrap">{p.full_name}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{team?.abbreviation || p.team_abbreviation}</td>
                  <td className="px-4 py-2">{p.position}</td>
                  <td className="px-4 py-2">{p.season_averages?.pts ?? '—'}</td>
                  <td className="px-4 py-2">{p.season_averages?.reb ?? '—'}</td>
                  <td className="px-4 py-2">{p.season_averages?.ast ?? '—'}</td>
                  <td className="px-4 py-2">
                    {pred ? `${pred.risk_level} ${(pred.injury_risk * 100).toFixed(0)}%` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
