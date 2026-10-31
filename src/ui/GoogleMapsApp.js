// GoogleMapsApp.js - Aplicación interactiva de Google Maps con detección GPS multinivel, calibración exacta en el mapa y sincronización OSM 3D
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export class GoogleMapsApp {
  constructor(gameContext) {
    this.game = gameContext;
    if (this.game) {
      this.game.mapsApp = this;
    }
    this.onLocationChange = null;
    this.map = null;
    this.playerMarker = null;
    this.routePolyline = null;
    this.placeMarkers = [];
    this.walkableLayerGroup = null;
    this.isSatellite = false;
    this.followPlayer = true;
    this.isCalibratingGpsPin = false;
    this.movementScale = 2.8; // Escala calibrada: 1 unidad 3D = 2.8 metros reales

    // Diccionario de ciudades populares precargadas
    this.presetCities = {
      'Barranquilla': { lat: 10.9685, lng: -74.7813, country: 'Colombia' },
      'Puerto Colombia': { lat: 10.9878, lng: -74.9547, country: 'Colombia' },
      'Bogotá': { lat: 4.7110, lng: -74.0721, country: 'Colombia' },
      'Medellín': { lat: 6.2442, lng: -75.5812, country: 'Colombia' },
      'Cali': { lat: 3.4516, lng: -76.5320, country: 'Colombia' },
      'Cartagena': { lat: 10.3910, lng: -75.4794, country: 'Colombia' },
      'Bucaramanga': { lat: 7.1254, lng: -73.1198, country: 'Colombia' },
      'Madrid': { lat: 40.4168, lng: -3.7038, country: 'España' },
      'Barcelona': { lat: 41.3851, lng: 2.1734, country: 'España' },
      'Ciudad de México': { lat: 19.4326, lng: -99.1332, country: 'México' },
      'Buenos Aires': { lat: -34.6037, lng: -58.3816, country: 'Argentina' },
      'Santiago': { lat: -33.4489, lng: -70.6693, country: 'Chile' },
      'Lima': { lat: -12.0464, lng: -77.0428, country: 'Perú' },
      'Miami': { lat: 25.7617, lng: -80.1918, country: 'EEUU' }
    };

    // Purgar llaves heredadas de versiones anteriores para evitar bloqueos en coordenadas antiguas
    try {
      localStorage.removeItem('terra_preferred_city');
      localStorage.removeItem('terra_preferred_city_manual');
      localStorage.removeItem('terra_real_gps_coords');
      localStorage.removeItem('terra_gps_calibrated_pin');
    } catch (e) {
      // Ignorar errores de almacenamiento restringido
    }

    // Cargar únicamente coordenadas verificadas v3 (provenientes de chip GPS real o selección explícita del usuario)
    let savedGpsObj = null;
    try {
      const rawGps = localStorage.getItem('terra_verified_gps_v3');
      if (rawGps) {
        const parsed = JSON.parse(rawGps);
        if (
          parsed &&
          Number.isFinite(parsed.lat) &&
          Number.isFinite(parsed.lng) &&
          (parsed.source === 'hardware_gps' || parsed.source === 'user_pin')
        ) {
          savedGpsObj = parsed;
        }
      }
    } catch (e) {
      savedGpsObj = null;
    }

    this.hasVerifiedGps = Boolean(savedGpsObj);
    this.verifiedGpsSource = savedGpsObj?.source || null;

    const initialCity = savedGpsObj?.city || 'Barranquilla';
    const initialCityData = this.presetCities[initialCity] || this.presetCities['Barranquilla'];

    this.cityName = initialCity;
    this.currentCity = initialCity;
    this.streetLabel = savedGpsObj?.streetLabel || '';
    this.baseCoords = savedGpsObj
      ? { lat: savedGpsObj.lat, lng: savedGpsObj.lng }
      : { lat: initialCityData.lat, lng: initialCityData.lng };
    this.realGpsCoords = savedGpsObj ? { lat: savedGpsObj.lat, lng: savedGpsObj.lng } : null;
    this.currentCoords = { ...this.baseCoords };
    this.currentHeadingDeg = 0;

    // Generar locales y sitios dinámicos acordes a la ubicación activa
    this.generatePlacesForCoords(this.baseCoords);

    // Sincronizar mundo 3D con las coordenadas iniciales y escuchar cuando carguen las vías reales
    if (this.game && this.game.world) {
      this.game.world.onWorldGeometryReady = () => {
        this.snapEntitiesToWalkableStreet();
        this.renderWalkableOverlayOnMap();
      };
      this.sync3DWorldWithBaseCoords();
    }

    // Detectar ubicación real automáticamente (Chip GPS de alta precisión -> Modal de Ubicación Exacta si HTTP bloquea GPS)
    this.gpsWatchId = null;
    this.lastWatchCoords = null;
    this.gpsPendingDelta = { x: 0, z: 0 };
    this.gpsTargetWorldOffset = { x: 0, z: 0 };
    this.modalOverlay = null;

    this.createMapModal();
    this.autoDetectLocation(false);
    this.startLiveGpsTracking();
  }

  saveVerifiedGps(lat, lng, city, streetLabel, source = 'user_pin') {
    if (source !== 'hardware_gps' && source !== 'user_pin') return;
    this.hasVerifiedGps = true;
    this.verifiedGpsSource = source;
    this.realGpsCoords = { lat, lng };
    try {
      localStorage.setItem(
        'terra_verified_gps_v3',
        JSON.stringify({
          lat,
          lng,
          city: city || this.cityName || 'Tu Ubicación',
          streetLabel: streetLabel || this.streetLabel || '',
          source,
          updatedAt: Date.now()
        })
      );
    } catch (e) {
      // Ignorar si localStorage no está disponible
    }
  }

  sync3DWorldWithBaseCoords() {
    if (this.game && this.game.world) {
      this.game.world.loadRealWorldGeometry(this.baseCoords.lat, this.baseCoords.lng, this.movementScale);
    }
  }

  snapEntitiesToWalkableStreet() {
    if (!this.game || !this.game.world || !this.game.player) return;

    const p = this.game.player.position;
    const snappedPlayer = this.game.world.getNearestWalkablePoint(p.x, p.z);
    this.game.player.position.x = snappedPlayer.x;
    this.game.player.position.z = snappedPlayer.z;
    if (this.game.player.mesh) {
      this.game.player.mesh.position.copy(this.game.player.position);
    }

    if (this.game.vehicle) {
      const v = this.game.vehicle.position;
      const snappedCar = this.game.world.getNearestWalkablePoint(v.x, v.z);
      this.game.vehicle.position.x = snappedCar.x;
      this.game.vehicle.position.z = snappedCar.z;
      if (this.game.vehicle.mesh) {
        this.game.vehicle.mesh.position.copy(this.game.vehicle.position);
      }
    }
  }

  startLiveGpsTracking() {
    if (!navigator.geolocation || typeof navigator.geolocation.watchPosition !== 'function') return;

    this.gpsWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        // Filtro de precisión satelital: ignorar lecturas con error mayor a 45 metros para evitar saltos
        const accuracy = pos.coords.accuracy;
        if (Number.isFinite(accuracy) && accuracy > 45) {
          return;
        }

        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        this.realGpsCoords = { lat, lng };

        if (!this.hasVerifiedGps) {
          this.hasVerifiedGps = true;
          this.verifiedGpsSource = 'hardware_gps';
          this.reverseGeocodeAndSetCity(lat, lng, 'hardware_gps');
          this.game?.hud?.closeGpsSetupModal?.();
        }

        if (!this.lastWatchCoords) {
          this.lastWatchCoords = { lat, lng };
          return;
        }

        const dLat = lat - this.lastWatchCoords.lat;
        const dLng = lng - this.lastWatchCoords.lng;
        const metersPerDegreeLat = 111139;
        const rad = this.baseCoords.lat * (Math.PI / 180);
        const metersPerDegreeLng = 111139 * Math.cos(rad);

        const northMeters = dLat * metersPerDegreeLat;
        const eastMeters = dLng * metersPerDegreeLng;
        const distMoved = Math.hypot(northMeters, eastMeters);

        // Deadband filter: si distMoved < 2.5 metros, tratar como ruido estacionario y NO mover el personaje
        if (distMoved < 2.5) {
          return;
        }

        // Caminata real detectada (entre 2.5m y 150m)
        if (distMoved <= 150) {
          const deltaWorldZ = -northMeters / this.movementScale;
          const deltaWorldX = eastMeters / this.movementScale;

          this.gpsPendingDelta.x += deltaWorldX;
          this.gpsPendingDelta.z += deltaWorldZ;
          this.gpsTargetWorldOffset.x += deltaWorldX;
          this.gpsTargetWorldOffset.z += deltaWorldZ;

          this.lastWatchCoords = { lat, lng };
        } else {
          // Desplazamiento anormalmente grande (> 150m), actualizar ancla sin saltos bruscos
          this.lastWatchCoords = { lat, lng };
        }
      },
      () => {
        // Silencioso si el navegador bloquea watchPosition en HTTP LAN
      },
      { enableHighAccuracy: true, maximumAge: 2500, timeout: 10000 }
    );
  }

  centerPlayerOnRealGps() {
    const applyCenter = (lat, lng) => {
      let originWalk = { x: 0, z: 0 };
      if (this.game?.world) {
        originWalk = this.game.world.getNearestWalkablePoint(0, 0);
      }

      if (this.game?.player) {
        this.game.player.position.set(originWalk.x, 0.1, originWalk.z);
        this.game.player.velocity.set(0, 0, 0);
        this.game.player.rotationY = 0;
        if (this.game.player.mesh) {
          this.game.player.mesh.position.set(originWalk.x, 0.1, originWalk.z);
          this.game.player.mesh.rotation.y = 0;
        }
      }

      this.gpsPendingDelta = { x: 0, z: 0 };
      this.gpsTargetWorldOffset = { x: 0, z: 0 };
      this.lastWatchCoords = { lat, lng };

      if (this.game?.thirdPersonCamera) {
        this.game.thirdPersonCamera.yaw = 0;
        this.game.thirdPersonCamera.pitch = 0.28;
      }

      if (this.game?.audioManager) {
        this.game.audioManager.playUiClick();
      }

      if (this.game?.hud?.showToast) {
        this.game.hud.showToast('📍 Personaje centrado en tu ubicación GPS real');
      }
    };

    if (this.realGpsCoords) {
      applyCenter(this.realGpsCoords.lat, this.realGpsCoords.lng);
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          this.realGpsCoords = { lat, lng };
          this.hasVerifiedGps = true;
          this.verifiedGpsSource = 'hardware_gps';
          this.reverseGeocodeAndSetCity(lat, lng, 'hardware_gps');
          applyCenter(lat, lng);
        },
        () => {
          if (this.baseCoords) {
            applyCenter(this.baseCoords.lat, this.baseCoords.lng);
          }
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else if (this.baseCoords) {
      applyCenter(this.baseCoords.lat, this.baseCoords.lng);
    }
  }

  returnPlayerToCurrentGPS(onComplete = null) {
    const applyReturn = async (lat, lng, verifiedSource = null) => {
      this.baseCoords = { lat, lng };
      this.currentCoords = { lat, lng };
      this.lastWatchCoords = { lat, lng };
      this.gpsPendingDelta = { x: 0, z: 0 };
      this.gpsTargetWorldOffset = { x: 0, z: 0 };

      this.sync3DWorldWithBaseCoords();

      if (this.game && this.game.player) {
        const originWalk = this.game.world
          ? this.game.world.getNearestWalkablePoint(0, 0)
          : { x: 0, z: 0 };
        this.game.player.position.set(originWalk.x, 0.1, originWalk.z);
        this.game.player.velocity.set(0, 0, 0);
        if (this.game.player.isInVehicle && this.game.vehicle) {
          this.game.vehicle.position.set(originWalk.x, 0.1, originWalk.z);
          this.game.vehicle.speed = 0;
        }
      }

      this.generatePlacesForCoords(this.baseCoords);
      this.centerOnPlayer();
      this.renderPlaceMarkers();

      if (verifiedSource) {
        await this.reverseGeocodeAndSetCity(lat, lng, verifiedSource);
      } else {
        this.notifyLocationChange(this.streetLabel || 'Ubicación GPS Actual');
      }

      if (this.game && this.game.hud) {
        const label = this.streetLabel ? `${this.streetLabel}, ${this.cityName}` : this.cityName;
        this.game.hud.updateTicker(`📍 Personaje ubicado en ${label} (${lat.toFixed(5)}°, ${lng.toFixed(5)}°)`);
      }

      if (typeof onComplete === 'function') {
        onComplete({ lat, lng, city: this.cityName, streetLabel: this.streetLabel });
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          this.realGpsCoords = { lat, lng };
          this.game?.hud?.closeGpsSetupModal?.();
          applyReturn(lat, lng, 'hardware_gps');
        },
        () => {
          if (this.hasVerifiedGps && this.realGpsCoords) {
            applyReturn(this.realGpsCoords.lat, this.realGpsCoords.lng, this.verifiedGpsSource || 'user_pin');
          } else {
            this.game?.hud?.openGpsSetupModal?.();
          }
        },
        { enableHighAccuracy: true, timeout: 4500, maximumAge: 0 }
      );
    } else if (this.hasVerifiedGps && this.realGpsCoords) {
      applyReturn(this.realGpsCoords.lat, this.realGpsCoords.lng, this.verifiedGpsSource || 'user_pin');
    } else {
      this.game?.hud?.openGpsSetupModal?.();
    }
  }

  autoDetectLocation(forceApply = false) {
    const handleHardwareGpsFailure = async () => {
      if (!forceApply && this.hasVerifiedGps && this.realGpsCoords) {
        await this.reverseGeocodeAndSetCity(
          this.realGpsCoords.lat,
          this.realGpsCoords.lng,
          this.verifiedGpsSource || 'user_pin'
        );
        return;
      }

      // Obtener región aproximada por IP solo como referencia inicial de cámara (NUNCA guardarla como verificada)
      await this.detectLocationByIP(false);

      // Abrir inmediatamente el modal de configuración de ubicación exacta para que el jugador fije su calle real
      setTimeout(() => {
        if (this.game && this.game.hud && typeof this.game.hud.openGpsSetupModal === 'function') {
          this.game.hud.openGpsSetupModal();
        }
      }, 150);
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          this.realGpsCoords = { lat, lng };
          this.hasVerifiedGps = true;
          this.verifiedGpsSource = 'hardware_gps';
          this.game?.hud?.closeGpsSetupModal?.();
          this.reverseGeocodeAndSetCity(lat, lng, 'hardware_gps');
        },
        () => {
          handleHardwareGpsFailure();
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      handleHardwareGpsFailure();
    }
  }

  async detectLocationByIP(forceApply = false) {
    const endpoints = [
      'https://ipwho.is/',
      'https://get.geojs.io/v1/ip/geo.json',
      'https://ipapi.co/json/'
    ];

    for (const url of endpoints) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const data = await res.json();
        const lat = parseFloat(data.latitude ?? data.lat);
        const lng = parseFloat(data.longitude ?? data.lon);

        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          if (forceApply || !this.hasVerifiedGps) {
            await this.reverseGeocodeAndSetCity(lat, lng, null);
          }
          return { lat, lng, city: data.city || this.cityName };
        }
      } catch (e) {
        // Intentar siguiente proveedor IP
      }
    }
    return null;
  }

  async reverseGeocodeAndSetCity(lat, lng, verifiedSource = null) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      );
      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};
        const city =
          addr.city ||
          addr.town ||
          addr.municipality ||
          addr.village ||
          addr.county ||
          this.cityName ||
          'Tu Ubicación';
        const road = addr.road || addr.pedestrian || addr.residential || '';
        const suburb = addr.suburb || addr.neighbourhood || addr.quarter || '';
        const streetLabel = [road, suburb].filter(Boolean).join(', ') || data.name || 'Zona Urbana';

        this.streetLabel = streetLabel;
        if (verifiedSource === 'hardware_gps' || verifiedSource === 'user_pin') {
          this.saveVerifiedGps(lat, lng, city, streetLabel, verifiedSource);
        }
        this.setCity(city, lat, lng, false, streetLabel);
      } else {
        const fallbackCity = this.cityName || 'Tu Ubicación GPS';
        const fallbackStreet = this.streetLabel || 'Punto GPS';
        if (verifiedSource === 'hardware_gps' || verifiedSource === 'user_pin') {
          this.saveVerifiedGps(lat, lng, fallbackCity, fallbackStreet, verifiedSource);
        }
        this.setCity(fallbackCity, lat, lng, false, fallbackStreet);
      }
    } catch (e) {
      const fallbackCity = this.cityName || 'Tu Ubicación GPS';
      const fallbackStreet = this.streetLabel || 'Punto GPS';
      if (verifiedSource === 'hardware_gps' || verifiedSource === 'user_pin') {
        this.saveVerifiedGps(lat, lng, fallbackCity, fallbackStreet, verifiedSource);
      }
      this.setCity(fallbackCity, lat, lng, false, fallbackStreet);
    }
  }

  calibrateExactGpsPoint(lat, lng, customCity = null, customStreet = null, source = 'user_pin') {
    this.isCalibratingGpsPin = false;
    this.realGpsCoords = { lat, lng };
    this.lastWatchCoords = { lat, lng };
    this.gpsPendingDelta = { x: 0, z: 0 };
    this.gpsTargetWorldOffset = { x: 0, z: 0 };
    this.hasVerifiedGps = true;
    this.verifiedGpsSource = source;

    const calBtn = document.getElementById('btn-calibrate-gps-pin');
    const calTxt = document.getElementById('btn-calibrate-gps-text');
    if (calBtn) calBtn.classList.remove('active');
    if (calTxt) calTxt.innerText = 'Calibrar';

    // Colocar al jugador en el origen (0,0) de la nueva coordenada exacta
    if (this.game && this.game.player) {
      this.game.player.position.set(0, 0.1, 0);
      this.game.player.velocity.set(0, 0, 0);
      if (this.game.player.isInVehicle && this.game.vehicle) {
        this.game.vehicle.position.set(0, 0.1, 0);
        this.game.vehicle.speed = 0;
      }
    }

    if (customCity && customStreet) {
      this.streetLabel = customStreet;
      this.saveVerifiedGps(lat, lng, customCity, customStreet, source);
      this.setCity(customCity, lat, lng, false, customStreet);
      if (this.game && this.game.hud) {
        this.game.hud.updateTicker(`📍 Ubicación exacta fijada en ${customStreet}, ${customCity} (${lat.toFixed(5)}°, ${lng.toFixed(5)}°)`);
      }
    } else {
      this.reverseGeocodeAndSetCity(lat, lng, source);
    }
  }

  async searchNominatimCandidates(query) {
    const cleanQuery = (query || '').trim();
    if (!cleanQuery) return [];

    const results = [];
    const matchedPreset = Object.keys(this.presetCities).find(
      k => k.toLowerCase() === cleanQuery.toLowerCase()
    );
    if (matchedPreset) {
      const c = this.presetCities[matchedPreset];
      results.push({
        lat: c.lat,
        lng: c.lng,
        city: matchedPreset,
        streetLabel: `Centro Urbano, ${matchedPreset}`,
        title: `${matchedPreset} (${c.country})`,
        subtitle: 'Ciudad principal precargada'
      });
    }

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(cleanQuery)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          for (const item of data) {
            const lat = parseFloat(item.lat);
            const lng = parseFloat(item.lon);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

            const addr = item.address || {};
            const city =
              addr.city ||
              addr.town ||
              addr.municipality ||
              addr.village ||
              addr.county ||
              addr.state ||
              this.cityName ||
              'Ubicación';
            const road = addr.road || addr.pedestrian || addr.residential || item.name || '';
            const suburb = addr.suburb || addr.neighbourhood || addr.quarter || addr.city_district || '';
            const streetLabel = [road, suburb].filter(Boolean).join(', ') || item.name || cleanQuery;
            const title = streetLabel !== city ? `${streetLabel} — ${city}` : city;
            const subtitle = item.display_name || `${lat.toFixed(5)}°, ${lng.toFixed(5)}°`;

            results.push({
              lat,
              lng,
              city,
              streetLabel,
              title,
              subtitle
            });
          }
        }
      }
    } catch (e) {
      // Fallback silencioso si falla la red
    }

    return results.slice(0, 5);
  }

  enableGpsCalibrationMode() {
    this.isCalibratingGpsPin = true;
    const calBtn = document.getElementById('btn-calibrate-gps-pin');
    const calTxt = document.getElementById('btn-calibrate-gps-text');
    if (calBtn) calBtn.classList.add('active');
    if (calTxt) {
      calTxt.innerText = '🎯 Toca tu calle...';
    }
  }

  selectCity(cityName, lat, lng) {
    this.saveVerifiedGps(lat, lng, cityName, `Centro Urbano, ${cityName}`, 'user_pin');
    this.setCity(cityName, lat, lng, true, `Centro Urbano, ${cityName}`);
  }

  applyDetectedCity(cityName, lat, lng) {
    this.setCity(cityName, lat, lng, false);
  }

  notifyLocationChange(placeLabel = null) {
    const effectiveLabel = placeLabel || this.streetLabel || null;
    if (typeof this.onLocationChange === 'function') {
      this.onLocationChange(this.cityName, effectiveLabel);
    }
    if (this.game && typeof this.game.onCityChanged === 'function') {
      this.game.onCityChanged(this.cityName, effectiveLabel);
    }
  }

  setCity(cityName, lat, lng, isManual = true, streetLabel = '') {
    this.cityName = cityName;
    this.currentCity = cityName;
    if (streetLabel) {
      this.streetLabel = streetLabel;
    }
    this.baseCoords = { lat, lng };
    this.currentCoords = { lat, lng };

    if (isManual) {
      this.saveVerifiedGps(lat, lng, cityName, this.streetLabel || cityName, 'user_pin');
    }

    // Colocar avatar en el centro de la nueva ubicación y sincronizar geometría 3D OSM
    if (this.game && this.game.player) {
      this.game.player.position.set(0, 0.1, 0);
      this.game.player.velocity.set(0, 0, 0);
      if (this.game.player.isInVehicle && this.game.vehicle) {
        this.game.vehicle.position.set(0, 0.1, 0);
        this.game.vehicle.speed = 0;
      }
    }

    this.sync3DWorldWithBaseCoords();
    this.generatePlacesForCoords(this.baseCoords);

    const cityLabel = document.getElementById('gmaps-city-selector-btn');
    if (cityLabel) {
      const displayLabel = this.streetLabel ? `${this.streetLabel} (${cityName})` : cityName;
      cityLabel.innerHTML = `📍 <span>${displayLabel}</span> ▾`;
    }

    const modalLocText = document.getElementById('map-modal-location-text');
    if (modalLocText) {
      const displayLabel = this.streetLabel ? `${this.streetLabel} (${cityName})` : cityName;
      modalLocText.innerText = displayLabel;
    }

    if (this.map) {
      this.map.setView([lat, lng], 17);
      this.renderPlaceMarkers();
      this.renderWalkableOverlayOnMap();
      if (this.playerMarker) {
        this.playerMarker.setLatLng([lat, lng]);
      }
    }

    this.notifyLocationChange(this.streetLabel || null);
  }

  generatePlacesForCoords(center) {
    const lat = center.lat;
    const lng = center.lng;

    this.places = [
      {
        id: 'place_cafe_1',
        name: `Café Central — ${this.cityName}`,
        category: 'Cafetería & Panadería',
        icon: '☕',
        color: '#e67e22',
        rating: 4.8,
        reviewsCount: 342,
        address: `Av. Principal / Calle Comercial, ${this.cityName}`,
        lat: lat + 0.0009,
        lng: lng - 0.0011,
        type: 'cafe',
        desc: 'Café de especialidad, bebidas frías, repostería y Wi-Fi de alta velocidad.',
        actionText: 'Tomar Café ($4.50)',
        action: 'buyCoffee'
      },
      {
        id: 'place_gas_1',
        name: `Estación de Servicio Terpel / Primax — ${this.cityName}`,
        category: 'Gasolinera & Minimarket 24h',
        icon: '⛽',
        color: '#e74c3c',
        rating: 4.6,
        reviewsCount: 580,
        address: `Troncal Urbana, ${this.cityName}`,
        lat: lat - 0.0010,
        lng: lng + 0.0012,
        type: 'gas',
        desc: 'Combustibles de calidad, cambio de aceite y tienda con snacks y bebidas.',
        actionText: 'Repostar Combustible',
        action: 'refuel'
      },
      {
        id: 'place_bank_1',
        name: `Bancolombia / BBVA Nexus — ${this.cityName}`,
        category: 'Banco & Cajeros Automáticos',
        icon: '🏦',
        color: '#3498db',
        rating: 4.7,
        reviewsCount: 410,
        address: `Plaza Financiera, ${this.cityName}`,
        lat: lat + 0.0012,
        lng: lng + 0.0007,
        type: 'bank',
        desc: 'Operaciones bancarias, cajeros automáticos, transferencias y asesoría de inversión.',
        actionText: 'Abrir Bolsa de Valores',
        action: 'openStocks'
      },
      {
        id: 'place_restaurant_1',
        name: `Restaurante Típico & Parrilla — ${this.cityName}`,
        category: 'Restaurante',
        icon: '🍽️',
        color: '#d35400',
        rating: 4.9,
        reviewsCount: 920,
        address: `Zona Gourmet, ${this.cityName}`,
        lat: lat - 0.0007,
        lng: lng - 0.0014,
        type: 'restaurant',
        desc: 'Gastronomía local e internacional, platos a la carta y ambiente familiar.',
        actionText: 'Almorzar ($18.00)',
        action: 'eatMeal'
      },
      {
        id: 'place_supermarket_1',
        name: `Supertienda Éxito / Olímpica — ${this.cityName}`,
        category: 'Supermercado & Tecnología',
        icon: '🛒',
        color: '#16a085',
        rating: 4.6,
        reviewsCount: 1100,
        address: `Centro Comercial Metropolitano, ${this.cityName}`,
        lat: lat + 0.0015,
        lng: lng - 0.0018,
        type: 'store',
        desc: 'Alimentos frescos, electrónicos, farmacia y productos de consumo diario.',
        actionText: 'Comprar Suministros',
        action: 'buySupplies'
      },
      {
        id: 'place_park_1',
        name: `Parque Público — ${this.cityName}`,
        category: 'Espacio Público & Zonas Verdes',
        icon: '🌳',
        color: '#2ecc71',
        rating: 4.9,
        reviewsCount: 1650,
        address: `Paseo Ecológico, ${this.cityName}`,
        lat: lat - 0.0015,
        lng: lng - 0.0004,
        type: 'park',
        desc: 'Espacio público abierto con senderos peatonales, hierba alta y áreas de recreación.',
        actionText: 'Descansar (Restaura Estamina)',
        action: 'restPark'
      }
    ];
  }

  createMapModal() {
    if (this.modalOverlay) return;

    const parent = this.game?.uiRoot || document.getElementById('ui-root') || document.body;
    this.modalOverlay = document.createElement('div');
    this.modalOverlay.id = 'map-modal-overlay';
    this.modalOverlay.className = 'map-modal-overlay hidden';

    const displayHeader = this.streetLabel ? `${this.streetLabel} (${this.cityName})` : this.cityName;

    this.modalOverlay.innerHTML = `
      <div class="map-modal-card" id="map-modal-card">
        <!-- Barra Superior del Modal -->
        <div class="map-modal-header">
          <div class="map-modal-header-left">
            <h2 class="map-modal-title">🗺️ Mapa de tu Cuadra</h2>
            <div class="map-modal-location-pill" id="map-modal-location-pill" title="Ubicación activa">
              📍 <span id="map-modal-location-text">${displayHeader}</span>
            </div>
          </div>
          <div class="map-modal-header-actions">
            <button class="btn-map-action btn-map-gps" id="btn-map-center-gps" type="button" title="Centrar personaje en tu ubicación GPS real">
              📍 <span>Centrar en mi GPS</span>
            </button>
            <button class="btn-map-action" id="btn-toggle-satellite" type="button" title="Alternar Vista Satélite / Calles">
              🛰️ <span>Satélite</span>
            </button>
            <button class="btn-map-action ${this.isCalibratingGpsPin ? 'active' : ''}" id="btn-calibrate-gps-pin" type="button" title="Calibrar punto tocando el mapa">
              📌 <span id="btn-calibrate-gps-text">${this.isCalibratingGpsPin ? '🎯 Toca tu calle...' : 'Calibrar'}</span>
            </button>
            <button class="btn-close-map-modal" id="btn-close-map-modal" type="button" title="Cerrar Mapa">
              ✕
            </button>
          </div>
        </div>

        <!-- Modal de Confirmación de Centrado GPS dentro del Mapa -->
        <div class="gps-confirm-modal hidden" id="map-gps-confirm-modal">
          <div class="gps-confirm-card">
            <div class="gps-confirm-header">
              <span class="gps-confirm-icon">📍</span>
              <h3>Centrar en tu ubicación GPS</h3>
            </div>
            <p class="gps-confirm-message">
              ¿Estás seguro de que deseas centrar tu personaje en tu ubicación GPS real?
            </p>
            <div class="gps-confirm-actions">
              <button class="btn-gps-confirm-no" id="btn-map-cancel-center-gps" type="button">Cancelar</button>
              <button class="btn-gps-confirm-yes" id="btn-map-confirm-center-gps" type="button">Confirmar y Centrar</button>
            </div>
          </div>
        </div>

        <!-- Barra de Búsqueda de Calles Reales, Barrios y Direcciones -->
        <div class="map-modal-search-bar">
          <div class="gmaps-input-wrapper">
            <span class="gmaps-search-icon">🔍</span>
            <input type="text" id="gmaps-search-input" placeholder="Buscar tu calle, barrio o dirección en ${this.cityName}..." />
            <button class="gmaps-clear-btn hidden" id="gmaps-clear-btn" type="button">✕</button>
          </div>
          <button class="btn-gmaps-search-go" id="btn-search-go" type="button">Buscar</button>
        </div>

        <!-- Chips de filtros de categorías rápidas -->
        <div class="gmaps-quick-chips">
          <button class="chip-btn active" data-filter="all">Todos</button>
          <button class="chip-btn" data-filter="cafe">☕ Cafeterías</button>
          <button class="chip-btn" data-filter="gas">⛽ Gasolineras</button>
          <button class="chip-btn" data-filter="bank">🏦 Bancos</button>
          <button class="chip-btn" data-filter="restaurant">🍽️ Restaurantes</button>
          <button class="chip-btn" data-filter="store">🛒 Supermercados</button>
          <button class="chip-btn" data-filter="park">🌳 Parques</button>
        </div>

        <!-- Contenedor del Mapa Leaflet -->
        <div class="map-modal-body">
          <div id="gmaps-canvas-container" class="gmaps-map-view"></div>

          <!-- Indicador flotante de telemetría y movimiento en tiempo real -->
          <div class="gmaps-telemetry-badge" id="gmaps-telemetry-badge">
            <span class="telemetry-live-dot"></span>
            <span id="gmaps-telemetry-text">Vías Públicas y Espacios Públicos sincronizados</span>
          </div>

          <!-- Botones flotantes de control de navegación -->
          <div class="gmaps-floating-controls">
            <button class="gmaps-fab ${this.followPlayer ? 'active' : ''}" id="btn-follow-player" title="Modo Seguir al Jugador">
              🧭
            </button>
            <button class="gmaps-fab" id="btn-center-player" title="Centrar cámara en el jugador">
              🎯
            </button>
            <button class="gmaps-fab" id="btn-gps-detect" title="Centrar en mi GPS real">
              📡
            </button>
            <button class="gmaps-fab" id="btn-zoom-in" title="Acercar">+</button>
            <button class="gmaps-fab" id="btn-zoom-out" title="Alejar">−</button>
          </div>

          <!-- Ficha de Información de Local Seleccionado (Bottom Sheet) -->
          <div class="gmaps-place-sheet hidden" id="gmaps-place-sheet"></div>
        </div>
      </div>
    `;

    parent.appendChild(this.modalOverlay);
    this.bindModalEvents(this.modalOverlay);

    setTimeout(() => {
      this.initMap(this.modalOverlay);
    }, 60);
  }

  bindModalEvents(container) {
    // Cerrar modal con botón X
    const closeBtn = container.querySelector('#btn-close-map-modal');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.closeMapModal();
      });
    }

    // Cerrar al hacer clic en el backdrop de fondo
    this.modalOverlay.addEventListener('click', (e) => {
      if (e.target === this.modalOverlay) {
        this.closeMapModal();
      }
    });

    // Cerrar con Escape
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modalOverlay && !this.modalOverlay.classList.contains('hidden')) {
        this.closeMapModal();
      }
    });

    // Alternar Satélite / Callejero
    const satBtn = container.querySelector('#btn-toggle-satellite');
    if (satBtn) {
      satBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleSatellite();
        satBtn.classList.toggle('active', this.isSatellite);
      });
    }

    // Botón para activar/desactivar calibración de punto exacto
    const calibrateBtn = container.querySelector('#btn-calibrate-gps-pin');
    if (calibrateBtn) {
      calibrateBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.isCalibratingGpsPin = !this.isCalibratingGpsPin;
        calibrateBtn.classList.toggle('active', this.isCalibratingGpsPin);
        const txt = container.querySelector('#btn-calibrate-gps-text');
        if (txt) {
          txt.innerText = this.isCalibratingGpsPin
            ? '🎯 Toca tu calle...'
            : 'Calibrar';
        }
      });
    }

    // Barra de Búsqueda de Calles Reales, Barrios o Sitios
    const searchInput = container.querySelector('#gmaps-search-input');
    const clearBtn = container.querySelector('#gmaps-clear-btn');
    const searchGoBtn = container.querySelector('#btn-search-go');

    if (searchInput) {
      const handleFilterInput = () => {
        const q = searchInput.value.toLowerCase().trim();
        if (clearBtn) clearBtn.classList.toggle('hidden', q.length === 0);
        this.filterPlaces(q);
      };

      const handleSearchGo = async () => {
        const rawQuery = searchInput.value.trim();
        if (!rawQuery) return;
        const qLower = rawQuery.toLowerCase();
        const localMatch = this.places.find(
          p => p.name.toLowerCase().includes(qLower) || p.category.toLowerCase().includes(qLower)
        );
        if (localMatch) {
          this.selectPlace(localMatch);
          return;
        }
        const fullQuery = rawQuery.toLowerCase().includes(this.cityName.toLowerCase())
          ? rawQuery
          : `${rawQuery}, ${this.cityName}`;
        await this.searchAndSetCustomCity(fullQuery);
      };

      searchInput.addEventListener('input', handleFilterInput);
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleSearchGo();
        }
      });
      if (searchGoBtn) {
        searchGoBtn.addEventListener('click', (e) => {
          e.preventDefault();
          handleSearchGo();
        });
      }
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (searchInput) searchInput.value = '';
        clearBtn.classList.add('hidden');
        this.filterPlaces('');
      });
    }

    // Chips de categorías
    container.querySelectorAll('.chip-btn').forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.preventDefault();
        container.querySelectorAll('.chip-btn').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const filter = chip.getAttribute('data-filter');
        this.filterPlacesByCategory(filter);
      });
    });

    // Centrar en el jugador
    const centerBtn = container.querySelector('#btn-center-player');
    if (centerBtn) {
      centerBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.centerOnPlayer();
      });
    }

    // Modo Seguir al Jugador
    const followBtn = container.querySelector('#btn-follow-player');
    if (followBtn) {
      followBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.followPlayer = !this.followPlayer;
        followBtn.classList.toggle('active', this.followPlayer);
        if (this.followPlayer) {
          this.centerOnPlayer();
        }
      });
    }

    // Botón GPS en cabecera y modal de confirmación
    const btnMapCenterGps = container.querySelector('#btn-map-center-gps');
    const modalGpsConfirm = container.querySelector('#map-gps-confirm-modal');
    const btnConfirmGps = container.querySelector('#btn-map-confirm-center-gps');
    const btnCancelGps = container.querySelector('#btn-map-cancel-center-gps');

    const openGpsConfirm = () => {
      if (modalGpsConfirm) {
        modalGpsConfirm.classList.remove('hidden');
        if (this.game?.audioManager) {
          this.game.audioManager.playUiClick();
        }
      }
    };

    const closeGpsConfirm = () => {
      if (modalGpsConfirm) {
        modalGpsConfirm.classList.add('hidden');
      }
    };

    if (btnMapCenterGps) {
      btnMapCenterGps.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openGpsConfirm();
      });
    }

    if (btnCancelGps) {
      btnCancelGps.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeGpsConfirm();
      });
    }

    if (btnConfirmGps) {
      btnConfirmGps.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeGpsConfirm();
        this.centerPlayerOnRealGps();
        this.closeMapModal();
      });
    }

    if (modalGpsConfirm) {
      modalGpsConfirm.addEventListener('click', (e) => {
        if (e.target === modalGpsConfirm) {
          closeGpsConfirm();
        }
      });
    }

    // Botón GPS flotante
    const gpsBtn = container.querySelector('#btn-gps-detect');
    if (gpsBtn) {
      gpsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openGpsConfirm();
      });
    }

    // Zoom
    const zoomInBtn = container.querySelector('#btn-zoom-in');
    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.map) this.map.zoomIn();
      });
    }

    const zoomOutBtn = container.querySelector('#btn-zoom-out');
    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.map) this.map.zoomOut();
      });
    }
  }

  openGpsConfirmModal() {
    this.openMapModal();
    const modalGpsConfirm = this.modalOverlay?.querySelector('#map-gps-confirm-modal');
    if (modalGpsConfirm) {
      modalGpsConfirm.classList.remove('hidden');
      if (this.game?.audioManager) {
        this.game.audioManager.playUiClick();
      }
    }
  }

  openMapModal() {
    if (!this.modalOverlay) {
      this.createMapModal();
    }
    this.modalOverlay.classList.remove('hidden');
    if (this.game?.audioManager) {
      this.game.audioManager.playUiClick();
    }
    setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize();
      }
      this.centerOnPlayer();
    }, 60);
  }

  closeMapModal() {
    if (this.modalOverlay) {
      this.modalOverlay.classList.add('hidden');
      if (this.game?.audioManager) {
        this.game.audioManager.playUiClick();
      }
    }
  }

  toggleMapModal() {
    if (!this.modalOverlay || this.modalOverlay.classList.contains('hidden')) {
      this.openMapModal();
    } else {
      this.closeMapModal();
    }
  }

  render(container) {
    const displayHeader = this.streetLabel ? `${this.streetLabel} (${this.cityName})` : this.cityName;

    container.innerHTML = `
      <div class="google-maps-app">
        <!-- Barra Superior con Selector de Ciudad y Búsqueda -->
        <div class="gmaps-top-header">
          <button class="btn-gmaps-back" id="btn-maps-back">←</button>
          
          <!-- Selector de Ciudad / Barrio Destacado -->
          <button class="gmaps-city-selector-btn" id="gmaps-city-selector-btn" title="Cambiar Ciudad o Barrio">
            📍 <span>${displayHeader}</span> ▾
          </button>

          <button class="btn-gmaps-layer" id="btn-toggle-satellite" title="Alternar Satélite / Callejero">🛰️</button>
        </div>

        <!-- Barra de Búsqueda de Calles Reales, Barrios y Direcciones -->
        <div class="gmaps-search-bar">
          <div class="gmaps-input-wrapper">
            <span class="gmaps-search-icon">🔍</span>
            <input type="text" id="gmaps-search-input" placeholder="Buscar tu calle, barrio o sitio en ${this.cityName}..." />
            <button class="gmaps-clear-btn hidden" id="gmaps-clear-btn">✕</button>
          </div>
          <button class="btn-gmaps-search-go" id="btn-search-go">Ir</button>
        </div>

        <!-- Barra de Calibración Exacta con un toque (Ideal cuando HTTP móvil bloquea GPS preciso) -->
        <div class="gmaps-calibrate-bar">
          <button class="btn-gmaps-calibrate ${this.isCalibratingGpsPin ? 'active' : ''}" id="btn-calibrate-gps-pin" type="button">
            📌 <span id="btn-calibrate-gps-text">${this.isCalibratingGpsPin ? '🎯 Toca tu calle o esquina exacta en el mapa...' : 'Calibrar mi punto exacto tocando el mapa'}</span>
          </button>
        </div>

        <!-- Chips de filtros de categorías rápidas -->
        <div class="gmaps-quick-chips">
          <button class="chip-btn active" data-filter="all">Todos</button>
          <button class="chip-btn" data-filter="cafe">☕ Cafeterías</button>
          <button class="chip-btn" data-filter="gas">⛽ Gasolineras</button>
          <button class="chip-btn" data-filter="bank">🏦 Bancos</button>
          <button class="chip-btn" data-filter="restaurant">🍽️ Restaurantes</button>
          <button class="chip-btn" data-filter="store">🛒 Supermercados</button>
          <button class="chip-btn" data-filter="park">🌳 Parques</button>
        </div>

        <!-- Indicador flotante de telemetría y movimiento en tiempo real -->
        <div class="gmaps-telemetry-badge" id="gmaps-telemetry-badge">
          <span class="telemetry-live-dot"></span>
          <span id="gmaps-telemetry-text">Vías Públicas y Espacios Públicos sincronizados</span>
        </div>

        <!-- Contenedor del Mapa Interactivo Leaflet / Google Maps -->
        <div id="gmaps-canvas-container" class="gmaps-map-view"></div>

        <!-- Botones flotantes de control de navegación -->
        <div class="gmaps-floating-controls">
          <button class="gmaps-fab ${this.followPlayer ? 'active' : ''}" id="btn-follow-player" title="Modo Seguir al Jugador (Centrado automático)">
            🧭
          </button>
          <button class="gmaps-fab" id="btn-center-player" title="Centrar cámara en el jugador">
            🎯
          </button>
          <button class="gmaps-fab" id="btn-gps-detect" title="Detectar mi GPS / IP real">
            📡
          </button>
          <button class="gmaps-fab" id="btn-zoom-in" title="Acercar">+</button>
          <button class="gmaps-fab" id="btn-zoom-out" title="Alejar">−</button>
        </div>

        <!-- Modal Selector de Ciudad / Barrio -->
        <div class="gmaps-city-modal hidden" id="gmaps-city-modal">
          <div class="modal-city-content">
            <div class="modal-city-header">
              <h3>Tu Ubicación Real en el Mundo</h3>
              <button class="modal-close-btn" id="btn-close-city-modal">✕</button>
            </div>
            <p class="modal-city-desc">Escribe tu dirección, barrio o ciudad exacta, o usa el detector GPS/IP:</p>
            <div class="modal-city-search">
              <input type="text" id="modal-city-input" placeholder="Ej: Calle 84 Barranquilla, Puerto Colombia, Chapinero..." />
              <button id="modal-city-search-btn">Ir</button>
            </div>
            <button class="btn-gps-detect-modal" id="modal-btn-detect-gps">
              📡 Detectar mi Ubicación Real (GPS / IP)
            </button>
            <button class="btn-gps-detect-modal" id="modal-btn-calibrate-pin">
              📌 Tocar el mapa para fijar mi esquina exacta
            </button>
            <div class="modal-city-list">
              <div class="city-group-title">Ciudades Populares:</div>
              <div class="city-grid" id="modal-city-presets">
                <!-- Generado dinámicamente -->
              </div>
            </div>
          </div>
        </div>

        <!-- Ficha de Información de Local Seleccionado (Bottom Sheet) -->
        <div class="gmaps-place-sheet hidden" id="gmaps-place-sheet">
          <!-- Renderizado dinámico del local seleccionado -->
        </div>
      </div>
    `;

    this.bindEvents(container);

    setTimeout(() => {
      this.initMap(container);
    }, 60);
  }

  bindEvents(container) {
    container.querySelector('#btn-maps-back').addEventListener('click', () => {
      if (this.game.smartphoneUI) {
        this.game.smartphoneUI.openApp('home');
      }
    });

    // Botón para activar/desactivar calibración de punto exacto tocando el mapa
    const calibrateBtn = container.querySelector('#btn-calibrate-gps-pin');
    if (calibrateBtn) {
      calibrateBtn.addEventListener('click', () => {
        this.isCalibratingGpsPin = !this.isCalibratingGpsPin;
        calibrateBtn.classList.toggle('active', this.isCalibratingGpsPin);
        const txt = container.querySelector('#btn-calibrate-gps-text');
        if (txt) {
          txt.innerText = this.isCalibratingGpsPin
            ? '🎯 Toca tu calle o esquina exacta en el mapa...'
            : 'Calibrar mi punto exacto tocando el mapa';
        }
      });
    }

    // Abrir Modal de Selección de Ciudad / Barrio
    const cityModal = container.querySelector('#gmaps-city-modal');
    container.querySelector('#gmaps-city-selector-btn').addEventListener('click', () => {
      this.openCityModal(container);
    });

    container.querySelector('#btn-close-city-modal').addEventListener('click', () => {
      cityModal.classList.add('hidden');
    });

    // Buscar ciudad o barrio en el modal
    const cityInput = container.querySelector('#modal-city-input');
    const searchCityBtn = container.querySelector('#modal-city-search-btn');

    const doSearchCity = async () => {
      const q = cityInput.value.trim();
      if (!q) return;
      await this.searchAndSetCustomCity(q);
      cityModal.classList.add('hidden');
    };

    searchCityBtn.addEventListener('click', doSearchCity);
    cityInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doSearchCity();
    });

    // Botón GPS / IP en el modal
    container.querySelector('#modal-btn-detect-gps').addEventListener('click', () => {
      this.autoDetectLocation(true);
      cityModal.classList.add('hidden');
    });

    // Botón Calibrar tocando el mapa desde el modal
    const modalCalibrateBtn = container.querySelector('#modal-btn-calibrate-pin');
    if (modalCalibrateBtn) {
      modalCalibrateBtn.addEventListener('click', () => {
        cityModal.classList.add('hidden');
        this.enableGpsCalibrationMode();
      });
    }

    // Poblar presets de ciudades en el modal
    const presetsContainer = container.querySelector('#modal-city-presets');
    Object.keys(this.presetCities).forEach(cName => {
      const cData = this.presetCities[cName];
      const btn = document.createElement('button');
      btn.className = `city-chip ${this.cityName === cName ? 'active' : ''}`;
      btn.innerText = `${cName} (${cData.country})`;
      btn.addEventListener('click', () => {
        this.streetLabel = `Centro Urbano, ${cName}`;
        this.calibrateExactGpsPoint(cData.lat, cData.lng, cName, this.streetLabel, 'user_pin');
        cityModal.classList.add('hidden');
      });
      presetsContainer.appendChild(btn);
    });

    // Barra de Búsqueda de Calles Reales, Barrios o Sitios
    const searchInput = container.querySelector('#gmaps-search-input');
    const clearBtn = container.querySelector('#gmaps-clear-btn');
    const searchGoBtn = container.querySelector('#btn-search-go');

    const handleFilterInput = () => {
      const q = searchInput.value.toLowerCase().trim();
      clearBtn.classList.toggle('hidden', q.length === 0);
      this.filterPlaces(q);
    };

    const handleSearchGo = async () => {
      const rawQuery = searchInput.value.trim();
      if (!rawQuery) return;
      const qLower = rawQuery.toLowerCase();
      const localMatch = this.places.find(
        p => p.name.toLowerCase().includes(qLower) || p.category.toLowerCase().includes(qLower)
      );
      if (localMatch) {
        this.selectPlace(localMatch);
        return;
      }
      // Buscar dirección, calle o barrio real en Nominatim OpenStreetMap
      const fullQuery = rawQuery.toLowerCase().includes(this.cityName.toLowerCase())
        ? rawQuery
        : `${rawQuery}, ${this.cityName}`;
      await this.searchAndSetCustomCity(fullQuery);
    };

    searchInput.addEventListener('input', handleFilterInput);
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSearchGo();
    });
    searchGoBtn.addEventListener('click', handleSearchGo);

    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearBtn.classList.add('hidden');
      this.filterPlaces('');
    });

    // Chips de categorías
    container.querySelectorAll('.chip-btn').forEach(chip => {
      chip.addEventListener('click', () => {
        container.querySelectorAll('.chip-btn').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const filter = chip.getAttribute('data-filter');
        this.filterPlacesByCategory(filter);
      });
    });

    // Alternar Satélite / Callejero
    container.querySelector('#btn-toggle-satellite').addEventListener('click', () => {
      this.toggleSatellite();
    });

    // Centrar en el jugador
    container.querySelector('#btn-center-player').addEventListener('click', () => {
      this.centerOnPlayer();
    });

    // Modo Seguir al Jugador
    const followBtn = container.querySelector('#btn-follow-player');
    followBtn.addEventListener('click', () => {
      this.followPlayer = !this.followPlayer;
      followBtn.classList.toggle('active', this.followPlayer);
      if (this.followPlayer) {
        this.centerOnPlayer();
      }
    });

    // Botón GPS / IP flotante
    container.querySelector('#btn-gps-detect').addEventListener('click', () => {
      this.returnPlayerToCurrentGPS();
    });

    // Zoom
    container.querySelector('#btn-zoom-in').addEventListener('click', () => {
      if (this.map) this.map.zoomIn();
    });

    container.querySelector('#btn-zoom-out').addEventListener('click', () => {
      if (this.map) this.map.zoomOut();
    });
  }

  openCityModal(container) {
    const modal = container.querySelector('#gmaps-city-modal');
    if (modal) {
      modal.classList.remove('hidden');
      const input = modal.querySelector('#modal-city-input');
      if (input) {
        input.value = '';
        input.focus();
      }
    }
  }

  async searchAndSetCustomCity(query) {
    const candidates = await this.searchNominatimCandidates(query);
    if (candidates.length > 0) {
      const top = candidates[0];
      this.calibrateExactGpsPoint(top.lat, top.lng, top.city, top.streetLabel, 'user_pin');
      return;
    }
    alert(`No pudimos localizar "${query}". También puedes tocar directamente tu calle en el mapa con el botón 📌.`);
  }

  initMap(container) {
    const mapDiv = container
      ? container.querySelector('#gmaps-canvas-container')
      : document.getElementById('gmaps-canvas-container');
    if (!mapDiv) return;

    if (this.map) {
      this.map.remove();
      this.map = null;
    }

    this.updatePlayerCoordinates();

    this.map = L.map(mapDiv, {
      center: [this.currentCoords.lat, this.currentCoords.lng],
      zoom: 17,
      zoomControl: false,
      attributionControl: true
    });

    this.tileLayerRoad = L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      attribution: '© Google Maps'
    });

    this.tileLayerSat = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      attribution: '© Google Maps Imagery'
    });

    if (this.isSatellite) {
      this.tileLayerSat.addTo(this.map);
    } else {
      this.tileLayerRoad.addTo(this.map);
    }

    this.walkableLayerGroup = L.layerGroup().addTo(this.map);
    this.renderWalkableOverlayOnMap();

    this.createPlayerMarker();
    this.renderPlaceMarkers();

    this.map.on('click', (e) => {
      this.handleMapClick(e.latlng);
    });

    setTimeout(() => {
      if (this.map) this.map.invalidateSize();
    }, 200);
  }

  renderWalkableOverlayOnMap() {
    if (!this.map || !this.walkableLayerGroup || !this.game || !this.game.world) return;

    this.walkableLayerGroup.clearLayers();
    const world = this.game.world;

    // Dibujar parques y espacios públicos en verde translúcido
    for (const space of world.publicSpaces) {
      if (space.points && space.points.length >= 3) {
        const latlngs = space.points.map(p => [p.lat, p.lng]);
        L.polygon(latlngs, {
          color: '#16a34a',
          fillColor: '#22c55e',
          fillOpacity: 0.28,
          weight: 2
        })
          .bindTooltip(`🌳 Espacio Público: ${space.name}`, { sticky: true })
          .addTo(this.walkableLayerGroup);
      } else if (Number.isFinite(space.radius) && Number.isFinite(space.lat)) {
        L.circle([space.lat, space.lng], {
          radius: space.radius * this.movementScale,
          color: '#22c55e',
          fillColor: '#4ade80',
          fillOpacity: 0.22,
          weight: 1.5
        }).addTo(this.walkableLayerGroup);
      }
    }
  }

  updatePlayerCoordinates() {
    const pPos = (this.game.player.isInVehicle && this.game.vehicle)
      ? this.game.vehicle.position
      : this.game.player.position;

    const metersPerDegreeLat = 111139;
    const rad = this.baseCoords.lat * (Math.PI / 180);
    const metersPerDegreeLng = 111139 * Math.cos(rad);

    const deltaLat = (-pPos.z * this.movementScale) / metersPerDegreeLat;
    const deltaLng = (pPos.x * this.movementScale) / metersPerDegreeLng;

    this.currentCoords = {
      lat: this.baseCoords.lat + deltaLat,
      lng: this.baseCoords.lng + deltaLng
    };

    const rotY = (this.game.player.isInVehicle && this.game.vehicle)
      ? this.game.vehicle.rotationY
      : this.game.player.rotationY;

    this.currentHeadingDeg = (-rotY * (180 / Math.PI)) % 360;
  }

  createPlayerMarker() {
    if (!this.map) return;

    const playerIcon = L.divIcon({
      className: 'gmaps-nav-player-icon',
      html: `
        <div class="gmaps-player-heading-cone" id="gmaps-player-heading" style="transform: rotate(${this.currentHeadingDeg}deg);">
          <div class="heading-arrow"></div>
        </div>
        <div class="gmaps-player-dot-core"></div>
        <div class="gmaps-player-beacon-ring"></div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

    this.playerMarker = L.marker([this.currentCoords.lat, this.currentCoords.lng], {
      icon: playerIcon,
      zIndexOffset: 1200
    }).addTo(this.map);

    this.playerMarker.bindTooltip('Tu Ubicación (En Vivo)', {
      permanent: false,
      direction: 'top',
      offset: [0, -14]
    });
  }

  renderPlaceMarkers(filteredPlaces = null) {
    if (!this.map) return;

    this.placeMarkers.forEach(m => m.remove());
    this.placeMarkers = [];

    const list = filteredPlaces || this.places;

    list.forEach(place => {
      const pinHtml = `
        <div class="gmaps-pin" style="background-color: ${place.color};">
          <span class="gmaps-pin-icon">${place.icon}</span>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'gmaps-custom-pin-wrapper',
        html: pinHtml,
        iconSize: [36, 42],
        iconAnchor: [18, 40]
      });

      const marker = L.marker([place.lat, place.lng], { icon: customIcon }).addTo(this.map);

      marker.on('click', () => {
        this.selectPlace(place);
      });

      this.placeMarkers.push(marker);
    });
  }

  selectPlace(place) {
    const sheet = document.getElementById('gmaps-place-sheet');
    if (!sheet) return;

    const distMeters = Math.round(
      this.getDistanceMeters(this.currentCoords, { lat: place.lat, lng: place.lng })
    );

    sheet.innerHTML = `
      <div class="sheet-header">
        <div class="sheet-title-col">
          <h3>${place.name}</h3>
          <div class="sheet-rating">
            <span class="stars">★★★★★</span>
            <strong>${place.rating}</strong>
            <span class="reviews">(${place.reviewsCount} reseñas en Google Maps)</span>
          </div>
          <span class="sheet-category">${place.category}</span>
        </div>
        <button class="sheet-close-btn" id="btn-close-sheet">✕</button>
      </div>

      <div class="sheet-body">
        <p class="sheet-desc">${place.desc}</p>
        <div class="sheet-meta-row">
          <span>📍 <strong>Dirección:</strong> ${place.address}</span>
          <span>📏 <strong>Distancia:</strong> ${distMeters > 1000 ? (distMeters / 1000).toFixed(1) + ' km' : distMeters + ' m'}</span>
        </div>
        <div class="sheet-status text-green">🟢 Abierto ahora • Cierra a las 23:00</div>
      </div>

      <div class="sheet-actions">
        <button class="btn-sheet-primary" id="btn-route-to-place">
          🚗 Trazar Ruta de Navegación
        </button>
        <button class="btn-sheet-action" id="btn-place-action">
          ${place.actionText}
        </button>
        <button class="btn-sheet-teleport" id="btn-teleport-place">
          ⚡ Ir Aquí por Vía Pública (3D)
        </button>
      </div>
    `;

    sheet.classList.remove('hidden');

    sheet.querySelector('#btn-close-sheet').addEventListener('click', () => {
      sheet.classList.add('hidden');
    });

    sheet.querySelector('#btn-route-to-place').addEventListener('click', () => {
      this.drawRoute(this.currentCoords, { lat: place.lat, lng: place.lng });
    });

    sheet.querySelector('#btn-place-action').addEventListener('click', () => {
      this.executePlaceAction(place);
    });

    sheet.querySelector('#btn-teleport-place').addEventListener('click', () => {
      this.teleportPlayerToPlace(place);
    });

    if (this.map) {
      this.map.panTo([place.lat, place.lng]);
    }

    if (this.game.audioManager) {
      this.game.audioManager.playUiClick();
    }
  }

  executePlaceAction(place) {
    if (place.action === 'buyCoffee') {
      if (this.game.player.cash >= 4.5) {
        this.game.player.cash -= 4.5;
        this.game.player.stamina = Math.min(100, this.game.player.stamina + 35);
        if (this.game.audioManager) this.game.audioManager.playCash();
        alert('☕ ¡Has comprado un café gourmet! +35% Estamina.');
      } else {
        alert('Fondos insuficientes.');
      }
    } else if (place.action === 'eatMeal') {
      if (this.game.player.cash >= 18.0) {
        this.game.player.cash -= 18.0;
        this.game.player.stamina = 100;
        if (this.game.audioManager) this.game.audioManager.playCash();
        alert('🍱 ¡Almuerzo completo! Estamina recuperada al 100%.');
      } else {
        alert('Fondos insuficientes.');
      }
    } else if (place.action === 'buySupplies') {
      if (this.game.player.cash >= 25.0) {
        this.game.player.cash -= 25.0;
        this.game.player.stamina = 100;
        if (this.game.audioManager) this.game.audioManager.playCash();
        alert('🛒 ¡Compra en el supermercado realizada con éxito!');
      } else {
        alert('Fondos insuficientes.');
      }
    } else if (place.action === 'refuel') {
      if (this.game.player.isInVehicle && this.game.vehicle) {
        const res = this.game.vehicle.refuel(30, this.game.commodities.fuelPricePerLiter);
        if (res.added > 0) {
          this.game.player.cash -= res.cost;
          if (this.game.audioManager) this.game.audioManager.playCash();
          alert(`⛽ Has repostado ${res.added.toFixed(1)}L por $${res.cost.toFixed(2)}.`);
        }
      } else {
        alert('Súbete a tu coche o acércate a la gasolinera para repostar.');
      }
    } else if (place.action === 'openStocks') {
      this.game.smartphoneUI.openApp('stocks');
    } else if (place.action === 'restPark') {
      this.game.player.stamina = 100;
      alert('🌳 Te has relajado en el parque público. Estamina restaurada al 100%.');
    }
  }

  teleportPlayerToPlace(place) {
    const metersPerDegreeLat = 111139;
    const rad = this.baseCoords.lat * (Math.PI / 180);
    const metersPerDegreeLng = 111139 * Math.cos(rad);

    const deltaLat = place.lat - this.baseCoords.lat;
    const deltaLng = place.lng - this.baseCoords.lng;

    let worldZ = -(deltaLat * metersPerDegreeLat) / this.movementScale;
    let worldX = (deltaLng * metersPerDegreeLng) / this.movementScale;

    // Ajustar siempre a la vía pública o espacio público más cercano
    if (this.game.world) {
      const snapped = this.game.world.getNearestWalkablePoint(worldX, worldZ);
      worldX = snapped.x;
      worldZ = snapped.z;
    }

    this.game.player.position.set(worldX, 0.1, worldZ);
    this.gpsPendingDelta = { x: 0, z: 0 };
    this.gpsTargetWorldOffset = { x: 0, z: 0 };
    if (this.game.player.isInVehicle && this.game.vehicle) {
      this.game.vehicle.position.set(worldX, 0.1, worldZ);
      this.game.vehicle.speed = 0;
    }

    if (this.game.audioManager) {
      this.game.audioManager.playUiClick();
    }

    this.notifyLocationChange(place.name);
  }

  drawRoute(start, end) {
    if (!this.map) return;

    if (this.routePolyline) {
      this.routePolyline.remove();
    }

    const midLat = (start.lat + end.lat) / 2 + 0.00015;
    const midLng = (start.lng + end.lng) / 2;

    const latlngs = [
      [start.lat, start.lng],
      [midLat, start.lng],
      [midLat, end.lng],
      [end.lat, end.lng]
    ];

    this.routePolyline = L.polyline(latlngs, {
      color: '#4285F4',
      weight: 6,
      opacity: 0.85,
      dashArray: '8, 8'
    }).addTo(this.map);

    this.map.fitBounds(this.routePolyline.getBounds(), { padding: [40, 40] });
  }

  handleMapClick(latlng) {
    // Si el modo de calibración de punto exacto está activo, fijar este punto inmediatamente como origen GPS real
    if (this.isCalibratingGpsPin) {
      this.calibrateExactGpsPoint(latlng.lat, latlng.lng);
      return;
    }

    const sheet = document.getElementById('gmaps-place-sheet');
    if (!sheet) return;

    sheet.innerHTML = `
      <div class="sheet-header">
        <div>
          <h3>Punto Seleccionado en el Mapa</h3>
          <span class="sheet-category">Coordenadas: ${latlng.lat.toFixed(5)}°, ${latlng.lng.toFixed(5)}°</span>
        </div>
        <button class="sheet-close-btn" id="btn-close-sheet">✕</button>
      </div>
      <div class="sheet-actions">
        <button class="btn-sheet-primary" id="btn-set-as-real-gps">
          📌 Fijar este punto como mi Ubicación GPS Real
        </button>
        <button class="btn-sheet-action" id="btn-route-here">
          🚗 Trazar Ruta Aquí
        </button>
        <button class="btn-sheet-teleport" id="btn-walk-here">
          🚶 Desplazarse a la Vía Pública más cercana
        </button>
      </div>
    `;

    sheet.classList.remove('hidden');

    sheet.querySelector('#btn-close-sheet').addEventListener('click', () => {
      sheet.classList.add('hidden');
    });

    sheet.querySelector('#btn-set-as-real-gps').addEventListener('click', () => {
      sheet.classList.add('hidden');
      this.calibrateExactGpsPoint(latlng.lat, latlng.lng);
    });

    sheet.querySelector('#btn-route-here').addEventListener('click', () => {
      this.drawRoute(this.currentCoords, latlng);
    });

    sheet.querySelector('#btn-walk-here').addEventListener('click', () => {
      sheet.classList.add('hidden');
      this.teleportPlayerToPlace({ lat: latlng.lat, lng: latlng.lng, name: 'Vía Pública Seleccionada' });
    });
  }

  filterPlaces(query) {
    if (!query) {
      this.renderPlaceMarkers(this.places);
      return;
    }
    const filtered = this.places.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.category.toLowerCase().includes(query) ||
      p.address.toLowerCase().includes(query)
    );
    this.renderPlaceMarkers(filtered);
  }

  filterPlacesByCategory(category) {
    if (category === 'all') {
      this.renderPlaceMarkers(this.places);
      return;
    }
    const filtered = this.places.filter(p => p.type === category);
    this.renderPlaceMarkers(filtered);
  }

  toggleSatellite() {
    if (!this.map) return;
    this.isSatellite = !this.isSatellite;
    if (this.isSatellite) {
      this.map.removeLayer(this.tileLayerRoad);
      this.map.addLayer(this.tileLayerSat);
    } else {
      this.map.removeLayer(this.tileLayerSat);
      this.map.addLayer(this.tileLayerRoad);
    }
  }

  centerOnPlayer() {
    this.updatePlayerCoordinates();
    if (this.map && this.playerMarker) {
      this.playerMarker.setLatLng([this.currentCoords.lat, this.currentCoords.lng]);
      this.map.setView([this.currentCoords.lat, this.currentCoords.lng], 17, { animate: true });
    }
  }

  getDistanceMeters(p1, p2) {
    const R = 6371e3;
    const φ1 = p1.lat * Math.PI / 180;
    const φ2 = p2.lat * Math.PI / 180;
    const Δφ = (p2.lat - p1.lat) * Math.PI / 180;
    const Δλ = (p2.lng - p1.lng) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  update(dt = 0.016) {
    // 1. Interpolación suave del GPS (anti-shake & jitter stabilization)
    if (this.gpsPendingDelta) {
      const pendingDist = Math.hypot(this.gpsPendingDelta.x, this.gpsPendingDelta.z);
      if (pendingDist > 0.02) {
        const safeDt = Math.min(Math.max(dt || 0.016, 0.001), 0.1);
        const lerpFactor = 1.0 - Math.exp(-safeDt * 4.5); // Amortiguación exponencial suave
        const stepX = this.gpsPendingDelta.x * lerpFactor;
        const stepZ = this.gpsPendingDelta.z * lerpFactor;

        if (this.game && this.game.player) {
          const currentPos = this.game.player.position;
          const targetPos = currentPos.clone();
          targetPos.x += stepX;
          targetPos.z += stepZ;

          const clamped = this.game.world
            ? this.game.world.clampToWalkable(currentPos, targetPos)
            : targetPos;

          this.game.player.position.copy(clamped);
          if (this.game.player.mesh) {
            this.game.player.mesh.position.copy(clamped);
          }
          if (this.game.player.isInVehicle && this.game.vehicle) {
            this.game.vehicle.position.copy(clamped);
            if (this.game.vehicle.mesh) {
              this.game.vehicle.mesh.position.copy(clamped);
            }
          }
        }

        this.gpsPendingDelta.x -= stepX;
        this.gpsPendingDelta.z -= stepZ;
      } else {
        this.gpsPendingDelta.x = 0;
        this.gpsPendingDelta.z = 0;
      }
    }

    // 2. Sincronización del mapa Leaflet 2D si está inicializado
    if (this.map && this.playerMarker) {
      this.updatePlayerCoordinates();
      this.playerMarker.setLatLng([this.currentCoords.lat, this.currentCoords.lng]);

      const headingEl = document.getElementById('gmaps-player-heading');
      if (headingEl) {
        headingEl.style.transform = `rotate(${this.currentHeadingDeg}deg)`;
      }

      if (this.followPlayer && !this.isCalibratingGpsPin) {
        this.map.panTo([this.currentCoords.lat, this.currentCoords.lng], { animate: false });
      }

      const badgeText = document.getElementById('gmaps-telemetry-text');
      if (badgeText) {
        const speed = (this.game.player.isInVehicle && this.game.vehicle)
          ? `${this.game.vehicle.getSpeedKmH()} km/h (Coche)`
          : 'A pie';
        const locLabel = this.streetLabel ? `${this.streetLabel} (${this.cityName})` : this.cityName;
        badgeText.innerText = `${locLabel} • ${speed}`;
      }
    }
  }
}
