// World.js - Generación sincronizada con calles y parques reales (OpenStreetMap Overpass) estilo Pokémon y restricción estricta a vías/espacios públicos
import * as THREE from 'three';

export class World {
  constructor(scene, physicsWorld) {
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    if (this.physicsWorld) {
      this.physicsWorld.world = this;
    }

    this.interactiveSpots = [];
    this.nightLights = [];
    this.tallGrassPatches = [];
    this.grassBlades = [];

    // Geometría de caminabilidad estricta: SOLO vías públicas (roadSegments) y espacios públicos (publicSpaces)
    this.roadSegments = [];
    this.publicSpaces = [];
    this.lastBlockedByPrivateProperty = false;
    this.lastBlockedNoticeTime = 0;
    this.onBlockedByPrivateProperty = null;
    this.onWorldGeometryReady = null;
    this.onStatusChange = null;

    this.baseCoords = { lat: 10.9685, lng: -74.7813 };
    this.movementScale = 2.8;
    this.osmAbortController = null;
    this.lastLoadedCoordKey = '';

    // Grupo estático base (pradera de fondo) y grupo dinámico para calles/parques/edificios reales
    this.dynamicWorldGroup = new THREE.Group();
    this.scene.add(this.dynamicWorldGroup);

    this.zones = [
      {
        id: 'pueblo_origen',
        name: 'Zona Residencial Pública',
        title: 'Zona Residencial Pública',
        subtitle: 'Vías y Espacios Públicos Transitables',
        badge: '🛣️ VÍA PÚBLICA',
        icon: '🏡',
        accentColor: '#4ade80',
        isRoute: false,
        bounds: { xMin: -50, xMax: 135, zMin: 12, zMax: 140 }
      },
      {
        id: 'ruta_101',
        name: 'Parque Lineal & Sendero',
        title: 'Parque Lineal & Sendero',
        subtitle: 'Espacio Público con Hierba Alta',
        badge: '🌳 ESPACIO PÚBLICO',
        icon: '🌿',
        accentColor: '#84cc16',
        isRoute: true,
        bounds: { xMin: -50, xMax: 135, zMin: -20, zMax: 12 }
      },
      {
        id: 'ciudad_azafran',
        name: 'Sector Financiero Urbano',
        title: 'Sector Financiero Urbano',
        subtitle: 'Avenidas Principales & Comercio',
        badge: '🏙️ VÍA URBANA',
        icon: '🏙️',
        accentColor: '#38bdf8',
        isRoute: false,
        bounds: { xMin: -50, xMax: 135, zMin: -140, zMax: -20 }
      },
      {
        id: 'ruta_102',
        name: 'Corredor Vial Oeste',
        title: 'Corredor Vial Oeste',
        subtitle: 'Centro de Energía y Vehículos',
        badge: '⚡ VÍA PÚBLICA',
        icon: '⚡',
        accentColor: '#f59e0b',
        isRoute: true,
        bounds: { xMin: -140, xMax: -50, zMin: -68, zMax: 140 }
      },
      {
        id: 'distrito_industrial',
        name: 'Distrito Logístico',
        title: 'Distrito Logístico',
        subtitle: 'Planta Tecnológica & Servicios',
        badge: '⚙️ SECTOR VIAL',
        icon: '⚙️',
        accentColor: '#fb923c',
        isRoute: false,
        bounds: { xMin: -140, xMax: -50, zMin: -140, zMax: -68 }
      }
    ];

    this.createBaseGround();
    this.buildFallbackNeighborhood();
  }

