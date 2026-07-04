'use strict';

// ── Kathmandu weather ────────────────────────────────────────────────────────
// Single shared source (previously duplicated in recommendationEngine.js and
// aiController.js). In-process cache for now — Phase 6 upgrades this to a
// Mongo-backed cache so it survives restarts and stays consistent if the app
// is ever scaled to multiple Node instances.

const axios = require('axios');

let _wxCache = { data: null, ts: 0 };
const CACHE_TTL_MS = 30 * 60 * 1000;

const WMO_CODES = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Rime fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow',
  77: 'Snow grains', 80: 'Rain showers', 81: 'Rain showers', 82: 'Heavy showers',
  85: 'Snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm heavy hail',
};
const RAIN_CODES = new Set([51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99]);

exports.fetchWeather = async function fetchWeather() {
  if (_wxCache.data && Date.now() - _wxCache.ts < CACHE_TTL_MS) return _wxCache.data;
  try {
    const { data } = await axios.get(
      'https://api.open-meteo.com/v1/forecast' +
      '?latitude=27.7172&longitude=85.3240' +
      '&current=temperature_2m,relative_humidity_2m,weather_code,apparent_temperature,wind_speed_10m,precipitation_probability' +
      '&timezone=Asia%2FKathmandu',
      { timeout: 5000 }
    );
    const c = data.current;
    const code = c.weather_code;
    const wx = {
      temp:      Math.round(c.temperature_2m),
      feelsLike: Math.round(c.apparent_temperature),
      humidity:  c.relative_humidity_2m,
      windSpeed: Math.round(c.wind_speed_10m),
      rainProb:  c.precipitation_probability ?? 0,
      condition: WMO_CODES[code] || 'Unknown',
      code,
      isRaining: RAIN_CODES.has(code),
      isCold:    c.temperature_2m < 15,
      isHot:     c.temperature_2m > 28,
    };
    _wxCache = { data: wx, ts: Date.now() };
    return wx;
  } catch {
    // Serve stale cache rather than nulling everything out, if we have it.
    if (_wxCache.data) return _wxCache.data;
    return {
      temp: null, feelsLike: null, humidity: null,
      windSpeed: null, rainProb: null,
      condition: 'Unavailable', code: 0,
      isRaining: false, isCold: false, isHot: false,
    };
  }
};
