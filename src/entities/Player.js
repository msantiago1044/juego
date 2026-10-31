// Player.js - Avatar en 3ra persona con físicas biológicas, dinero, estamina y empleo
import * as THREE from 'three';

export class Player {
  constructor(scene, physicsWorld, audioManager) {
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.audioManager = audioManager;

    this.position = new THREE.Vector3(0, 0.1, 10);
    this.velocity = new THREE.Vector3();
    this.rotationY = 0;

    // Físicas biológicas
    this.walkSpeed = 4.8; // m/s (~17 km/h)
    this.sprintSpeed = 8.5; // m/s (~30 km/h)
    this.speedMultiplier = 1; // 1x normal, 2x rápido, 3x turbo
    this.jumpForce = 6.8;
    this.isGrounded = true;
    this.stamina = 100;
    this.maxStamina = 100;

    // Economía y estatus del jugador
    this.cash = 2500.0; // Saldo inicial
    this.bankBalance = 8000.0;
    this.job = {
      title: 'Trader Junior de Bolsa',
      company: 'Wall Street Nexus',
      salaryDaily: 140,
      level: 1
    };
    this.propertiesOwned = [];
    this.currentVehicle = null;
    this.isInVehicle = false;

    // Animación procedimental
    this.walkTime = 0;
    this.stepAudioTimer = 0;

    this.createMesh();
    this.boxCollider = new THREE.Box3();
  }

