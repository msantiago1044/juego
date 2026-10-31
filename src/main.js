// main.js - Punto de entrada principal y bucle de simulación planetaria de TerraSim 3D
import * as THREE from 'three';
import './style.css';

import { PhysicsWorld } from './core/PhysicsWorld.js';
import { AudioManager } from './core/AudioManager.js';
import { InputManager } from './core/InputManager.js';

import { EarthClock } from './simulation/EarthClock.js';
import { Geopolitics } from './simulation/Geopolitics.js';
import { GlobalEconomy } from './simulation/GlobalEconomy.js';
import { RealEstateMarket } from './simulation/RealEstateMarket.js';
import { Commodities } from './simulation/Commodities.js';
import { TechTree } from './simulation/TechTree.js';
import { NewsEngine } from './simulation/NewsEngine.js';

import { SkyAndAtmosphere } from './environment/SkyAndAtmosphere.js';
import { WeatherSystem } from './environment/WeatherSystem.js';
import { World } from './environment/World.js';

import { Player } from './entities/Player.js';
import { Vehicle } from './entities/Vehicle.js';
import { ThirdPersonCamera } from './entities/ThirdPersonCamera.js';

import { HUD } from './ui/HUD.js';
import { SmartphoneUI } from './ui/SmartphoneUI.js';

class GameApp {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.uiRoot = document.getElementById('ui-root');

