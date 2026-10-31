# Feature: Minimalist Clean Mobility, Dual GPS/Manual Movement, Ultra-Fast OSM Streets & GPS Return Button

## Objective
Strip away all legacy simulation systems (economy, stocks, DEFCON/geopolitics, news, commodities, real estate, jobs, tech tree, vehicle/fuel mechanics, money/wallet) leaving a clean, lightweight, highly responsive game focused exclusively on:
1. Smooth character movement and camera controls on both mobile (touch joystick, finger drag, touch camera orbit) and desktop (WASD/arrows, mouse drag).
2. Real-life GPS movement (walking in real life displaces the character with anti-shake filtering).
3. Ultra-fast real street and park loading from OpenStreetMap using lightweight `out geom;` queries across fast CDN mirrors.
4. A prominent, instant **`📍 Centrar en mi GPS`** button that returns the character to their real GPS location whenever they have moved away using manual controls (keys, finger, or joystick).

## Problem & Why
The user reported:
- The Overpass API returned "servidor OSM ocupado" because the previous query asked for hundreds of buildings with heavy node lookups, timing out on public servers.
- The user explicitly requested: "vamos paso a paso por ahora quita todo deja solo el personaje movimientos y las vias 2 tipos de movimientos con el gps a medida que me muevo y con el control dedos teclas y pantalla moviendo camara, solo eso quita todo lo demas de lugares dinero etc todo lo que ya tenia, solo quiero que tenga movilidad muy buena tanto em movil como web para esto necesito que tenga un boton y me lleve a la ubicacion gps si ya se movion con tecla o dedo etc".

## Scope & Constraints
- Remove legacy simulation clutter from `main.js`, `HUD.js`, `World.js`, and `style.css`.
- Keep Three.js 3D rendering, sky/atmosphere, world streets, character animations, physics collision on street boundaries, and input managers.
- Ultra-fast OpenStreetMap query: query only `way["highway"]` and `way["leisure"="park"]` with `out geom;` (no heavy buildings or secondary node queries), querying with GET requests that are CDN-cacheable.
- Prominent HUD button: **`📍 Centrar en mi GPS`** always visible, immediately teleporting/centering the character at the verified GPS location with 1 tap.
- Dual movement:
  - Movement A: real-life walking via `watchPosition` with 2.5m deadband and smooth lerp.
  - Movement B: manual joystick / touch drag / WASD with 360° fluid locomotion and camera look.
- Delivery strategy: `exception-ok`.

## Authorized Edit Surfaces
- `src/main.js`
- `src/environment/World.js`
- `src/ui/HUD.js`
- `src/ui/GoogleMapsApp.js`
- `src/entities/Player.js`
- `src/style.css`

## Tasks
- [x] **TASK-1**: Clean up `src/main.js` and `src/ui/HUD.js` removing all legacy simulation bloat (stocks, DEFCON, news, economy, jobs, real estate, commodities, vehicles) and adding the dedicated, always-accessible **`📍 Centrar en mi GPS`** button.
  - Route: `delegated-direct` (`odd_writer`).
  - Risk tier: `medium` (verified via `npm run build` -> `✓ 20 modules transformed, built in 550ms`).
  - Evidence: `main.js` only loads core systems. All 8 legacy simulation subsystems removed. HUD displays clean top bar and prominent floating `#btn-center-gps`.
- [x] **TASK-2**: Implement ultra-fast lightweight `out geom;` OSM street loader in `src/environment/World.js` and fluid dual GPS/manual movement in `src/ui/GoogleMapsApp.js` and `src/entities/Player.js`.
  - Route: `delegated-direct` (`odd_writer`).
  - Risk tier: `medium` (verified via `npm run build` -> `✓ 20 modules transformed, built in 550ms`).
  - Evidence: `World.js` uses `[out:json][timeout:15];(way["highway"](around:350...);way["leisure"="park"](around:350...););out geom;` via GET query with zero building overload. `centerPlayerOnRealGps()` snaps player to origin and restores camera alignment.

## Progress & Verification Summary
- Completed: 2 / 2 tasks.
- Verification: `npm run build` passed cleanly with 0 errors.
- Bundle reduced: transformed module count reduced from 28 to 20.
- Git status: Committed and pushed to `origin main` for automatic Vercel production rebuild.
