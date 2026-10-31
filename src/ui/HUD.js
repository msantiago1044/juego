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
    this.onSpeedChange = null;

    this.currentSpeedMultiplier = 1;
    this.clockEl = null;
    this.speedTextEl = null;

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
          <div class="hud-location-pill" id="hud-location-pill">
            📍 <span id="hud-location-text">Cargando ubicación...</span>
          </div>
          <div class="hud-osm-status-pill hidden" id="hud-osm-status-pill">
            <span class="osm-status-icon" id="hud-osm-status-icon">🔄</span>
            <span class="osm-status-text" id="hud-osm-status-text">Descargando calles reales...</span>
          </div>
        </div>
        <div class="hud-top-right">
          <button class="hud-speed-pill" id="btn-toggle-speed" type="button" title="Velocidad del personaje (1x, 2x, 3x)">
            ⚡ <span id="hud-speed-text">1x Normal</span>
          </button>
          <div class="hud-clock-pill" id="hud-clock-pill" title="Hora actual local">
            🕒 <span id="hud-clock">--:-- --</span>
          </div>
        </div>
      </div>

      <!-- Cartel de Zona Estilo Pokémon (Esquina Superior Izquierda) -->
      <div class="pokemon-location-banner" id="pokemon-location-banner">
        <div class="pokemon-banner-accent" id="pokemon-banner-accent"></div>
        <div class="pokemon-banner-body">
          <div class="pokemon-banner-top">
            <span class="pokemon-banner-badge" id="pokemon-banner-badge">🛣️ VÍA PÚBLICA</span>
          </div>
          <div class="pokemon-banner-title" id="pokemon-banner-title">Pueblo Origen • Barranquilla</div>
          <div class="pokemon-banner-subtitle" id="pokemon-banner-subtitle">Vías y Espacios Públicos Transitables</div>
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

      <!-- Botones de Acción en Esquina Inferior Derecha -->
      <div class="hud-bottom-right">
        <button class="btn-hud-action btn-hud-jump" id="btn-hud-jump" type="button" title="Saltar">
          ⬆️ <span>Saltar</span>
        </button>
        <button class="btn-hud-action btn-hud-map" id="btn-hud-map" type="button" title="Ver Mapa Interactivo">
          🗺️ <span>Ver Mapa</span>
        </button>
        <button class="btn-center-gps" id="btn-center-gps" type="button" title="Centrar personaje en tu ubicación GPS real">
          📍 <span>Centrar en mi GPS</span>
        </button>
      </div>

      <!-- Ayuda de Controles Minimalista (Desktop) -->
      <div class="hud-controls-help">
        <div><strong>[WASD]</strong> Moverse</div>
        <div><strong>[Mouse / Touch]</strong> Girar cámara</div>
        <div><strong>[Shift]</strong> Correr</div>
        <div><strong>[Espacio]</strong> Saltar</div>
        <div><strong>[1/2/3]</strong> Velocidad</div>
        <div><strong>[M]</strong> Ver Mapa</div>
        <div><strong>[C]</strong> Centrar GPS</div>
      </div>

      <!-- Modal de Confirmación de Centrado GPS -->
      <div class="gps-confirm-modal hidden" id="gps-confirm-modal">
        <div class="gps-confirm-card">
          <div class="gps-confirm-header">
            <span class="gps-confirm-icon">📍</span>
            <h3>Centrar en tu ubicación GPS</h3>
          </div>
          <p class="gps-confirm-message">
            ¿Estás seguro de que deseas regresar y centrar tu personaje a tu ubicación GPS real?
          </p>
          <div class="gps-confirm-actions">
            <button class="btn-gps-confirm-no" id="btn-cancel-center-gps" type="button">Cancelar</button>
            <button class="btn-gps-confirm-yes" id="btn-confirm-center-gps" type="button">Confirmar y Centrar</button>
          </div>
        </div>
      </div>
    `;

    this.container.appendChild(this.hudEl);

    // Elementos reactivos de la barra superior
    this.clockEl = this.hudEl.querySelector('#hud-clock');
    this.speedTextEl = this.hudEl.querySelector('#hud-speed-text');

    // Conectar botón de alternancia de velocidad
    const btnSpeed = this.hudEl.querySelector('#btn-toggle-speed');
    if (btnSpeed) {
      const handleSpeedClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.cycleSpeedMultiplier();
      };
      btnSpeed.addEventListener('click', handleSpeedClick);
      btnSpeed.addEventListener('touchend', handleSpeedClick);
    }

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

    // Conectar botón principal de centrado en GPS (abre confirmación)
    const btnCenterGps = this.hudEl.querySelector('#btn-center-gps');
    if (btnCenterGps) {
      const handleGpsCenterClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.openGpsConfirmModal();
      };
      btnCenterGps.addEventListener('click', handleGpsCenterClick);
      btnCenterGps.addEventListener('touchend', handleGpsCenterClick);
    }

    // Conectar botones del modal de confirmación GPS
    const modalGpsConfirm = this.hudEl.querySelector('#gps-confirm-modal');
    const btnConfirmGps = this.hudEl.querySelector('#btn-confirm-center-gps');
    const btnCancelGps = this.hudEl.querySelector('#btn-cancel-center-gps');

    if (btnConfirmGps) {
      btnConfirmGps.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.closeGpsConfirmModal();
        if (typeof this.onGpsCenterTap === 'function') {
          this.onGpsCenterTap();
        }
      });
    }

    if (btnCancelGps) {
      btnCancelGps.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.closeGpsConfirmModal();
      });
    }

    if (modalGpsConfirm) {
      modalGpsConfirm.addEventListener('click', (e) => {
        if (e.target === modalGpsConfirm) {
          this.closeGpsConfirmModal();
        }
      });
    }
  }

  openGpsConfirmModal() {
    const modal = this.hudEl.querySelector('#gps-confirm-modal');
    if (modal) {
      modal.classList.remove('hidden');
      if (this.game?.audioManager) {
        this.game.audioManager.playUiClick();
      }
    }
  }

  closeGpsConfirmModal() {
    const modal = this.hudEl.querySelector('#gps-confirm-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
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

    // Botón Saltar
    const btnJump = this.hudEl.querySelector('#btn-hud-jump');
    if (btnJump) {
      const startJump = (e) => {
        e.preventDefault();
        if (typeof this.onJumpTap === 'function') this.onJumpTap(true);
      };
      const endJump = (e) => {
        e.preventDefault();
        if (typeof this.onJumpTap === 'function') this.onJumpTap(false);
      };
      btnJump.addEventListener('touchstart', startJump, { passive: false });
      btnJump.addEventListener('touchend', endJump, { passive: false });
      btnJump.addEventListener('touchcancel', endJump, { passive: false });
      btnJump.addEventListener('mousedown', startJump);
      btnJump.addEventListener('mouseup', endJump);
      btnJump.addEventListener('mouseleave', endJump);
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
    let badge = '🛣️ VÍA PÚBLICA';
    let title = '';
    let subtitle = subTitle;
    let color = accentColor;

    if (typeof zoneOrOptions === 'object' && zoneOrOptions !== null) {
      badge = zoneOrOptions.badge || '🛣️ VÍA PÚBLICA';
      title = zoneOrOptions.title || zoneOrOptions.name || 'Pueblo Origen';
      subtitle = zoneOrOptions.subtitle || '';
      color = zoneOrOptions.accentColor || '#4ade80';
    } else {
      title = String(zoneOrOptions || 'Pueblo Origen');
    }

    const bannerEl = this.hudEl.querySelector('#pokemon-location-banner');
    const accentEl = this.hudEl.querySelector('#pokemon-banner-accent');
    const badgeEl = this.hudEl.querySelector('#pokemon-banner-badge');
    const titleEl = this.hudEl.querySelector('#pokemon-banner-title');
    const subEl = this.hudEl.querySelector('#pokemon-banner-subtitle');
    const locTextEl = this.hudEl.querySelector('#hud-location-text');

    if (locTextEl) {
      locTextEl.innerText = title;
    }

    if (!bannerEl) return;

    if (accentEl) accentEl.style.backgroundColor = color;
    if (badgeEl) {
      badgeEl.innerText = badge;
      badgeEl.style.backgroundColor = `${color}28`;
      badgeEl.style.color = color;
      badgeEl.style.borderColor = `${color}66`;
    }
    if (titleEl) titleEl.innerText = title;
    if (subEl) subEl.innerText = subtitle;

    bannerEl.style.borderColor = `${color}66`;
    bannerEl.classList.remove('banner-visible');
    void bannerEl.offsetWidth;
    bannerEl.classList.add('banner-visible');

    if (this.bannerTimeout) {
      clearTimeout(this.bannerTimeout);
    }
    this.bannerTimeout = setTimeout(() => {
      bannerEl.classList.remove('banner-visible');
    }, 3800);
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

  getSpeedLabel(factor) {
    if (factor === 2) return '2x Rápido';
    if (factor === 3) return '3x Turbo';
    return '1x Normal';
  }

  setSpeedMultiplier(factor, notify = true, showToast = true) {
    const valid = (factor === 2 || factor === 3) ? factor : 1;
    this.currentSpeedMultiplier = valid;
    const label = this.getSpeedLabel(valid);
    if (this.speedTextEl) {
      this.speedTextEl.innerText = label;
    }
    if (notify && typeof this.onSpeedChange === 'function') {
      this.onSpeedChange(valid);
    }
    if (showToast) {
      this.showToast(`⚡ Velocidad: ${label}`);
    }
    if (this.game?.audioManager) {
      this.game.audioManager.playUiClick();
    }
  }

  cycleSpeedMultiplier() {
    let next = 1;
    if (this.currentSpeedMultiplier === 1) next = 2;
    else if (this.currentSpeedMultiplier === 2) next = 3;
    else next = 1;
    this.setSpeedMultiplier(next, true, true);
  }

  update() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    if (this.clockEl) {
      this.clockEl.innerText = timeStr;
    }
  }
}
