// Vehicle.js - Físicas completas de vehículos: masa, motor, fricción, combustible y colisiones
import * as THREE from 'three';

export class Vehicle {
  constructor(scene, physicsWorld, audioManager, initialPos = new THREE.Vector3(-10, 0, 5), config = {}) {
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.audioManager = audioManager;

    this.position = initialPos.clone();
    this.rotationY = config.rotationY || 0;
    this.velocity = new THREE.Vector3();
    this.speed = 0; // m/s (en dirección hacia adelante)

    // Parámetros físicos
    this.mass = config.mass || 1350; // kg
    this.maxSpeed = config.topSpeed || 26; // ~95 km/h
    this.acceleration = config.acceleration || 16; // m/s^2
    this.brakeForce = 28; // m/s^2
    this.turnSpeed = config.handling || 2.2;
    this.dragCoeff = 0.32; // Coeficiente aerodinámico
    this.friction = 0.85;

    // Sistema de combustible / energía
    this.maxFuel = config.fuelCapacity || 60; // Litros o kWh
    this.fuel = this.maxFuel * 0.85;
    this.fuelConsumptionRate = config.fuelConsumption || 0.08; // L/s a máxima aceleración

    this.isOccupied = false;
    this.driver = null;

    this.createMesh(config.color || 0x3498db);
    this.boxCollider = new THREE.Box3();
  }

  createMesh(colorHex) {
    this.mesh = new THREE.Group();

    // Chasis principal (Low-Poly estilizado)
    const bodyGeo = new THREE.BoxGeometry(2.1, 0.85, 4.4);
    const bodyMat = new THREE.MeshLambertMaterial({ color: colorHex, flatShading: true });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.75;
    body.castShadow = true;
    body.receiveShadow = true;
    this.mesh.add(body);

    // Cabina / Ventanas (Vidrio polarizado oscuro)
    const cabinGeo = new THREE.BoxGeometry(1.8, 0.75, 2.4);
    const cabinMat = new THREE.MeshLambertMaterial({ color: 0x111625, flatShading: true });
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(0, 1.45, -0.2);
    cabin.castShadow = true;
    this.mesh.add(cabin);

    // 4 Ruedas
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 12);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    wheelGeo.rotateZ(Math.PI / 2);

    this.wheels = [];
    const wheelPositions = [
      [-1.05, 0.42, 1.3],   // Trasera Izq
      [1.05, 0.42, 1.3],    // Trasera Der
      [-1.05, 0.42, -1.3],  // Delantera Izq
      [1.05, 0.42, -1.3]    // Delantera Der
    ];

