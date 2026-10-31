// src/environment/OSMBuildings.js
// Generación optimizada de edificios 3D reales de OpenStreetMap (extrusión procedural,
// vertexColors, mergeGeometries para un solo draw call a 60 FPS, caché en IndexedDB y POIs)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// --- GESTOR DE CACHÉ INDEXEDDB ROBUSTO CON FALLBACK EN MEMORIA ---
class IndexedDBCache {
  constructor(dbName = 'TerraSim_OSM_DB', storeName = 'osm_buildings_cache') {
    this.dbName = dbName;
    this.storeName = storeName;
    this.db = null;
    this.memoryFallback = new Map();
    this.isSupported = typeof window !== 'undefined' && 'indexedDB' in window;
    this.initPromise = this.init();
  }

  async init() {
    if (!this.isSupported) return;
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(this.dbName, 1);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName, { keyPath: 'key' });
          }
        };
        req.onsuccess = (e) => {
          this.db = e.target.result;
          resolve();
        };
        req.onerror = () => {
          this.isSupported = false;
          resolve();
        };
      } catch (e) {
        this.isSupported = false;
        resolve();
      }
    });
  }

  async get(key) {
    await this.initPromise;
    if (!this.isSupported || !this.db) {
      const item = this.memoryFallback.get(key);
      if (!item) return null;
      if (Date.now() > item.expires) {
        this.memoryFallback.delete(key);
        return null;
      }
      return item.data;
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const req = store.get(key);
        req.onsuccess = () => {
          const res = req.result;
          if (!res) return resolve(null);
          if (Date.now() > res.expires) {
            this.delete(key);
            return resolve(null);
          }
          resolve(res.data);
        };
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  async set(key, data, ttlMs = 86400000) { // 24 horas TTL por defecto
    await this.initPromise;
    const expires = Date.now() + ttlMs;
    if (!this.isSupported || !this.db) {
      this.memoryFallback.set(key, { data, expires });
      return;
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        store.put({ key, data, expires });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  async delete(key) {
    if (!this.db) {
      this.memoryFallback.delete(key);
      return;
    }
    try {
      const tx = this.db.transaction(this.storeName, 'readwrite');
      tx.objectStore(this.storeName).delete(key);
    } catch (e) {}
  }
}

// --- CLASE PRINCIPAL OSMBuildings ---
export class OSMBuildings {
  constructor(options = {}) {
    this.scene = options.scene || null;
    this.physicsWorld = options.physicsWorld || null;
    this.latLngToWorld = options.latLngToWorld || null;
    this.isPositionWalkable = options.isPositionWalkable || null;

    this.group = new THREE.Group();
    this.group.name = 'OSM_Buildings_Group';
    if (this.scene) {
      this.scene.add(this.group);
    }

    this.poiSpritesGroup = new THREE.Group();
    this.poiSpritesGroup.name = 'POI_Sprites_Group';
    this.group.add(this.poiSpritesGroup);

    this.cache = new IndexedDBCache();
    this.pois = [];
    this.poiSprites = [];
    this.buildingColliders = [];
    this.mergedMesh = null;
    this.lastLoadedCoordKey = '';

    // Paletas temáticas refinadas para vertexColors
    this.palettes = {
      residential: [
        { wall: 0xf3ede2, roof: 0xb45309 }, // Teja cálida
        { wall: 0xeae5d9, roof: 0x9a3412 }, // Terracota
        { wall: 0xf5f0eb, roof: 0x475569 }, // Techo pizarra
        { wall: 0xdfd7cb, roof: 0x78716c }, // Techo neutro
        { wall: 0xe2ded4, roof: 0xb91c1c }  // Teja roja
      ],
      commercial: [
        { wall: 0xe2e8f0, roof: 0x334155 }, // Moderno pizarra
        { wall: 0xcfd8dc, roof: 0x1e293b }, // Gris frío oscuro
        { wall: 0xdbeafe, roof: 0x2563eb }, // Cristal azulado sutil
        { wall: 0xf1f5f9, roof: 0x0f172a }  // Carbón contraste
      ],
      office: [
        { wall: 0x94a3b8, roof: 0x1e293b }, // Granito corporativo
        { wall: 0xa8b4c2, roof: 0x334155 },
        { wall: 0xc5cfdb, roof: 0x0f172a }
      ],
      industrial: [
        { wall: 0xa1887f, roof: 0x546e7a }, // Ladrillo/metal
        { wall: 0x8d6e63, roof: 0x37474f },
        { wall: 0x78909c, roof: 0x455a64 }
      ],
      civic: [
        { wall: 0xfef3c7, roof: 0xd97706 }, // Amarillo canario/cívico
        { wall: 0xfef9c3, roof: 0xca8a04 },
        { wall: 0xe0e7ff, roof: 0x4f46e5 }  // Hospital / Salud
      ]
    };
  }

  // Generador pseudoaleatorio determinista para alturas y paletas estables según ID/coordenada
  deterministicHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  // Clasificar tipo de edificio
  categorizeBuilding(tags = {}) {
    const b = (tags.building || '').toLowerCase();
    const a = (tags.amenity || '').toLowerCase();
    const s = (tags.shop || '').toLowerCase();

    if (a || s) return 'commercial';
    if (['commercial', 'retail', 'supermarket'].includes(b)) return 'commercial';
    if (['office', 'civic', 'government', 'public'].includes(b)) return 'office';
    if (['industrial', 'warehouse', 'manufacture'].includes(b)) return 'industrial';
    if (['school', 'university', 'college', 'hospital', 'clinic'].includes(b)) return 'civic';
    return 'residential';
  }

  // Calcular altura según etiquetas OSM o estimación estable
  calculateHeight(tags = {}, category = 'residential', seed = 0) {
    if (tags.height) {
      const h = parseFloat(tags.height);
      if (Number.isFinite(h) && h > 0) {
        return Math.max(3.2, Math.min(48.0, h));
      }
    }
    if (tags['building:levels']) {
      const lvls = parseInt(tags['building:levels'], 10);
      if (Number.isFinite(lvls) && lvls > 0) {
        return Math.max(3.2, Math.min(50.0, lvls * 3.2));
      }
    }

    const variance = (seed % 100) / 100;
    switch (category) {
      case 'office':
        return 12.0 + variance * 16.0; // 12m - 28m
      case 'commercial':
        return 6.0 + variance * 7.5;   // 6m - 13.5m
      case 'industrial':
        return 5.5 + variance * 4.0;   // 5.5m - 9.5m
      case 'civic':
        return 8.0 + variance * 8.0;   // 8m - 16m
      case 'residential':
      default:
        if (tags.building === 'apartments') {
          return 9.0 + variance * 12.0; // 9m - 21m
        }
        return 4.2 + variance * 3.5;    // 4.2m - 7.7m (casas 1-2 plantas)
    }
  }

  // Limpiar recursos y mallas
  clear() {
    if (this.mergedMesh) {
      this.group.remove(this.mergedMesh);
      if (this.mergedMesh.geometry) this.mergedMesh.geometry.dispose();
      if (this.mergedMesh.material) this.mergedMesh.material.dispose();
      this.mergedMesh = null;
    }

    if (this.poiSpritesGroup) {
      while (this.poiSpritesGroup.children.length > 0) {
        const s = this.poiSpritesGroup.children.pop();
        if (s.material) {
          if (s.material.map) s.material.map.dispose();
          s.material.dispose();
        }
        this.poiSpritesGroup.remove(s);
      }
    }
    this.poiSprites = [];
    this.pois = [];
    this.buildingColliders = [];
  }

  // Descargar edificios y POIs desde Overpass con servidores espejo y caché IndexedDB
  async fetchOSMBuildings(lat, lng, radius = 550, signal = null) {
    const cacheKey = `buildings_${lat.toFixed(3)}_${lng.toFixed(3)}_${radius}`;

    // 1. Revisar caché en IndexedDB
    try {
      const cached = await this.cache.get(cacheKey);
      if (cached && Array.isArray(cached.elements) && cached.elements.length > 0) {
        return cached;
      }
    } catch (e) {}

    // 2. Consulta Overpass optimizada (out geom para obtener geometrías directamente)
    const query = `[out:json][timeout:9];(
      way["building"](around:${radius},${lat},${lng});
      node["amenity"](around:${radius},${lat},${lng});
      node["shop"](around:${radius},${lat},${lng});
      way["amenity"](around:${radius},${lat},${lng});
      way["shop"](around:${radius},${lat},${lng});
    );out geom;`;

    const encoded = encodeURIComponent(query);
    const endpoints = [
      `https://overpass-api.de/api/interpreter?data=${encoded}`,
      `https://overpass.kumi.systems/api/interpreter?data=${encoded}`,
      `https://maps.mail.ru/osm/tools/overpass/api/interpreter?data=${encoded}`
    ];

    const fetchEndpoint = async (url) => {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 7000);
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
      } catch (err) {
        clearTimeout(tid);
        if (signal) signal.removeEventListener('abort', onAbort);
      }
      throw new Error(`Endpoint ${url} falló`);
    };

    try {
      const data = await Promise.any(endpoints.map(fetchEndpoint));
      if (data && Array.isArray(data.elements)) {
        await this.cache.set(cacheKey, data, 86400000); // 24 horas
      }
      return data;
    } catch (e) {
      return null;
    }
  }

  // Construir edificios a partir de elementos OSM (soporta tanto Overpass directo como datos de World.js)
  buildFromElements(elements, baseLat, baseLng, scale = 2.8) {
    if (!Array.isArray(elements) || elements.length === 0) return 0;

    this.clear();
    const toWorld = this.latLngToWorld || ((lat, lng) => {
      const metersPerDegreeLat = 111139;
      const rad = baseLat * (Math.PI / 180);
      const metersPerDegreeLng = 111139 * Math.cos(rad);
      return {
        x: ((lng - baseLng) * metersPerDegreeLng) / scale,
        z: -((lat - baseLat) * metersPerDegreeLat) / scale
      };
    });

    const buildingGeometries = [];
    const maxBuildings = 220; // Capacidad optimizada para mantener 60 FPS estables en móviles
    let count = 0;

    for (const el of elements) {
      const tags = el.tags || {};

      // 1. Extraer POIs reales (sitios destacados, tiendas, amenidades)
      const isPOI = tags.amenity || tags.shop || tags.tourism || tags.historic || (tags.name && tags.building);
      if (isPOI) {
        let poiLat = el.lat;
        let poiLng = el.lon;

        if (!poiLat && Array.isArray(el.geometry) && el.geometry.length > 0) {
          poiLat = el.geometry[0].lat;
          poiLng = el.geometry[0].lon;
        }

        if (poiLat && poiLng) {
          const w = toWorld(poiLat, poiLng);
          this.pois.push({
            id: el.id,
            name: tags.name || tags['name:es'] || tags.shop || tags.amenity || 'Lugar de Interés',
            type: tags.amenity || tags.shop || tags.tourism || 'building',
            category: this.categorizeBuilding(tags),
            lat: poiLat,
            lng: poiLng,
            x: w.x,
            z: w.z,
            tags
          });
        }
      }

      // 2. Procesar huellas de edificios
      if (el.type === 'way' && (tags.building || tags.amenity || tags.shop) && Array.isArray(el.geometry)) {
        if (count >= maxBuildings) continue;
        const geom = el.geometry;
        if (geom.length < 3) continue;

        // Convertir coordenadas geográficas a puntos locales en el mundo 3D
        const pts = [];
        let xMin = Infinity, xMax = -Infinity, zMin = Infinity, zMax = -Infinity;

        for (const pt of geom) {
          const w = toWorld(pt.lat, pt.lon);
          pts.push(w);
          if (w.x < xMin) xMin = w.x;
          if (w.x > xMax) xMax = w.x;
          if (w.z < zMin) zMin = w.z;
          if (w.z > zMax) zMax = w.z;
        }

        const cx = (xMin + xMax) * 0.5;
        const cz = (zMin + zMax) * 0.5;
        const distFromCenter = Math.hypot(cx, cz);
        if (distFromCenter > 380) continue; // Fuera del radio visual útil

        // Omitir si cae directamente en el eje de una calzada peatonal/vehicular
        if (typeof this.isPositionWalkable === 'function' && this.isPositionWalkable(cx, cz, -0.8)) {
          continue;
        }

        const seed = this.deterministicHash(`${el.id || cx}_${cz}`);
        const category = this.categorizeBuilding(tags);
        const height = this.calculateHeight(tags, category, seed);

        // Selección armónica de paleta
        const catPalette = this.palettes[category] || this.palettes.residential;
        const colorPair = catPalette[seed % catPalette.length];

        const wallColorObj = new THREE.Color(colorPair.wall);
        const roofColorObj = new THREE.Color(colorPair.roof);

        // Crear geometría del edificio (paredes verticales + techo triangulado)
        const bGeo = this.createBuildingGeometry(pts, height, wallColorObj, roofColorObj);
        if (bGeo) {
          buildingGeometries.push(bGeo);

          // Registrar colisión física
          const width = Math.max(2.5, xMax - xMin);
          const depth = Math.max(2.5, zMax - zMin);
          const box = new THREE.Box3();
          box.setFromCenterAndSize(
            new THREE.Vector3(cx, height * 0.5, cz),
            new THREE.Vector3(width * 0.95, height, depth * 0.95)
          );

          if (this.physicsWorld) {
            const label = tags.name || `Edificio (${tags.building || category})`;
            this.physicsWorld.addStaticBox(box, { label, category, tags });
          }

          this.buildingColliders.push({ box, cx, cz, height, tags });
          count++;
        }
      }
    }

    // 3. Fusión en una sola malla para máximo rendimiento (1 solo draw call)
    if (buildingGeometries.length > 0) {
      try {
        const mergedGeometry = mergeGeometries(buildingGeometries, false);
        // Liberar geometrías temporales
        for (const g of buildingGeometries) g.dispose();

        const material = new THREE.MeshLambertMaterial({
          vertexColors: true,
          side: THREE.FrontSide
        });

        this.mergedMesh = new THREE.Mesh(mergedGeometry, material);
        this.mergedMesh.castShadow = true;
        this.mergedMesh.receiveShadow = true;
        this.group.add(this.mergedMesh);
      } catch (err) {
        console.warn('Error al fusionar geometrías de edificios OSM:', err);
      }
    }

    // 4. Generar letreros y marcadores 3D flotantes (Sprites) para los POIs más importantes
    this.createPOIMarkers();

    return count;
  }

  // Generador de prisma procedural con vertexColors y normales
  createBuildingGeometry(pts, height, wallColor, roofColor) {
    const numPts = pts.length;
    if (numPts < 3) return null;

    // Eliminar punto duplicado final si cierra el loop
    const cleaned = [];
    for (let i = 0; i < numPts; i++) {
      if (i > 0 && Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z) < 0.1) continue;
      cleaned.push(pts[i]);
    }
    if (cleaned.length >= 2 && Math.hypot(cleaned[cleaned.length - 1].x - cleaned[0].x, cleaned[cleaned.length - 1].z - cleaned[0].z) < 0.1) {
      cleaned.pop();
    }
    if (cleaned.length < 3) return null;

    const positions = [];
    const colors = [];

    // Color con gradiente vertical sutil: base ligeramente oscurecida (AO) a altura completa
    const wallBottom = wallColor.clone().multiplyScalar(0.72);
    const wallTop = wallColor.clone();

    // 1. Paredes verticales (Quads triangulados)
    for (let i = 0; i < cleaned.length; i++) {
      const p1 = cleaned[i];
      const p2 = cleaned[(i + 1) % cleaned.length];

      // Triángulo 1
      positions.push(p1.x, 0, p1.z);
      colors.push(wallBottom.r, wallBottom.g, wallBottom.b);

      positions.push(p2.x, 0, p2.z);
      colors.push(wallBottom.r, wallBottom.g, wallBottom.b);

      positions.push(p2.x, height, p2.z);
      colors.push(wallTop.r, wallTop.g, wallTop.b);

      // Triángulo 2
      positions.push(p1.x, 0, p1.z);
      colors.push(wallBottom.r, wallBottom.g, wallBottom.b);

      positions.push(p2.x, height, p2.z);
      colors.push(wallTop.r, wallTop.g, wallTop.b);

      positions.push(p1.x, height, p1.z);
      colors.push(wallTop.r, wallTop.g, wallTop.b);
    }

    // 2. Techo plano triangulado
    try {
      const shape2D = cleaned.map(p => new THREE.Vector2(p.x, p.z));
      const triangles = THREE.ShapeUtils.triangulateShape(shape2D, []);

      for (const tri of triangles) {
        const i0 = tri[0];
        const i1 = tri[1];
        const i2 = tri[2];

        // Asegurar orientación de normales hacia arriba
        positions.push(cleaned[i0].x, height, cleaned[i0].z);
        colors.push(roofColor.r, roofColor.g, roofColor.b);

        positions.push(cleaned[i2].x, height, cleaned[i2].z);
        colors.push(roofColor.r, roofColor.g, roofColor.b);

        positions.push(cleaned[i1].x, height, cleaned[i1].z);
        colors.push(roofColor.r, roofColor.g, roofColor.b);
      }
    } catch (e) {
      // Si la triangulación del techo falla en polígonos complejos, las paredes se mantienen
    }

    if (positions.length === 0) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    return geo;
  }

  // Consultar el POI más cercano a unas coordenadas mundiales (x, z)
  nearestPOI(x, z, maxDist = 40) {
    if (this.pois.length === 0) return null;
    let closest = null;
    let minDist = maxDist;

    for (const poi of this.pois) {
      const dist = Math.hypot(poi.x - x, poi.z - z);
      if (dist < minDist) {
        minDist = dist;
        closest = { ...poi, distance: dist };
      }
    }
    return closest;
  }

  getPOIs() {
    return this.pois;
  }

  getBuildingsCount() {
    return this.buildingColliders.length;
  }

  // Generar letreros y marcadores 3D flotantes (Sprites) para sitios emblemáticos
  createPOIMarkers() {
    if (!this.pois || this.pois.length === 0) return;
    if (typeof document === 'undefined') return;

    // Priorizar POIs con nombre propio o tipos clave
    const validPOIs = this.pois.filter(p => {
      const t = (p.type || '').toLowerCase();
      const n = (p.name || '').toLowerCase();
      return (
        (n !== 'lugar de interés' && n.length > 2) ||
        /^(restaurant|cafe|bar|fast_food|supermarket|convenience|bakery|pharmacy|hospital|clinic|bank|atm|school|university|hotel)$/.test(t)
      );
    });

    // Limitar a los 35 más representativos para óptimo rendimiento en móviles
    const selected = validPOIs.slice(0, 35);

    for (const poi of selected) {
      const icon = this.getPOIIcon(poi.type);
      const colorHex = this.getPOIColorHex(poi.type, poi.category);
      const canvas = this.createMarkerCanvas(icon, poi.name, colorHex);
      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;

      const mat = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false
      });

      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(7.5, 3.75, 1);
      sprite.position.set(poi.x, 6.2, poi.z);

      this.poiSpritesGroup.add(sprite);
      this.poiSprites.push({
        sprite,
        x: poi.x,
        z: poi.z,
        poi
      });
    }
  }

  getPOIIcon(type = '') {
    const t = type.toLowerCase();
    if (t.includes('cafe')) return '☕';
    if (t.includes('restaurant') || t.includes('food')) return '🍽️';
    if (t.includes('bar')) return '🍺';
    if (t.includes('supermarket') || t.includes('shop') || t.includes('convenience')) return '🛒';
    if (t.includes('bakery')) return '🥖';
    if (t.includes('bank') || t.includes('atm')) return '🏦';
    if (t.includes('pharmacy')) return '💊';
    if (t.includes('hospital') || t.includes('clinic')) return '🏥';
    if (t.includes('school') || t.includes('university')) return '🎓';
    if (t.includes('hotel') || t.includes('motel')) return '🏨';
    return '📍';
  }

  getPOIColorHex(type = '', category = '') {
    const t = type.toLowerCase();
    if (/restaurant|cafe|bar|fast_food|bakery/.test(t)) return '#f97316';
    if (/shop|supermarket|convenience/.test(t)) return '#3b82f6';
    if (/bank|atm/.test(t)) return '#10b981';
    if (/pharmacy|hospital|clinic/.test(t)) return '#ef4444';
    if (/school|university/.test(t)) return '#8b5cf6';
    return '#64748b';
  }

  createMarkerCanvas(icon, name, colorHex) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Círculo del icono superior
    ctx.beginPath();
    ctx.arc(128, 44, 30, 0, Math.PI * 2);
    ctx.fillStyle = colorHex;
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // Emoji de icono
    ctx.font = '28px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, 128, 45);

    // Etiqueta de texto inferior
    if (name) {
      const cleanName = name.length > 20 ? name.slice(0, 18) + '...' : name;
      ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const textWidth = ctx.measureText(cleanName).width;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(128 - textWidth / 2 - 8, 88, textWidth + 16, 24, 12);
      } else {
        ctx.rect(128 - textWidth / 2 - 8, 88, textWidth + 16, 24);
      }
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.fillText(cleanName, 128, 100);
    }

    return canvas;
  }

  update(cameraPosition) {
    if (!this.poiSprites || this.poiSprites.length === 0 || !cameraPosition) return;

    for (let i = 0; i < this.poiSprites.length; i++) {
      const item = this.poiSprites[i];
      const dist = Math.hypot(item.x - cameraPosition.x, item.z - cameraPosition.z);

      if (dist > 120) {
        item.sprite.visible = false;
      } else {
        item.sprite.visible = true;
        // Fade out progresivo entre 70m y 120m
        const opacity = dist < 70 ? 1.0 : Math.max(0, 1.0 - (dist - 70) / 50);
        item.sprite.material.opacity = opacity;
      }
    }
  }
}

