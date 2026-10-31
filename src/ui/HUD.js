// HUD.js - Interfaz limpia, minimalista y de alta visibilidad para TerraSim 3D
export class HUD {
  constructor(container, gameContext) {
    this.container = container;
    this.game = gameContext;
    this.bannerTimeout = null;
    this.osmStatusTimeout = null;
    this.toastTimeout = null;
    this.walkToastTimeout = null;

    // Callbacks para controles móviles y acciones rápidas
    this.onJoystickMove = null;
    this.onJumpTap = null;
    this.onGpsCenterTap = null;
    this.onMapToggleTap = null;
    this.onCameraModeChange = null;
    this.onInteractTap = null;

    this.currentCameraMode = 'normal';
    this.clockEl = null;

    this.joystickTouchId = null;

    this.createDom();
    this.initTouchControls();
  }

  createDom() {
    this.hudEl = document.createElement('div');
    this.hudEl.className = 'hud-container';
    this.hudEl.innerHTML = `
      <!-- Barra Superior Minimalista -->
      <div class="hud-top-bar">
        <div class="hud-top-left">
          <div class="hud-osm-status-pill hidden" id="hud-osm-status-pill">
            <span class="osm-status-icon" id="hud-osm-status-icon">🔄</span>
            <span class="osm-status-text" id="hud-osm-status-text">Descargando vías reales...</span>
          </div>
        </div>
        <div class="hud-top-right">
          <!-- Selector Rápido de Modos de Cámara -->
          <div class="hud-camera-selector" id="hud-camera-selector" title="Modos de visualización de cámara">
            <button class="btn-camera-view active" data-mode="normal" type="button" title="Cámara Normal (3ra Persona)">
              🚶 <span class="cam-btn-text">Normal</span>
            </button>
            <button class="btn-camera-view" data-mode="panoramic" type="button" title="Panorámica Lejana (Ciudad/Barrio)">
              🔭 <span class="cam-btn-text">Panorámica</span>
            </button>
            <button class="btn-camera-view" data-mode="airplane" type="button" title="Vista de Avión / Dron Aéreo">
              ✈️ <span class="cam-btn-text">Avión</span>
            </button>
            <button class="btn-camera-view" data-mode="isometric" type="button" title="Vista Isométrica en Ángulo 45°">
              📐 <span class="cam-btn-text">Isométrica</span>
            </button>
            <button class="btn-camera-view" data-mode="first_person" type="button" title="Primera Persona (Ojos del Personaje)">
              👁️ <span class="cam-btn-text">1ra Persona</span>
            </button>
          </div>

          <div class="hud-clock-pill" id="hud-clock-pill" title="Hora actual en vivo">
            🕒 <span id="hud-clock">--:--:--</span>
          </div>
        </div>
      </div>

      <!-- Toast flotante para notificaciones de acción (Centrado GPS, etc.) -->
      <div class="hud-toast hidden" id="hud-toast">
        <span id="hud-toast-text">📍 Personaje centrado en tu ubicación GPS real</span>
      </div>

      <!-- Aviso flotante de Restricción de Vía Pública / Espacio Público -->
      <div class="hud-walkability-toast hidden" id="hud-walkability-toast">
        🚧 <span>Propiedad privada: Solo puedes transitar por vías públicas y espacios públicos</span>
      </div>

      <!-- Joystick Táctil Virtual (Esquina Inferior Izquierda) -->
      <div class="mobile-joystick-zone" id="mobile-joystick-zone">
        <div class="mobile-joystick-base" id="mobile-joystick-base">
          <div class="mobile-joystick-stick" id="mobile-joystick-stick"></div>
        </div>
        <div class="mobile-joystick-hint">Arrastra para moverte</div>
      </div>

      <!-- Banner / Botón de Interacción Contextual con POIs Reales -->
      <div class="hud-poi-prompt hidden" id="hud-poi-prompt">
        <button class="btn-hud-interact" id="btn-hud-interact" type="button" title="Entrar al edificio / interactuar">
          <span class="btn-interact-key">[E]</span>
          <span class="btn-interact-icon" id="hud-poi-icon">🏪</span>
          <div class="btn-interact-texts">
            <span class="btn-interact-action">Entrar</span>
            <span class="btn-interact-name" id="hud-poi-name">Lugar de Interés</span>
          </div>
        </button>
      </div>

      <!-- Botones de Acción en Esquina Inferior Derecha -->
      <div class="hud-bottom-right">
        <button class="btn-hud-action btn-hud-map" id="btn-hud-map" type="button" title="Ver Mapa Interactivo">
          🗺️ <span>Ver Mapa</span>
        </button>
      </div>

      <!-- Ayuda de Controles Minimalista (Desktop) -->
      <div class="hud-controls-help">
        <div><strong>[WASD]</strong> Moverse</div>
        <div><strong>[Mouse / Touch]</strong> Girar cámara</div>
        <div><strong>[Shift]</strong> Correr</div>
        <div><strong>[Espacio]</strong> Saltar</div>
        <div><strong>[V]</strong> Cambiar Cámara</div>
        <div><strong>[M]</strong> Ver Mapa</div>
        <div><strong>[C]</strong> Centrar GPS</div>
      </div>
    `;

    this.container.appendChild(this.hudEl);

    // Elemento reactivo del reloj
    this.clockEl = this.hudEl.querySelector('#hud-clock');

    // Conectar botones de visualización de cámara
    const camButtons = this.hudEl.querySelectorAll('.btn-camera-view');
    camButtons.forEach(btn => {
      const mode = btn.getAttribute('data-mode');
      const handleTap = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.selectCameraMode(mode);
      };
      btn.addEventListener('click', handleTap);
      btn.addEventListener('touchend', handleTap);
    });