  createMesh() {
    this.mesh = new THREE.Group();

    // Paleta Low-Poly moderna (Chaqueta oscura, pantalón vaquero, piel estilizada)
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xffccaa });
    const clothesMat = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
    const pantsMat = new THREE.MeshLambertMaterial({ color: 0x2980b9 });
    const shoeMat = new THREE.MeshLambertMaterial({ color: 0x111111 });

    // Torso
    const torsoGeo = new THREE.BoxGeometry(0.7, 0.85, 0.4);
    this.torso = new THREE.Mesh(torsoGeo, clothesMat);
    this.torso.position.y = 1.35;
    this.torso.castShadow = true;
    this.mesh.add(this.torso);

    // Cabeza
    const headGeo = new THREE.BoxGeometry(0.42, 0.45, 0.42);
    this.head = new THREE.Mesh(headGeo, skinMat);
    this.head.position.y = 2.05;
    this.head.castShadow = true;
    this.mesh.add(this.head);

    // Cabello moderno
    const hairGeo = new THREE.BoxGeometry(0.44, 0.18, 0.44);
    const hair = new THREE.Mesh(hairGeo, new THREE.MeshLambertMaterial({ color: 0x2c2c2c }));
    hair.position.y = 2.22;
    this.mesh.add(hair);

    // Brazos articulados
    const armGeo = new THREE.BoxGeometry(0.2, 0.7, 0.22);
    this.leftArm = new THREE.Mesh(armGeo, clothesMat);
    this.leftArm.position.set(-0.48, 1.3, 0);
    this.leftArm.castShadow = true;
    this.mesh.add(this.leftArm);

    this.rightArm = new THREE.Mesh(armGeo, clothesMat);
    this.rightArm.position.set(0.48, 1.3, 0);
    this.rightArm.castShadow = true;
    this.mesh.add(this.rightArm);

    // Piernas articuladas
    const legGeo = new THREE.BoxGeometry(0.26, 0.85, 0.28);
    this.leftLeg = new THREE.Mesh(legGeo, pantsMat);
    this.leftLeg.position.set(-0.2, 0.48, 0);
    this.leftLeg.castShadow = true;
    this.mesh.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(legGeo, pantsMat);
    this.rightLeg.position.set(0.2, 0.48, 0);
    this.rightLeg.castShadow = true;
    this.mesh.add(this.rightLeg);

    this.mesh.position.copy(this.position);
    this.scene.add(this.mesh);
  }

  update(deltaSeconds, input, cameraAngleY) {
    if (this.isInVehicle) {
      this.mesh.visible = false;
      if (this.currentVehicle) {
        this.position.copy(this.currentVehicle.position);
      }
      return;
    }

    this.mesh.visible = true;

    // Calcular dirección deseada según la cámara, joystick táctil analógico o WASD
    let moveX = 0;
    let moveZ = 0;
    let analogMagnitude = 1;

    const touchMag = input.moveVector ? Math.hypot(input.moveVector.x, input.moveVector.y) : 0;
    if (touchMag > 0.08) {
      moveX = input.moveVector.x;
      moveZ = input.moveVector.y;
      analogMagnitude = Math.min(1, touchMag);
    } else {
      if (input.isForward()) moveZ -= 1;
      if (input.isBackward()) moveZ += 1;
      if (input.isLeft()) moveX -= 1;
      if (input.isRight()) moveX += 1;
    }

    const isMoving = (moveX !== 0 || moveZ !== 0);

    // Sprint con estamina biológica
    let currentSpeed = this.walkSpeed * analogMagnitude;
    const isSprinting = input.isSprint() && isMoving && this.stamina > 5;
    if (isSprinting) {
      currentSpeed = this.sprintSpeed;
      this.stamina = Math.max(0, this.stamina - deltaSeconds * 22);
    } else {
      // Recuperación natural de estamina
      this.stamina = Math.min(this.maxStamina, this.stamina + deltaSeconds * 12);
    }
    currentSpeed *= (this.speedMultiplier || 1);

    if (isMoving) {
      const moveVec = new THREE.Vector3(moveX, 0, moveZ).normalize();
      moveVec.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraAngleY);

      // Orientar personaje hacia la dirección de movimiento
      const targetRotation = Math.atan2(moveVec.x, moveVec.z);
      this.rotationY = THREE.MathUtils.lerp(this.rotationY, targetRotation, deltaSeconds * 14);

      this.velocity.x = moveVec.x * currentSpeed;
      this.velocity.z = moveVec.z * currentSpeed;

      // Animación procedimental de paso y brazos proporcional a la velocidad
      const freq = (isSprinting ? 14 : 9) * (this.speedMultiplier || 1);
      this.walkTime += deltaSeconds * freq;
      const swing = Math.sin(this.walkTime) * 0.65;

      this.leftLeg.rotation.x = swing;
      this.rightLeg.rotation.x = -swing;
      this.leftArm.rotation.x = -swing;
      this.rightArm.rotation.x = swing;

      // Sonido de pasos
      this.stepAudioTimer += deltaSeconds;
      const stepInterval = (isSprinting ? 0.28 : 0.42) / (this.speedMultiplier || 1);
      if (this.stepAudioTimer >= stepInterval) {
        this.stepAudioTimer = 0;
        if (this.isGrounded && this.audioManager) {
          this.audioManager.playFootstep();
        }
      }
    } else {
      this.velocity.x = 0;
      this.velocity.z = 0;
      // Reposo / Respiración sutil
      this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, 0, deltaSeconds * 10);
      this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, 0, deltaSeconds * 10);
      this.leftArm.rotation.x = THREE.MathUtils.lerp(this.leftArm.rotation.x, 0, deltaSeconds * 10);
      this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, 0, deltaSeconds * 10);
    }

    // Salto y Gravedad Newtoniana (g = 9.81 m/s^2)
    if (input.isJump() && this.isGrounded) {
      this.velocity.y = this.jumpForce;
      this.isGrounded = false;
      if (this.audioManager) {
        this.audioManager.playJump();
      }
    }

    if (!this.isGrounded) {
      this.velocity.y -= (this.physicsWorld ? this.physicsWorld.gravity : 9.81) * deltaSeconds;
    }

    // Calcular desplazamiento
    const desiredPos = this.position.clone().add(this.velocity.clone().multiplyScalar(deltaSeconds));

    // Suelo
    const groundHeight = this.physicsWorld ? this.physicsWorld.getGroundHeight(desiredPos.x, desiredPos.z) : 0;
    if (desiredPos.y <= groundHeight) {
      desiredPos.y = groundHeight;
      this.velocity.y = 0;
      this.isGrounded = true;
    }

    // Comprobar colisiones con edificios y obstáculos
    this.boxCollider.setFromCenterAndSize(desiredPos.clone().setY(1.0), new THREE.Vector3(0.8, 1.9, 0.8));
    const colResult = this.physicsWorld.checkCollisions(this.boxCollider, this.position, desiredPos, 0.45);
    let finalPos = colResult.resolvedPos;

    // Restricción estricta: solo permitir transitar por vías públicas y espacios públicos
    if (this.physicsWorld && this.physicsWorld.world) {
      finalPos = this.physicsWorld.world.clampToWalkable(this.position, finalPos);
    }

    this.position.copy(finalPos);

    // Actualizar Malla
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.rotationY;
  }

  enterVehicle(vehicle) {
    this.isInVehicle = true;
    this.currentVehicle = vehicle;
    vehicle.enter(this);
  }

  exitVehicle() {
    if (!this.currentVehicle) return;
    this.isInVehicle = false;
    // Aparecer al lado izquierdo del vehículo (ajustado a la vía o espacio público)
    const sideOffset = new THREE.Vector3(-2.2, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.currentVehicle.rotationY);
    const exitCandidate = this.currentVehicle.position.clone().add(sideOffset);
    exitCandidate.y = 0;

    if (this.physicsWorld && this.physicsWorld.world) {
      const clampedExit = this.physicsWorld.world.clampToWalkable(this.currentVehicle.position, exitCandidate);
      this.position.copy(clampedExit);
    } else {
      this.position.copy(exitCandidate);
    }

    this.currentVehicle.exit();
    this.currentVehicle = null;
  }
}
