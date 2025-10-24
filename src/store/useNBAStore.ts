import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { api } from '../api/axios';

export interface Player {
  id: number;
  full_name: string;
  first_name: string;
  last_name: string;
  position: string;
  height_feet?: number | null;
  height_inches?: number | null;
  weight_pounds?: number | null;
  team_abbreviation?: string | null;
  team_full_name?: string | null;
  team_id: number;
  is_active: boolean;
  current_injury?: {
    injury_type?: string;
    status?: string;
    date?: string;
    games_missed?: number;
  } | null;
  season_averages?: {
    pts?: number;
    reb?: number;
    ast?: number;
    stl?: number;
    blk?: number;
    fg_pct?: number;
    fg3_pct?: number;
    ft_pct?: number;
    min?: number;
  };
  headshot_url?: string;
}

export interface Team {
  id: number;
  abbreviation: string;
  city: string;
  conference: string;
  division: string;
  full_name: string;
  name: string;
  state: string;
}

export interface InjuryPrediction {
  player_id: number;
  injury_risk: number;
  risk_level: 'Low' | 'Medium' | 'High';
  factors: {
    temperature: number;
    humidity: number;
    timestamp: string;
  };
}

interface NBAState {
  players: Player[];
  teams: Team[];
  loading: boolean;
  error: string | null;
  selectedPlayerId: number | null;
  injuryPredictions: Map<number, InjuryPrediction>;
  fetchingInfo: Set<number>;
  /* Indicates that a /teams request is currently in flight – prevents
     dozens of parallel calls when the dashboard renders 450 PlayerCards
     before the first response finishes. */
  teamsFetching: boolean;
  predictionsBatching: boolean;
  
  fetchPlayers: () => Promise<void>;
  fetchTeams: () => Promise<void>;
  selectPlayer: (playerId: number | null) => void;
  predictInjury: (playerId: number, temperature?: number, humidity?: number) => Promise<void>;
  fetchPlayerInfo: (playerId: number) => Promise<void>;
  getPlayerById: (playerId: number) => Player | undefined;
  getTeamById: (teamId: number) => Team | undefined;
  batchPredictAll: () => Promise<void>;
}

export const useNBAStore = create<NBAState>()(
  devtools((set, get) => ({
    players: [],
    teams: [],
    loading: false,
    error: null,
    selectedPlayerId: null,
    injuryPredictions: new Map(),
    fetchingInfo: new Set(),
    predictionsBatching: false,
    teamsFetching: false,

    fetchPlayers: async () => {
      // If players already loaded, no need to set loading spinner again
      if (get().players.length === 0) {
        set({ loading: true, error: null });
      }
      try {
        const res = await api.get('/players/summary');
        set({ players: res.data, loading: false });
      } catch (err: any) {
        console.warn('Summary fetch failed, falling back to active list');
        try {
          const resBasic = await api.get('/players');
          set({ players: resBasic.data, loading: false });
        } catch (err2: any) {
          set({ error: err2.message, loading: false });
        }
      }
    },

    fetchTeams: async () => {
      // if already fetching, bail out – this prevents request spam
      if (get().teamsFetching) return;

      set({ loading: true, error: null, teamsFetching: true });
      try {
        const res = await api.get('/teams');
        set({ teams: res.data, loading: false, teamsFetching: false });
      } catch (err: any) {
        set({ error: err.message, loading: false, teamsFetching: false });
      }
    },

    selectPlayer: (playerId) => {
      set({ selectedPlayerId: playerId });
    },

    predictInjury: async (playerId, temperature = 72, humidity = 50) => {
      try {
        const res = await api.post('/predict_injury', null, {
          params: { player_id: playerId, temperature, humidity }
        });
        const data = res.data;
        // Normalize backend shape to InjuryPrediction
        const normalized: InjuryPrediction = {
          player_id: data.player_id,
          injury_risk: data.injury_risk,
          risk_level: data.risk_level,
          factors: {
            temperature: data.contributing_factors?.environmental?.temperature ?? temperature,
            humidity: data.contributing_factors?.environmental?.humidity ?? humidity,
            timestamp: data.timestamp,
          },
        };
        
        set((state) => {
          const newPredictions = new Map(state.injuryPredictions);
          newPredictions.set(playerId, normalized);
          return { injuryPredictions: newPredictions };
        });
      } catch (err: any) {
        set({ error: err.message });
      }
    },

    fetchPlayerInfo: async (playerId) => {
      const s = get();
      if (s.fetchingInfo.has(playerId)) return;
      s.fetchingInfo.add(playerId);
      try {
        const res = await api.get(`/player/${playerId}/info`);
        set((state) => {
          const updatedPlayers = state.players.map((p) =>
            p.id === playerId ? { ...p, ...res.data } : p
          );
          state.fetchingInfo.delete(playerId);
          return { players: updatedPlayers };
        });
      } catch (err: any) {
        set({ error: err.message });
        s.fetchingInfo.delete(playerId);
      }
    },

    getPlayerById: (playerId) => {
      return get().players.find(p => p.id === playerId);
    },

    getTeamById: (teamId) => {
      const { teams, teamsFetching, fetchTeams } = get();
      const found = teams.find(t => t.id === teamId);
      // Trigger lazy load exactly once; subsequent calls while waiting do nothing
      if (!found && !teamsFetching) {
        fetchTeams();
      }
      return found;
    },

    batchPredictAll: async () => {
      const s = get();
      if (s.predictionsBatching || s.players.length === 0) return;
      set({ predictionsBatching: true });

      try {
        const ids = s.players.map((p) => p.id);
        const res = await api.post('/predict_injury/bulk', ids);
        const data = res.data; // { [id]: prediction }

        set((state) => {
          const newMap = new Map(state.injuryPredictions);
          Object.values(data).forEach((pred: any) => {
            newMap.set(pred.player_id, pred as any);
          });
          return { injuryPredictions: newMap };
        });
      } catch (err: any) {
        set({ error: err.message });
      } finally {
        set({ predictionsBatching: false });
      }
    },
  }))
);
