// SkyAndAtmosphere.js - Ciclo solar astronómico día/noche, estrellas, iluminación y niebla
import * as THREE from 'three';

export class SkyAndAtmosphere {
  constructor(scene) {
    this.scene = scene;

    // Luz ambiental
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(this.ambientLight);

    // Sol direccional
    this.sunLight = new THREE.DirectionalLight(0xfff4e0, 1.2);
    this.sunLight.position.set(50, 100, 50);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 350;
    const d = 120;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);

    // Luna direccional suave
    this.moonLight = new THREE.DirectionalLight(0x7090ff, 0.25);
    this.scene.add(this.moonLight);

    // Sol 3D visual (Mesh)
    const sunGeo = new THREE.SphereGeometry(6, 16, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffe680 });
    this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
    this.scene.add(this.sunMesh);

    // Niebla atmosférica
    this.scene.fog = new THREE.FogExp2(0xd6e5f3, 0.0055);

    // Campo de estrellas para la noche
    this.initStars();
  }

  initStars() {
    const starCount = 800;
    const starGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i += 3) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 240 + Math.random() * 20;
      positions[i] = r * Math.sin(phi) * Math.cos(theta);
      positions[i + 1] = Math.abs(r * Math.cos(phi)) + 15; // Solo en el hemisferio superior
      positions[i + 2] = r * Math.sin(phi) * Math.sin(theta);
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.8,
      transparent: true,
      opacity: 0.0
    });
    this.stars = new THREE.Points(starGeo, this.starMat);
    this.scene.add(this.stars);
  }

  update(timeFraction) {
    // timeFraction va de 0.0 (medianoche) a 0.5 (mediodía) a 1.0
    // Ángulo solar en radianes: mediodía (0.5) = sol en el cenit
    const sunAngle = (timeFraction - 0.25) * Math.PI * 2;
    const orbitRadius = 180;

    const sunX = Math.cos(sunAngle) * orbitRadius;
    const sunY = Math.sin(sunAngle) * orbitRadius;
    const sunZ = 30;

    this.sunLight.position.set(sunX, Math.max(-20, sunY), sunZ);
    this.sunMesh.position.copy(this.sunLight.position);

    // Posición opuesta para la luna
    this.moonLight.position.set(-sunX, -sunY, -sunZ);

    // Altitud normalizada del sol (-1 a 1)
    const sunAlt = Math.sin(sunAngle);

    // Colores según la hora del día
    if (sunAlt > 0.15) {
      // Día pleno
      this.ambientLight.color.setHex(0xe8f0f8);
      this.ambientLight.intensity = 0.45;
      this.sunLight.color.setHex(0xfff8e8);
      this.sunLight.intensity = 1.35;
      this.scene.background = new THREE.Color(0x87ceeb); // Cielo azul
      this.scene.fog.color.setHex(0xcbe3f7);
      this.starMat.opacity = 0.0;
    } else if (sunAlt > -0.15) {
      // Amanecer / Atardecer dorado-rojizo
      const t = (sunAlt + 0.15) / 0.3; // 0 a 1
      const dawnColor = new THREE.Color(0xff7744).lerp(new THREE.Color(0x87ceeb), t);
      this.ambientLight.color.setHex(0xffaa77);
      this.ambientLight.intensity = 0.25 + t * 0.2;
      this.sunLight.color.setHex(0xffaa44);
      this.sunLight.intensity = 0.5 + t * 0.8;
      this.scene.background = dawnColor;
      this.scene.fog.color.set(dawnColor);
      this.starMat.opacity = (1 - t) * 0.4;
    } else {
      // Noche profunda
      this.ambientLight.color.setHex(0x223355);
      this.ambientLight.intensity = 0.18;
      this.sunLight.intensity = 0.0;
      this.moonLight.intensity = 0.35;
      this.scene.background = new THREE.Color(0x0a1122); // Azul noche profundo
      this.scene.fog.color.setHex(0x0e182a);
      this.starMat.opacity = 0.95;
    }
  }
}
