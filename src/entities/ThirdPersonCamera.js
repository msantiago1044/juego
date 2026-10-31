// ThirdPersonCamera.js - Cámara orbital multicámara con modos Avión, Panorámica, Normal, Isométrica y 1ra Persona
import * as THREE from 'three';

export const CAMERA_MODES = {
  normal: {
    id: 'normal',
    name: 'Normal',
    icon: '🚶',
    description: 'Tercera persona cercana',
    distanceFoot: 6.5,
    distanceVehicle: 9.8,
    heightOffsetFoot: 1.7,
    heightOffsetVehicle: 2.2,
    defaultPitch: 0.28,
    minPitch: -0.15,
    maxPitch: 1.15,
    lerpSpeed: 10
  },
  panoramic: {
    id: 'panoramic',
    name: 'Panorámica',
    icon: '🔭',
    description: 'Vista panorámica lejana del barrio',
    distanceFoot: 34.0,
    distanceVehicle: 38.0,
    heightOffsetFoot: 8.0,
    heightOffsetVehicle: 9.0,
    defaultPitch: 0.38,
    minPitch: 0.05,
    maxPitch: 1.15,
    lerpSpeed: 6
  },
  airplane: {
    id: 'airplane',
    name: 'Avión',
    icon: '✈️',
    description: 'Vista aérea de avión / Dron',
    distanceFoot: 85.0,
    distanceVehicle: 95.0,
    heightOffsetFoot: 20.0,
    heightOffsetVehicle: 22.0,
    defaultPitch: 1.25,
    minPitch: 0.60,
    maxPitch: 1.52,
    lerpSpeed: 4
  },
  isometric: {
    id: 'isometric',
    name: 'Isométrica',
    icon: '📐',
    description: 'Vista isométrica angular a 45°',
    distanceFoot: 24.0,
    distanceVehicle: 28.0,
    heightOffsetFoot: 14.0,
    heightOffsetVehicle: 16.0,
    defaultPitch: 0.78,
    minPitch: 0.40,
    maxPitch: 1.20,
    lerpSpeed: 8
  },
  first_person: {
    id: 'first_person',
    name: '1ra Persona',
    icon: '👁️',
    description: 'Vista en primera persona desde los ojos',
    distanceFoot: 0.2,
    distanceVehicle: 0.2,
    heightOffsetFoot: 1.95,
    heightOffsetVehicle: 1.45,
    defaultPitch: 0.05,
    minPitch: -0.85,
    maxPitch: 1.25,
    lerpSpeed: 16
  }
};

export class ThirdPersonCamera {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;

    this.currentPosition = new THREE.Vector3();
    this.currentLookAt = new THREE.Vector3();

    this.modeOrder = ['normal', 'panoramic', 'airplane', 'isometric', 'first_person'];
    this.currentMode = 'normal';

    // Ángulos esféricos
    this.yaw = 0; // Rotación horizontal
    this.pitch = CAMERA_MODES.normal.defaultPitch;
    this.distance = CAMERA_MODES.normal.distanceFoot;

    this.mouseSensitivity = 0.0028;
  }

  setMode(modeId) {
    if (!CAMERA_MODES[modeId]) return null;
    this.currentMode = modeId;
    const cfg = CAMERA_MODES[modeId];

    // Ajustar pitch dentro de los rangos seguros del nuevo modo
    if (this.pitch < cfg.minPitch || this.pitch > cfg.maxPitch) {
      this.pitch = cfg.defaultPitch;
    }
    return cfg;
  }

  cycleMode() {
    const idx = this.modeOrder.indexOf(this.currentMode);
    const nextIdx = (idx + 1) % this.modeOrder.length;
    return this.setMode(this.modeOrder[nextIdx]);
  }

  getModeConfig() {
    return CAMERA_MODES[this.currentMode] || CAMERA_MODES.normal;
  }

  updateMouse(mouseDelta) {
    if (mouseDelta.x !== 0 || mouseDelta.y !== 0) {
      const cfg = this.getModeConfig();
      this.yaw -= mouseDelta.x * this.mouseSensitivity;
      this.pitch = Math.max(cfg.minPitch, Math.min(cfg.maxPitch, this.pitch + mouseDelta.y * this.mouseSensitivity));
    }
  }

  update(deltaSeconds, targetPosition, isVehicle = false) {
    if (!targetPosition) return;

    const cfg = this.getModeConfig();
    const targetDistance = isVehicle ? cfg.distanceVehicle : cfg.distanceFoot;
    const targetHeightOffset = isVehicle ? cfg.heightOffsetVehicle : cfg.heightOffsetFoot;

    // Amortiguación adaptativa según el modo (más cinematográfico en avión y panorámica)
    const lerpRate = cfg.lerpSpeed || 8;
    this.distance = THREE.MathUtils.lerp(this.distance, targetDistance, deltaSeconds * lerpRate);

    // Calcular posición ideal de la cámara usando coordenadas esféricas
    const hDist = this.distance * Math.cos(this.pitch);
    const vDist = this.distance * Math.sin(this.pitch);

    const offsetX = hDist * Math.sin(this.yaw);
    const offsetZ = hDist * Math.cos(this.yaw);
    const offsetY = vDist;

    const idealPosition = new THREE.Vector3(
      targetPosition.x + offsetX,
      targetPosition.y + targetHeightOffset + offsetY,
      targetPosition.z + offsetZ
    );

    // Punto focal: si es primera persona mira hacia adelante, si es orbital mira al centro del personaje
    let idealLookAt;
    if (this.currentMode === 'first_person') {
      const fwdX = -Math.sin(this.yaw) * 15;
      const fwdZ = -Math.cos(this.yaw) * 15;
      const fwdY = -Math.tan(this.pitch) * 15;
      idealLookAt = new THREE.Vector3(
        targetPosition.x + fwdX,
        targetPosition.y + targetHeightOffset + fwdY,
        targetPosition.z + fwdZ
      );
    } else {
      idealLookAt = new THREE.Vector3(
        targetPosition.x,
        targetPosition.y + (isVehicle ? 1.5 : 1.2),
        targetPosition.z
      );
    }

    // Amortiguación suave (Lerp) para evitar tirones
    const lerpFactor = 1.0 - Math.exp(-deltaSeconds * Math.max(4, lerpRate * 1.5));
    this.currentPosition.lerp(idealPosition, lerpFactor);
    this.currentLookAt.lerp(idealLookAt, lerpFactor);

    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.currentLookAt);
  }

  getYaw() {
    return this.yaw;
  }
}