    this.initThree();
    this.initCoreSystems();
    this.initSimulationSystems();
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
  }

  initSimulationSystems() {
    this.earthClock = new EarthClock();
    this.geopolitics = new Geopolitics();
    this.economy = new GlobalEconomy();
    this.realEstate = new RealEstateMarket();
    this.commodities = new Commodities();
    this.techTree = new TechTree();
    this.newsEngine = new NewsEngine();

    // Eventos al cambiar de día en el juego
    this.earthClock.onDay((date) => {
      this.handleDailySettlement();
    });
  }

  handleDailySettlement() {
    // 1. Cobrar Salario del trabajo
    const salary = this.player.job.salaryDaily || 0;
    this.player.cash += salary;

    // 2. Cobrar rentas de propiedades adquiridas
    const rent = this.realEstate.calculateDailyRent();
    this.player.cash += rent;

    // 3. Cobrar dividendos bursátiles
    const dividends = this.economy.calculateDividends();
    this.player.cash += dividends;

    // 4. Actualizar mercados e inflación
    this.geopolitics.update();
    this.economy.update(this.geopolitics);
    this.realEstate.update(this.economy.inflationRate, this.economy.interestRate);
    this.commodities.update(this.economy.commodities.crudeOil.price, this.economy.inflationRate);
    this.techTree.update();

    if (this.audioManager) {
      this.audioManager.playCash();
    }

    if (this.hud) {
      this.hud.updateTicker(`💰 Jornada Finalizada: +$${salary} (Salario) | +$${rent} (Rentas) | +$${dividends} (Dividendos)`);
    }
  }

  initEnvironment() {
    this.sky = new SkyAndAtmosphere(this.scene);
    this.weather = new WeatherSystem(this.scene, this.physicsWorld);
    this.world = new World(this.scene, this.physicsWorld);
  }

  initEntities() {
    this.player = new Player(this.scene, this.physicsWorld, this.audioManager);
    this.player.position.set(0, 0, 15);

    // Coche deportivo aparcado en la calle para que el jugador pueda conducirlo
    this.vehicle = new Vehicle(
      this.scene,
      this.physicsWorld,
      this.audioManager,
      new THREE.Vector3(4, 0, 15),
      {
        color: 0x00d4ff,
        topSpeed: 28,
        acceleration: 18,
        handling: 2.2,
        mass: 1400
      }
    );

    this.thirdPersonCamera = new ThirdPersonCamera(this.camera, this.container);
  }

  initUI() {
    this.currentZoneId = null;
    this.gameContext = {
      clock: this.earthClock,
      player: this.player,
      geopolitics: this.geopolitics,
      economy: this.economy,
      realEstateMarket: this.realEstate,
      commodities: this.commodities,
      techTree: this.techTree,
      newsEngine: this.newsEngine,
      weather: this.weather,
      world: this.world,
      physicsWorld: this.physicsWorld,
      audioManager: this.audioManager,
      vehicle: this.vehicle,
      smartphoneUI: null,
      mapsApp: null,
      onCityChanged: (cityName, placeLabel) => this.onCityChanged(cityName, placeLabel)
    };

    this.smartphoneUI = new SmartphoneUI(this.uiRoot, this.gameContext);
    this.smartphone = this.smartphoneUI;
    this.gameContext.smartphoneUI = this.smartphoneUI;

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
    this.hud.onInteractTap = () => {
      this.handleInteraction();
    };
    this.hud.onJumpTap = (active) => {
      this.input.setTouchJump(active);
    };
    this.hud.onMapButtonTap = () => {
      this.smartphoneUI.toggleMapApp();
    };
    this.hud.onGpsConfirmTap = () => {
      if (this.smartphoneUI && this.smartphoneUI.mapsApp) {
        this.smartphoneUI.mapsApp.returnPlayerToCurrentGPS();
      }
    };
  }

  getActiveCityName() {
    return (
      this.smartphone?.mapsApp?.currentCity ||
      this.gameContext?.mapsApp?.cityName ||
      'Barranquilla'
    );
  }

  onCityChanged(cityName, placeLabel = null) {
    if (!this.world || !this.hud) return;
    const activePos = (this.player.isInVehicle || this.vehicle?.isOccupied)
      ? this.vehicle.position
      : this.player.position;
    const zone = this.world.getZoneAt(activePos);
    this.currentZoneId = zone.id;
    const coords = this.gameContext?.mapsApp?.currentCoords;
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
      const coords = this.gameContext?.mapsApp?.currentCoords;
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
    // Interacción con Tecla 'E'
    this.input.on('interact', () => {
      this.handleInteraction();
    });

    // Abrir Smartphone con Tecla 'TAB'
    this.input.on('togglePhone', () => {
      this.smartphoneUI.toggle();
    });

    // Abrir Mapa directamente con Tecla 'M'
    this.input.on('toggleMap', () => {
      this.smartphoneUI.toggleMapApp();
    });
  }

  handleInteraction() {
    // 1. Si está dentro del coche, salir del vehículo
    if (this.player.isInVehicle) {
      this.player.exitVehicle();
      return;
    }

    // 2. Si está cerca del coche, entrar al vehículo
    const distToCar = this.player.position.distanceTo(this.vehicle.position);
    if (distToCar < 3.8) {
      this.player.enterVehicle(this.vehicle);
      return;
    }

    // 3. Si está en un punto interactivo de la ciudad
    const spot = this.world.getNearestSpot(this.player.position);
    if (spot) {
      if (spot.action === 'openStockMarket') {
        this.smartphoneUI.openApp('stocks');
        if (!this.smartphoneUI.isOpen) this.smartphoneUI.toggle();
      } else if (spot.action === 'openRealEstate') {
        this.smartphoneUI.openApp('realestate');
        if (!this.smartphoneUI.isOpen) this.smartphoneUI.toggle();
      } else if (spot.action === 'openJobs') {
        this.smartphoneUI.openApp('jobs');
        if (!this.smartphoneUI.isOpen) this.smartphoneUI.toggle();
      } else if (spot.action === 'openGeopolitics') {
        this.smartphoneUI.openApp('geopolitics');
        if (!this.smartphoneUI.isOpen) this.smartphoneUI.toggle();
      } else if (spot.action === 'refuelCar') {
        // Repostar coche
        const fuelPrice = this.commodities.fuelPricePerLiter;
        const res = this.vehicle.refuel(30, fuelPrice);
        if (res.added > 0) {
          if (this.player.cash >= res.cost) {
            this.player.cash -= res.cost;
            if (this.audioManager) this.audioManager.playCash();
            this.hud.updateTicker(`⛽ Repostados ${res.added.toFixed(1)}L por $${res.cost.toFixed(2)}`);
          } else {
            alert('Fondos insuficientes para repostar');
          }
        } else {
          this.hud.updateTicker('⛽ El tanque del vehículo ya está lleno al 100%');
        }
      } else if (spot.action === 'openDealership') {
        this.smartphoneUI.openApp('tech');
        if (!this.smartphoneUI.isOpen) this.smartphoneUI.toggle();
      } else if (spot.action === 'openBank') {
        this.smartphoneUI.openApp('stocks');
        if (!this.smartphoneUI.isOpen) this.smartphoneUI.toggle();
      }
    }
  }

  updateInteractionsPrompt() {
    if (this.player.isInVehicle) {
      this.hud.showPrompt('Salir del vehículo');
      return;
    }

    const distToCar = this.player.position.distanceTo(this.vehicle.position);
    if (distToCar < 3.8) {
      this.hud.showPrompt('Conducir Vehículo');
      return;
    }

    const spot = this.world.getNearestSpot(this.player.position);
    if (spot) {
      this.hud.showPrompt(spot.name);
      return;
    }

    this.hud.hidePrompt();
  }

  animate() {
    requestAnimationFrame(this.animate);

    // Delta time seguro (máximo 0.05s para evitar saltos de física al perder foco)
    const rawDelta = this.clockTimer.getDelta();
    const dt = Math.min(rawDelta, 0.05);

    // 1. Reloj del juego y ciclo astronómico
    this.earthClock.update(dt);
    const timeFraction = this.earthClock.getTimeFraction();
    this.sky.update(timeFraction);

    const hour = this.earthClock.date.getHours();
    const isNight = (hour >= 20 || hour < 6);

    // 2. Noticias mundiales en tiempo real
    const newNews = this.newsEngine.update(dt, this.earthClock, this.geopolitics, this.economy, this.audioManager);
    if (newNews) {
      this.hud.updateTicker(`📢 ${newNews.category}: ${newNews.headline}`);
    }

    // 3. Físicas de Entidades
    const mouseDelta = this.input.consumeMouseDelta();
    this.thirdPersonCamera.updateMouse(mouseDelta);

    const cameraYaw = this.thirdPersonCamera.getYaw();

    if (this.player.isInVehicle) {
      this.vehicle.update(dt, this.input, isNight);
      this.thirdPersonCamera.update(dt, this.vehicle.position, true);
    } else {
      this.vehicle.update(dt, { isForward: () => false, isBackward: () => false, isLeft: () => false, isRight: () => false, isJump: () => false }, isNight);
      this.player.update(dt, this.input, cameraYaw);
      this.thirdPersonCamera.update(dt, this.player.position, false);
    }

    // 4. Clima y Ambiente (lluvia, partículas, charcos, fricción del PhysicsWorld)
    const activePos = (this.player.isInVehicle || this.vehicle?.isOccupied) ? this.vehicle.position : this.player.position;
    this.weather.update(dt, activePos, this.sky);
    this.world.update(dt, isNight, activePos);
    this.checkZoneTransition(activePos);

    // 5. Prompts y HUD
    this.updateInteractionsPrompt();
    this.hud.update();
    if (this.smartphoneUI && typeof this.smartphoneUI.update === 'function') {
      this.smartphoneUI.update();
    }
    if (this.gameContext?.mapsApp) {
      this.gameContext.mapsApp.update(dt);
    }

    // 6. Renderizar escena
    this.renderer.render(this.scene, this.camera);
  }
}

// Inicializar al cargar la página
window.addEventListener('DOMContentLoaded', () => {
  new GameApp();
});
