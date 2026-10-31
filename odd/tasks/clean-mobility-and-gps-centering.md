# Feature: Minimalist Clean Mobility, Dual GPS/Manual Movement, Ultra-Fast OSM Streets & GPS Return Button

## Objective
Strip away all legacy simulation systems leaving a clean, lightweight, highly responsive game focused exclusively on:
1. Smooth character movement and camera controls on both mobile (touch joystick, finger drag, touch camera orbit) and desktop (WASD/arrows, mouse drag).
2. Real-life GPS movement (walking in real life displaces the character with anti-shake filtering).
3. Ultra-fast real street and park loading from OpenStreetMap using lightweight `out geom;` queries across fast CDN mirrors.
4. A prominent, instant **`📍 Centrar en mi GPS`** button with confirmation modal asking whether the user is sure before returning the character to their real GPS location.
5. A prominent bottom **`🗺️ Ver Mapa`** button/icon that opens the interactive Leaflet/Google Maps view with live player marker, street search, satellite toggle, and 1-tap close (`✕`).

## Authorized Edit Surfaces
- `src/main.js`
- `src/environment/World.js`
- `src/ui/HUD.js`
- `src/ui/GoogleMapsApp.js`
- `src/entities/Player.js`
- `src/style.css`

## Tasks
- [x] **TASK-1**: Clean up `src/main.js` and `src/ui/HUD.js` removing all legacy simulation bloat (stocks, DEFCON, news, economy, jobs, real estate, commodities, vehicles) and adding the dedicated, always-accessible **`📍 Centrar en mi GPS`** button.
- [x] **TASK-2**: Implement ultra-fast lightweight `out geom;` OSM street loader in `src/environment/World.js` and fluid dual GPS/manual movement in `src/ui/GoogleMapsApp.js` and `src/entities/Player.js`.
- [x] **TASK-3**: Add bottom HUD button `🗺️ Ver Mapa`, confirmation modal for `📍 Centrar en mi GPS` ("¿Estás seguro de que deseas centrar tu personaje?"), and interactive modal Leaflet Map overlay in `src/ui/HUD.js`, `src/ui/GoogleMapsApp.js`, `src/main.js`, and `src/style.css`.
  - Route: `delegated-direct` (`odd_writer`).
  - Risk tier: `medium` (verified via `npm run build` -> `✓ built in 679ms`).
  - Evidence: `HUD.js` adds `#btn-hud-map` and `#gps-confirm-modal` confirmation flow. `GoogleMapsApp.js` adds `#map-modal-overlay` with Leaflet view, street search, satellite toggle, and close button `✕`. `main.js` binds `onMapToggleTap` and `KeyM`. `style.css` styles both components responsively.

## Progress & Verification Summary
- Completed: 3 / 3 tasks.
- Verification: `npm run build` passed cleanly with 0 errors.
- Git status: Committed and pushed to `origin main` for automatic Vercel production rebuild.
