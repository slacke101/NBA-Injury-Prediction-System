# SportsOnCourts – NBA Injury Prediction Suite

A sophisticated React + FastAPI application for NBA player analytics with advanced injury prediction based on environmental, biomechanical, and workload factors.

## 🌟 Features

### Dashboard

- **Real-time Statistics**: Live NBA player data via nba_api
- **Risk Overview**: At-a-glance injury risk metrics
- **Weather Integration**: Environmental impact analysis
- **Player Cards**: Interactive player profiles with risk indicators

### Advanced Analytics

- **Position-based Risk Analysis**: Compare injury risks across positions
- **Seasonal Trends**: Track injury patterns throughout the season
- **Team Comparisons**: Analyze risk levels by team
- **Risk Factor Radar**: Multi-dimensional risk assessment
- **League-wide Insights**: Trending injury types and prevention strategies

### Player Profiles

- **Career Statistics**: Comprehensive player performance data
- **Injury History**: Detailed injury timeline and severity tracking
- **Performance Charts**: Visual representation of recent games
- **Risk Breakdown**: Environmental, workload, and biomechanical factors

### Injury Prediction Engine

- **Multi-factor Analysis**:
  - Environmental conditions (temperature, humidity)
  - Workload metrics (minutes played, game frequency)
  - Biomechanical factors (flexibility, fatigue index)
  - Historical injury data
- **Risk Levels**: Low, Medium, High with percentage scores
- **Recommendations**: Personalized injury prevention strategies

## 🚀 Quick Start

### Prerequisites

- Node.js 16+
- Python 3.8+
- npm or yarn

### Installation

1. **Clone the repository**

   ```bash
   git clone <your-repo-url>
   cd courtvision-analytics
   ```

2. **Install frontend dependencies**

   ```bash
   npm install
   ```

3. **Install backend dependencies**
   ```bash
   cd backend
   pip install -r requirements.txt
   cd ..
   ```

### Running the Application

**Option 1: Run both frontend and backend together**

```bash
npm run dev
```

**Option 2: Run separately**

Terminal 1 - Backend:

```bash
cd backend
python -m uvicorn main:app --reload --port 8000
```

Terminal 2 - Frontend:

```bash
npm start
```

Access the application at http://localhost:3000

## 🔧 API Endpoints

### Player Management

- `GET /players` - List NBA players with filtering
- `GET /player/{player_id}/career` - Get career statistics
- `GET /player/{player_id}/injury-history` - Get injury history

### Team Data

- `GET /teams` - List all NBA teams

### Predictions

- `POST /predict_injury` - Advanced injury risk prediction
  ```json
  {
    "player_id": 123,
    "temperature": 72.0,
    "humidity": 50.0,
    "minutes_played": 35.0,
    "games_in_last_week": 3,
    "previous_injuries": 1
  }
  ```

### Analytics

- `GET /analytics/league-trends` - League-wide injury trends
- `GET /weather/{city}` - Weather data for NBA cities

## 🏗 Architecture

### Frontend (React + TypeScript)

```
src/
├── components/         # Reusable UI components
│   ├── PlayerCard.tsx
│   ├── InjuryRiskChart.tsx
│   ├── WeatherPanel.tsx
│   └── StatsOverview.tsx
├── pages/             # Page components
│   ├── PlayerProfile.tsx
│   └── Analytics.tsx
├── store/             # State management (Zustand)
│   └── useNBAStore.ts
└── api/               # API integration
    └── axios.ts
```

### Backend (FastAPI)

```
backend/
├── main.py            # API endpoints and logic
├── requirements.txt   # Python dependencies
└── start.bat/ps1     # Startup scripts
```

## 🛠 Technologies

### Frontend

- React 19 with TypeScript
- Tailwind CSS for styling
- Recharts for data visualization
- React Router for navigation
- Zustand for state management
- Axios for API calls
- Lucide React for icons

### Backend

- FastAPI for REST API
- nba_api for NBA data
- Pydantic for data validation
- CORS middleware for cross-origin requests

## 📊 Data Sources

- **NBA Statistics**: Official NBA data via nba_api
- **Weather Data**: Mock data (ready for OpenWeatherMap integration)
- **Injury Predictions**: Advanced mock ML model (ready for real ML integration)

## 🔐 Environment Variables

Create a `.env` file in the root directory:

```env
REACT_APP_API_BASE=http://localhost:8000
REACT_APP_WEATHER_API_KEY=your_openweather_api_key
```

## 🚧 Future Enhancements

- [ ] Real ML model integration for injury predictions
- [ ] Live weather API integration
- [ ] Player comparison features
- [ ] Historical trend analysis
- [ ] Export reports functionality
- [ ] Mobile responsive improvements
- [ ] Real-time game data integration
- [ ] Team management dashboard

## 📝 License

MIT License

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For issues and questions, please open an issue on GitHub.
