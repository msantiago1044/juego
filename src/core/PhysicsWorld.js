// PhysicsWorld.js - Motor de física Newtoneana con gravedad, fricción, inercia y colisiones espaciales (Spatial Hash Grid 2D)
import * as THREE from 'three';

export class PhysicsWorld {
  constructor() {
    this.gravity = 9.81; // m/s^2
    this.airDensity = 1.225; // kg/m^3 a nivel del mar
    this.groundY = 0; // Plano base del suelo
    this._staticColliders = []; // Cajas y mallas estáticas de colisión
    this.dynamicBodies = [];

    // Spatial Hash Grid 2D para colisiones O(1) ultra fluidas en móviles
    this.cellSize = 35.0; // Metros por celda espacial
    this.grid = new Map();

    // Condiciones ambientales que afectan la física
    this.surfaceFriction = 0.85; // Asfalto seco estándar
    this.wetness = 0.0; // 0.0 (seco) a 1.0 (empapado por lluvia)
  }

  get staticColliders() {
    return this._staticColliders;
  }

  set staticColliders(val) {
    this._staticColliders = val;
    this.grid.clear();
    if (Array.isArray(val) && val.length > 0) {
      for (const col of val) {
        if (col && col.box) {
          this._insertIntoGrid(col);
        }
      }
    }
  }

  clear() {
    this._staticColliders = [];
    this.grid.clear();
  }

  setWeatherFriction(wetness = 0) {
    this.wetness = Math.max(0, Math.min(1, wetness));
    // Asfalto mojado reduce la fricción drásticamente (aquaplaning, derrapes)
    this.surfaceFriction = THREE.MathUtils.lerp(0.85, 0.32, this.wetness);
  }

  _getCellKey(cellX, cellZ) {
    return `${cellX},${cellZ}`;
  }

  _insertIntoGrid(collider) {
    const box = collider.box;
    const minCX = Math.floor(box.min.x / this.cellSize);
    const maxCX = Math.floor(box.max.x / this.cellSize);
    const minCZ = Math.floor(box.min.z / this.cellSize);
    const maxCZ = Math.floor(box.max.z / this.cellSize);

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cz = minCZ; cz <= maxCZ; cz++) {
        const key = this._getCellKey(cx, cz);
        let cellList = this.grid.get(key);
        if (!cellList) {
          cellList = [];
          this.grid.set(key, cellList);
        }
        cellList.push(collider);
      }
    }
  }

  addStaticBox(box3, metadata = {}) {
    const collider = {
      type: 'box',
      box: box3,
      metadata
    };
    this._staticColliders.push(collider);
    this._insertIntoGrid(collider);
  }

  addDynamicBody(body) {
    this.dynamicBodies.push(body);
  }

  removeDynamicBody(body) {
    const idx = this.dynamicBodies.indexOf(body);
    if (idx !== -1) this.dynamicBodies.splice(idx, 1);
  }

  // Comprobar colisión de una caja AABB móvil contra los obstáculos estáticos usando Spatial Hash Grid
  checkCollisions(targetBox, currentPos, desiredPos, radius = 0.45) {
    const resolvedPos = desiredPos.clone();
    let hitAny = false;

    if (this._staticColliders.length === 0) {
      return { resolvedPos, hitAny };
    }

    // Obtener celdas cubiertas por la caja del personaje
    const minCX = Math.floor(targetBox.min.x / this.cellSize);
    const maxCX = Math.floor(targetBox.max.x / this.cellSize);
    const minCZ = Math.floor(targetBox.min.z / this.cellSize);
    const maxCZ = Math.floor(targetBox.max.z / this.cellSize);

    const tested = new Set();

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cz = minCZ; cz <= maxCZ; cz++) {
        const key = this._getCellKey(cx, cz);
        const cellList = this.grid.get(key);
        if (!cellList) continue;

        for (let i = 0; i < cellList.length; i++) {
          const collider = cellList[i];
          if (tested.has(collider)) continue;
          tested.add(collider);

          if (collider.type === 'box') {
            const box = collider.box;
            if (targetBox.intersectsBox(box)) {
              hitAny = true;
              // Resolver penetración eje por eje (separación mínima)
              const overlapMinX = targetBox.max.x - box.min.x;
              const overlapMaxX = box.max.x - targetBox.min.x;
              const overlapMinZ = targetBox.max.z - box.min.z;
              const overlapMaxZ = box.max.z - targetBox.min.z;

              const minX = Math.min(overlapMinX, overlapMaxX);
              const minZ = Math.min(overlapMinZ, overlapMaxZ);

              if (minX < minZ) {
                if (overlapMinX < overlapMaxX) {
                  resolvedPos.x = box.min.x - radius;
                } else {
                  resolvedPos.x = box.max.x + radius;
                }
              } else {
                if (overlapMinZ < overlapMaxZ) {
                  resolvedPos.z = box.min.z - radius;
                } else {
                  resolvedPos.z = box.max.z + radius;
                }
              }
              targetBox.setFromCenterAndSize(resolvedPos, targetBox.getSize(new THREE.Vector3()));
            }
          }
        }
      }
    }

    return { resolvedPos, hitAny };
  }

  // Raycast hacia el suelo para pendientes o desniveles
  getGroundHeight(x, z) {
    return this.groundY;
  }
}
