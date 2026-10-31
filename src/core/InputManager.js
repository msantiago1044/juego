// InputManager.js - Gestor de teclado, ratón y controles táctiles móviles
export class InputManager {
  constructor(domElement) {
    this.domElement = domElement || document.body;
    this.keys = {};
    this.mouseDelta = { x: 0, y: 0 };
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.moveVector = { x: 0, y: 0 };
    this.isTouchActive = false;
    this.isPointerLocked = false;
    this.isMouseDown = false;

    // Estado interno para gestos táctiles directos sobre el lienzo 3D
    this.canvasMoveTouchId = null;
    this.canvasMoveOrigin = { x: 0, y: 0 };
    this.canvasLookTouchId = null;
    this.canvasLookLast = { x: 0, y: 0 };

    this.callbacks = {
      interact: [],
      togglePhone: [],
      toggleCameraMode: [],
      toggleMap: []
    };

    this.initListeners();
  }

  initListeners() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;

      // Acciones directas de un solo disparo
      if (e.code === 'KeyE') {
        this.trigger('interact');
      } else if (e.code === 'Tab') {
        e.preventDefault();
        this.trigger('togglePhone');
      } else if (e.code === 'KeyM') {
        this.trigger('toggleMap');
      } else if (e.code === 'KeyV') {
        this.trigger('toggleCameraMode');
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // Control de ratón para rotación de cámara
    this.domElement.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.isMouseDown = true;
      }
    });

    window.addEventListener('mouseup', () => {
      this.isMouseDown = false;
    });

    window.addEventListener('mousemove', (e) => {
      // Si el cursor está capturado o se arrastra con clic izquierdo
      if (this.isPointerLocked || this.isMouseDown) {
        const dx = e.movementX || 0;
        const dy = e.movementY || 0;
        this.mouseDelta.x += dx;
        this.mouseDelta.y += dy;
        this.mouseDeltaX = this.mouseDelta.x;
        this.mouseDeltaY = this.mouseDelta.y;
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = (document.pointerLockElement === this.domElement);
    });

    // Soporte táctil directo en el lienzo 3D (mitad izquierda mueve al personaje, mitad derecha rota la cámara)
    this.domElement.addEventListener('touchstart', (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const isLeftHalf = t.clientX < window.innerWidth * 0.48;

        if (isLeftHalf && this.canvasMoveTouchId === null) {
          this.canvasMoveTouchId = t.identifier;
          this.canvasMoveOrigin = { x: t.clientX, y: t.clientY };
        } else if (this.canvasLookTouchId === null) {
          this.canvasLookTouchId = t.identifier;
          this.canvasLookLast = { x: t.clientX, y: t.clientY };
        }
      }
    }, { passive: true });

    this.domElement.addEventListener('touchmove', (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === this.canvasMoveTouchId) {
          const maxRadius = 55;
          const dx = t.clientX - this.canvasMoveOrigin.x;
          const dy = t.clientY - this.canvasMoveOrigin.y;
          const dist = Math.hypot(dx, dy);
          const clamped = Math.min(dist, maxRadius);
          const angle = Math.atan2(dy, dx);
          const nx = dist > 4 ? (Math.cos(angle) * clamped) / maxRadius : 0;
          const ny = dist > 4 ? (Math.sin(angle) * clamped) / maxRadius : 0;
          const sprinting = (clamped / maxRadius) > 0.8;
          this.setTouchMove(nx, ny, sprinting);
        } else if (t.identifier === this.canvasLookTouchId) {
          const dx = (t.clientX - this.canvasLookLast.x) * 1.65;
          const dy = (t.clientY - this.canvasLookLast.y) * 1.65;
          this.canvasLookLast = { x: t.clientX, y: t.clientY };
          this.mouseDelta.x += dx;
          this.mouseDelta.y += dy;
          this.mouseDeltaX = this.mouseDelta.x;
          this.mouseDeltaY = this.mouseDelta.y;
        }
      }
    }, { passive: true });

    const endTouch = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === this.canvasMoveTouchId) {
          this.canvasMoveTouchId = null;
          this.setTouchMove(0, 0, false);
        }
        if (t.identifier === this.canvasLookTouchId) {
          this.canvasLookTouchId = null;
        }
      }
    };

    this.domElement.addEventListener('touchend', endTouch, { passive: true });
    this.domElement.addEventListener('touchcancel', endTouch, { passive: true });
  }

  // Vector analógico desde el joystick virtual o el gesto táctil en pantalla
  setTouchMove(x, y, sprinting = false) {
    this.moveVector.x = Math.max(-1, Math.min(1, x || 0));
    this.moveVector.y = Math.max(-1, Math.min(1, y || 0));
    const mag = Math.hypot(this.moveVector.x, this.moveVector.y);
    this.isTouchActive = mag > 0.06;

    // Sincronizar con teclas virtuales para compatibilidad total con Player y Vehicle
    this.keys['KeyW'] = this.moveVector.y < -0.22;
    this.keys['KeyS'] = this.moveVector.y > 0.22;
    this.keys['KeyA'] = this.moveVector.x < -0.22;
    this.keys['KeyD'] = this.moveVector.x > 0.22;
    this.keys['ShiftLeft'] = !!(this.isTouchActive && sprinting);
  }

  setTouchJump(active) {
    this.keys['Space'] = !!active;
  }

  requestPointerLock() {
    if (!this.isPointerLocked && this.domElement.requestPointerLock) {
      this.domElement.requestPointerLock();
    }
  }

  exitPointerLock() {
    if (this.isPointerLocked && document.exitPointerLock) {
      document.exitPointerLock();
    }
  }

  on(action, cb) {
    if (this.callbacks[action]) {
      this.callbacks[action].push(cb);
    }
  }

  trigger(action) {
    if (this.callbacks[action]) {
      this.callbacks[action].forEach(cb => cb());
    }
  }

  // Consumir el delta de ratón y resetearlo
  consumeMouseDelta() {
    const delta = { ...this.mouseDelta };
    this.mouseDelta.x = 0;
    this.mouseDelta.y = 0;
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    return delta;
  }

  isForward() {
    return !!(this.keys['KeyW'] || this.keys['ArrowUp']);
  }

  isBackward() {
    return !!(this.keys['KeyS'] || this.keys['ArrowDown']);
  }

  isLeft() {
    return !!(this.keys['KeyA'] || this.keys['ArrowLeft']);
  }

  isRight() {
    return !!(this.keys['KeyD'] || this.keys['ArrowRight']);
  }

  isSprint() {
    return !!(this.keys['ShiftLeft'] || this.keys['ShiftRight']);
  }

  isJump() {
    return !!(this.keys['Space']);
  }
}