    wheelPositions.forEach((pos, idx) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(...pos);
      wheel.castShadow = true;
      this.mesh.add(wheel);
      this.wheels.push({ mesh: wheel, isFront: idx >= 2 });
    });

    // Faros delanteros
    const headlightGeo = new THREE.BoxGeometry(0.35, 0.2, 0.1);
    const headlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    [-0.7, 0.7].forEach(hx => {
      const hl = new THREE.Mesh(headlightGeo, headlightMat);
      hl.position.set(hx, 0.75, -2.25);
      this.mesh.add(hl);
    });

    // Luz proyectada delantera
    this.headlightBeam = new THREE.SpotLight(0xfff5dd, 0, 45, Math.PI / 5, 0.3);
    this.headlightBeam.position.set(0, 0.8, -2.1);
    this.headlightTarget = new THREE.Object3D();
    this.headlightTarget.position.set(0, 0, -20);
    this.mesh.add(this.headlightTarget);
    this.headlightBeam.target = this.headlightTarget;
    this.mesh.add(this.headlightBeam);

    // Faros traseros (rojos)
    this.taillightMat = new THREE.MeshBasicMaterial({ color: 0x990000 });
    [-0.7, 0.7].forEach(tx => {
      const tl = new THREE.Mesh(headlightGeo, this.taillightMat);
      tl.position.set(tx, 0.75, 2.25);
      this.mesh.add(tl);
    });

    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.rotationY;
    this.scene.add(this.mesh);
  }

  enter(driver) {
    this.isOccupied = true;
    this.driver = driver;
    if (this.audioManager) {
      this.audioManager.startEngine();
    }
  }

  exit() {
    this.isOccupied = false;
    this.driver = null;
    if (this.audioManager) {
      this.audioManager.stopEngine();
    }
    // Dejar el vehículo desacelerando
  }

  update(deltaSeconds, input, isNight) {
    // Iluminación de faros
    this.headlightBeam.intensity = (isNight && this.isOccupied) ? 2.5 : 0;

    if (!this.isOccupied) {
      // Fricción estática de estacionamiento
      this.speed = THREE.MathUtils.lerp(this.speed, 0, deltaSeconds * 4);
      return;
    }

    let isAccelerating = false;
    let isBraking = false;

    // Comprobar si queda combustible
    const hasFuel = this.fuel > 0;

    if (hasFuel) {
      if (input.isForward()) {
        isAccelerating = true;
        this.speed = Math.min(this.maxSpeed, this.speed + this.acceleration * deltaSeconds);
        this.fuel = Math.max(0, this.fuel - this.fuelConsumptionRate * deltaSeconds);
      } else if (input.isBackward()) {
        if (this.speed > 0.5) {
          isBraking = true;
          this.speed = Math.max(0, this.speed - this.brakeForce * deltaSeconds);
        } else {
          // Marcha atrás
          this.speed = Math.max(-10, this.speed - (this.acceleration * 0.6) * deltaSeconds);
          this.fuel = Math.max(0, this.fuel - (this.fuelConsumptionRate * 0.5) * deltaSeconds);
        }
      }
    }

    // Freno de mano con Barra Espaciadora
    if (input.isJump()) {
      isBraking = true;
      this.speed = THREE.MathUtils.lerp(this.speed, 0, deltaSeconds * 6);
    }

    // Resistencia aerodinámica y fricción del PhysicsWorld
    const surfaceFriction = this.physicsWorld ? this.physicsWorld.surfaceFriction : 0.85;
    const airDrag = 0.5 * this.dragCoeff * 1.2 * (this.speed * this.speed) * Math.sign(this.speed) * 0.008;
    this.speed -= airDrag * deltaSeconds;

    if (!isAccelerating && !isBraking) {
      // Rodadura libre con fricción
      this.speed = THREE.MathUtils.lerp(this.speed, 0, deltaSeconds * (0.8 * surfaceFriction));
    }

    // Dirección (rotación) según la velocidad actual
    if (Math.abs(this.speed) > 0.1) {
      const turnDir = (this.speed > 0 ? 1 : -1);
      // El suelo mojado (menor fricción) hace que gire con más derrape
      const grip = THREE.MathUtils.clamp(surfaceFriction, 0.4, 1.0);

      if (input.isLeft()) {
        this.rotationY += this.turnSpeed * grip * deltaSeconds * turnDir;
      }
      if (input.isRight()) {
        this.rotationY -= this.turnSpeed * grip * deltaSeconds * turnDir;
      }
    }

    // Luces de freno rojas
    this.taillightMat.color.setHex(isBraking ? 0xff0022 : 0x770000);

    // Mover posición forward (vector de orientación)
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotationY);
    const desiredMovement = forward.clone().multiplyScalar(this.speed * deltaSeconds);
    const targetPos = this.position.clone().add(desiredMovement);

    // Comprobar colisión física con edificios
    this.boxCollider.setFromCenterAndSize(targetPos.clone().setY(1.0), new THREE.Vector3(2.2, 1.8, 4.4));
    const colResult = this.physicsWorld.checkCollisions(this.boxCollider, this.position, targetPos, 1.5);

    if (colResult.hitAny) {
      // Rebote e impacto físico
      if (Math.abs(this.speed) > 4) {
        if (this.audioManager) {
          this.audioManager.playCrash(Math.abs(this.speed) / this.maxSpeed);
        }
      }
      this.speed = -this.speed * 0.25; // Rebote elástico invertido
    } else {
      let nextPos = colResult.resolvedPos;
      if (this.physicsWorld && this.physicsWorld.world) {
        nextPos = this.physicsWorld.world.clampToWalkable(this.position, nextPos);
        if (this.physicsWorld.world.lastBlockedByPrivateProperty) {
          this.speed *= 0.85;
        }
      }
      this.position.copy(nextPos);
    }

    // Actualizar visual de la malla
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.rotationY;

    // Girar ruedas
    const wheelRot = (this.speed * deltaSeconds) / 0.42;
    this.wheels.forEach(w => {
      w.mesh.rotation.x += wheelRot;
      if (w.isFront) {
        // Ángulo de giro de las ruedas delanteras
        let steerAngle = 0;
        if (input.isLeft()) steerAngle = 0.45;
        if (input.isRight()) steerAngle = -0.45;
        w.mesh.rotation.y = steerAngle;
      }
    });

    // Actualizar audio del motor
    if (this.audioManager) {
      const speedNorm = Math.abs(this.speed) / this.maxSpeed;
      this.audioManager.updateEngine(speedNorm, isAccelerating);
    }
  }

  refuel(liters, costPerLiter) {
    const space = this.maxFuel - this.fuel;
    const toAdd = Math.min(space, liters);
    this.fuel += toAdd;
    return { added: toAdd, cost: +(toAdd * costPerLiter).toFixed(2) };
  }

  getSpeedKmH() {
    return Math.round(Math.abs(this.speed) * 3.6);
  }

  getFuelPercentage() {
    return Math.round((this.fuel / this.maxFuel) * 100);
  }
}
