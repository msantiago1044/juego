// HUD.js - Interfaz de visualización de información del jugador en pantalla
export class HUD {
  constructor(container, gameContext) {
    this.container = container;
    this.game = gameContext;
    this.bannerTimeout = null;

    // Callbacks para controles táctiles y botones de acción rápida
    this.onJoystickMove = null;
    this.onInteractTap = null;
    this.onJumpTap = null;
    this.onMapButtonTap = null;
    this.onGpsConfirmTap = null;

    this.joystickTouchId = null;

    this.createDom();
    this.initTouchControls();
  }

  createDom() {
    this.hudEl = document.createElement('div');
    this.hudEl.className = 'hud-container';
    this.hudEl.innerHTML = `
      <!-- Barra Superior -->
      <div class="hud-top-bar">
        <div class="hud-panel hud-time-panel">
          <div class="hud-clock" id="hud-clock">08:30</div>
          <div class="hud-date" id="hud-date">Lun, 12 Oct 2026</div>
          <div class="time-controls">
            <button class="btn-time active" data-scale="15">1x</button>
            <button class="btn-time" data-scale="60">5x</button>
            <button class="btn-time" data-scale="300">20x</button>
            <button class="btn-time" id="btn-pause">⏸</button>
          </div>
        </div>

        <div class="hud-news-ticker">
          <div class="ticker-label">🔴 EN VIVO</div>
          <div class="ticker-content" id="hud-ticker-text">
            Bienvenido a TerraSim 3D — Simulación planetaria en tiempo real activa.
          </div>
        </div>

        <div class="hud-panel hud-status-panel">
          <div class="hud-zone-pill" id="hud-zone-pill">🏡 Pueblo Origen</div>
          <div class="hud-weather" id="hud-weather">☀️ 22.0°C | Tracción Seca</div>
          <div class="hud-money" id="hud-money">💵 $2,500.00</div>
          <div class="hud-defcon" id="hud-defcon">DEFCON 4</div>
        </div>
      </div>

      <!-- Cartel de Zona Estilo Pokémon (Esquina Superior Izquierda) -->
      <div class="pokemon-location-banner" id="pokemon-location-banner">
        <div class="pokemon-banner-accent" id="pokemon-banner-accent"></div>
        <div class="pokemon-banner-body">
          <div class="pokemon-banner-top">
            <span class="pokemon-banner-badge" id="pokemon-banner-badge">🏡 PUEBLO</span>
            <span class="pokemon-banner-pokeball">◓ REGIÓN TERRASIM</span>
          </div>
          <div class="pokemon-banner-title" id="pokemon-banner-title">Pueblo Origen • Barranquilla</div>
          <div class="pokemon-banner-subtitle" id="pokemon-banner-subtitle">Zona Residencial Tranquila</div>
        </div>
      </div>

      <!-- Prompt flotante central para interacciones -->
      <div class="interaction-prompt hidden" id="hud-prompt">
        <span class="prompt-key">E</span>
        <span class="prompt-text" id="hud-prompt-text">Interactuar</span>
      </div>

      <!-- Panel Inferior Izquierdo: Tablero del Vehículo -->
      <div class="vehicle-dashboard hidden" id="hud-vehicle-dash">
        <div class="dash-speedometer">
          <span class="speed-number" id="dash-speed">0</span>
          <span class="speed-unit">KM/H</span>
        </div>
        <div class="dash-bars">
          <div class="dash-fuel-label">COMBUSTIBLE: <span id="dash-fuel-val">85%</span></div>
          <div class="dash-bar-bg">
            <div class="dash-bar-fill" id="dash-fuel-bar" style="width: 85%;"></div>
          </div>
          <div class="dash-traction-note" id="dash-traction-note">Tracción: Normal</div>
        </div>
      </div>

      <!-- Panel Inferior Derecho: Estamina, Acciones Rápidas (Mapa, GPS, Interactuar, Saltar) y Teléfono -->
      <div class="hud-bottom-right">
        <div class="player-stamina-card">
          <div class="stamina-label">Estamina Biológica</div>
          <div class="stamina-bar-bg">
            <div class="stamina-bar-fill" id="hud-stamina-bar" style="width: 100%;"></div>
          </div>
        </div>

        <div class="hud-mobile-actions" id="hud-mobile-actions">
          <button class="btn-hud-action btn-hud-interact hidden" id="btn-hud-interact" type="button">
            ✋ <span id="btn-hud-interact-label">Interactuar</span>
          </button>
          <button class="btn-hud-action btn-hud-jump" id="btn-hud-jump" type="button">
            ⬆️ <span>Saltar</span>
          </button>
          <button class="btn-hud-action btn-hud-map" id="btn-hud-map" type="button">
            🗺️ <span>Mapa</span>
          </button>
          <button class="btn-hud-action btn-hud-gps" id="btn-hud-gps" type="button">
            📍 <span>Mi GPS</span>
          </button>
        </div>

        <button class="btn-phone-launcher" id="hud-btn-phone" type="button">
          📱 <span>Smartphone</span> <small>[TAB]</small>
        </button>
      </div>

      <!-- Joystick Táctil Virtual (Esquina Inferior Izquierda) -->
      <div class="mobile-joystick-zone" id="mobile-joystick-zone">
        <div class="mobile-joystick-base" id="mobile-joystick-base">
          <div class="mobile-joystick-stick" id="mobile-joystick-stick"></div>
        </div>
        <div class="mobile-joystick-hint">Arrastra para moverte</div>
      </div>

      <!-- Aviso flotante de Restricción de Vía Pública / Espacio Público -->
      <div class="hud-walkability-toast hidden" id="hud-walkability-toast">
        🚧 <span>Propiedad privada: Solo puedes transitar por vías públicas y espacios públicos</span>
      </div>

      <!-- Modal de Confirmación para Regresar a Ubicación GPS -->
      <div class="gps-confirm-modal hidden" id="gps-confirm-modal">
        <div class="gps-confirm-card">
          <div class="gps-confirm-header">
            <span class="gps-confirm-icon">📍</span>
            <h3>Regresar a tu Ubicación GPS Real</h3>
          </div>
          <p class="gps-confirm-message" id="gps-confirm-message">
            ¿Deseas regresar a tu personaje a tu ubicación GPS actual?
          </p>
          <button class="btn-gps-open-setup" id="btn-gps-open-setup" type="button">
            🔍 Cambiar / Buscar Mi Calle Exacta
          </button>
          <button class="btn-gps-calibrate-map" id="btn-gps-calibrate-map" type="button">
            📌 Calibrar mi calle o punto exacto en el Mapa
          </button>
          <div class="gps-confirm-actions">
            <button class="btn-gps-confirm-no" id="btn-gps-confirm-no" type="button">Cancelar</button>
            <button class="btn-gps-confirm-yes" id="btn-gps-confirm-yes" type="button">✅ Confirmar y Ir a Mi Ubicación</button>
          </div>
        </div>
      </div>

      <!-- Modal Instantáneo para Configurar Tu Ubicación Exacta cuando HTTP móvil bloquea el chip GPS -->
      <div class="gps-setup-modal hidden" id="gps-setup-modal">
        <div class="gps-setup-card">
          <div class="gps-setup-header">
            <div class="gps-setup-title-group">
              <span class="gps-setup-icon">📍</span>
              <h3>Configurar Tu Ubicación Exacta</h3>
            </div>
            <button class="gps-setup-close-btn" id="btn-gps-setup-close" type="button" title="Cerrar">✕</button>
          </div>

          <p class="gps-setup-reason" id="gps-setup-reason">
            📍 Selecciona o busca tu ubicación exacta para generar las calles reales de tu cuadra:
          </p>

          <!-- Opción A: Buscador Directo de Calle / Barrio / Ciudad -->
          <div class="gps-setup-section">
            <label class="gps-setup-label" for="gps-setup-search-input">
              1️⃣ Busca tu calle, barrio, conjunto o ciudad exacta:
            </label>
            <div class="gps-setup-search-row">
              <input
                type="text"
                id="gps-setup-search-input"
                placeholder="Escribe tu calle, barrio y ciudad... (ej. Calle 84 Barranquilla)"
                autocomplete="off"
              />
              <button class="btn-gps-setup-search" id="btn-gps-setup-search" type="button">
                🔍 Buscar
              </button>
            </div>
            <div class="gps-setup-results" id="gps-setup-results"></div>
          </div>

          <!-- Opción B: Elegir punto tocando el Mapa -->
          <div class="gps-setup-section">
            <button class="btn-gps-setup-map" id="btn-gps-setup-open-map" type="button">
              🗺️ Abrir Mapa y Tocar mi Cuadra Exacta
            </button>
          </div>

          <!-- Opción C: Activar HTTPS / Reintentar Chip GPS del Dispositivo -->
          <div class="gps-setup-footer-actions">
            <button class="btn-gps-setup-https" id="btn-gps-setup-https" type="button">
              🔒 Abrir versión HTTPS para usar Chip GPS del Celular
            </button>
            <button class="btn-gps-setup-retry" id="btn-gps-setup-retry-gps" type="button">
              🔄 Reintentar GPS
            </button>
          </div>
          <div class="gps-setup-status hidden" id="gps-setup-status"></div>
        </div>
      </div>

      <!-- Ayuda de Controles / Tutorial Rápido en esquina -->
      <div class="hud-controls-help">
        <div><strong>[WASD]</strong> Moverse / Conducir</div>
        <div><strong>[Mouse]</strong> Mirar en 3ra persona</div>
        <div><strong>[Shift]</strong> Correr a pie</div>
        <div><strong>[Espacio]</strong> Saltar / Freno de mano</div>
        <div><strong>[E]</strong> Subir/Bajar de coche o interactuar</div>
        <div><strong>[TAB]</strong> Abrir Smartphone (Bolsa, Noticias, etc.)</div>
      </div>
    `;

    this.container.appendChild(this.hudEl);

    // Conectar eventos de botones de tiempo
    this.hudEl.querySelectorAll('.btn-time').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.id === 'btn-pause') {
          const isPaused = this.game.clock.togglePause();
          btn.innerText = isPaused ? '▶' : '⏸';
          btn.classList.toggle('active', isPaused);
        } else {
          const scale = +btn.getAttribute('data-scale');
          this.game.clock.setTimeScale(scale);
          this.hudEl.querySelectorAll('.btn-time').forEach(b => {
            if (b.id !== 'btn-pause') b.classList.remove('active');
          });
          btn.classList.add('active');
        }
      });
    });

    // Abrir Smartphone con el botón
    this.hudEl.querySelector('#hud-btn-phone').addEventListener('click', () => {
      if (this.game.smartphoneUI) {
        this.game.smartphoneUI.toggle();
      }
    });

    // También permitir tocar el prompt central para interactuar en pantallas táctiles
    const promptEl = this.hudEl.querySelector('#hud-prompt');
    if (promptEl) {
      promptEl.addEventListener('click', () => {
        if (typeof this.onInteractTap === 'function') {
          this.onInteractTap();
        }
      });
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

      // Soporte de ratón en el joystick para pruebas o uso híbrido
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

    // Botón de Mapa Rápido
    const btnMap = this.hudEl.querySelector('#btn-hud-map');
    if (btnMap) {
      btnMap.addEventListener('click', () => {
        if (typeof this.onMapButtonTap === 'function') {
          this.onMapButtonTap();
        } else if (this.game.smartphoneUI) {
          this.game.smartphoneUI.toggleMapApp();
        }
      });
    }

    // Botón de GPS con Modal de Confirmación
    const btnGps = this.hudEl.querySelector('#btn-hud-gps');
    if (btnGps) {
      btnGps.addEventListener('click', () => {
        this.openGpsConfirmModal();
      });
    }

    const btnGpsYes = this.hudEl.querySelector('#btn-gps-confirm-yes');
    const btnGpsNo = this.hudEl.querySelector('#btn-gps-confirm-no');
    const btnGpsCalibrate = this.hudEl.querySelector('#btn-gps-calibrate-map');
    const btnGpsOpenSetup = this.hudEl.querySelector('#btn-gps-open-setup');
    const gpsModal = this.hudEl.querySelector('#gps-confirm-modal');

    if (btnGpsNo && gpsModal) {
      btnGpsNo.addEventListener('click', () => {
        gpsModal.classList.add('hidden');
      });
    }

    if (btnGpsOpenSetup && gpsModal) {
      btnGpsOpenSetup.addEventListener('click', () => {
        gpsModal.classList.add('hidden');
        this.openGpsSetupModal();
      });
    }

    if (btnGpsCalibrate && gpsModal) {
      btnGpsCalibrate.addEventListener('click', () => {
        gpsModal.classList.add('hidden');
        this.openMapAndActivateCalibration();
      });
    }

    if (btnGpsYes && gpsModal) {
      btnGpsYes.addEventListener('click', () => {
        gpsModal.classList.add('hidden');
        if (typeof this.onGpsConfirmTap === 'function') {
          this.onGpsConfirmTap();
        } else if (this.game.mapsApp) {
          this.game.mapsApp.returnPlayerToCurrentGPS();
        }
      });
    }

    // Configurar eventos del Modal de Ubicación Exacta (#gps-setup-modal)
    const setupModal = this.hudEl.querySelector('#gps-setup-modal');
    const btnSetupClose = this.hudEl.querySelector('#btn-gps-setup-close');
    const setupSearchInput = this.hudEl.querySelector('#gps-setup-search-input');
    const btnSetupSearch = this.hudEl.querySelector('#btn-gps-setup-search');
    const btnSetupOpenMap = this.hudEl.querySelector('#btn-gps-setup-open-map');
    const btnSetupHttps = this.hudEl.querySelector('#btn-gps-setup-https');
    const btnSetupRetryGps = this.hudEl.querySelector('#btn-gps-setup-retry-gps');

    if (btnSetupClose && setupModal) {
      btnSetupClose.addEventListener('click', () => {
        this.closeGpsSetupModal();
      });
    }

    const executeSetupSearch = async () => {
      if (!setupSearchInput) return;
      const query = setupSearchInput.value.trim();
      if (!query) return;
      await this.runGpsSetupSearch(query);
    };

    if (btnSetupSearch) {
      btnSetupSearch.addEventListener('click', executeSetupSearch);
    }

    if (setupSearchInput) {
      setupSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          executeSetupSearch();
        }
      });
    }

    if (btnSetupOpenMap) {
      btnSetupOpenMap.addEventListener('click', () => {
        this.closeGpsSetupModal();
        this.openMapAndActivateCalibration();
      });
    }

    if (btnSetupHttps) {
      btnSetupHttps.addEventListener('click', () => {
        const host = window.location.hostname || 'localhost';
        const targetUrl = `https://${host}:5174/`;
        window.location.href = targetUrl;
      });
    }

    if (btnSetupRetryGps) {
      btnSetupRetryGps.addEventListener('click', () => {
        const statusEl = this.hudEl.querySelector('#gps-setup-status');
        if (!navigator.geolocation) {
          if (statusEl) {
            statusEl.classList.remove('hidden');
            statusEl.innerText = '⚠️ Este navegador no expone API de geolocalización aquí. Usa el buscador de calle arriba o abre la versión HTTPS.';
          }
          return;
        }
        if (statusEl) {
          statusEl.classList.remove('hidden');
          statusEl.innerText = '📡 Solicitando coordenadas al chip GPS del dispositivo...';
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            if (this.game?.mapsApp) {
              this.game.mapsApp.calibrateExactGpsPoint(lat, lng, null, null, 'hardware_gps');
            }
            this.closeGpsSetupModal();
          },
          () => {
            if (statusEl) {
              statusEl.classList.remove('hidden');
              statusEl.innerText = !window.isSecureContext
                ? '🔒 El navegador móvil bloquea el chip GPS en HTTP (http://). Escribe tu calle o barrio arriba, toca el mapa, o abre la versión HTTPS.'
                : '⚠️ Permiso de GPS denegado o sin señal. Escribe tu calle o barrio arriba para ubicarte al instante.';
            }
          },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
      });
    }

    // Botón Interactuar
    const btnInteract = this.hudEl.querySelector('#btn-hud-interact');
    if (btnInteract) {
      btnInteract.addEventListener('click', () => {
        if (typeof this.onInteractTap === 'function') {
          this.onInteractTap();
        }
      });
    }

    // Botón Saltar / Freno de mano
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

  openMapAndActivateCalibration() {
    if (this.game?.smartphoneUI) {
      this.game.smartphoneUI.openApp('maps');
      if (!this.game.smartphoneUI.isOpen) {
        this.game.smartphoneUI.toggle();
      }
      setTimeout(() => {
        if (this.game?.mapsApp) {
          this.game.mapsApp.enableGpsCalibrationMode();
        }
      }, 120);
    }
  }

  openGpsSetupModal() {
    const setupModal = this.hudEl.querySelector('#gps-setup-modal');
    const reasonEl = this.hudEl.querySelector('#gps-setup-reason');
    const httpsBtn = this.hudEl.querySelector('#btn-gps-setup-https');
    const statusEl = this.hudEl.querySelector('#gps-setup-status');
    const inputEl = this.hudEl.querySelector('#gps-setup-search-input');

    if (!setupModal) return;

    if (reasonEl) {
      reasonEl.innerText = !window.isSecureContext
        ? '📱 Tu navegador móvil bloquea el chip GPS en conexiones HTTP (http://). Elige cómo ubicar tu posición exacta:'
        : '📍 Selecciona o busca tu ubicación exacta para generar las calles reales de tu cuadra:';
    }

    if (httpsBtn) {
      httpsBtn.classList.toggle('hidden', Boolean(window.isSecureContext));
    }

    if (statusEl) {
      statusEl.classList.add('hidden');
      statusEl.innerText = '';
    }

    setupModal.classList.remove('hidden');

    if (inputEl) {
      setTimeout(() => {
        inputEl.focus();
      }, 80);
    }
  }

  closeGpsSetupModal() {
    const setupModal = this.hudEl.querySelector('#gps-setup-modal');
    if (setupModal) {
      setupModal.classList.add('hidden');
    }
  }

  async runGpsSetupSearch(query) {
    const resultsContainer = this.hudEl.querySelector('#gps-setup-results');
    const statusEl = this.hudEl.querySelector('#gps-setup-status');
    if (!resultsContainer) return;

    resultsContainer.innerHTML = '<div class="gps-setup-loading">🔍 Buscando calles y barrios reales en OpenStreetMap...</div>';
    if (statusEl) statusEl.classList.add('hidden');

    let candidates = [];
    if (this.game?.mapsApp && typeof this.game.mapsApp.searchNominatimCandidates === 'function') {
      candidates = await this.game.mapsApp.searchNominatimCandidates(query);
    } else {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(query)}`
        );
        if (res.ok) {
          const data = await res.json();
          candidates = (data || []).map((item) => {
            const addr = item.address || {};
            const city = addr.city || addr.town || addr.municipality || addr.village || addr.county || 'Ubicación';
            const road = addr.road || addr.pedestrian || item.name || query;
            const suburb = addr.suburb || addr.neighbourhood || '';
            const streetLabel = [road, suburb].filter(Boolean).join(', ');
            return {
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon),
              city,
              streetLabel,
              title: `${streetLabel} — ${city}`,
              subtitle: item.display_name || ''
            };
          });
        }
      } catch (e) {
        candidates = [];
      }
    }

    resultsContainer.innerHTML = '';

    if (!candidates || candidates.length === 0) {
      resultsContainer.innerHTML = `
        <div class="gps-setup-empty">
          No se encontraron coincidencias para "${query}". Intenta agregar el nombre de tu ciudad (ej. "Calle 84 Barranquilla") o toca el botón del Mapa abajo.
        </div>
      `;
      return;
    }

    candidates.forEach((cand) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'gps-setup-result-card';
      card.innerHTML = `
        <div class="gps-result-main">📍 <strong>${cand.title}</strong></div>
        <div class="gps-result-sub">${cand.subtitle}</div>
      `;
      card.addEventListener('click', () => {
        if (this.game?.mapsApp) {
          this.game.mapsApp.calibrateExactGpsPoint(
            cand.lat,
            cand.lng,
            cand.city,
            cand.streetLabel,
            'user_pin'
          );
        }
        this.closeGpsSetupModal();
        if (this.game?.audioManager) {
          this.game.audioManager.playUiClick();
        }
      });
      resultsContainer.appendChild(card);
    });
  }

  openGpsConfirmModal() {
    const gpsModal = this.hudEl.querySelector('#gps-confirm-modal');
    const msgEl = this.hudEl.querySelector('#gps-confirm-message');
    if (!gpsModal) return;

    const mapsApp = this.game?.mapsApp;
    const city = mapsApp?.cityName || 'Tu Ubicación';
    const street = mapsApp?.streetLabel ? `${mapsApp.streetLabel}, ` : '';
    const coords = mapsApp?.realGpsCoords || mapsApp?.baseCoords || { lat: 10.9685, lng: -74.7813 };
    const latStr = coords.lat.toFixed(5);
    const lngStr = coords.lng.toFixed(5);

    if (msgEl) {
      msgEl.innerText = `¿Deseas regresar a tu personaje a tu ubicación GPS actual (${street}${city} — ${latStr}°, ${lngStr}°)?`;
    }

    gpsModal.classList.remove('hidden');
    if (this.game?.audioManager) {
      this.game.audioManager.playUiClick();
    }
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

  showPrompt(text) {
    const prompt = this.hudEl.querySelector('#hud-prompt');
    const label = this.hudEl.querySelector('#hud-prompt-text');
    if (prompt && label) {
      label.innerText = text;
      prompt.classList.remove('hidden');
    }
    const btnInteract = this.hudEl.querySelector('#btn-hud-interact');
    const btnInteractLabel = this.hudEl.querySelector('#btn-hud-interact-label');
    if (btnInteract) {
      btnInteract.classList.remove('hidden');
      if (btnInteractLabel) {
        btnInteractLabel.innerText = text;
      }
    }
  }

  hidePrompt() {
    const prompt = this.hudEl.querySelector('#hud-prompt');
    if (prompt) prompt.classList.add('hidden');
    const btnInteract = this.hudEl.querySelector('#btn-hud-interact');
    if (btnInteract) btnInteract.classList.add('hidden');
  }

  showInteractionPrompt(text) {
    this.showPrompt(text);
  }

  hideInteractionPrompt() {
    this.hidePrompt();
  }

  updateTicker(headline) {
    const ticker = this.hudEl.querySelector('#hud-ticker-text');
    if (ticker) {
      ticker.innerText = headline;
    }
  }

  showLocationBanner(zoneOrOptions, subTitle = '', accentColor = '#4ade80') {
    let badge = '📍 ZONA';
    let title = '';
    let subtitle = subTitle;
    let color = accentColor;

    if (typeof zoneOrOptions === 'object' && zoneOrOptions !== null) {
      badge = zoneOrOptions.badge || '📍 ZONA';
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
    const pillEl = this.hudEl.querySelector('#hud-zone-pill');

    if (pillEl) {
      pillEl.innerText = `${badge.split(' ')[0]} ${title.split('•')[0].trim()}`;
      pillEl.style.borderColor = color;
      pillEl.style.color = color;
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

  update() {
    const clock = this.game.clock;
    const player = this.game.player;
    const weather = this.game.weather;
    const geopolitics = this.game.geopolitics;

    // Reloj y fecha
    if (clock) {
      this.hudEl.querySelector('#hud-clock').innerText = clock.getFormattedTime();
      this.hudEl.querySelector('#hud-date').innerText = clock.getFormattedDate();
    }

    // Dinero
    if (player) {
      this.hudEl.querySelector('#hud-money').innerText = `💵 $${player.cash.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
      const staminaBar = this.hudEl.querySelector('#hud-stamina-bar');
      if (staminaBar) {
        staminaBar.style.width = `${player.stamina}%`;
        staminaBar.style.backgroundColor = player.stamina < 25 ? '#ef4444' : (player.stamina < 55 ? '#f59e0b' : '#10b981');
      }
    }

    // Clima
    if (weather) {
      const wInfo = weather.getWeatherInfo();
      this.hudEl.querySelector('#hud-weather').innerText = `${wInfo.name} | ${wInfo.temp} | ${wInfo.frictionNotice}`;
    }

    // DEFCON
    if (geopolitics) {
      const def = geopolitics.getDefconStatus();
      const defEl = this.hudEl.querySelector('#hud-defcon');
      defEl.innerText = def.text.split('—')[0].trim();
      defEl.style.color = def.color;
    }

    // Panel del coche
    const dash = this.hudEl.querySelector('#hud-vehicle-dash');
    if (player && player.isInVehicle && player.currentVehicle) {
      dash.classList.remove('hidden');
      const v = player.currentVehicle;
      this.hudEl.querySelector('#dash-speed').innerText = v.getSpeedKmH();
      const fuelPct = v.getFuelPercentage();
      this.hudEl.querySelector('#dash-fuel-val').innerText = `${fuelPct}%`;
      const fuelBar = this.hudEl.querySelector('#dash-fuel-bar');
      fuelBar.style.width = `${fuelPct}%`;
      fuelBar.style.backgroundColor = fuelPct < 20 ? '#ef4444' : '#00d4ff';

      const surfaceFriction = this.game.physicsWorld ? this.game.physicsWorld.surfaceFriction : 0.85;
      const isWet = surfaceFriction < 0.6;
      this.hudEl.querySelector('#dash-traction-note').innerText = isWet ? '⚠️ Asfalto Resbaladizo' : '✅ Tracción Firme';
    } else {
      dash.classList.add('hidden');
    }
  }
}