  createBaseGround() {
    // Suelo base (manzanas/terreno privado no transitable salvo por vías o parques públicos)
    const groundGeo = new THREE.PlaneGeometry(520, 520);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x3b6e28 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  clearDynamicWorld() {
    while (this.dynamicWorldGroup.children.length > 0) {
      const child = this.dynamicWorldGroup.children.pop();
      this.dynamicWorldGroup.remove(child);
    }
    if (this.physicsWorld) {
      this.physicsWorld.staticColliders = [];
    }
    this.nightLights = [];
    this.tallGrassPatches = [];
    this.grassBlades = [];
    this.interactiveSpots = [];
    this.roadSegments = [];
    this.publicSpaces = [];
  }

  latLngToWorld(lat, lng, baseLat = this.baseCoords.lat, baseLng = this.baseCoords.lng, scale = this.movementScale) {
    const metersPerDegreeLat = 111139;
    const rad = baseLat * (Math.PI / 180);
    const metersPerDegreeLng = 111139 * Math.cos(rad);
    const x = ((lng - baseLng) * metersPerDegreeLng) / scale;
    const z = -((lat - baseLat) * metersPerDegreeLat) / scale;
    return { x, z };
  }

  worldToLatLng(x, z, baseLat = this.baseCoords.lat, baseLng = this.baseCoords.lng, scale = this.movementScale) {
    const metersPerDegreeLat = 111139;
    const rad = baseLat * (Math.PI / 180);
    const metersPerDegreeLng = 111139 * Math.cos(rad);
    const lat = baseLat + (-z * scale) / metersPerDegreeLat;
    const lng = baseLng + (x * scale) / metersPerDegreeLng;
    return { lat, lng };
  }

  loadRealWorldData(lat, lng, movementScale = 2.8) {
    return this.loadRealWorldGeometry(lat, lng, movementScale);
  }

  async loadRealWorldGeometry(lat, lng, movementScale = 2.8) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    this.baseCoords = { lat, lng };
    this.movementScale = movementScale || 2.8;

    const cacheKey = `osm_cache_${lat.toFixed(4)}_${lng.toFixed(4)}`;
    const osrmCacheKey = `osrm_cache_${lat.toFixed(4)}_${lng.toFixed(4)}`;
    const coordKey = `${lat.toFixed(4)}_${lng.toFixed(4)}`;

    if (this.osmAbortController) {
      this.osmAbortController.abort();
    }
    this.osmAbortController = new AbortController();
    const signal = this.osmAbortController.signal;

    // 1. Revisar caché local en sessionStorage para carga inmediata de 0ms
    try {
      const cachedOsm = sessionStorage.getItem(cacheKey);
      if (cachedOsm) {
        const osmData = JSON.parse(cachedOsm);
        if (osmData && Array.isArray(osmData.elements) && osmData.elements.length > 0) {
          this.lastLoadedCoordKey = coordKey;
          const stats = this.buildFromOSMData(osmData, lat, lng, this.movementScale);
          if (typeof this.onStatusChange === 'function') {
            this.onStatusChange({
              status: 'success',
              message: `Calles reales cargadas (${stats.roadCount} vías, ${stats.parkCount} espacios públicos)`
            });
          }
          if (typeof this.onWorldGeometryReady === 'function') {
            this.onWorldGeometryReady({ source: 'osm_cache', lat, lng, stats });
          }
          return;
        }
      }

      const cachedOsrm = sessionStorage.getItem(osrmCacheKey);
      if (cachedOsrm) {
        const osrmData = JSON.parse(cachedOsrm);
        if (osrmData && Array.isArray(osrmData.waypoints) && osrmData.waypoints.length > 0) {
          this.lastLoadedCoordKey = coordKey;
          const stats = this.buildFromOSRMData(osrmData, lat, lng, this.movementScale);
          if (typeof this.onStatusChange === 'function') {
            this.onStatusChange({
              status: 'success',
              message: `Calles reales cargadas vía OSRM (${stats.roadCount} vías reales)`
            });
          }
          if (typeof this.onWorldGeometryReady === 'function') {
            this.onWorldGeometryReady({ source: 'osrm_cache', lat, lng, stats });
          }
          return;
        }
      }
    } catch (e) {
      // Ignorar errores de caché
    }

    // 2. Construir red inicial inmediata alrededor de (lat, lng) para movimiento instantáneo
    this.clearDynamicWorld();
    this.buildFallbackNeighborhood(lat, lng);
    if (typeof this.onWorldGeometryReady === 'function') {
      this.onWorldGeometryReady({ source: 'fallback', lat, lng });
    }

    if (typeof this.onStatusChange === 'function') {
      this.onStatusChange({
        status: 'loading',
        message: 'Descargando vías reales de OpenStreetMap...'
      });
    }

    // 3. PASO 1 (Prioridad Máxima): Geometría Oficial de OpenStreetMap (API 0.6 Oficial + Overpass Espejos en paralelo)
    try {
      const osmData = await this.fetchRealStreetsInParallel(lat, lng, 4000, signal);
      if (signal.aborted) return;
      if (
        osmData &&
        Array.isArray(osmData.elements) &&
        osmData.elements.some(el => el.type === 'way' && el.tags && el.tags.highway)
      ) {
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(osmData));
        } catch (e) {}

        this.lastLoadedCoordKey = coordKey;
        const stats = this.buildFromOSMData(osmData, lat, lng, this.movementScale);
        if (typeof this.onStatusChange === 'function') {
          this.onStatusChange({
            status: 'success',
            message: `Calles reales exactas cargadas (${stats.roadCount} vías de tu barrio)`
          });
        }
        if (typeof this.onWorldGeometryReady === 'function') {
          this.onWorldGeometryReady({ source: 'osm', lat, lng, stats });
        }
        return;
      }
    } catch (err) {
      // Continuar con OSRM si OpenStreetMap oficial no está disponible
    }

    // 4. PASO 2: Respaldo Rápido con OSRM
    try {
      const osrmResult = await this.fetchOSRMStreets(lat, lng, signal);
      if (signal.aborted) return;
      if (osrmResult && Array.isArray(osrmResult.waypoints) && osrmResult.waypoints.length > 0) {
        try {
          sessionStorage.setItem(osrmCacheKey, JSON.stringify(osrmResult));
        } catch (e) {}

        this.lastLoadedCoordKey = coordKey;
        const stats = this.buildFromOSRMData(osrmResult, lat, lng, this.movementScale);
        if (typeof this.onStatusChange === 'function') {
          this.onStatusChange({
            status: 'success',
            message: `Calles cargadas vía OSRM (${stats.roadCount} vías de tu zona)`
          });
        }
        if (typeof this.onWorldGeometryReady === 'function') {
          this.onWorldGeometryReady({ source: 'osrm', lat, lng, stats });
        }
        return;
      }
    } catch (err) {
      if (typeof this.onStatusChange === 'function') {
        this.onStatusChange({
          status: 'warning',
          message: 'Red local activa en tu ubicación actual'
        });
      }
    }
  }

  async fetchRealStreetsInParallel(lat, lng, timeoutMs = 4000, signal = null) {
    // 1. API Oficial de OpenStreetMap (Descarga vectorial pura sin intermediarios ni saturación)
    const officialFetch = this.fetchOsmOfficialApi(lat, lng, timeoutMs, signal);

    // 2. Espejos Overpass con timeout de protección y cobertura completa de edificios, mar, parques y arroyos
    const query = `[out:json][timeout:7];(way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|service|living_street|pedestrian|footway)$"](around:450,${lat},${lng});way["building"](around:350,${lat},${lng});way["leisure"~"^(park|pitch|playground|garden|recreation_ground|sports_centre)$"](around:450,${lat},${lng});way["landuse"~"^(grass|village_green|recreation_ground|meadow)$"](around:450,${lat},${lng});way["waterway"~"^(stream|drain|canal)$"](around:450,${lat},${lng});way["natural"~"^(coastline|water|beach)$"](around:500,${lat},${lng}););out geom;`;
    const encoded = encodeURIComponent(query);
    const endpoints = [
      `https://overpass-api.de/api/interpreter?data=${encoded}`,
      `https://overpass.kumi.systems/api/interpreter?data=${encoded}`,
      `https://maps.mail.ru/osm/tools/overpass/api/interpreter?data=${encoded}`
    ];

    const fetchSingleOverpass = async (url) => {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), timeoutMs);
      const onAbort = () => ctrl.abort();
      if (signal) signal.addEventListener('abort', onAbort, { once: true });
      try {
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(tid);
        if (signal) signal.removeEventListener('abort', onAbort);
        if (res.ok) {
          const json = await res.json();
          if (json && Array.isArray(json.elements) && json.elements.length > 0) {
            return json;
          }
        }
      } catch (e) {
        clearTimeout(tid);
        if (signal) signal.removeEventListener('abort', onAbort);
      }
      throw new Error('Overpass endpoint falló o demoró');
    };

    try {
      return await Promise.any([officialFetch, ...endpoints.map(fetchSingleOverpass)]);
    } catch (e) {
      return null;
    }
  }

  async fetchOsmOfficialApi(lat, lng, timeoutMs = 4000, signal = null) {
    const delta = 0.0045; // ~500m de radio alrededor del jugador para detectar todos los parques y vías vecinas
    const minLng = (lng - delta).toFixed(5);
    const minLat = (lat - delta).toFixed(5);
    const maxLng = (lng + delta).toFixed(5);
    const maxLat = (lat + delta).toFixed(5);
    const url = `https://api.openstreetmap.org/api/0.6/map?bbox=${minLng},${minLat},${maxLng},${maxLat}`;

    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), timeoutMs);
    const onAbort = () => ctrl.abort();
    if (signal) signal.addEventListener('abort', onAbort, { once: true });

    try {
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(tid);
      if (signal) signal.removeEventListener('abort', onAbort);

      if (res.ok) {
        const xmlText = await res.text();
        if (typeof window !== 'undefined' && window.DOMParser) {
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

          const nodeMap = new Map();
          const nodeEls = xmlDoc.querySelectorAll('node');
          for (let i = 0; i < nodeEls.length; i++) {
            const n = nodeEls[i];
            const id = n.getAttribute('id');
            const nLat = parseFloat(n.getAttribute('lat'));
            const nLng = parseFloat(n.getAttribute('lon'));
            if (id && Number.isFinite(nLat) && Number.isFinite(nLng)) {
              nodeMap.set(id, { lat: nLat, lon: nLng });
            }
          }

          const elements = [];
          const wayEls = xmlDoc.querySelectorAll('way');
          for (let i = 0; i < wayEls.length; i++) {
            const w = wayEls[i];
            const tags = {};
            const tagEls = w.querySelectorAll('tag');
            for (let j = 0; j < tagEls.length; j++) {
              const t = tagEls[j];
              tags[t.getAttribute('k')] = t.getAttribute('v');
            }

            const isHighway = Boolean(tags.highway);
            const isBuilding = Boolean(tags.building);
            const isPark = /^(park|pitch|playground|garden|recreation_ground|sports_centre)$/.test(tags.leisure) ||
                           /^(grass|village_green|recreation_ground|meadow)$/.test(tags.landuse);
            const isWaterway = Boolean(tags.waterway);
            const isNatural = /^(coastline|water|beach)$/.test(tags.natural);

            if (isHighway || isBuilding || isPark || isWaterway || isNatural) {
              const geometry = [];
              const ndEls = w.querySelectorAll('nd');
              for (let j = 0; j < ndEls.length; j++) {
                const ref = ndEls[j].getAttribute('ref');
                const node = nodeMap.get(ref);
                if (node) {
                  geometry.push(node);
                }
              }
              if (geometry.length >= 2) {
                elements.push({
                  type: 'way',
                  id: w.getAttribute('id'),
                  tags,
                  geometry
                });
              }
            }
          }

          if (elements.length > 0) {
            return { elements };
          }
        }
      }
    } catch (e) {
      clearTimeout(tid);
      if (signal) signal.removeEventListener('abort', onAbort);
    }
    throw new Error('OSM Official API falló');
  }

  async fetchOSRMStreets(lat, lng, signal) {
    const footUrl = `https://routing.openstreetmap.de/routed-foot/nearest/v1/foot/${lng},${lat}?number=50`;
    const carUrl = `https://routing.openstreetmap.de/routed-car/nearest/v1/driving/${lng},${lat}?number=50`;

    const fetchEndpoint = async (url, timeoutMs = 2800) => {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), timeoutMs);
      const onAbort = () => ctrl.abort();
      if (signal) signal.addEventListener('abort', onAbort, { once: true });
      try {
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(tid);
        if (signal) signal.removeEventListener('abort', onAbort);
        if (res.ok) {
          return await res.json();
        }
      } catch (e) {
        clearTimeout(tid);
        if (signal) signal.removeEventListener('abort', onAbort);
      }
      return null;
    };

    const [footRes, carRes] = await Promise.allSettled([
      fetchEndpoint(footUrl, 2800),
      fetchEndpoint(carUrl, 2800)
    ]);

    const waypoints = [];
    const seenCoords = new Set();

    const addWaypoints = (data, isVehicle = false) => {
      if (data && Array.isArray(data.waypoints)) {
        for (const wp of data.waypoints) {
          if (!wp.location || wp.location.length < 2) continue;
          const wLng = wp.location[0];
          const wLat = wp.location[1];
          const locKey = `${wLat.toFixed(5)},${wLng.toFixed(5)}`;
          if (!seenCoords.has(locKey)) {
            seenCoords.add(locKey);
            waypoints.push({
              lat: wLat,
              lng: wLng,
              name: (wp.name || '').trim(),
              distance: wp.distance || 0,
              nodes: wp.nodes || [],
              isVehicle
            });
          }
        }
      }
    };

    if (footRes.status === 'fulfilled' && footRes.value) {
      addWaypoints(footRes.value, false);
    }
    if (carRes.status === 'fulfilled' && carRes.value) {
      addWaypoints(carRes.value, true);
    }

    return { waypoints };
  }


  buildFromOSRMData(osrmData, baseLat, baseLng, scale) {
    this.clearDynamicWorld();

    const rawWaypoints = osrmData.waypoints || [];
    if (rawWaypoints.length === 0) {
      return { roadCount: 0, parkCount: 0, sampleNames: [] };
    }

    const waypoints = [];
    const nameSet = new Set();

    for (const wp of rawWaypoints) {
      const w = this.latLngToWorld(wp.lat, wp.lng, baseLat, baseLng, scale);
      if (Math.hypot(w.x, w.z) > 280) continue;
      const cleanName = (wp.name || '').trim();
      if (cleanName) nameSet.add(cleanName);
      waypoints.push({
        lat: wp.lat,
        lng: wp.lng,
        x: w.x,
        z: w.z,
        name: cleanName || 'Calle Pública',
        isVehicle: Boolean(wp.isVehicle)
      });
    }

    if (waypoints.length === 0) {
      return { roadCount: 0, parkCount: 0, sampleNames: [] };
    }

    // Agrupar waypoints por nombre de calle real
    const streetMap = new Map();
    for (const wp of waypoints) {
      if (!streetMap.has(wp.name)) {
        streetMap.set(wp.name, []);
      }
      streetMap.get(wp.name).push(wp);
    }

    const vertexSet = new Set();
    const createdSegments = [];

    const addSegment = (a, b, width, name, isPedestrian = false) => {
      const segLen = Math.hypot(b.x - a.x, b.z - a.z);
      if (segLen < 0.4 || segLen > 180) return;

      const segKey = `${Math.round(a.x)},${Math.round(a.z)}_${Math.round(b.x)},${Math.round(b.z)}`;
      const revKey = `${Math.round(b.x)},${Math.round(b.z)}_${Math.round(a.x)},${Math.round(a.z)}`;
      if (createdSegments.includes(segKey) || createdSegments.includes(revKey)) return;
      createdSegments.push(segKey);

      this.addRoadSegment(
        a.x,
        a.z,
        b.x,
        b.z,
        width,
        name,
        isPedestrian ? 'footway' : 'residential',
        isPedestrian,
        a.lat,
        a.lng,
        b.lat,
        b.lng
      );

      const keyA = `${Math.round(a.x * 2)},${Math.round(a.z * 2)}`;
      if (!vertexSet.has(keyA)) {
        vertexSet.add(keyA);
        this.createRoadNodeCap(a.x, a.z, width, isPedestrian);
      }
      const keyB = `${Math.round(b.x * 2)},${Math.round(b.z * 2)}`;
      if (!vertexSet.has(keyB)) {
        vertexSet.add(keyB);
        this.createRoadNodeCap(b.x, b.z, width, isPedestrian);
      }
    };

    // 1. Trazar segmentos conectando los waypoints de cada calle
    for (const [name, pts] of streetMap.entries()) {
      const isCarrera = /carrera|cra|cr\b/i.test(name);
      const isAvenida = /avenida|av\b/i.test(name);
      const isPedestrian = /peatonal|sendero|pasaje/i.test(name);
      const width = isAvenida ? 6.5 : (isCarrera ? 5.8 : 5.2);

      if (pts.length >= 2) {
        let maxDist = 0;
        let startPt = pts[0];
        let endPt = pts[1];
        for (let i = 0; i < pts.length; i++) {
          for (let j = i + 1; j < pts.length; j++) {
            const d = Math.hypot(pts[j].x - pts[i].x, pts[j].z - pts[i].z);
            if (d > maxDist) {
              maxDist = d;
              startPt = pts[i];
              endPt = pts[j];
            }
          }
        }

        const dirX = endPt.x - startPt.x;
        const dirZ = endPt.z - startPt.z;
        const dirLen = Math.hypot(dirX, dirZ) || 1;
        const uX = dirX / dirLen;
        const uZ = dirZ / dirLen;

        pts.sort((p1, p2) => {
          const t1 = (p1.x - startPt.x) * uX + (p1.z - startPt.z) * uZ;
          const t2 = (p2.x - startPt.x) * uX + (p2.z - startPt.z) * uZ;
          return t1 - t2;
        });

        for (let i = 0; i < pts.length - 1; i++) {
          addSegment(pts[i], pts[i + 1], width, name, isPedestrian);
        }
      } else if (pts.length === 1) {
        const p = pts[0];
        const isNorthSouth = isCarrera || Math.abs(p.x) > Math.abs(p.z);
        const halfLen = 22;
        const aX = isNorthSouth ? p.x : p.x - halfLen;
        const aZ = isNorthSouth ? p.z - halfLen : p.z;
        const bX = isNorthSouth ? p.x : p.x + halfLen;
        const bZ = isNorthSouth ? p.z + halfLen : p.z;
        const ptA = { x: aX, z: aZ, ...this.worldToLatLng(aX, aZ, baseLat, baseLng, scale) };
        const ptB = { x: bX, z: bZ, ...this.worldToLatLng(bX, bZ, baseLat, baseLng, scale) };
        addSegment(ptA, ptB, width, name, isPedestrian);
      }
    }

    // 2. Limpieza: NO conectar puntos arbitrarios entre calles para evitar telarañas diagonales y solapamientos
    // Las intersecciones se forman naturalmente cuando los trazados de las calles se cruzan en el espacio 3D.

    // 3. Garantizar que el origen (0,0) esté conectado a la vía más cercana
    const originWalk = this.getNearestWalkablePoint(0, 0);
    const distToOrigin = Math.hypot(originWalk.x, originWalk.z);
    if (distToOrigin > 1.5) {
      const pOrig = { x: 0, z: 0, lat: baseLat, lng: baseLng };
      const pSnap = {
        x: originWalk.x,
        z: originWalk.z,
        ...this.worldToLatLng(originWalk.x, originWalk.z, baseLat, baseLng, scale)
      };
      addSegment(pOrig, pSnap, 4.5, 'Acceso Peatonal Principal', true);
    }

    this.addPublicCircleSpace(originWalk.x, originWalk.z, 6.5, 'Plazoleta de Acceso', true);

    // 4. Parques y Espacios Públicos: Solo se registran si provienen de datos geográficos reales
    // Se evita crear polígonos sintéticos arbitrarios que desfacen la realidad del mapa.

    // 5. Edificios suburbanos y farolas a lo largo de las vías
    this.renderSuburbanBlocks();
    this.populateAlongRealStreets();

    const sampleNames = Array.from(nameSet).slice(0, 4);

    return {
      roadCount: this.roadSegments.length,
      parkCount: this.publicSpaces.length,
      sampleNames
    };
  }

  buildFromOSMData(osmData, baseLat, baseLng, scale) {
    this.clearDynamicWorld();

    const highwayWays = [];
    const parkWays = [];
    const waterwayWays = [];
    const buildingWays = [];
    const naturalWays = [];

    for (const el of osmData.elements) {
      if (el.type === 'way') {
        const tags = el.tags || {};
        if (tags.highway) {
          highwayWays.push(el);
        } else if (tags.building) {
          buildingWays.push(el);
        } else if (
          /^(park|pitch|playground|garden|recreation_ground|sports_centre|common)$/.test(tags.leisure) ||
          /^(grass|village_green|recreation_ground|meadow)$/.test(tags.landuse)
        ) {
          parkWays.push(el);
        } else if (tags.waterway) {
          waterwayWays.push(el);
        } else if (/^(coastline|water|beach)$/.test(tags.natural)) {
          naturalWays.push(el);
        }
      }
    }

    const extractPoints = (way) => {
      if (Array.isArray(way.geometry) && way.geometry.length > 0) {
        return way.geometry.map(pt => {
          const w = this.latLngToWorld(pt.lat, pt.lon, baseLat, baseLng, scale);
          return { lat: pt.lat, lng: pt.lon, x: w.x, z: w.z };
        });
      }
      return [];
    };

    // 1. Procesar y renderizar ARROYOS / CANALES REALES como agua limpia sin cortar el asfalto
    for (const way of waterwayWays) {
      const tags = way.tags || {};
      const pts = extractPoints(way);
      const canalName = tags.name || 'Arroyo / Canal Pluvial';
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        if (Math.hypot(b.x - a.x, b.z - a.z) < 0.3) continue;
        this.addWaterwaySegment(a.x, a.z, b.x, b.z, 2.6, canalName);
      }
    }

    // 2. Procesar y renderizar VÍAS PÚBLICAS reales (highway) con calzadas limpias y aceras
    const vertexSet = new Set();
    for (const way of highwayWays) {
      const tags = way.tags || {};
      const hw = tags.highway;
      let width = 5.0;
      let isPedestrian = false;

      if (/^(motorway|trunk|primary|secondary|tertiary|primary_link|secondary_link)$/.test(hw)) {
        width = 6.8;
      } else if (/^(footway|pedestrian|path|steps)$/.test(hw)) {
        width = 2.4;
        isPedestrian = true;
      } else if (/^(service|track)$/.test(hw)) {
        width = 4.2;
        isPedestrian = false; // Calzadas de acceso pavimentadas limpias
      } else {
        width = 5.2;
      }

      const defaultRoadName = isPedestrian
        ? 'Paseo Peatonal Público'
        : (width >= 6.2 ? 'Avenida Principal' : 'Calle Pública');
      const roadName = tags.name || tags.ref || defaultRoadName;

      const pts = extractPoints(way);
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const segLen = Math.hypot(b.x - a.x, b.z - a.z);
        if (segLen < 0.3) continue;
        if (Math.hypot((a.x + b.x) * 0.5, (a.z + b.z) * 0.5) > 280) continue;

        this.addRoadSegment(a.x, a.z, b.x, b.z, width, roadName, hw, isPedestrian, a.lat, a.lng, b.lat, b.lng);

        const keyA = `${Math.round(a.x * 2)},${Math.round(a.z * 2)}`;
        if (!vertexSet.has(keyA)) {
          vertexSet.add(keyA);
          this.createRoadNodeCap(a.x, a.z, width, isPedestrian);
        }
        const keyB = `${Math.round(b.x * 2)},${Math.round(b.z * 2)}`;
        if (!vertexSet.has(keyB)) {
          vertexSet.add(keyB);
          this.createRoadNodeCap(b.x, b.z, width, isPedestrian);
        }
      }
    }

    // 3. Procesar y renderizar TODOS LOS PARQUES, CANCHAS Y ÁREAS DEPORTIVAS REALES con acceso 100% libre
    for (const way of parkWays) {
      const tags = way.tags || {};
      const pts = extractPoints(way);
      if (pts.length < 3) continue;

      let xMin = Infinity, xMax = -Infinity, zMin = Infinity, zMax = -Infinity;
      for (const p of pts) {
        if (p.x < xMin) xMin = p.x;
        if (p.x > xMax) xMax = p.x;
        if (p.z < zMin) zMin = p.z;
        if (p.z > zMax) zMax = p.z;
      }

      const cx = (xMin + xMax) * 0.5;
      const cz = (zMin + zMax) * 0.5;
      if (Math.hypot(cx, cz) > 260) continue;

      const isPitch = tags.leisure === 'pitch' || tags.leisure === 'sports_centre';
      const parkName = tags.name || (isPitch ? 'Cancha Deportiva Pública' : 'Parque Público');
      this.addPublicPolygonSpace(pts, { xMin, xMax, zMin, zMax }, parkName, isPitch);

      // Conectar el parque/cancha a la calle más cercana para acceso peatonal continuo garantizado
      const nearestStreetPt = this.getNearestWalkablePoint(cx, cz);
      const distToStreet = Math.hypot(nearestStreetPt.x - cx, nearestStreetPt.z - cz);
      if (distToStreet > 1.0 && distToStreet < 60) {
        this.addRoadSegment(nearestStreetPt.x, nearestStreetPt.z, cx, cz, 3.2, `Acceso a ${parkName}`, 'footway', true);
      }
    }

    // Garantizar plazoleta accesible en el origen (0,0)
    const originWalk = this.getNearestWalkablePoint(0, 0);
    this.addPublicCircleSpace(originWalk.x, originWalk.z, 6.5, 'Plazoleta de Acceso Público', true);

    // Solo conservar espacios públicos reales descargados desde OpenStreetMap

    // 4. Procesar y renderizar COSTA, MAR Y PLAYAS REALES
    this.renderNaturalWaterAndBeaches(naturalWays, extractPoints);

    // 5. Procesar y renderizar EDIFICIOS REALES DE OPENSTREETMAP con sus alturas y fachadas
    let buildingCount = 0;
    if (buildingWays.length > 0) {
      buildingCount = this.renderRealOsmBuildings(buildingWays, extractPoints);
    }
    if (buildingCount === 0) {
      // Bloques suburbanos agradables como respaldo si no hay edificios detallados en la base de datos
      this.renderSuburbanBlocks();
    }

    // 6. Farolas urbanas a lo largo de las vías públicas
    this.populateAlongRealStreets();

    return {
      roadCount: this.roadSegments.length,
      parkCount: this.publicSpaces.length,
      buildingCount
    };
  }

  renderNaturalWaterAndBeaches(naturalWays, extractPoints) {
    let hasCoastline = false;
    for (const way of naturalWays) {
      const tags = way.tags || {};
      const pts = extractPoints(way);
      if (pts.length < 2) continue;

      if (tags.natural === 'beach') {
        if (pts.length >= 3) {
          const shape = new THREE.Shape();
          shape.moveTo(pts[0].x, -pts[0].z);
          for (let i = 1; i < pts.length; i++) {
            shape.lineTo(pts[i].x, -pts[i].z);
          }
          shape.closePath();
          const beachGeo = new THREE.ShapeGeometry(shape);
          beachGeo.rotateX(-Math.PI / 2);
          const beachMat = new THREE.MeshLambertMaterial({ color: 0xfef08a, side: THREE.DoubleSide });
          const beachMesh = new THREE.Mesh(beachGeo, beachMat);
          beachMesh.position.y = 0.012;
          this.dynamicWorldGroup.add(beachMesh);
        }
      } else if (tags.natural === 'water' || tags.natural === 'coastline') {
        hasCoastline = true;
        if (pts.length >= 3) {
          const shape = new THREE.Shape();
          shape.moveTo(pts[0].x, -pts[0].z);
          for (let i = 1; i < pts.length; i++) {
            shape.lineTo(pts[i].x, -pts[i].z);
          }
          shape.closePath();
          const waterGeo = new THREE.ShapeGeometry(shape);
          waterGeo.rotateX(-Math.PI / 2);
          const waterMat = new THREE.MeshLambertMaterial({ color: 0x0284c7, transparent: true, opacity: 0.88, side: THREE.DoubleSide });
          const waterMesh = new THREE.Mesh(waterGeo, waterMat);
          waterMesh.position.y = 0.01;
          this.dynamicWorldGroup.add(waterMesh);
        }
      }
    }

    // Si la zona es costera o tiene línea de playa/mar detectada, renderizar mar caribeño expansivo al oeste
    if (hasCoastline || (this.baseCoords && this.baseCoords.lng < -74.95)) {
      const oceanGeo = new THREE.PlaneGeometry(600, 600);
      const oceanMat = new THREE.MeshLambertMaterial({
        color: 0x0284c7,
        transparent: true,
        opacity: 0.85
      });
      const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
      oceanMesh.rotation.x = -Math.PI / 2;
      oceanMesh.position.set(-260, -0.05, 0);
      this.dynamicWorldGroup.add(oceanMesh);
    }
  }

  renderRealOsmBuildings(buildingWays, extractPoints) {
    const wallPalette = [0xf8fafc, 0xfef3c7, 0xf1f5f9, 0xffedd5, 0xe0f2fe, 0xfef9c3, 0xfde047];
    const roofPalette = [0xef4444, 0x3b82f6, 0x10b981, 0xf59e0b, 0x64748b, 0x8b5cf6];

    let count = 0;
    const maxBuildings = 70; // Optimizado para 60 FPS fluidos en móviles y PC

    for (let i = 0; i < buildingWays.length && count < maxBuildings; i++) {
      const way = buildingWays[i];
      const tags = way.tags || {};
      const pts = extractPoints(way);
      if (pts.length < 3) continue;

      let xMin = Infinity, xMax = -Infinity, zMin = Infinity, zMax = -Infinity;
      for (const p of pts) {
        if (p.x < xMin) xMin = p.x;
        if (p.x > xMax) xMax = p.x;
        if (p.z < zMin) zMin = p.z;
        if (p.z > zMax) zMax = p.z;
      }

      const cx = (xMin + xMax) * 0.5;
      const cz = (zMin + zMax) * 0.5;
      const distToCenter = Math.hypot(cx, cz);
      if (distToCenter > 240) continue;

      // Si el edificio cae exactamente en medio de una calle principal transitable, omitir
      if (this.isPositionWalkable(cx, cz, -0.8)) continue;

      // Calcular altura real según etiquetas de OpenStreetMap
      let height = 4.8;
      if (tags.height) {
        height = Math.max(3.0, Math.min(35.0, parseFloat(tags.height) || 4.8));
      } else if (tags['building:levels']) {
        const lvls = parseInt(tags['building:levels'], 10) || 1;
        height = Math.max(3.2, Math.min(35.0, lvls * 3.3));
      } else if (/^(commercial|retail|office|school|hospital|apartments)$/.test(tags.building)) {
        height = 8.5;
      } else {
        height = 4.5 + (count % 3) * 1.8;
      }

      try {
        const shape = new THREE.Shape();
        shape.moveTo(pts[0].x, -pts[0].z);
        for (let j = 1; j < pts.length; j++) {
          shape.lineTo(pts[j].x, -pts[j].z);
        }
        shape.closePath();

        const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
          depth: height,
          bevelEnabled: false
        });
        extrudeGeo.rotateX(-Math.PI / 2);

        const wallColor = wallPalette[count % wallPalette.length];
        const wallMat = new THREE.MeshLambertMaterial({ color: wallColor });
        const buildingMesh = new THREE.Mesh(extrudeGeo, wallMat);
        buildingMesh.position.y = 0;
        buildingMesh.castShadow = true;
        buildingMesh.receiveShadow = true;
        this.dynamicWorldGroup.add(buildingMesh);

        // Tejado sutil o acento superior
        const roofShape = new THREE.Shape();
        roofShape.moveTo(pts[0].x, -pts[0].z);
        for (let j = 1; j < pts.length; j++) {
          roofShape.lineTo(pts[j].x, -pts[j].z);
        }
        roofShape.closePath();
        const roofGeo = new THREE.ShapeGeometry(roofShape);
        roofGeo.rotateX(-Math.PI / 2);
        const roofColor = roofPalette[count % roofPalette.length];
        const roofMat = new THREE.MeshLambertMaterial({ color: roofColor, side: THREE.DoubleSide });
        const roofMesh = new THREE.Mesh(roofGeo, roofMat);
        roofMesh.position.y = height + 0.05;
        this.dynamicWorldGroup.add(roofMesh);

        // Registrar colisión física sólida del edificio
        const width = Math.max(2.0, xMax - xMin);
        const depth = Math.max(2.0, zMax - zMin);
        const box = new THREE.Box3();
        box.setFromCenterAndSize(
          new THREE.Vector3(cx, height * 0.5, cz),
          new THREE.Vector3(width * 0.95, height, depth * 0.95)
        );
        if (this.physicsWorld) {
          const bLabel = tags.name || `Edificio Real (${tags.building || 'Urbano'})`;
          this.physicsWorld.addStaticBox(box, { label: bLabel });
        }

        count++;
      } catch (e) {
        // Continuar si algún polígono es auto-intersecante
      }
    }

    return count;
  }

  renderSuburbanBlocks() {
    const wallPalette = [0xfef3c7, 0xf1f5f9, 0xfef9c3, 0xffedd5, 0xe0f2fe];
    const roofPalette = [0xef4444, 0x3b82f6, 0x10b981, 0xeab308, 0x8b5cf6];

    const step = Math.max(1, Math.floor(this.roadSegments.length / 10));
    let houseCount = 0;

    for (let i = 0; i < this.roadSegments.length && houseCount < 10; i += step) {
      const seg = this.roadSegments[i];
      if (!seg) continue;
      const mx = (seg.ax + seg.bx) * 0.5;
      const mz = (seg.az + seg.bz) * 0.5;
      const dx = seg.bx - seg.ax;
      const dz = seg.bz - seg.az;
      const len = Math.hypot(dx, dz) || 1;
      const nx = -dz / len;
      const nz = dx / len;
      const side = (houseCount % 2 === 0 ? 1 : -1);
      const houseOffset = seg.width * 0.5 + 9.0;
      const hx = mx + nx * houseOffset * side;
      const hz = mz + nz * houseOffset * side;

      if (Math.hypot(hx, hz) < 180 && !this.isPositionWalkable(hx, hz, 0.8)) {
        this.createPokemonHouse(
          hx,
          hz,
          10,
          9,
          7.5,
          wallPalette[houseCount % wallPalette.length],
          roofPalette[houseCount % roofPalette.length],
          'Propiedad Privada'
        );

        const treeOffset = seg.width * 0.5 + 5.5;
        const tx = mx + nx * treeOffset * side + (dx / len) * 3.5;
        const tz = mz + nz * treeOffset * side + (dz / len) * 3.5;
        if (!this.isPositionWalkable(tx, tz, 0.4)) {
          this.createTree(tx, tz);
        }

        houseCount++;
      }
    }

    for (let i = 0; i < Math.min(20, this.roadSegments.length); i += 2) {
      const seg = this.roadSegments[i];
      if (!seg) continue;
      const mx = (seg.ax + seg.bx) * 0.5;
      const mz = (seg.az + seg.bz) * 0.5;
      const dx = seg.bx - seg.ax;
      const dz = seg.bz - seg.az;
      const len = Math.hypot(dx, dz) || 1;
      const tx = mx + (-dz / len) * (seg.width * 0.5 + 4.2);
      const tz = mz + (dx / len) * (seg.width * 0.5 + 4.2);
      if (Math.hypot(tx, tz) < 190 && !this.isPositionWalkable(tx, tz, 0.3)) {
        this.createTree(tx, tz);
      }
    }
  }

  createTree(tx, tz, scale = 1.0) {
    const treeTrunkGeo = new THREE.CylinderGeometry(0.32 * scale, 0.48 * scale, 2.4 * scale, 6);
    const treeTrunkMat = new THREE.MeshLambertMaterial({ color: 0x5d4037 });
    const treeFoliageGeo = new THREE.ConeGeometry(2.4 * scale, 4.8 * scale, 7);
    const treeFoliageMat = new THREE.MeshLambertMaterial({ color: 0x166534, flatShading: true });

    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(treeTrunkGeo, treeTrunkMat);
    trunk.position.y = 1.2 * scale;
    trunk.castShadow = true;
    tree.add(trunk);

    const foliage = new THREE.Mesh(treeFoliageGeo, treeFoliageMat);
    foliage.position.y = 4.2 * scale;
    foliage.castShadow = true;
    tree.add(foliage);

    tree.position.set(tx, 0, tz);
    this.dynamicWorldGroup.add(tree);

    const box = new THREE.Box3();
    box.setFromCenterAndSize(new THREE.Vector3(tx, 1.2 * scale, tz), new THREE.Vector3(0.8 * scale, 2.4 * scale, 0.8 * scale));
    if (this.physicsWorld) {
      this.physicsWorld.addStaticBox(box, { label: 'Árbol' });
    }
  }

  addWaterwaySegment(ax, az, bx, bz, width = 2.6, name = 'Arroyo') {
    const dx = bx - ax;
    const dz = bz - az;
    const length = Math.hypot(dx, dz);
    if (length < 0.2) return;

    const midX = (ax + bx) * 0.5;
    const midZ = (az + bz) * 0.5;
    const angle = Math.atan2(dx, dz);

    // Canal o lecho de agua limpia (altura y = 0.008 para que no corte el asfalto de las calles)
    const waterMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, length + 0.2),
      new THREE.MeshLambertMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.82 })
    );
    waterMesh.rotation.order = 'YXZ';
    waterMesh.rotation.y = angle;
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.set(midX, 0.008, midZ);
    this.dynamicWorldGroup.add(waterMesh);
  }

  addRoadSegment(ax, az, bx, bz, width = 5.0, name = 'Calle Pública', highwayType = 'residential', isPedestrian = false, aLat = null, aLng = null, bLat = null, bLng = null) {
    const startLatLng = (aLat !== null && aLng !== null) ? { lat: aLat, lng: aLng } : this.worldToLatLng(ax, az);
    const endLatLng = (bLat !== null && bLng !== null) ? { lat: bLat, lng: bLng } : this.worldToLatLng(bx, bz);

    this.roadSegments.push({
      ax,
      az,
      bx,
      bz,
      width,
      name,
      highwayType,
      isPedestrian,
      aLat: startLatLng.lat,
      aLng: startLatLng.lng,
      bLat: endLatLng.lat,
      bLng: endLatLng.lng
    });

    const dx = bx - ax;
    const dz = bz - az;
    const length = Math.hypot(dx, dz);
    if (length < 0.2) return;

    const midX = (ax + bx) * 0.5;
    const midZ = (az + bz) * 0.5;
    const angle = Math.atan2(dx, dz);

    // Acera / Borde peatonal: gris sobrio y limpio (sin barro marrón)
    const sidewalkColor = 0x94a3b8;
    const sidewalkMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(isPedestrian ? width + 0.6 : width + 1.8, length + 0.4),
      new THREE.MeshLambertMaterial({ color: sidewalkColor })
    );
    sidewalkMesh.rotation.order = 'YXZ';
    sidewalkMesh.rotation.y = angle;
    sidewalkMesh.rotation.x = -Math.PI / 2;
    sidewalkMesh.position.set(midX, isPedestrian ? 0.014 : 0.016, midZ);
    sidewalkMesh.receiveShadow = true;
    this.dynamicWorldGroup.add(sidewalkMesh);

    // Calzada:
    // Peatonal = adoquín gris claro limpio (0xd1d5db) a y = 0.018
    // Vehicular = asfalto gris oscuro limpio (0x22262e) a y = 0.025 (pasa siempre por encima)
    const roadColor = isPedestrian ? 0xd1d5db : 0x22262e;
    const roadMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, length + 0.3),
      new THREE.MeshLambertMaterial({ color: roadColor })
    );
    roadMesh.rotation.order = 'YXZ';
    roadMesh.rotation.y = angle;
    roadMesh.rotation.x = -Math.PI / 2;
    roadMesh.position.set(midX, isPedestrian ? 0.018 : 0.025, midZ);
    roadMesh.receiveShadow = true;
    this.dynamicWorldGroup.add(roadMesh);
  }

  createRoadNodeCap(x, z, width, isPedestrian = false) {
    const sidewalkCap = new THREE.Mesh(
      new THREE.CircleGeometry((isPedestrian ? width + 0.6 : width + 1.8) * 0.5, 14),
      new THREE.MeshLambertMaterial({ color: 0x94a3b8 })
    );
    sidewalkCap.rotation.x = -Math.PI / 2;
    sidewalkCap.position.set(x, isPedestrian ? 0.013 : 0.015, z);
    this.dynamicWorldGroup.add(sidewalkCap);

    const roadCap = new THREE.Mesh(
      new THREE.CircleGeometry(width * 0.5, 14),
      new THREE.MeshLambertMaterial({ color: isPedestrian ? 0xd1d5db : 0x22262e })
    );
    roadCap.rotation.x = -Math.PI / 2;
    roadCap.position.set(x, isPedestrian ? 0.017 : 0.024, z);
    this.dynamicWorldGroup.add(roadCap);
  }

  addPublicCircleSpace(cx, cz, radius, name = 'Plaza Pública', isSpawnBuffer = false) {
    const centerLatLng = this.worldToLatLng(cx, cz);
    this.publicSpaces.push({
      cx,
      cz,
      radius,
      name,
      isSpawnBuffer,
      lat: centerLatLng.lat,
      lng: centerLatLng.lng,
      bounds: { xMin: cx - radius, xMax: cx + radius, zMin: cz - radius, zMax: cz + radius }
    });

    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 24),
      new THREE.MeshLambertMaterial({ color: isSpawnBuffer ? 0x64748b : 0x4ade80 })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(cx, 0.014, cz);
    disc.receiveShadow = true;
    this.dynamicWorldGroup.add(disc);
  }

  addPublicPolygonSpace(pts, bounds, name = 'Parque Público', isPitch = false) {
    const cleanPts = pts.map(p => ({
      x: p.x,
      z: p.z,
      lat: p.lat ?? this.worldToLatLng(p.x, p.z).lat,
      lng: p.lng ?? this.worldToLatLng(p.x, p.z).lng
    }));

    this.publicSpaces.push({
      points: cleanPts,
      bounds,
      name,
      isPitch,
      isSpawnBuffer: false
    });

    // Renderizar superficie verde vibrante de Parque Público o Cancha Deportiva
    const shape = new THREE.Shape();
    shape.moveTo(cleanPts[0].x, -cleanPts[0].z);
    for (let i = 1; i < cleanPts.length; i++) {
      shape.lineTo(cleanPts[i].x, -cleanPts[i].z);
    }
    shape.closePath();

    const parkGeo = new THREE.ShapeGeometry(shape);
    parkGeo.rotateX(-Math.PI / 2);
    const parkColor = isPitch ? 0x22c55e : 0x4fb043;
    const parkMat = new THREE.MeshLambertMaterial({ color: parkColor, side: THREE.DoubleSide });
    const parkMesh = new THREE.Mesh(parkGeo, parkMat);
    parkMesh.position.y = 0.016;
    parkMesh.receiveShadow = true;
    this.dynamicWorldGroup.add(parkMesh);

    // Borde delimitador sutil de césped / acera del parque
    const linePts = [...cleanPts, cleanPts[0]].map(p => new THREE.Vector3(p.x, 0.02, p.z));
    const borderGeo = new THREE.BufferGeometry().setFromPoints(linePts);
    const borderMat = new THREE.LineBasicMaterial({ color: isPitch ? 0xffffff : 0x86efac });
    const borderLine = new THREE.Line(borderGeo, borderMat);
    this.dynamicWorldGroup.add(borderLine);

    if (!isPitch) {
      const cx = (bounds.xMin + bounds.xMax) * 0.5;
      const cz = (bounds.zMin + bounds.zMax) * 0.5;
      const w = Math.max(6, Math.min(22, bounds.xMax - bounds.xMin));
      const d = Math.max(6, Math.min(22, bounds.zMax - bounds.zMin));
      const cols = Math.max(3, Math.min(6, Math.floor(w / 3.0)));
      const rows = Math.max(3, Math.min(5, Math.floor(d / 3.0)));
      this.createTallGrassPatch(cx, cz, cols, rows, 1.2);
    }
  }

  populateAlongRealStreets() {
    let lampCount = 0;
    for (let i = 0; i < this.roadSegments.length && lampCount < 14; i += Math.max(1, Math.floor(this.roadSegments.length / 12))) {
      const seg = this.roadSegments[i];
      const mx = (seg.ax + seg.bx) * 0.5;
      const mz = (seg.az + seg.bz) * 0.5;
      if (Math.hypot(mx, mz) > 120) continue;

      const dx = seg.bx - seg.ax;
      const dz = seg.bz - seg.az;
      const len = Math.hypot(dx, dz) || 1;
      const nx = -dz / len;
      const nz = dx / len;
      const offset = seg.width * 0.5 + 1.1;

      this.createStreetLamp(mx + nx * offset, mz + nz * offset);
      lampCount++;
    }
  }

  createStreetLamp(lx, lz) {
    const lampPostGeo = new THREE.CylinderGeometry(0.12, 0.16, 5.5, 6);
    const lampPostMat = new THREE.MeshLambertMaterial({ color: 0x333333 });

    const lamp = new THREE.Group();
    const post = new THREE.Mesh(lampPostGeo, lampPostMat);
    post.position.y = 2.75;
    lamp.add(post);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xfff4cc })
    );
    head.position.set(0, 5.5, 0);
    lamp.add(head);

    const light = new THREE.PointLight(0xffea9f, 0.0, 22);
    light.position.set(lx, 5.4, lz);
    this.dynamicWorldGroup.add(light);
    this.nightLights.push(light);

    lamp.position.set(lx, 0, lz);
    this.dynamicWorldGroup.add(lamp);
  }

  setupInteractiveSpotsOnStreets() {
    const spotsTemplate = [
      { id: 'stock_exchange', name: 'Silph S.A. — Bolsa de Valores', targetX: -32, targetZ: -24, action: 'openStockMarket', icon: '📈' },
      { id: 'bank', name: 'Banco Central & Cajero', targetX: -28, targetZ: -56, action: 'openBank', icon: '🏦' },
      { id: 'gas_station', name: 'Centro PokéEnergy (Gasolinera)', targetX: -55, targetZ: 22, action: 'refuelCar', icon: '⛽' },
      { id: 'dealership', name: 'Concesionario Turbo', targetX: -34, targetZ: 22, action: 'openDealership', icon: '🚗' },
      { id: 'office_work', name: 'Laboratorio Tech / Empleos', targetX: 36, targetZ: -22, action: 'openJobs', icon: '💼' },
      { id: 'real_estate', name: 'Agencia Inmobiliaria', targetX: 24, targetZ: 24, action: 'openRealEstate', icon: '🏠' },
      { id: 'government', name: 'Liga Geopolítica & Gobierno', targetX: 0, targetZ: -68, action: 'openGeopolitics', icon: '🏛️' }
    ];

    spotsTemplate.forEach(s => {
      const snapped = this.getNearestWalkablePoint(s.targetX, s.targetZ);
      const sx = snapped.x;
      const sz = snapped.z;

      const ringGeo = new THREE.RingGeometry(1.6, 2.2, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x00d4ff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(sx, 0.045, sz);
      this.dynamicWorldGroup.add(ring);

      this.interactiveSpots.push({
        id: s.id,
        name: s.name,
        x: sx,
        z: sz,
        action: s.action,
        icon: s.icon,
        mesh: ring
      });
    });
  }

  // ===========================================================================
  // RESTRICCIÓN ESTRICTA DE TRÁNSITO: SOLO VÍAS PÚBLICAS Y ESPACIOS PÚBLICOS
  // ===========================================================================
  pointToSegmentDistanceInfo(px, pz, seg) {
    const vx = seg.bx - seg.ax;
    const vz = seg.bz - seg.az;
    const lenSq = vx * vx + vz * vz;
    let t = 0;
    if (lenSq > 0.0001) {
      t = ((px - seg.ax) * vx + (pz - seg.az) * vz) / lenSq;
      t = Math.max(0, Math.min(1, t));
    }
    const closestX = seg.ax + t * vx;
    const closestZ = seg.az + t * vz;
    const dist = Math.hypot(px - closestX, pz - closestZ);
    return { dist, closestX, closestZ, t };
  }

  isPointInPolygon(px, pz, points) {
    if (!points || points.length < 3) return false;
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const xi = points[i].x, zi = points[i].z;
      const xj = points[j].x, zj = points[j].z;
      const intersect = ((zi > pz) !== (zj > pz)) &&
        (px < ((xj - xi) * (pz - zi)) / ((zj - zi) || 1e-7) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  isInsidePublicSpace(x, z, extraMargin = 0) {
    const accessTolerance = 3.2 + extraMargin;
    for (const space of this.publicSpaces) {
      if (Number.isFinite(space.radius)) {
        if (Math.hypot(x - space.cx, z - space.cz) <= space.radius + accessTolerance) {
          return space;
        }
      } else if (space.points && space.points.length >= 3) {
        const b = space.bounds;
        if (
          x >= b.xMin - accessTolerance &&
          x <= b.xMax + accessTolerance &&
          z >= b.zMin - accessTolerance &&
          z <= b.zMax + accessTolerance
        ) {
          if (this.isPointInPolygon(x, z, space.points)) {
            return space;
          }
          // Margen de acceso y aceras perimetrales del parque para permitir entrar y salir fluidamente
          for (let i = 0; i < space.points.length; i++) {
            const a = space.points[i];
            const next = space.points[(i + 1) % space.points.length];
            const info = this.pointToSegmentDistanceInfo(x, z, { ax: a.x, az: a.z, bx: next.x, bz: next.z });
            if (info.dist <= accessTolerance) {
              return space;
            }
          }
        }
      } else if (space.bounds) {
        const b = space.bounds;
        if (
          x >= b.xMin - accessTolerance &&
          x <= b.xMax + accessTolerance &&
          z >= b.zMin - accessTolerance &&
          z <= b.zMax + accessTolerance
        ) {
          return space;
        }
      }
    }
    return null;
  }

  isPositionWalkable(x, z, extraMargin = 0) {
    // 1. ¿Está dentro de un Espacio Público (parque, plaza, zona verde)?
    if (this.isInsidePublicSpace(x, z, extraMargin)) {
      return true;
    }

    // 2. ¿Está sobre una Vía Pública (calzada o acera peatonal)?
    for (const seg of this.roadSegments) {
      const allowedHalfWidth = seg.width * 0.5 + 1.25 + extraMargin;
      const info = this.pointToSegmentDistanceInfo(x, z, seg);
      if (info.dist <= allowedHalfWidth) {
        return true;
      }
    }

    return false;
  }

  getNearestWalkablePoint(x, z) {
    if (this.isPositionWalkable(x, z)) {
      return { x, z };
    }

    let bestDist = Infinity;
    let bestPt = { x: 0, z: 0 };

    for (const seg of this.roadSegments) {
      const info = this.pointToSegmentDistanceInfo(x, z, seg);
      if (info.dist < bestDist) {
        bestDist = info.dist;
        bestPt = { x: info.closestX, z: info.closestZ };
      }
    }

    for (const space of this.publicSpaces) {
      if (Number.isFinite(space.radius)) {
        const d = Math.hypot(x - space.cx, z - space.cz);
        if (d < bestDist) {
          bestDist = d;
          const angle = Math.atan2(z - space.cz, x - space.cx);
          bestPt = {
            x: space.cx + Math.cos(angle) * Math.min(d, space.radius * 0.8),
            z: space.cz + Math.sin(angle) * Math.min(d, space.radius * 0.8)
          };
        }
      } else if (space.points && space.points.length > 0) {
        for (const p of space.points) {
          const d = Math.hypot(x - p.x, z - p.z);
          if (d < bestDist) {
            bestDist = d;
            bestPt = { x: p.x, z: p.z };
          }
        }
      }
    }

    return bestPt;
  }

  clampToWalkable(prevPos, nextPos) {
    if (!this.roadSegments.length && !this.publicSpaces.length) {
      return nextPos;
    }

    if (this.isPositionWalkable(nextPos.x, nextPos.z)) {
      this.lastBlockedByPrivateProperty = false;
      return nextPos;
    }

    // Intentar deslizamiento por eje X o eje Z primero
    if (this.isPositionWalkable(nextPos.x, prevPos.z)) {
      this.triggerPrivatePropertyNotice();
      const res = nextPos.clone();
      res.z = prevPos.z;
      return res;
    }
    if (this.isPositionWalkable(prevPos.x, nextPos.z)) {
      this.triggerPrivatePropertyNotice();
      const res = nextPos.clone();
      res.x = prevPos.x;
      return res;
    }

    // Deslizamiento tangencial a lo largo del borde de la vía pública más cercana (calles diagonales reales)
    let bestSeg = null;
    let bestInfo = null;
    let minOvershoot = Infinity;

    for (const seg of this.roadSegments) {
      const info = this.pointToSegmentDistanceInfo(nextPos.x, nextPos.z, seg);
      const maxRadius = seg.width * 0.5 + 1.2;
      const overshoot = info.dist - maxRadius;
      if (overshoot < minOvershoot) {
        minOvershoot = overshoot;
        bestSeg = seg;
        bestInfo = info;
      }
    }

    if (bestSeg && bestInfo) {
      const maxRadius = bestSeg.width * 0.5 + 1.18;
      const dx = nextPos.x - bestInfo.closestX;
      const dz = nextPos.z - bestInfo.closestZ;
      const d = Math.hypot(dx, dz) || 1;
      const clampedX = bestInfo.closestX + (dx / d) * Math.min(d, maxRadius);
      const clampedZ = bestInfo.closestZ + (dz / d) * Math.min(d, maxRadius);

      this.triggerPrivatePropertyNotice();
      const res = nextPos.clone();
      res.x = clampedX;
      res.z = clampedZ;
      return res;
    }

    // Si estaba fuera, ajustar al punto caminable más cercano
    const fallback = this.getNearestWalkablePoint(prevPos.x, prevPos.z);
    this.triggerPrivatePropertyNotice();
    const res = nextPos.clone();
    res.x = fallback.x;
    res.z = fallback.z;
    return res;
  }

  triggerPrivatePropertyNotice() {
    this.lastBlockedByPrivateProperty = true;
    const now = Date.now();
    if (now - this.lastBlockedNoticeTime > 2600) {
      this.lastBlockedNoticeTime = now;
      if (typeof this.onBlockedByPrivateProperty === 'function') {
        this.onBlockedByPrivateProperty();
      }
    }
  }

  getZoneAt(position) {
    if (!position) return this.zones[0];

    // 1. Verificar si está en un Espacio Público real (Parque, Plaza, Zona Verde)
    const space = this.isInsidePublicSpace(position.x, position.z, 0.4);
    if (space && !space.isSpawnBuffer) {
      return {
        id: `park_${space.name}`,
        name: space.name || 'Parque Público',
        title: space.name || 'Parque Público',
        subtitle: 'Espacio Público Abierto • Hierba Alta',
        badge: '🌳 ESPACIO PÚBLICO',
        icon: '🌳',
        accentColor: '#22c55e',
        isRoute: true
      };
    }

    // 2. Verificar la Vía Pública activa donde camina o conduce el jugador
    let closestSeg = null;
    let minDist = Infinity;
    for (const seg of this.roadSegments) {
      const info = this.pointToSegmentDistanceInfo(position.x, position.z, seg);
      if (info.dist <= seg.width * 0.5 + 2.2 && info.dist < minDist) {
        minDist = info.dist;
        closestSeg = seg;
      }
    }

    if (closestSeg) {
      return {
        id: `road_${closestSeg.name}`,
        name: closestSeg.name || 'Vía Pública',
        title: closestSeg.name || 'Vía Pública',
        subtitle: closestSeg.isPedestrian ? 'Sendero Peatonal Público' : 'Vía Pública Transitable',
        badge: '🛣️ VÍA PÚBLICA',
        icon: '🛣️',
        accentColor: '#38bdf8',
        isRoute: false
      };
    }

    for (const zone of this.zones) {
      const b = zone.bounds;
      if (
        position.x >= b.xMin &&
        position.x <= b.xMax &&
        position.z >= b.zMin &&
        position.z <= b.zMax
      ) {
        return zone;
      }
    }
    return this.zones[0];
  }

  // ===========================================================================
  // RED VIAL Y PARQUES DE RESPALDO (CONSTRUIDA CON COORDENADAS REALES)
  // ===========================================================================
  buildFallbackNeighborhood(lat = this.baseCoords.lat, lng = this.baseCoords.lng) {
    this.clearDynamicWorld();

    const baseLat = Number.isFinite(lat) ? lat : this.baseCoords.lat;
    const baseLng = Number.isFinite(lng) ? lng : this.baseCoords.lng;

    // Calles limpias de cuadrícula local alrededor del punto GPS actual
    const street1 = 'Vía Principal Norte-Sur';
    const street2 = 'Calle Transversal 1';
    const street3 = 'Calle Transversal 2';
    const street4 = 'Avenida Este';
    const street5 = 'Calle Transversal 3';

    // Generar red de calles limpia con coordenadas reales calculadas alrededor de (baseLat, baseLng)
    this.addRoadSegment(0, -90, 0, 90, 6.0, street1, 'primary', false);
    this.addRoadSegment(-90, -35, 90, -35, 5.5, street2, 'secondary', false);
    this.addRoadSegment(-90, 5, 90, 5, 5.5, street3, 'secondary', false);
    this.addRoadSegment(-90, 45, 90, 45, 5.2, street5, 'residential', false);
    this.addRoadSegment(45, -90, 45, 90, 5.6, street4, 'residential', false);

    // Parque vecinal transitable con coordenadas reales
    const parkPts = [
      { x: -35, z: -10 },
      { x: 45, z: -10 },
      { x: 45, z: 2 },
      { x: -35, z: 2 }
    ].map(p => ({ ...p, ...this.worldToLatLng(p.x, p.z, baseLat, baseLng, this.movementScale) }));
    this.addPublicPolygonSpace(parkPts, { xMin: -35, xMax: 45, zMin: -10, zMax: 2 }, 'Parque Vecinal');

    const plazaPts = [
      { x: -12, z: 10 },
      { x: 14, z: 10 },
      { x: 14, z: 26 },
      { x: -12, z: 26 }
    ].map(p => ({ ...p, ...this.worldToLatLng(p.x, p.z, baseLat, baseLng, this.movementScale) }));
    this.addPublicPolygonSpace(plazaPts, { xMin: -12, xMax: 14, zMin: 10, zMax: 26 }, 'Plazoleta Central');

    // Construir casitas suburbanas ligeras a los lados de las calles y farolas limpias (sin bloat de economía)
    this.renderSuburbanBlocks();
    this.populateAlongRealStreets();
  }

  createPokemonHouse(x, z, width, depth, height, wallHex, roofHex, label = '') {
    const group = new THREE.Group();

    const wallMat = new THREE.MeshLambertMaterial({ color: wallHex });
    const walls = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), wallMat);
    walls.position.y = height / 2;
    walls.castShadow = true;
    walls.receiveShadow = true;
    group.add(walls);

    const roofRadius = Math.hypot(width, depth) * 0.58;
    const roofHeight = height * 0.55;
    const roofGeo = new THREE.ConeGeometry(roofRadius, roofHeight, 4);
    const roofMat = new THREE.MeshLambertMaterial({ color: roofHex, flatShading: true });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = height + roofHeight / 2 - 0.1;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    group.add(roof);

    const door = new THREE.Mesh(
      new THREE.BoxGeometry(Math.min(2.0, width * 0.35), Math.min(3.2, height * 0.45), 0.25),
      new THREE.MeshLambertMaterial({ color: 0x7c2d12 })
    );
    door.position.set(0, 1.5, depth / 2 + 0.08);
    group.add(door);

    const winMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    [-width * 0.28, width * 0.28].forEach(wx => {
      const win = new THREE.Mesh(new THREE.BoxGeometry(Math.min(1.8, width * 0.22), 1.6, 0.2), winMat);
      win.position.set(wx, height * 0.58, depth / 2 + 0.06);
      group.add(win);
    });

    group.position.set(x, 0, z);
    this.dynamicWorldGroup.add(group);

    const box = new THREE.Box3();
    box.setFromCenterAndSize(
      new THREE.Vector3(x, height / 2, z),
      new THREE.Vector3(width, height, depth)
    );
    this.physicsWorld.addStaticBox(box, { label });

    return group;
  }

  createWoodenFence(x, z, length, isHorizontal = true) {
    const fenceGroup = new THREE.Group();
    const woodMat = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });

    const rail1 = new THREE.Mesh(
      new THREE.BoxGeometry(isHorizontal ? length : 0.25, 0.2, isHorizontal ? 0.25 : length),
      woodMat
    );
    rail1.position.y = 0.95;
    fenceGroup.add(rail1);

    const rail2 = rail1.clone();
    rail2.position.y = 0.5;
    fenceGroup.add(rail2);

    const postsCount = Math.max(2, Math.floor(length / 3));
    for (let i = 0; i <= postsCount; i++) {
      const offset = -length / 2 + (i * length) / postsCount;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.3, 0.35), woodMat);
      post.position.set(isHorizontal ? offset : 0, 0.65, isHorizontal ? 0 : offset);
      post.castShadow = true;
      fenceGroup.add(post);
    }

    fenceGroup.position.set(x, 0, z);
    this.dynamicWorldGroup.add(fenceGroup);
  }

  createWoodenSign(x, z, accentHex = 0x4ade80) {
    const signGroup = new THREE.Group();
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.18, 2.2, 6),
      new THREE.MeshLambertMaterial({ color: 0x5c3a21 })
    );
    post.position.y = 1.1;
    signGroup.add(post);

    const board = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 1.3, 0.25),
      new THREE.MeshLambertMaterial({ color: 0xa47148 })
    );
    board.position.y = 2.1;
    board.castShadow = true;
    signGroup.add(board);

    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.3, 0.28),
      new THREE.MeshBasicMaterial({ color: accentHex })
    );
    stripe.position.y = 2.45;
    signGroup.add(stripe);

    signGroup.position.set(x, 0, z);
    this.dynamicWorldGroup.add(signGroup);
  }

  createFlowerBed(x, z, width, depth) {
    const colors = [0xef4444, 0xfacc15, 0xec4899, 0x60a5fa];
    for (let i = 0; i < 14; i++) {
      const fx = x + (Math.random() - 0.5) * width;
      const fz = z + (Math.random() - 0.5) * depth;
      const flower = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.15, 0.35, 6),
        new THREE.MeshLambertMaterial({ color: colors[i % colors.length] })
      );
      flower.position.set(fx, 0.18, fz);
      this.dynamicWorldGroup.add(flower);
    }
  }

  createBuilding(x, z, width, depth, height, colorHex, label = '', roofAccentHex = null) {
    const geo = new THREE.BoxGeometry(width, height, depth);
    const mat = new THREE.MeshLambertMaterial({ color: colorHex });
    const building = new THREE.Mesh(geo, mat);
    building.position.set(x, height / 2, z);
    building.castShadow = true;
    building.receiveShadow = true;
    this.dynamicWorldGroup.add(building);

    if (roofAccentHex !== null) {
      const crown = new THREE.Mesh(
        new THREE.BoxGeometry(width + 0.8, 1.8, depth + 0.8),
        new THREE.MeshBasicMaterial({ color: roofAccentHex })
      );
      crown.position.set(x, height - 1.2, z);
      this.dynamicWorldGroup.add(crown);
    }

    const winCols = Math.max(2, Math.floor(width / 3.5));
    const winRows = Math.max(3, Math.floor(height / 4));
    const winMat = new THREE.MeshBasicMaterial({ color: 0xffeeaa });

    for (let r = 1; r < winRows; r++) {
      for (let c = 0; c < winCols; c++) {
        if ((r + c) % 2 === 0 || Math.random() > 0.35) {
          const win = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.8), winMat);
          win.position.set(
            x - width / 2 + (c + 0.5) * (width / winCols),
            r * 3.8,
            z + depth / 2 + 0.05
          );
          this.dynamicWorldGroup.add(win);
        }
      }
    }

    const box = new THREE.Box3();
    box.setFromCenterAndSize(
      new THREE.Vector3(x, height / 2, z),
      new THREE.Vector3(width, height, depth)
    );
    this.physicsWorld.addStaticBox(box, { label });

    return building;
  }

  createDistrictsAndBuildings() {
    this.createPokemonHouse(-24, 34, 14, 12, 8.5, 0xfef3c7, 0xef4444, 'Casa Entrenador (Propiedad Privada)');
    this.createPokemonHouse(40, 34, 15, 12, 9.0, 0xf1f5f9, 0x3b82f6, 'Agencia Inmobiliaria');
    this.createPokemonHouse(62, 34, 14, 12, 8.5, 0xfef9c3, 0x10b981, 'Villa Esmeralda (Propiedad Privada)');
    this.createPokemonHouse(84, 34, 14, 12, 8.5, 0xffedd5, 0xeab308, 'Cabaña Girasol (Propiedad Privada)');
    this.createPokemonHouse(42, 66, 18, 14, 10.5, 0xe0f2fe, 0xec4899, 'Laboratorio del Profesor');
    this.createPokemonHouse(68, 66, 15, 13, 9.0, 0xf3e8ff, 0x8b5cf6, 'Residencia Floral (Propiedad Privada)');

    this.createWoodenFence(-24, 22, 22, true);
    this.createWoodenFence(52, 22, 55, true);
    this.createWoodenSign(8.5, 14, 0x4ade80);
    this.createWoodenSign(-8.5, 8, 0x84cc16);

    this.createBuilding(-35, -38, 24, 22, 48, 0x1e293b, 'Silph S.A. & Bolsa de Valores', 0x00d4ff);
    this.createBuilding(-72, -38, 20, 20, 56, 0x0f172a, 'Torre Corporativa', 0x38bdf8);
    this.createBuilding(-35, -76, 22, 22, 38, 0x334155, 'Banco Central', 0xfacc15);

    this.createBuilding(45, -38, 26, 22, 34, 0x1d4ed8, 'Laboratorio Tech & Empleos', 0x38bdf8);
    this.createBuilding(80, -38, 18, 20, 42, 0x0284c7, 'Torre Porygon AI', 0xa855f7);
    this.createBuilding(45, -76, 22, 22, 28, 0x0f766e, 'Centro de Investigación', 0x2dd4bf);
    this.createBuilding(0, -96, 30, 20, 22, 0x475569, 'Sede de Gobierno & Liga Geopolítica', 0xf59e0b);

    this.createBuilding(-46, 28, 18, 14, 12, 0x374151, 'Concesionario Turbo', 0xf97316);
    this.createGasStation(-108, 24);
  }

  createGasStation(x, z) {
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(20, 1.4, 14),
      new THREE.MeshLambertMaterial({ color: 0xef4444 })
    );
    roof.position.set(x, 6, z);
    roof.castShadow = true;
    this.dynamicWorldGroup.add(roof);

    const whiteStripe = new THREE.Mesh(
      new THREE.BoxGeometry(20.3, 0.45, 14.3),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    whiteStripe.position.set(x, 6.1, z);
    this.dynamicWorldGroup.add(whiteStripe);

    const colMat = new THREE.MeshLambertMaterial({ color: 0xe2e8f0 });
    [-7, 7].forEach(cx => {
      [-4.5, 4.5].forEach(cz => {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 6, 8), colMat);
        col.position.set(x + cx, 3, z + cz);
        col.castShadow = true;
        this.dynamicWorldGroup.add(col);
      });
    });

    const pumpMat = new THREE.MeshLambertMaterial({ color: 0x10b981 });
    [-3.5, 3.5].forEach(px => {
      const pump = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.5, 1.2), pumpMat);
      pump.position.set(x + px, 1.25, z);
      pump.castShadow = true;
      this.dynamicWorldGroup.add(pump);
      const box = new THREE.Box3();
      box.setFromCenterAndSize(pump.position, new THREE.Vector3(1.4, 2.5, 1.2));
      this.physicsWorld.addStaticBox(box, { label: 'Surtidor PokéEnergy' });
    });
  }

  createTallGrassPatch(centerX, centerZ, cols = 6, rows = 4, spacing = 1.55) {
    const bladeGeo = new THREE.ConeGeometry(0.42, 1.55, 4);
    bladeGeo.translate(0, 0.75, 0);
    const bladeMatDark = new THREE.MeshLambertMaterial({ color: 0x15803d, flatShading: true });
    const bladeMatLight = new THREE.MeshLambertMaterial({ color: 0x22c55e, flatShading: true });

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const gx = centerX + (c - (cols - 1) / 2) * spacing + (Math.random() - 0.5) * 0.35;
        const gz = centerZ + (r - (rows - 1) / 2) * spacing + (Math.random() - 0.5) * 0.35;

        const tuft = new THREE.Group();
        tuft.position.set(gx, 0, gz);

        const offsets = [
          [0, 0, 0, 0],
          [-0.28, 0.15, 0.18, -0.15],
          [0.28, -0.15, -0.18, 0.15],
          [-0.18, -0.25, -0.14, -0.18],
          [0.2, 0.25, 0.15, 0.18]
        ];

        offsets.forEach(([ox, oz, rx, rz], idx) => {
          const blade = new THREE.Mesh(bladeGeo, idx % 2 === 0 ? bladeMatDark : bladeMatLight);
          blade.position.set(ox, 0, oz);
          blade.rotation.set(rx, idx * 0.6, rz);
          tuft.add(blade);
        });

        this.dynamicWorldGroup.add(tuft);
        const patchItem = {
          group: tuft,
          x: gx,
          z: gz,
          phase: gx * 0.45 + gz * 0.35,
          rustleAmount: 0
        };
        this.tallGrassPatches.push(patchItem);
        this.grassBlades.push(patchItem);
      }
    }
  }

  createTallGrassRoutes() {
    this.createTallGrassPatch(-16, 4, 7, 4, 1.5);
    this.createTallGrassPatch(16, 4, 7, 4, 1.5);
    this.createTallGrassPatch(34, 3, 7, 4, 1.5);
  }

  createNatureAndVegetation() {
    const treeTrunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 2.5, 6);
    const treeTrunkMat = new THREE.MeshLambertMaterial({ color: 0x5d4037 });
    const treeFoliageGeo = new THREE.ConeGeometry(2.6, 5.2, 7);
    const treeFoliageMat = new THREE.MeshLambertMaterial({ color: 0x166534, flatShading: true });

    const treePositions = [
      [-12, 18], [12, 18], [-12, -14], [12, -14],
      [-44, 12], [-36, 12], [44, 12], [54, 12],
      [-12, -32], [-12, -48], [12, -32], [12, -48]
    ];

    treePositions.forEach(([tx, tz]) => {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(treeTrunkGeo, treeTrunkMat);
      trunk.position.y = 1.25;
      trunk.castShadow = true;
      tree.add(trunk);

      const foliage = new THREE.Mesh(treeFoliageGeo, treeFoliageMat);
      foliage.position.y = 4.5;
      foliage.castShadow = true;
      tree.add(foliage);

      tree.position.set(tx, 0, tz);
      this.dynamicWorldGroup.add(tree);

      const box = new THREE.Box3();
      box.setFromCenterAndSize(new THREE.Vector3(tx, 1.25, tz), new THREE.Vector3(0.9, 2.5, 0.9));
      this.physicsWorld.addStaticBox(box, { label: 'Árbol' });
    });
  }

  createStreetFurniture() {
    const lampPositions = [
      [-8, 12], [8, 12], [-8, 38], [8, 38],
      [-10, -22], [10, -22], [-10, -60], [10, -60]
    ];

    lampPositions.forEach(([lx, lz]) => {
      this.createStreetLamp(lx, lz);
    });
  }

  setupInteractiveSpots() {
    const spotsData = [
      { id: 'stock_exchange', name: 'Silph S.A. — Bolsa de Valores', x: -35, z: -20, action: 'openStockMarket', icon: '📈' },
      { id: 'bank', name: 'Banco Central & Cajero', x: -35, z: -58, action: 'openBank', icon: '🏦' },
      { id: 'gas_station', name: 'Centro PokéEnergy (Gasolinera)', x: -92, z: 18, action: 'refuelCar', icon: '⛽' },
      { id: 'dealership', name: 'Concesionario Turbo', x: -62, z: 18, action: 'openDealership', icon: '🚗' },
      { id: 'office_work', name: 'Laboratorio Tech / Empleos', x: 45, z: -20, action: 'openJobs', icon: '💼' },
      { id: 'real_estate', name: 'Agencia Inmobiliaria', x: 26, z: 25, action: 'openRealEstate', icon: '🏠' },
      { id: 'government', name: 'Liga Geopolítica & Gobierno', x: 0, z: -77, action: 'openGeopolitics', icon: '🏛️' }
    ];

    spotsData.forEach(s => {
      const ringGeo = new THREE.RingGeometry(1.6, 2.2, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x00d4ff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(s.x, 0.04, s.z);
      this.dynamicWorldGroup.add(ring);

      this.interactiveSpots.push({
        ...s,
        mesh: ring
      });
    });
  }

  update(deltaSeconds, isNight, playerPosition = null) {
    const targetIntensity = isNight ? 1.4 : 0.0;
    this.nightLights.forEach(light => {
      light.intensity = THREE.MathUtils.lerp(light.intensity, targetIntensity, deltaSeconds * 2);
    });

    const time = Date.now() * 0.003;
    this.interactiveSpots.forEach(s => {
      if (s.mesh) {
        s.mesh.scale.setScalar(1.0 + Math.sin(time) * 0.08);
      }
    });

    for (let i = 0; i < this.tallGrassPatches.length; i++) {
      const patch = this.tallGrassPatches[i];
      const windSway = Math.sin(time * 1.6 + patch.phase) * 0.09;

      let targetTiltX = windSway;
      let targetTiltZ = Math.cos(time * 1.3 + patch.phase) * 0.06;
      let targetScaleY = 1.0;

      if (playerPosition) {
        const dx = patch.x - playerPosition.x;
        const dz = patch.z - playerPosition.z;
        const dist = Math.hypot(dx, dz);

        if (dist < 2.2) {
          const factor = 1 - dist / 2.2;
          const pushAngle = Math.atan2(dz, dx);
          targetTiltX += Math.sin(pushAngle) * factor * 0.55 + Math.sin(time * 9) * 0.18 * factor;
          targetTiltZ += -Math.cos(pushAngle) * factor * 0.55;
          targetScaleY = 1.0 - factor * 0.22 + Math.abs(Math.sin(time * 8)) * 0.12 * factor;
        }
      }

      patch.group.rotation.x = THREE.MathUtils.lerp(patch.group.rotation.x, targetTiltX, deltaSeconds * 10);
      patch.group.rotation.z = THREE.MathUtils.lerp(patch.group.rotation.z, targetTiltZ, deltaSeconds * 10);
      patch.group.scale.y = THREE.MathUtils.lerp(patch.group.scale.y, targetScaleY, deltaSeconds * 10);
    }
  }

  getNearestSpot(playerPos, maxDist = 4.2) {
    for (const spot of this.interactiveSpots) {
      const dist = Math.hypot(spot.x - playerPos.x, spot.z - playerPos.z);
      if (dist <= maxDist) {
        return spot;
      }
    }
    return null;
  }
}
