# Feature: Minimalist Clean Mobility, Dual GPS/Manual Movement, Ultra-Fast OSM Streets & GPS Return Button

## Objective
Implement UI cleanups requested by the user and fix real street synchronization:
1. Move "Centrar en mi GPS" with confirmation dialog inside the Map Modal.
2. Merge speed selector inside the clock pill (`🕒 HH:MM:SS • ⚡ 1x`).
3. Remove floating "Saltar" button (keep jump in keyboard controls).
4. Remove top-left location pill and Pokémon banner (location stays strictly inside the map).
5. Only `🗺️ Ver Mapa` remains in the bottom-right HUD.
6. Fix 3D streets to match real neighborhood by integrating fast OSRM (`routing.openstreetmap.de`) and removing the fake straight grid fallback (`Carrera Central`).

## Authorized Edit Surfaces
- `src/ui/HUD.js`
- `src/ui/GoogleMapsApp.js`
- `src/environment/World.js`
- `src/main.js`
- `src/style.css`

## Tasks
- [x] **TASK-1**: Clean up `src/main.js` and `src/ui/HUD.js` removing all legacy simulation bloat (stocks, DEFCON, news, economy, jobs, real estate, commodities, vehicles) and adding the dedicated, always-accessible **`📍 Centrar en mi GPS`** button.
- [x] **TASK-2**: Implement ultra-fast lightweight `out geom;` OSM street loader in `src/environment/World.js` and fluid dual GPS/manual movement in `src/ui/GoogleMapsApp.js` and `src/entities/Player.js`.
- [x] **TASK-3**: Add bottom HUD button `🗺️ Ver Mapa`, confirmation modal for `📍 Centrar en mi GPS` ("¿Estás seguro de que deseas centrar tu personaje?"), and interactive modal Leaflet Map overlay in `src/ui/HUD.js`, `src/ui/GoogleMapsApp.js`, `src/main.js`, and `src/style.css`.
- [x] **TASK-4**: Implement real-time current local clock (`new Date()`) and user-selectable movement speed multiplier (`1x`, `2x`, `3x`) in `src/ui/HUD.js`, `src/entities/Player.js`, `src/main.js`, and `src/style.css`.
- [x] **TASK-5**: Implement UI cleanups (move GPS center inside map with confirmation, merge clock & speed, remove jump button, remove top-left location badge).
  - Route: `delegated-direct` (`odd_writer`).
  - Risk tier: `medium` (verified via `npm run build` -> `✓ built in 1.07s`).
  - Evidence: `HUD.js` merges `#btn-clock-speed`, removes jump button and top-left location banners, leaving only `🗺️ Ver Mapa` in bottom-right. `GoogleMapsApp.js` adds `#btn-map-center-gps` with confirmation modal inside map.
- [x] **TASK-6**: Fix 3D streets to match the real neighborhood using fast OSRM street geometry fallback and removing the fake straight grid.
  - Route: `delegated-direct` (`odd_writer`).
  - Risk tier: `medium` (verified via `npm run build` -> `✓ built in 1.07s`).
  - Evidence: `World.js` adds `buildFromOSRMData()` and eliminates fake `Carrera Central` grid from fallback. `GoogleMapsApp.js` removes synthetic blue lines from Leaflet tiles.

## Progress & Verification Summary
- Completed: 6 / 6 tasks.
- Verification: `npm run build` passed with zero errors.
- Git status: Committed and pushed to `origin main` for automatic Vercel production rebuild.
