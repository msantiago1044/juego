// ThirdPersonCamera.js - Cámara orbital en 3ra persona con amortiguación suave y modo vehículo
import * as THREE from 'three';

export class ThirdPersonCamera {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;

    this.currentPosition = new THREE.Vector3();
    this.currentLookAt = new THREE.Vector3();

    // Ángulos esféricos
    this.yaw = 0; // Rotación horizontal
    this.pitch = 0.28; // Inclinación vertical (radianes)
    this.distance = 6.8; // Distancia al objetivo

    this.minPitch = -0.15;
    this.maxPitch = 1.15; // Evitar que se invierta verticalmente

    this.mouseSensitivity = 0.0028;
  }

  updateMouse(mouseDelta) {
    if (mouseDelta.x !== 0 || mouseDelta.y !== 0) {
      this.yaw -= mouseDelta.x * this.mouseSensitivity;
      this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch + mouseDelta.y * this.mouseSensitivity));
    }
  }

  update(deltaSeconds, targetPosition, isVehicle = false) {
    if (!targetPosition) return;

    // Distancia y altura según si va a pie o en coche
    const targetDistance = isVehicle ? 9.8 : 6.5;
    const targetHeightOffset = isVehicle ? 2.2 : 1.7;

    this.distance = THREE.MathUtils.lerp(this.distance, targetDistance, deltaSeconds * 4);

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

    const idealLookAt = new THREE.Vector3(
      targetPosition.x,
      targetPosition.y + targetHeightOffset,
      targetPosition.z
    );

    // Amortiguación suave (Lerp) para evitar movimientos bruscos
    const lerpFactor = 1.0 - Math.exp(-deltaSeconds * 12);
    this.currentPosition.lerp(idealPosition, lerpFactor);
    this.currentLookAt.lerp(idealLookAt, lerpFactor);

    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.currentLookAt);
  }

  getYaw() {
    return this.yaw;
  }
}
