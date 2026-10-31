# Feature: Mobile Touch Controls, Live GPS Displacement, Map Button & GPS Return Confirmation

## Objective
Make `TerraSim 3D` fully playable on mobile devices by adding finger/touch movement (virtual joystick + touch camera rotation + on-screen action buttons), real-time GPS displacement support alongside manual finger displacement, a dedicated **Map (`🗺️ Mapa`)** button, and a dedicated **GPS (`📍 GPS`)** button that prompts and confirms with the user before returning the character to their real GPS location.

## Problem & Why
Currently, `InputManager.js` only supports desktop keyboard (`WASD`) and mouse events, making it impossible to move the character on a smartphone browser. The user is testing from their mobile device and needs finger-based movement on screen (in addition to GPS movement), quick access buttons for Map and GPS, and a confirmation prompt before resetting the character back to the current GPS location.

## Scope & Constraints
- Support both touch devices (mobile/tablet) and desktop seamlessly.
- Allow moving the character with the finger (virtual joystick / touch drag with analog direction & sprint) while updating the GPS offset in `GoogleMapsApp.js`, as well as optional live GPS `watchPosition` updates.
- Provide two prominent mobile-friendly HUD buttons:
  1. **Mapa (`🗺️ Mapa`)**: Opens/toggles the Smartphone UI directly on the `maps` app.
  2. **GPS (`📍 GPS`)**: Opens a confirmation modal asking whether the user wants to return the character to their current GPS location, and upon confirmation, syncs with `navigator.geolocation` (or current GPS anchor) and returns the character/vehicle to that location.
- Provide an on-screen **Interact (`[E]`)** button when near interactive spots or vehicles, plus responsive mobile CSS (`@media (max-width: 768px)`).
- Delivery strategy: `exception-ok` (workspace is not a Git repository).
- Forecast authored changed lines: ~390 lines across `index.html`, `src/core/InputManager.js`, `src/entities/Player.js`, `src/ui/HUD.js`, `src/ui/SmartphoneUI.js`, `src/ui/GoogleMapsApp.js`, `src/main.js`, and `src/style.css`.

## Authorized Edit Surfaces
- `index.html`
- `src/core/InputManager.js`
- `src/entities/Player.js`
- `src/ui/HUD.js`
- `src/ui/SmartphoneUI.js`
- `src/ui/GoogleMapsApp.js`
- `src/main.js`
- `src/style.css`

## Tasks
- [x] **TASK-1**: Implement mobile touch movement and camera look in `src/core/InputManager.js` and `src/entities/Player.js` (virtual joystick with smooth 360° finger drag, automatic sprint at full joystick deflection, touch camera look on the right/free screen area, and mobile viewport lock in `index.html`).
  - Route: `delegated-direct` (`odd_writer`).
  - Risk tier: `medium` (verified via writer self-verification + parent spot-check `npm run build`).
  - Evidence: `InputManager.js` adds `moveVector`, `setTouchMove(x, y, sprinting)`, `setTouchJump(active)`, and canvas touch drag handlers (left half moves character, right half rotates camera). `Player.js` reads analog `input.moveVector` for 360° movement and sprint.
- [x] **TASK-2**: Implement the HUD **Mapa** button, **GPS** button with confirmation modal, mobile **Interact** button, and live GPS displacement sync in `src/ui/HUD.js`, `src/ui/SmartphoneUI.js`, `src/ui/GoogleMapsApp.js`, `src/main.js`, and `src/style.css`.
  - Route: `delegated-direct` (`odd_writer`).
  - Risk tier: `medium` (verified via writer self-verification + parent spot-check `npm run build`).
  - Evidence: `HUD.js` adds `#mobile-joystick-zone`, `#btn-hud-map`, `#btn-hud-gps`, `#btn-hud-interact`, `#btn-hud-jump`, and `#gps-confirm-modal`. `GoogleMapsApp.js` adds `startLiveGpsTracking()` (`watchPosition`) and `returnPlayerToCurrentGPS()`. `SmartphoneUI.js` adds `toggleMapApp()` and `#phone-close-btn`.

## Progress & Verification Summary
- Completed: 2 / 2 tasks (`TASK-1`, `TASK-2`).
- Verification: `npm run build` passed in both delegated writer (`562ms`) and parent spot-check (exit code 0).
