// WeatherSystem.js - Simulación meteorológica: Lluvia, viento, fricción física y tormentas
import * as THREE from 'three';

export class WeatherSystem {
  constructor(scene, physicsWorld) {
    this.scene = scene;
    this.physicsWorld = physicsWorld;

    this.currentWeather = 'despejado'; // despejado, lluvia, tormenta, niebla
    this.wetness = 0.0;
    this.temperature = 22.0; // °C
    this.wind = new THREE.Vector3(2.5, 0, 1.2); // Vector de viento (m/s)

    this.rainCount = 2000;
    this.initRain();

    // Luz de relámpago
    this.lightningLight = new THREE.PointLight(0xddeeff, 0, 300);
    this.lightningLight.position.set(0, 80, 0);
    this.scene.add(this.lightningLight);
    this.lightningTimer = 0;

    this.changeTimer = 0;
    this.changeInterval = 120; // Cambiar clima cada 2 minutos
  }

  initRain() {
    const rainGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.rainCount * 3);
    const velocities = new Float32Array(this.rainCount);

    for (let i = 0; i < this.rainCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 160;
      positions[i * 3 + 1] = Math.random() * 60;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 160;
      velocities[i] = 30 + Math.random() * 20; // Velocidad de caída libre
    }

    rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.rainVelocities = velocities;

    this.rainMat = new THREE.PointsMaterial({
      color: 0x99ccff,
      size: 0.65,
      transparent: true,
      opacity: 0.0
    });

    this.rainParticles = new THREE.Points(rainGeo, this.rainMat);
    this.scene.add(this.rainParticles);
  }

  setWeather(type) {
    this.currentWeather = type;
    if (type === 'lluvia') {
      this.rainMat.opacity = 0.75;
      this.temperature = 16.5;
    } else if (type === 'tormenta') {
      this.rainMat.opacity = 0.95;
      this.temperature = 14.0;
      this.wind.set(6.0, 0, 3.5);
    } else if (type === 'niebla') {
      this.rainMat.opacity = 0.0;
      this.temperature = 18.0;
    } else {
      // despejado
      this.rainMat.opacity = 0.0;
      this.temperature = 24.5;
      this.wind.set(1.5, 0, 0.8);
    }
  }

  update(deltaSeconds, playerPosition, skyAtmosphere) {
    // Cambio aleatorio de clima con el tiempo
    this.changeTimer += deltaSeconds;
    if (this.changeTimer >= this.changeInterval) {
      this.changeTimer = 0;
      const weathers = ['despejado', 'despejado', 'lluvia', 'tormenta', 'despejado'];
      const nextW = weathers[Math.floor(Math.random() * weathers.length)];
      this.setWeather(nextW);
    }

    // Actualizar humedad de la superficie y fricción del PhysicsWorld
    if (this.currentWeather === 'lluvia' || this.currentWeather === 'tormenta') {
      this.wetness = Math.min(1.0, this.wetness + deltaSeconds * 0.15);
    } else {
      this.wetness = Math.max(0.0, this.wetness - deltaSeconds * 0.05); // Se va secando con el sol
    }

    if (this.physicsWorld) {
      this.physicsWorld.setWeatherFriction(this.wetness);
    }

    // Mover partículas de lluvia centradas en el jugador
    if (this.rainMat.opacity > 0 && playerPosition) {
      const positions = this.rainParticles.geometry.attributes.position.array;
      const px = playerPosition.x;
      const pz = playerPosition.z;

      for (let i = 0; i < this.rainCount; i++) {
        // Gravedad y viento
        positions[i * 3 + 1] -= this.rainVelocities[i] * deltaSeconds;
        positions[i * 3] += this.wind.x * deltaSeconds;
        positions[i * 3 + 2] += this.wind.z * deltaSeconds;

        // Si toca el suelo, reaparece arriba
        if (positions[i * 3 + 1] < 0) {
          positions[i * 3 + 1] = 50 + Math.random() * 15;
          positions[i * 3] = px + (Math.random() - 0.5) * 140;
          positions[i * 3 + 2] = pz + (Math.random() - 0.5) * 140;
        }
      }
      this.rainParticles.geometry.attributes.position.needsUpdate = true;
    }

    // Relámpagos durante tormentas
    if (this.currentWeather === 'tormenta') {
      this.lightningTimer -= deltaSeconds;
      if (this.lightningTimer <= 0) {
        if (Math.random() < 0.25) {
          this.lightningLight.intensity = 4.5;
          setTimeout(() => {
            this.lightningLight.intensity = 0;
          }, 120);
        }
        this.lightningTimer = 4 + Math.random() * 6;
      }
    } else {
      this.lightningLight.intensity = 0;
    }
  }

  getWeatherInfo() {
    const icons = {
      despejado: '☀️ Despejado',
      lluvia: '🌧️ Lluvia Ligera',
      tormenta: '⛈️ Tormenta Eléctrica',
      niebla: '🌫️ Neblina'
    };
    return {
      name: icons[this.currentWeather] || this.currentWeather,
      temp: `${this.temperature.toFixed(1)}°C`,
      wetness: `${Math.round(this.wetness * 100)}%`,
      frictionNotice: this.wetness > 0.4 ? '⚠️ Asfalto mojado: Menor tracción' : '✅ Tracción óptima'
    };
  }
}
