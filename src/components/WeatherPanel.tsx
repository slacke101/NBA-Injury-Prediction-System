import React, { useState, useEffect } from 'react';
import { Cloud, Droplets, Thermometer, Wind } from 'lucide-react';
import { api } from '../api/axios';

interface WeatherData {
  temperature: number;
  humidity: number;
  description: string;
  windSpeed: number;
  city: string;
}

export const WeatherPanel: React.FC = () => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [selectedCity, setSelectedCity] = useState('Los Angeles');

  // NBA cities for weather monitoring
  const nbaCities = [
    'Los Angeles', 'New York', 'Chicago', 'Miami', 'Boston',
    'San Francisco', 'Dallas', 'Denver', 'Phoenix', 'Milwaukee'
  ];

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await api.get(`/weather/${encodeURIComponent(selectedCity)}`);
        setWeather(res.data);
      } catch (err) {
        console.error('Weather fetch failed', err);
        setWeather(null);
      }
    };
    fetchWeather();
  }, [selectedCity]);

  const getTemperatureColor = (temp: number) => {
    if (temp > 85) return 'text-red-600';
    if (temp < 50) return 'text-blue-600';
    return 'text-green-600';
  };

  const getHumidityColor = (humidity: number) => {
    if (humidity > 70) return 'text-blue-600';
    if (humidity < 30) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Weather Conditions</h2>
        <select 
          className="px-3 py-1 border rounded-md text-sm"
          value={selectedCity}
          onChange={(e) => setSelectedCity(e.target.value)}
        >
          {nbaCities.map(city => (
            <option key={city} value={city}>{city}</option>
          ))}
        </select>
      </div>

      {weather ? (
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center space-x-3">
          <Thermometer className={`w-8 h-8 ${getTemperatureColor(weather.temperature)}`} />
          <div>
            <p className="text-sm text-gray-600">Temperature</p>
            <p className={`text-2xl font-bold ${getTemperatureColor(weather.temperature)}`}>
              {weather.temperature}°F
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Droplets className={`w-8 h-8 ${getHumidityColor(weather.humidity)}`} />
          <div>
            <p className="text-sm text-gray-600">Humidity</p>
            <p className={`text-2xl font-bold ${getHumidityColor(weather.humidity)}`}>
              {weather.humidity}%
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Cloud className="w-8 h-8 text-gray-500" />
          <div>
            <p className="text-sm text-gray-600">Conditions</p>
            <p className="font-semibold">{weather.description}</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Wind className="w-8 h-8 text-gray-500" />
          <div>
            <p className="text-sm text-gray-600">Wind Speed</p>
            <p className="font-semibold">{weather.windSpeed} mph</p>
          </div>
        </div>
      </div>
      ) : (
        <p className="text-gray-600">Loading weather...</p>
      )}

      <div className="mt-4 p-3 bg-blue-50 rounded-md">
        <p className="text-sm text-blue-800">
          <strong>Impact on Injury Risk:</strong> 
          {weather?.temperature && (weather.temperature > 85 || weather.temperature < 50) 
            ? ' Extreme temperatures may increase injury risk. '
            : ' Temperature is within optimal range. '}
          {weather?.humidity && (weather.humidity > 70) 
            ? 'High humidity may affect player performance.'
            : 'Humidity levels are acceptable.'}
        </p>
      </div>
    </div>
  );
};
