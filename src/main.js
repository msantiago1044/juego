// main.js - Punto de entrada principal y bucle de simulación limpia de TerraSim 3D
import * as THREE from 'three';
import './style.css';

import { PhysicsWorld } from './core/PhysicsWorld.js';
import { AudioManager } from './core/AudioManager.js';
import { InputManager } from './core/InputManager.js';

import { EarthClock } from './simulation/EarthClock.js';
import { SkyAndAtmosphere } from './environment/SkyAndAtmosphere.js';
import { WeatherSystem } from './environment/WeatherSystem.js';
import { World } from './environment/World.js';

import { Player } from './entities/Player.js';
import { ThirdPersonCamera } from './entities/ThirdPersonCamera.js';

import { HUD } from './ui/HUD.js';
import { GoogleMapsApp } from './ui/GoogleMapsApp.js';

class GameApp {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.uiRoot = document.getElementById('ui-root');

    this.initThree();
    this.initCoreSystems();
    this.initEnvironment();
    this.initEntities();
    this.initUI();

    this.clockTimer = new THREE.Clock();
    this.bindEvents();

    // Iniciar loop de renderizado
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initThree() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      600
    );

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.container.appendChild(this.renderer.domElement);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  initCoreSystems() {
    this.physicsWorld = new PhysicsWorld();
    this.audioManager = new AudioManager();
    this.input = new InputManager(this.container);
    this.earthClock = new EarthClock();
  }

  initEnvironment() {
    this.sky = new SkyAndAtmosphere(this.scene);
    this.weather = new WeatherSystem(this.scene, this.physicsWorld);
    this.world = new World(this.scene, this.physicsWorld);
  }

  initEntities() {
    this.player = new Player(this.scene, this.physicsWorld, this.audioManager);
    this.player.position.set(0, 0.1, 0);

    this.thirdPersonCamera = new ThirdPersonCamera(this.camera, this.container);
  }

  initUI() {
    this.currentZoneId = null;
    this.gameContext = {
      clock: this.earthClock,
      player: this.player,
      weather: this.weather,
      world: this.world,
      physicsWorld: this.physicsWorld,
      audioManager: this.audioManager,
      thirdPersonCamera: this.thirdPersonCamera,
      mapsApp: null,
      hud: null,
      onCityChanged: (cityName, placeLabel) => this.onCityChanged(cityName, placeLabel)
    };

    this.mapsApp = new GoogleMapsApp(this.gameContext);
    this.gameContext.mapsApp = this.mapsApp;

    this.hud = new HUD(this.uiRoot, this.gameContext);
    this.gameContext.hud = this.hud;

    if (this.world) {
      this.world.onBlockedByPrivateProperty = () => {
        if (this.hud) {
          this.hud.showPrivatePropertyWarning();
        }
      };
      this.world.onStatusChange = (statusInfo) => {
        if (this.hud && statusInfo) {
          this.hud.showOsmStatus(statusInfo.status, statusInfo.message);
        }
      };
    }

    // Conectar callbacks de controles móviles y acciones rápidas del HUD
    this.hud.onJoystickMove = (nx, ny, isSprint) => {
      this.input.setTouchMove(nx, ny, isSprint);
    };
    this.hud.onJumpTap = (active) => {
      this.input.setTouchJump(active);
    };
    this.hud.onGpsCenterTap = () => {
      if (this.mapsApp) {
        this.mapsApp.centerPlayerOnRealGps();
      }
    };
  }

  getActiveCityName() {
    return this.mapsApp?.cityName || 'Barranquilla';
  }

  onCityChanged(cityName, placeLabel = null) {
    if (!this.world || !this.hud) return;
    const activePos = this.player.position;
    const zone = this.world.getZoneAt(activePos);
    this.currentZoneId = zone.id;
    const coords = this.mapsApp?.currentCoords;
    const coordSuffix = coords ? ` • ${coords.lat.toFixed(4)}° N` : '';
    const subtitle = placeLabel ? `${placeLabel} — ${zone.subtitle}` : `${zone.subtitle}${coordSuffix}`;

    this.hud.showLocationBanner({
      badge: zone.badge,
      title: `${zone.name} • ${cityName || this.getActiveCityName()}`,
      subtitle,
      accentColor: zone.accentColor
    });
  }

  checkZoneTransition(activePos) {
    if (!this.world || !this.hud) return;
    const zone = this.world.getZoneAt(activePos);
    if (zone && zone.id !== this.currentZoneId) {
      const isInitial = this.currentZoneId === null;
      this.currentZoneId = zone.id;
      const cityName = this.getActiveCityName();
      const coords = this.mapsApp?.currentCoords;
      const coordSuffix = coords ? ` • ${coords.lat.toFixed(4)}° N` : '';

      if (!isInitial && this.audioManager) {
        this.audioManager.playUiClick();
      }

      this.hud.showLocationBanner({
        badge: zone.badge,
        title: `${zone.name} • ${cityName}`,
        subtitle: `${zone.subtitle}${coordSuffix}`,
        accentColor: zone.accentColor
      });
    }
  }

  bindEvents() {
    // Tecla 'C' o 'G' también puede centrar en GPS
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyC' || e.code === 'KeyG') {
        if (this.mapsApp) {
          this.mapsApp.centerPlayerOnRealGps();
        }
      }
    });
  }

  animate() {
    requestAnimationFrame(this.animate);

    // Delta time seguro (máximo 0.05s para evitar saltos de física al perder foco)
    const rawDelta = this.clockTimer.getDelta();
    const dt = Math.min(rawDelta, 0.05);

    // 1. Reloj del juego y ciclo celeste
    this.earthClock.update(dt);
    const timeFraction = this.earthClock.getTimeFraction();
    this.sky.update(timeFraction);

    const hour = this.earthClock.date.getHours();
    const isNight = (hour >= 20 || hour < 6);

    // 2. Físicas de cámara y jugador
    const mouseDelta = this.input.consumeMouseDelta();
    this.thirdPersonCamera.updateMouse(mouseDelta);

    const cameraYaw = this.thirdPersonCamera.getYaw();
    this.player.update(dt, this.input, cameraYaw);
    this.thirdPersonCamera.update(dt, this.player.position, false);

    // 3. Clima y Ambiente (lluvia, partículas, charcos, hierba alta)
    const activePos = this.player.position;
    this.weather.update(dt, activePos, this.sky);
    this.world.update(dt, isNight, activePos);
    this.checkZoneTransition(activePos);

    // 4. GPS en tiempo real y HUD
    if (this.mapsApp) {
      this.mapsApp.update(dt);
    }
    this.hud.update();

    // 5. Renderizar escena
    this.renderer.render(this.scene, this.camera);
  }
}

// Inicializar al cargar la página
window.addEventListener('DOMContentLoaded', () => {
  new GameApp();
});
