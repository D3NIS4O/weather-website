# Skyline weather

A responsive, dependency-free weather website with city search, current conditions, a seven-day forecast, Celsius/Fahrenheit switching, optional browser geolocation, and remembered location/unit preferences.

## Website

https://D3NIS4O.github.io/weather-website/

## Run locally

Run `python3 -m http.server 8000` in this directory, then visit http://localhost:8000. No build step or API key is required for the current non-commercial Open-Meteo endpoints.

## Files

- `index.html`: semantic page layout
- `styles.css`: responsive dark theme
- `app.js`: search, forecast fetching, and rendering
- `.nojekyll`: static GitHub Pages deployment

## Deployment

GitHub Pages publishes the root of the `main` branch. Changes committed to that branch are deployed automatically.

## Data, privacy, and commercial use

Forecasts: https://open-meteo.com/ ; city lookup: GeoNames through Open-Meteo. Forecasts are estimates, not emergency alerts.

City preferences and units are stored locally in the visitor's browser when storage is available. Location is requested only after the visitor clicks the location button. Coordinates are sent to Open-Meteo to obtain a forecast; city searches are sent to its geocoding service. Google Fonts supplies the optional web fonts; system fonts are the fallback.

This version uses Open-Meteo's public non-commercial API. Before adding paid access, ads, or other monetization, review https://open-meteo.com/en/terms and https://open-meteo.com/en/pricing and arrange appropriate commercial API access. Do not put private API keys in client-side JavaScript or a public repository; use a backend for secret-bearing commercial access.

No x402 payment functionality is included. A real payment gate requires a backend, wallet/payment configuration, and a commercially permitted data source. GitHub Pages alone cannot securely enforce a paid weather API.
