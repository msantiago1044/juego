# Feature: Real Location Detection, OpenStreetMap 3D Street/Park Sync & Public-Way Walkability Restriction

## Objective
Fix location detection so it matches the user's real location (unlocking mobile hardware GPS via HTTPS and removing stale `localStorage` defaults/ISP IP inaccuracy), synchronize the 3D Pokemon-styled world with the real streets, buildings, and public parks around the user's coordinates via OpenStreetMap Overpass API, and strictly restrict player/vehicle movement so the avatar can ONLY transit along public streets (`vías`) and public spaces (`parques / plazas / zonas públicas`).

## Problem & Why
1. Mobile browsers strictly forbid `navigator.geolocation` on insecure HTTP LAN URLs (`http://192.168.1.11:5173/`), and ISP IP geolocation resolves to a distant ISP node rather than the user's real street/neighborhood. Furthermore, stale `localStorage` keys (`terra_preferred_city_manual` / `terra_preferred_city`) kept the user locked to hardcoded Barranquilla coordinates (`10.9685, -74.7813`).
2. `World.js` needed real OpenStreetMap streets/parks and strict walkability so the avatar can only walk on public streets (`vías`) and public spaces (`espacios públicos`).

## Authorized Edit Surfaces
- `vite.config.js`
- `src/environment/World.js`
- `src/entities/Player.js`
- `src/entities/Vehicle.js`
- `src/ui/GoogleMapsApp.js`
- `src/ui/HUD.js`
- `src/main.js`
- `src/style.css`

## Tasks
- [x] **TASK-1**: Implement real-world OpenStreetMap Overpass geometry loader and strict street/public-space walkability enforcement in `src/environment/World.js`, `src/entities/Player.js`, and `src/entities/Vehicle.js`.
- [x] **TASK-2**: Implement resilient real-location detection and live sync between `GoogleMapsApp.js`, `HUD.js`, `main.js`, and `style.css`.
- [x] **TASK-3**: Unlock real mobile hardware GPS via HTTPS (`vite.config.js` + `.certs/`), purge stale `localStorage` city locks, and add an automatic **Ubicación Real** setup prompt when hardware GPS is blocked over plain HTTP (`src/ui/GoogleMapsApp.js`, `src/ui/HUD.js`, `src/style.css`).
  - Route: `delegated-direct` (`odd_writer`).
  - Risk tier: `medium` (verified via writer self-verification + parent spot-check `npm run build` -> `✓ built in 402ms` + live Vite server log confirming `Servidor HTTPS Móvil activo en puerto 5174`).
  - Evidence: `vite.config.js` starts an HTTPS companion proxy on port `5174`. `GoogleMapsApp.js` purges legacy `localStorage` keys and only trusts `terra_verified_gps_v3`. `HUD.js` adds `#gps-setup-modal` with Nominatim street/neighborhood search, 1-tap map calibration, and HTTPS redirect (`https://192.168.1.11:5174/`).
