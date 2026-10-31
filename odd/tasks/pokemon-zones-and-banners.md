# Feature: Pokemon-Style World Zones, Routes, Tall Grass, and Location Banners

## Objective
Redesign the 3D world layout and location HUD in `TerraSim 3D` to follow a classic Pokemon region structure (Starter Town, Route 101 & Route 102 with animated tall grass patches and tree/fence borders, and Saffron-style Central City with Silph Co. / Financial District buildings) coupled with a sliding Pokemon-style location banner in the HUD synchronized with 3D zones and the GPS city from `GoogleMapsApp`.

## Problem & Why
Currently, `World.js` places generic city blocks around an asphalt crossroad and `GoogleMapsApp.js` tracks GPS coordinates without any region/zone identity or visual transition in the 3D world or HUD. The user requested applying Point 2: Pokemon-style locations (Towns, Routes with tall grass, Central City buildings) and sliding zone banners linked to both 3D zone transitions and GPS city selection.

## Scope & Constraints
- Apply Point 2 only (do NOT alter `ThirdPersonCamera.js` or `Player.js` movement controls, and do NOT add turn-based battle modals yet).
- Preserve all existing interactive spots (`stock_exchange`, `bank`, `gas_station`, `dealership`, `office_work`, `real_estate`, `government`) so `main.js` interactions (`KeyE`) continue working seamlessly.
- Delivery strategy: `exception-ok` (workspace is not a Git repository; `git status` reports `not a git repository`).
- Forecast authored changed lines: ~380 lines across `src/environment/World.js`, `src/ui/HUD.js`, `src/ui/GoogleMapsApp.js`, `src/main.js`, and `src/style.css`.

## Authorized Edit Surfaces
- `src/environment/World.js`
- `src/ui/HUD.js`
- `src/ui/GoogleMapsApp.js`
- `src/main.js`
- `src/style.css`

## Tasks
- [x] **TASK-1**: Implement Pokemon-style 3D world layout in `src/environment/World.js` (Starter Town / Pueblo Origen with colorful pitched/styled roofs and wooden fences, Route 101 & Route 102 with dirt/cobble paths, tree borders, wooden route signs, and rustling tall grass patches that animate when the player walks through them, and Central City / Ciudad Azafrán with Silph S.A.-inspired Financial, Bank, Tech Lab, and Recharge Center buildings) plus zone detection API (`getZoneAt(position)`).
  - Route: `delegated-direct` (`odd_writer`).
  - Risk tier: `medium` (verified via writer self-verification + parent spot-check `npm run build`).
  - Evidence: `src/environment/World.js` implements `setupZones()`, `getZoneAt(position)`, `createPokemonHouse()`, `createWoodenFence()`, `createWoodenSign()`, `createFlowerBed()`, `createTallGrassRoutes()`, and proximity-based grass sway in `update(deltaSeconds, isNight, playerPosition)`. All 7 interactive spots preserved.
- [x] **TASK-2**: Implement the sliding Pokemon-style Location Banner in `src/ui/HUD.js`, `src/style.css`, `src/ui/GoogleMapsApp.js`, and `src/main.js`.
  - Route: `delegated-direct` (`odd_writer`).
  - Risk tier: `medium` (verified via writer self-verification + parent spot-check `npm run build` -> `✓ 28 modules transformed, built in 384ms`).
  - Evidence: `HUD.js` exposes `showLocationBanner()` and updates `#hud-zone-pill` and `#pokemon-location-banner`. `main.js` adds `checkZoneTransition(activePos)` and `onCityChanged(cityName, placeLabel)` synced with `GoogleMapsApp.js` (`selectCity`, `applyDetectedCity`, `notifyLocationChange`).

## Progress & Verification Summary
- Completed: 2 / 2 tasks (`TASK-1`, `TASK-2`).
- Verification: `npm run build` passed in both delegated writer (`572ms`) and parent spot-check (`384ms`, exit code 0). No unit test runner exists in `package.json`.
- Git status: Not applicable (`fatal: not a git repository`).
- Next step: Await user feedback on whether to apply Point 1 (Top-Down 2.5D camera) or Point 3 (NPC dialogues & tall-grass encounter system).
