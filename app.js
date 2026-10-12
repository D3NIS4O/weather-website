'use strict';
const $ = id => document.getElementById(id);
let fahrenheit = false;
try { fahrenheit = localStorage.getItem('skyline-unit') === 'f'; } catch (_) {}
let weatherData = null;
let selectedPlace = null;
let requestVersion = 0;
let controller = null;
const descriptions = {0:['Clear sky','☀️'],1:['Mainly clear','🌤️'],2:['Partly cloudy','⛅'],3:['Overcast','☁️'],45:['Fog','🌫️'],48:['Freezing fog','🌫️'],51:['Light drizzle','🌦️'],53:['Drizzle','🌦️'],55:['Heavy drizzle','🌧️'],56:['Freezing drizzle','🌧️'],57:['Heavy freezing drizzle','🌧️'],61:['Light rain','🌧️'],63:['Rain','🌧️'],65:['Heavy rain','🌧️'],66:['Freezing rain','🌧️'],67:['Heavy freezing rain','🌧️'],71:['Light snow','🌨️'],73:['Snow','🌨️'],75:['Heavy snow','❄️'],77:['Snow grains','❄️'],80:['Light showers','🌦️'],81:['Showers','🌧️'],82:['Heavy showers','🌧️'],85:['Snow showers','🌨️'],86:['Heavy snow showers','❄️'],95:['Thunderstorm','⛈️'],96:['Thunderstorm with hail','⛈️'],99:['Heavy hailstorm','⛈️']};
const condition = code => descriptions[code] || ['Unknown conditions','☁️'];
const numeric = value => typeof value === 'number' && Number.isFinite(value);
const temp = value => numeric(value) ? `${Math.round(fahrenheit ? value * 9 / 5 + 32 : value)}°${fahrenheit ? 'F' : 'C'}` : '—';
const percent = value => numeric(value) ? `${Math.round(value)}%` : '—';
function status(message) { $('status').textContent = message; }
function beginRequest(message) {
  if (controller) controller.abort();
  controller = new AbortController();
  requestVersion += 1;
  $('results').replaceChildren();
  status(message);
  return {version: requestVersion, signal: controller.signal};
}
async function getJSON(url, signal) {
  const response = await fetch(url, {signal});
  if (!response.ok) throw new Error(`Weather service returned ${response.status}. Please try again shortly.`);
  const data = await response.json();
  if (data.error) throw new Error(data.reason || 'Weather service is temporarily unavailable.');
  return data;
}
function reportError(error, version) {
  if (version !== requestVersion || error.name === 'AbortError') return;
  status(error instanceof TypeError ? 'Unable to connect. Check your internet connection and try again.' : error.message);
}
function placeName(place) { return [place.name, place.admin1, place.country].filter(Boolean).join(', '); }
function node(tag, text, className) { const el = document.createElement(tag); el.textContent = text; if (className) el.className = className; return el; }
function render() {
  $('unit').textContent = fahrenheit ? '°F · switch to °C' : '°C · switch to °F';
  $('unit').setAttribute('aria-label', fahrenheit ? 'Switch to Celsius' : 'Switch to Fahrenheit');
  if (!weatherData) return;
  const {current: c, daily: d} = weatherData;
  $('place').textContent = placeName(selectedPlace);
  $('updated').textContent = `As of ${c.time.slice(11,16)} · ${weatherData.timezone.replaceAll('_', ' ')}`;
  $('temperature').textContent = temp(c.temperature_2m);
  $('description').textContent = condition(c.weather_code)[0];
  $('symbol').textContent = c.is_day === 0 && c.weather_code === 0 ? '🌙' : condition(c.weather_code)[1];
  $('feels').textContent = temp(c.apparent_temperature);
  $('humidity').textContent = percent(c.relative_humidity_2m);
  $('wind').textContent = numeric(c.wind_speed_10m) ? `${Math.round(fahrenheit ? c.wind_speed_10m / 1.609344 : c.wind_speed_10m)} ${fahrenheit ? 'mph' : 'km/h'}` : '—';
  $('rain').textContent = percent(d.precipitation_probability_max[0]);
  $('forecast').replaceChildren();
  d.time.forEach((date, index) => {
    const card = node('article', '', 'day');
    const localDate = new Date(`${date}T12:00:00`);
    card.append(node('h3', index === 0 ? 'Today' : localDate.toLocaleDateString(undefined, {weekday:'short'})));
    card.append(node('div', localDate.toLocaleDateString(undefined, {month:'short',day:'numeric'}), 'date'));
    const [label, icon] = condition(d.weather_code[index]);
    const symbol = node('span', icon, 'day-icon'); symbol.setAttribute('aria-hidden','true'); card.append(symbol);
    const range = node('div', '', 'range');
    range.append(node('span', temp(d.temperature_2m_max[index])), node('span', temp(d.temperature_2m_min[index]), 'low'));
    card.append(range, node('div', label, 'summary'), node('div', `Rain: ${percent(d.precipitation_probability_max[index])}`, 'precip'));
    $('forecast').append(card);
  });
  $('weather').hidden = false;
}
async function loadWeather(place) {
  const {version, signal} = beginRequest(`Loading weather for ${place.name}…`);
  $('weather').setAttribute('aria-busy','true');
  try {
    const params = new URLSearchParams({latitude:place.latitude, longitude:place.longitude, current:'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m', daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max', timezone:'auto',forecast_days:'7',temperature_unit:'celsius',wind_speed_unit:'kmh'});
    const data = await getJSON(`https://api.open-meteo.com/v1/forecast?${params}`, signal);
    if (version !== requestVersion) return;
    if (!data.current || !data.daily || !Array.isArray(data.daily.time)) throw new Error('Incomplete forecast received. Please try again.');
    weatherData = data; selectedPlace = place; render(); status('');
    try { localStorage.setItem('skyline-place', JSON.stringify(place)); } catch (_) {}
  } catch (error) { reportError(error, version); }
  finally { if (version === requestVersion) $('weather').setAttribute('aria-busy','false'); }
}
$('search').addEventListener('submit', async event => {
  event.preventDefault();
  const query = $('city').value.trim(); if (query.length < 2) { status('Enter at least two characters.'); return; }
  const {version, signal} = beginRequest('Finding cities…');
  try {
    const params = new URLSearchParams({name:query,count:'6',language:'en',format:'json'});
    const data = await getJSON(`https://geocoding-api.open-meteo.com/v1/search?${params}`, signal);
    if (version !== requestVersion) return;
    if (!data.results?.length) { status('No cities found. Try a different name or spelling.'); return; }
    if (data.results.length === 1) { loadWeather(data.results[0]); return; }
    status('Choose your city:');
    data.results.forEach(place => { const button = node('button', placeName(place)); button.type = 'button'; button.addEventListener('click', () => loadWeather(place)); $('results').append(button); });
  } catch (error) { reportError(error, version); }
});
$('unit').addEventListener('click', () => { fahrenheit = !fahrenheit; try { localStorage.setItem('skyline-unit', fahrenheit ? 'f' : 'c'); } catch (_) {} render(); });
$('locate').addEventListener('click', () => {
  if (!navigator.geolocation) { status('Your browser does not support location. Please search for a city instead.'); return; }
  const {version} = beginRequest('Waiting for your location permission…');
  navigator.geolocation.getCurrentPosition(position => {
    if (version !== requestVersion) return;
    loadWeather({name:'Your location',latitude:position.coords.latitude,longitude:position.coords.longitude});
  }, () => { if (version === requestVersion) status('Location unavailable or permission denied. Please search for a city instead.'); }, {timeout:10000,maximumAge:300000});
});
let initialPlace = {name:'London',country:'United Kingdom',latitude:51.5085,longitude:-0.1257};
try { const saved = JSON.parse(localStorage.getItem('skyline-place')); if (saved && typeof saved.name === 'string' && numeric(saved.latitude) && numeric(saved.longitude) && Math.abs(saved.latitude) <= 90 && Math.abs(saved.longitude) <= 180) initialPlace = saved; } catch (_) {}
render(); loadWeather(initialPlace);
