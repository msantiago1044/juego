// PhysicsWorld.js - Motor de física Newtoneana con gravedad, fricción, inercia y colisiones
import * as THREE from 'three';

export class PhysicsWorld {
  constructor() {
    this.gravity = 9.81; // m/s^2
    this.airDensity = 1.225; // kg/m^3 a nivel del mar
    this.groundY = 0; // Plano base del suelo
    this.staticColliders = []; // Cajas y mallas estáticas de colisión
    this.dynamicBodies = [];

    // Condiciones ambientales que afectan la física
    this.surfaceFriction = 0.85; // Asfalto seco estándar
    this.wetness = 0.0; // 0.0 (seco) a 1.0 (empapado por lluvia)
  }

  setWeatherFriction(wetness = 0) {
    this.wetness = Math.max(0, Math.min(1, wetness));
    // Asfalto mojado reduce la fricción drásticamente (aquaplaning, derrapes)
    this.surfaceFriction = THREE.MathUtils.lerp(0.85, 0.32, this.wetness);
  }

  addStaticBox(box3, metadata = {}) {
    this.staticColliders.push({
      type: 'box',
      box: box3,
      metadata
    });
  }

  addDynamicBody(body) {
    this.dynamicBodies.push(body);
  }

  removeDynamicBody(body) {
    const idx = this.dynamicBodies.indexOf(body);
    if (idx !== -1) this.dynamicBodies.splice(idx, 1);
  }

  // Comprobar colisión de una caja AABB móvil contra los obstáculos estáticos
  checkCollisions(targetBox, currentPos, desiredPos, radius = 0.45) {
    const resolvedPos = desiredPos.clone();
    let hitAny = false;

    for (const collider of this.staticColliders) {
      if (collider.type === 'box') {
        // Expandir ligeramente la caja por el radio del cuerpo
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

    return { resolvedPos, hitAny };
  }

  // Raycast hacia el suelo para pendientes o desniveles
  getGroundHeight(x, z) {
    // En este prototipo modular, el suelo base está a Y = 0
    // Podemos añadir aceras con Y = 0.2
    return this.groundY;
  }
}