    // Conectar botón de mapa interactivo
    const btnMap = this.hudEl.querySelector('#btn-hud-map');
    if (btnMap) {
      const handleMapToggle = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof this.onMapToggleTap === 'function') {
          this.onMapToggleTap();
        }
      };
      btnMap.addEventListener('click', handleMapToggle);
      btnMap.addEventListener('touchend', handleMapToggle);
    }

    // Conectar botón de interacción contextual con POIs
    const btnInteract = this.hudEl.querySelector('#btn-hud-interact');
    if (btnInteract) {
      const handleInteract = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof this.onInteractTap === 'function') {
          this.onInteractTap();
        }
      };
      btnInteract.addEventListener('click', handleInteract);
      btnInteract.addEventListener('touchend', handleInteract);
    }
  }

  openGpsConfirmModal() {
    if (this.game?.mapsApp && typeof this.game.mapsApp.openGpsConfirmModal === 'function') {
      this.game.mapsApp.openGpsConfirmModal();
    }
  }

  closeGpsConfirmModal() {
    // Delegado al modal del mapa interactivo
  }

  initTouchControls() {
    const zone = this.hudEl.querySelector('#mobile-joystick-zone');
    const base = this.hudEl.querySelector('#mobile-joystick-base');
    const stick = this.hudEl.querySelector('#mobile-joystick-stick');

    if (zone && base && stick) {
      const maxRadius = 46;
      let isDraggingMouse = false;

      const updateStickFromPoint = (clientX, clientY) => {
        const rect = base.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dx = clientX - centerX;
        const dy = clientY - centerY;
        const dist = Math.hypot(dx, dy);
        const clamped = Math.min(dist, maxRadius);
        const angle = Math.atan2(dy, dx);
        const offsetX = Math.cos(angle) * clamped;
        const offsetY = Math.sin(angle) * clamped;

        stick.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;
        const ratio = clamped / maxRadius;
        const isSprint = ratio > 0.8;
        stick.classList.toggle('sprint-active', isSprint);

        const nx = dist > 3 ? offsetX / maxRadius : 0;
        const ny = dist > 3 ? offsetY / maxRadius : 0;

        if (typeof this.onJoystickMove === 'function') {
          this.onJoystickMove(nx, ny, isSprint);
        }
      };

      const resetStick = () => {
        stick.style.transform = 'translate(-50%, -50%)';
        stick.classList.remove('sprint-active');
        if (typeof this.onJoystickMove === 'function') {
          this.onJoystickMove(0, 0, false);
        }
      };

      zone.addEventListener('touchstart', (e) => {
        e.stopPropagation();
        if (this.joystickTouchId === null && e.changedTouches.length > 0) {
          const t = e.changedTouches[0];
          this.joystickTouchId = t.identifier;
          updateStickFromPoint(t.clientX, t.clientY);
        }
      }, { passive: true });

      zone.addEventListener('touchmove', (e) => {
        e.stopPropagation();
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (t.identifier === this.joystickTouchId) {
            updateStickFromPoint(t.clientX, t.clientY);
            break;
          }
        }
      }, { passive: true });

      const endJoystickTouch = (e) => {
        e.stopPropagation();
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === this.joystickTouchId) {
            this.joystickTouchId = null;
            resetStick();
            break;
          }
        }
      };

      zone.addEventListener('touchend', endJoystickTouch, { passive: true });
      zone.addEventListener('touchcancel', endJoystickTouch, { passive: true });

      // Soporte para pruebas de ratón en el joystick
      zone.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        isDraggingMouse = true;
        updateStickFromPoint(e.clientX, e.clientY);
      });

      window.addEventListener('mousemove', (e) => {
        if (isDraggingMouse) {
          updateStickFromPoint(e.clientX, e.clientY);
        }
      });

      window.addEventListener('mouseup', () => {
        if (isDraggingMouse) {
          isDraggingMouse = false;
          resetStick();
        }
      });
    }
  }

  showToast(message, duration = 3000) {
    const toast = this.hudEl.querySelector('#hud-toast');
    const textEl = this.hudEl.querySelector('#hud-toast-text');
    if (!toast || !textEl) return;

    textEl.innerText = message;
    toast.classList.remove('hidden');

    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
    this.toastTimeout = setTimeout(() => {
      toast.classList.add('hidden');
    }, duration);
  }

  showPrivatePropertyWarning() {
    const toast = this.hudEl.querySelector('#hud-walkability-toast');
    if (!toast) return;
    toast.classList.remove('hidden');
    if (this.walkToastTimeout) {
      clearTimeout(this.walkToastTimeout);
    }
    this.walkToastTimeout = setTimeout(() => {
      toast.classList.add('hidden');
    }, 2300);
  }

  showLocationBanner(zoneOrOptions, subTitle = '', accentColor = '#4ade80') {
    // La ubicación se muestra estrictamente en la cabecera del mapa interactivo
    // Se mantiene el método para compatibilidad con eventos de zona de main.js
  }

  showOsmStatus(status, message) {
    const pill = this.hudEl.querySelector('#hud-osm-status-pill');
    const textEl = this.hudEl.querySelector('#hud-osm-status-text');
    const iconEl = this.hudEl.querySelector('#hud-osm-status-icon');
    if (!pill || !textEl) return;

    if (this.osmStatusTimeout) {
      clearTimeout(this.osmStatusTimeout);
      this.osmStatusTimeout = null;
    }

    textEl.innerText = message || '';
    pill.classList.remove('hidden', 'osm-loading', 'osm-success', 'osm-warning', 'osm-fading');

    if (status === 'loading') {
      pill.classList.add('osm-loading');
      if (iconEl) iconEl.innerText = '🔄';
    } else if (status === 'success') {
      pill.classList.add('osm-success');
      if (iconEl) iconEl.innerText = '✅';
      this.osmStatusTimeout = setTimeout(() => {
        pill.classList.add('osm-fading');
        setTimeout(() => {
          pill.classList.add('hidden');
          pill.classList.remove('osm-fading');
        }, 500);
      }, 4000);
    } else if (status === 'warning' || status === 'error') {
      pill.classList.add('osm-warning');
      if (iconEl) iconEl.innerText = '⚠️';
      this.osmStatusTimeout = setTimeout(() => {
        pill.classList.add('osm-fading');
        setTimeout(() => {
          pill.classList.add('hidden');
          pill.classList.remove('osm-fading');
        }, 500);
      }, 6000);
    }
  }

  selectCameraMode(modeId, notify = true) {
    this.currentCameraMode = modeId;
    const buttons = this.hudEl.querySelectorAll('.btn-camera-view');
    buttons.forEach(b => {
      if (b.getAttribute('data-mode') === modeId) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });

    if (notify && typeof this.onCameraModeChange === 'function') {
      const modeConfig = this.onCameraModeChange(modeId);
      if (modeConfig) {
        this.showToast(`${modeConfig.icon} Modo ${modeConfig.name}: ${modeConfig.description}`);
      }
    }

    if (this.game?.audioManager) {
      this.game.audioManager.playUiClick();
    }
  }

  showPOIPrompt(poi) {
    const promptEl = this.hudEl.querySelector('#hud-poi-prompt');
    if (!promptEl || !poi) return;
    const iconEl = promptEl.querySelector('#hud-poi-icon');
    const nameEl = promptEl.querySelector('#hud-poi-name');
    if (iconEl && this.game?.world?.osmBuildings) {
      iconEl.textContent = this.game.world.osmBuildings.getPOIIcon(poi.type);
    }
    if (nameEl) {
      nameEl.textContent = poi.name || 'Lugar de Interés';
    }
    promptEl.classList.remove('hidden');
  }

  hidePOIPrompt() {
    const promptEl = this.hudEl.querySelector('#hud-poi-prompt');
    if (promptEl) {
      promptEl.classList.add('hidden');
    }
  }

  update() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    if (this.clockEl) {
      this.clockEl.innerText = timeStr;
    }
  }
}
