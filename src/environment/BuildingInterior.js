// src/environment/BuildingInterior.js
// Sistema de interiores procedurales interactivos para sitios y edificios reales de OpenStreetMap
export class BuildingInterior {
  constructor(options = {}) {
    this.game = options.game || null;
    this.player = options.player || null;
    this.audioManager = options.audioManager || null;
    this.isOpen = false;
    this.currentPOI = null;

    this.createDom();
  }

  createDom() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'interior-overlay hidden';
    this.overlay.id = 'interior-overlay';
    document.body.appendChild(this.overlay);

    // Eventos de teclado
    window.addEventListener('keydown', (e) => {
      if (this.isOpen && (e.key === 'Escape' || e.key.toLowerCase() === 'e')) {
        this.close();
      }
    });
  }

  getCategoryData(poi) {
    const type = (poi.type || '').toLowerCase();
    const cat = poi.category || 'residential';

    if (type.includes('cafe') || type.includes('restaurant') || type.includes('fast_food') || type.includes('bar')) {
      return {
        id: 'gastronomy',
        icon: '🍽️',
        title: 'Restaurante / Cafetería',
        accentColor: '#f97316',
        desc: 'Ambiente acogedor. Puedes pedir comida y bebidas para recuperar tu hambre y energía.',
        actions: [
          {
            name: '☕ Café Especial Expreso',
            cost: 4,
            hunger: 5,
            energy: 25,
            desc: 'Recupera energía rápidamente (+25⚡) y calma la fatiga.'
          },
          {
            name: '🥪 Menú Ejecutivo del Día',
            cost: 16,
            hunger: 45,
            energy: 20,
            desc: 'Almuerzo completo (+45🍗) que satisface el apetito.'
          },
          {
            name: '🍕 Banquete Familiar',
            cost: 32,
            hunger: 90,
            energy: 35,
            desc: 'Llena completamente tu barra de nutrición (+90🍗).'
          }
        ]
      };
    }

    if (type.includes('shop') || type.includes('supermarket') || type.includes('convenience') || type.includes('bakery')) {
      return {
        id: 'shop',
        icon: '🛒',
        title: 'Tienda / Supermercado',
        accentColor: '#3b82f6',
        desc: 'Estanterías surtidas con provisiones de primera necesidad y artículos útiles.',
        actions: [
          {
            name: '🥤 Bebida Hidratante',
            cost: 5,
            hunger: 10,
            energy: 30,
            desc: 'Restaura estamina y energía (+30⚡).'
          },
          {
            name: '🍎 Pack de Frutas Frescas',
            cost: 8,
            hunger: 25,
            energy: 10,
            desc: 'Snack saludable (+25🍗).'
          },
          {
            name: '🩹 Botiquín de Primeros Auxilios',
            cost: 28,
            hunger: 0,
            energy: 10,
            health: 45,
            desc: 'Cura heridas y restaura tu salud (+45❤️).'
          }
        ]
      };
    }

    if (type.includes('bank') || type.includes('atm')) {
      return {
        id: 'bank',
        icon: '🏦',
        title: 'Sucursal Bancaria / Cajero ATM',
        accentColor: '#10b981',
        desc: 'Terminal financiero para gestionar tus ahorros, depósitos y saldos.',
        isBank: true,
        actions: []
      };
    }

    if (type.includes('pharmacy') || type.includes('hospital') || type.includes('clinic')) {
      return {
        id: 'health',
        icon: '🏥',
        title: 'Centro Médico / Farmacia',
        accentColor: '#ef4444',
        desc: 'Atención sanitaria y medicamentos para tu salud física y vitalidad.',
        actions: [
          {
            name: '💊 Complejo Vitamínico',
            cost: 12,
            hunger: 0,
            energy: 35,
            health: 20,
            desc: 'Aumenta tus defensas y revitaliza tu cuerpo.'
          },
          {
            name: '🩺 Chequeo Médico Completo',
            cost: 50,
            hunger: 0,
            energy: 50,
            health: 100,
            desc: 'Recupera tu salud al 100% y elimina el cansancio.'
          }
        ]
      };
    }

    if (cat === 'office' || type.includes('office') || type.includes('townhall')) {
      return {
        id: 'office',
        icon: '🏢',
        title: 'Edificio de Oficinas / Empresa',
        accentColor: '#64748b',
        desc: 'Sede corporativa y despachos. Puedes buscar vacantes de empleo o tramitar proyectos.',
        isOffice: true,
        actions: []
      };
    }

    // Por defecto: Residencial / Casa / Apartamento
    return {
      id: 'residential',
      icon: '🏡',
      title: 'Vivienda / Residencia',
      accentColor: '#8b5cf6',
      desc: 'Espacio privado para descansar, recuperar energía y guardar tus progresos.',
      actions: [
        {
          name: '🛏️ Descansar en la Cama',
          cost: 0,
          hunger: -10,
          energy: 70,
          desc: 'Duerme plácidamente para recuperar tu energía vital (+70⚡).'
        },
        {
          name: '💧 Vaso de Agua Fresca',
          cost: 0,
          hunger: 5,
          energy: 10,
          desc: 'Refresca tu cuerpo de forma gratuita.'
        }
      ]
    };
  }

  open(poi) {
    if (!poi) return;
    this.currentPOI = poi;
    this.isOpen = true;

    const catData = this.getCategoryData(poi);
    const player = this.player || (this.game ? this.game.player : null);

    const cash = player ? Math.floor(player.cash) : 0;
    const bank = player ? Math.floor(player.bankBalance) : 0;
    const hunger = player ? Math.round(player.hunger || 85) : 85;
    const energy = player ? Math.round(player.energy || 90) : 90;
    const health = player ? Math.round(player.health || 100) : 100;

    let actionsHtml = '';

    if (catData.isBank) {
      actionsHtml = `
        <div class="interior-bank-panel">
          <div class="interior-stat-grid">
            <div class="interior-stat-box">
              <span class="stat-label">💵 Dinero en Mano</span>
              <span class="stat-val">$${cash}</span>
            </div>
            <div class="interior-stat-box">
              <span class="stat-label">🏛️ Saldo en Cuenta</span>
              <span class="stat-val">$${bank}</span>
            </div>
          </div>
          <div class="interior-bank-controls">
            <button class="btn-interior-action" data-action="deposit_100" type="button">
              📥 Depositar $100
            </button>
            <button class="btn-interior-action" data-action="withdraw_100" type="button">
              📤 Retirar $100
            </button>
            <button class="btn-interior-action" data-action="deposit_all" type="button">
              💰 Depositar Todo
            </button>
          </div>
        </div>
      `;
    } else if (catData.isOffice) {
      const jobTitle = player && player.job ? player.job.title : 'Ciudadano Autónomo';
      const salary = player && player.job ? player.job.salaryDaily : 120;
      actionsHtml = `
        <div class="interior-office-panel">
          <p>💼 <strong>Puesto actual:</strong> ${jobTitle}</p>
          <p>📈 <strong>Salario diario estimado:</strong> $${salary} / jornada</p>
          <button class="btn-interior-action btn-interior-primary" data-action="work_shift" type="button">
            ⚡ Realizar Turno de Trabajo (+Salario, -Energía)
          </button>
        </div>
      `;
    } else {
      actionsHtml = catData.actions.map((act, idx) => `
        <div class="interior-item-card">
          <div class="interior-item-header">
            <span class="item-name">${act.name}</span>
            <span class="item-cost">${act.cost > 0 ? `$${act.cost}` : 'GRATIS'}</span>
          </div>
          <p class="item-desc">${act.desc}</p>
          <button class="btn-interior-buy" data-index="${idx}" type="button">
            ${act.cost > 0 ? `Comprar por $${act.cost}` : 'Usar'}
          </button>
        </div>
      `).join('');
    }

    this.overlay.innerHTML = `
      <div class="interior-modal-box">
        <!-- Encabezado del Interior -->
        <div class="interior-header" style="border-bottom: 3px solid ${catData.accentColor}">
          <div class="interior-title-group">
            <span class="interior-icon">${catData.icon}</span>
            <div>
              <h2 class="interior-name">${poi.name || 'Lugar Público'}</h2>
              <span class="interior-category" style="color: ${catData.accentColor}">
                ${catData.title} &bull; OpenStreetMap Real
              </span>
            </div>
          </div>
          <button class="btn-interior-close" id="btn-interior-close" type="button" title="Salir a la calle (ESC)">
            ✕ Salir
          </button>
        </div>

        <!-- Barras de Estado Vital (Sims) -->
        <div class="interior-player-status">
          <div class="status-meter" title="Nutrición / Hambre">
            <span class="meter-icon">🍗</span>
            <div class="meter-bar"><div class="meter-fill fill-hunger" style="width: ${hunger}%"></div></div>
            <span class="meter-num">${hunger}%</span>
          </div>
          <div class="status-meter" title="Energía">
            <span class="meter-icon">⚡</span>
            <div class="meter-bar"><div class="meter-fill fill-energy" style="width: ${energy}%"></div></div>
            <span class="meter-num">${energy}%</span>
          </div>
          <div class="status-meter" title="Salud">
            <span class="meter-icon">❤️</span>
            <div class="meter-bar"><div class="meter-fill fill-health" style="width: ${health}%"></div></div>
            <span class="meter-num">${health}%</span>
          </div>
          <div class="status-cash" title="Billetera">
            💵 <strong>$${cash}</strong>
          </div>
        </div>

        <p class="interior-description">${catData.desc}</p>

        <!-- Contenedor de Acciones / Tienda / Menús -->
        <div class="interior-content-scroll">
          ${actionsHtml}
        </div>

        <!-- Pie de diálogo -->
        <div class="interior-footer">
          <span class="interior-tip">💡 Presiona [E] o [ESC] para regresar a la vía pública</span>
          <button class="btn-hud-action btn-interior-exit" id="btn-interior-exit" type="button">
            🚪 Volver a la Calle
          </button>
        </div>
      </div>
    `;

    this.overlay.classList.remove('hidden');

    // Asociar eventos
    const closeBtn = this.overlay.querySelector('#btn-interior-close');
    const exitBtn = this.overlay.querySelector('#btn-interior-exit');
    if (closeBtn) closeBtn.onclick = () => this.close();
    if (exitBtn) exitBtn.onclick = () => this.close();

    // Eventos de botones de compra / acción
    const buyBtns = this.overlay.querySelectorAll('.btn-interior-buy');
    buyBtns.forEach(btn => {
      btn.onclick = () => {
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        const action = catData.actions[idx];
        if (action) this.executeAction(action);
      };
    });

    // Eventos bancarios
    const actionBtns = this.overlay.querySelectorAll('.btn-interior-action');
    actionBtns.forEach(btn => {
      btn.onclick = () => {
        const act = btn.getAttribute('data-action');
        this.executeSpecialAction(act);
      };
    });
  }

  executeAction(action) {
    const player = this.player || (this.game ? this.game.player : null);
    if (!player) return;

    if (action.cost > 0 && player.cash < action.cost) {
      alert('⚠️ No tienes suficiente dinero en mano para esta compra.');
      return;
    }

    if (action.cost > 0) {
      player.cash -= action.cost;
    }

    if (action.hunger && typeof player.eat === 'function') {
      player.eat(action.hunger);
    } else if (action.hunger) {
      player.hunger = Math.min(100, Math.max(0, (player.hunger || 85) + action.hunger));
    }

    if (action.energy && typeof player.rest === 'function') {
      player.rest(action.energy);
    } else if (action.energy) {
      player.energy = Math.min(100, Math.max(0, (player.energy || 90) + action.energy));
    }

    if (action.health && typeof player.heal === 'function') {
      player.heal(action.health);
    } else if (action.health) {
      player.health = Math.min(100, Math.max(0, (player.health || 100) + action.health));
    }

    // Refrescar modal con nuevos datos
    this.open(this.currentPOI);
  }

  executeSpecialAction(actionName) {
    const player = this.player || (this.game ? this.game.player : null);
    if (!player) return;

    if (actionName === 'deposit_100') {
      if (player.cash >= 100) {
        player.cash -= 100;
        player.bankBalance += 100;
      }
    } else if (actionName === 'withdraw_100') {
      if (player.bankBalance >= 100) {
        player.bankBalance -= 100;
        player.cash += 100;
      }
    } else if (actionName === 'deposit_all') {
      if (player.cash > 0) {
        player.bankBalance += player.cash;
        player.cash = 0;
      }
    } else if (actionName === 'work_shift') {
      if ((player.energy || 90) < 25) {
        alert('⚠️ Estás demasiado exhausto para trabajar. Descansa o come primero.');
        return;
      }
      player.energy = Math.max(0, (player.energy || 90) - 25);
      const earned = (player.job && player.job.salaryDaily) || 120;
      player.cash += earned;
      alert(`💼 Turno completado con éxito. Has ganado $${earned}!`);
    }

    this.open(this.currentPOI);
  }

  close() {
    this.isOpen = false;
    this.currentPOI = null;
    this.overlay.classList.add('hidden');
  }
}

