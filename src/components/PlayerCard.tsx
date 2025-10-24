import React from 'react';
import { Player, InjuryPrediction } from '../store/useNBAStore';
import { User, Activity, AlertTriangle } from 'lucide-react';

interface PlayerCardProps {
  player: Player;
  team?: string;
  prediction?: InjuryPrediction;
  onClick?: () => void;
}

export const PlayerCard: React.FC<PlayerCardProps> = ({ player, team, prediction, onClick }) => {

  const getRiskColor = (level?: string) => {
    switch (level) {
      case 'High': return 'text-red-600 bg-red-100';
      case 'Medium': return 'text-yellow-600 bg-yellow-100';
      case 'Low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatHeight = () => {
    if (player.height_feet && player.height_inches !== null) {
      return `${player.height_feet}'${player.height_inches}"`;
    }
    return 'N/A';
  };

  return (
    <div 
      className="bg-white rounded-xl shadow hover:shadow-xl ring-1 ring-gray-100 hover:ring-accent/50 transform hover:-translate-y-1 transition duration-200 p-5 cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          {player.headshot_url ? (
            <img
              src={player.headshot_url}
              alt={player.full_name}
              className="w-12 h-12 rounded-full object-cover border"
              onError={(e: any) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className="bg-blue-100 p-3 rounded-full">
              <User className="w-6 h-6 text-blue-600" />
            </div>
          )}
          <div>
            <h3 className="font-semibold text-lg flex items-center">{player.full_name}
              {player.current_injury && (
                <span className="ml-2 px-2 py-0.5 rounded text-xs bg-red-600 text-white">
                  {player.current_injury.status || 'OUT'}
                </span>
              )}
            </h3>
            <p className="text-gray-600 text-sm">
              {player.team_full_name || team || (player.team_id ? `Team ${player.team_id}` : 'Free Agent')}
            </p>
            {player.current_injury?.injury_type && (
              <p className="text-xs text-red-700 mt-0.5">{player.current_injury.injury_type}</p>
            )}
          </div>
        </div>
        <span className="text-2xl font-bold text-gray-700">{player.position}</span>
      </div>
      
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-gray-500" />
          <span className="text-gray-600">Height: {formatHeight()}</span>
        </div>
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-gray-500" />
          <span className="text-gray-600">Weight: {player.weight_pounds || 'N/A'} lbs</span>
        </div>
      </div>
      
      {prediction && (
        <div className="mt-4 border-t pt-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">Injury Risk</span>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRiskColor(prediction.risk_level)}`}>
              {prediction.risk_level} ({(prediction.injury_risk * 100).toFixed(1)}%)
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
