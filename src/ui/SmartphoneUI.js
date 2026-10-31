// SmartphoneUI.js - Interfaz del Smartphone / PDA del jugador con todas las aplicaciones
import { GoogleMapsApp } from './GoogleMapsApp.js';

export class SmartphoneUI {
  constructor(container, gameContext) {
    this.container = container;
    this.game = gameContext;
    this.isOpen = false;
    this.currentApp = 'home'; // home, maps, stocks, news, geopolitics, realestate, jobs, tech, store
    this.googleMapsApp = new GoogleMapsApp(this.game);
    this.mapsApp = this.googleMapsApp;

    this.createDom();
  }

  createDom() {
    this.phoneEl = document.createElement('div');
    this.phoneEl.className = 'smartphone-frame hidden';
    this.phoneEl.innerHTML = `
      <div class="phone-notch">
        <span class="phone-time" id="phone-clock">12:00</span>
        <div class="phone-camera-lens"></div>
        <div class="phone-notch-right">
          <span class="phone-battery">🔋 98%</span>
          <button class="phone-close-btn" id="phone-close-btn" type="button" title="Cerrar Smartphone">✕ Cerrar</button>
        </div>
      </div>
      <div class="phone-content" id="phone-screen">
        <!-- Renderizado dinámico de la app activa -->
      </div>
      <div class="phone-home-bar" id="phone-home-btn" title="Volver al Menú Principal"></div>
    `;

    this.container.appendChild(this.phoneEl);

    this.phoneEl.querySelector('#phone-home-btn').addEventListener('click', () => {
      this.openApp('home');
    });

    this.phoneEl.querySelector('#phone-close-btn').addEventListener('click', () => {
      if (this.isOpen) {
        this.toggle();
      }
    });

    this.renderScreen();
  }

  toggle() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.phoneEl.classList.remove('hidden');
      this.renderScreen();
    } else {
      this.phoneEl.classList.add('hidden');
    }
    if (this.game.audioManager) {
      this.game.audioManager.playUiClick();
    }
  }

  toggleMapApp() {
    if (this.isOpen && this.currentApp === 'maps') {
      this.toggle();
      return;
    }
    this.currentApp = 'maps';
    this.isOpen = true;
    this.phoneEl.classList.remove('hidden');
    if (this.game.audioManager) {
      this.game.audioManager.playUiClick();
    }
    this.renderScreen();
  }

  openApp(appName) {
    this.currentApp = appName;
    if (this.game.audioManager) {
      this.game.audioManager.playUiClick();
    }
    this.renderScreen();
  }

  renderScreen() {
    const screen = this.phoneEl.querySelector('#phone-screen');
    const clock = this.game.clock ? this.game.clock.getFormattedTime() : '12:00';
    const clockEl = this.phoneEl.querySelector('#phone-clock');
    if (clockEl) clockEl.innerText = clock;

    if (this.currentApp === 'home') {
      this.renderHome(screen);
    } else if (this.currentApp === 'maps') {
      this.googleMapsApp.render(screen);
    } else if (this.currentApp === 'stocks') {
      this.renderStocks(screen);
    } else if (this.currentApp === 'news') {
      this.renderNews(screen);
    } else if (this.currentApp === 'geopolitics') {
      this.renderGeopolitics(screen);
    } else if (this.currentApp === 'realestate') {
      this.renderRealEstate(screen);
    } else if (this.currentApp === 'jobs') {
      this.renderJobs(screen);
    } else if (this.currentApp === 'tech') {
      this.renderTech(screen);
    }
  }

  update() {
    if (this.isOpen && this.currentApp === 'maps' && this.googleMapsApp) {
      this.googleMapsApp.update();
    }
  }

  renderHome(screen) {
    screen.innerHTML = `
      <div class="phone-app-header">
        <h2>GlobalOS 2026</h2>
        <p class="phone-subtext">Tu portal de control planetario</p>
      </div>
      <div class="app-grid">
        <div class="app-icon-item" data-app="maps">
          <div class="app-icon" style="background: linear-gradient(135deg, #4285F4, #34A853); box-shadow: 0 4px 15px rgba(66, 133, 244, 0.45);">🗺️</div>
          <span>Google Maps</span>
        </div>
        <div class="app-icon-item" data-app="stocks">
          <div class="app-icon" style="background: linear-gradient(135deg, #10b981, #059669);">📈</div>
          <span>Bolsa</span>
        </div>
        <div class="app-icon-item" data-app="news">
          <div class="app-icon" style="background: linear-gradient(135deg, #ef4444, #dc2626);">📰</div>
          <span>Noticias</span>
        </div>
        <div class="app-icon-item" data-app="geopolitics">
          <div class="app-icon" style="background: linear-gradient(135deg, #8b5cf6, #7c3aed);">🌍</div>
          <span>Geopolítica</span>
        </div>
        <div class="app-icon-item" data-app="realestate">
          <div class="app-icon" style="background: linear-gradient(135deg, #f59e0b, #d97706);">🏠</div>
          <span>Viviendas</span>
        </div>
        <div class="app-icon-item" data-app="jobs">
          <div class="app-icon" style="background: linear-gradient(135deg, #3b82f6, #2563eb);">💼</div>
          <span>Empleos</span>
        </div>
        <div class="app-icon-item" data-app="tech">
          <div class="app-icon" style="background: linear-gradient(135deg, #06b6d4, #0891b2);">🔬</div>
          <span>I+D / Tech</span>
        </div>
      </div>
      <div class="phone-widget">
        <div class="widget-title">Resumen Financiero</div>
        <div class="widget-row">
          <span>Efectivo:</span>
          <strong class="text-green">$${this.game.player.cash.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</strong>
        </div>
        <div class="widget-row">
          <span>Banco:</span>
          <strong class="text-blue">$${this.game.player.bankBalance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</strong>
        </div>
        <div class="widget-row">
          <span>Empleo:</span>
          <span>${this.game.player.job.title}</span>
        </div>
      </div>
    `;

    screen.querySelectorAll('.app-icon-item').forEach(item => {
      item.addEventListener('click', () => {
        this.openApp(item.getAttribute('data-app'));
      });
    });
  }

  renderStocks(screen) {
    const economy = this.game.economy;
    let stocksHtml = economy.stocks.map(stock => {
      const isPos = stock.changePercent >= 0;
      return `
        <div class="stock-item">
          <div class="stock-info">
            <span class="stock-ticker">${stock.ticker}</span>
            <span class="stock-name">${stock.name}</span>
            <span class="stock-sector">${stock.sector}</span>
          </div>
          <div class="stock-price-col">
            <span class="stock-price">$${stock.price.toFixed(2)}</span>
            <span class="stock-change ${isPos ? 'text-green' : 'text-red'}">
              ${isPos ? '+' : ''}${stock.changePercent}%
            </span>
            <span class="stock-owned">Tienes: ${stock.sharesOwned}</span>
          </div>
          <div class="stock-actions">
            <button class="btn-trade buy-btn" data-ticker="${stock.ticker}">Comprar 1</button>
            <button class="btn-trade sell-btn" data-ticker="${stock.ticker}" ${stock.sharesOwned === 0 ? 'disabled' : ''}>Vender 1</button>
          </div>
        </div>
      `;
    }).join('');

    screen.innerHTML = `
      <div class="app-view-header">
        <button class="btn-back" id="btn-back-home">←</button>
        <h3>Wall Street Nexus</h3>
      </div>
      <div class="app-body-scroll">
        <div class="market-summary-badge">
          <span>Tasa Central: ${economy.interestRate}%</span> | <span>Inflación: ${economy.inflationRate}%</span>
        </div>
        ${stocksHtml}
      </div>
    `;

    screen.querySelector('#btn-back-home').addEventListener('click', () => this.openApp('home'));

    screen.querySelectorAll('.buy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const ticker = btn.getAttribute('data-ticker');
        const res = economy.buyStock(ticker, 1, this.game.player.cash);
        if (res.success) {
          this.game.player.cash -= res.cost;
          if (this.game.audioManager) this.game.audioManager.playCash();
          this.renderStocks(screen);
        } else {
          alert(res.msg);
        }
      });
    });

    screen.querySelectorAll('.sell-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const ticker = btn.getAttribute('data-ticker');
        const res = economy.sellStock(ticker, 1);
        if (res.success) {
          this.game.player.cash += res.revenue;
          if (this.game.audioManager) this.game.audioManager.playCash();
          this.renderStocks(screen);
        } else {
          alert(res.msg);
        }
      });
    });
  }

  renderNews(screen) {
    const news = this.game.newsEngine.newsFeed;
    const newsHtml = news.map(item => `
      <div class="news-card">
        <div class="news-meta">
          <span class="news-tag">${item.category}</span>
          <span class="news-timestamp">${item.time}</span>
        </div>
        <h4 class="news-headline">${item.headline}</h4>
      </div>
    `).join('');

    screen.innerHTML = `
      <div class="app-view-header">
        <button class="btn-back" id="btn-back-home">←</button>
        <h3>Reuters / Wire Global</h3>
      </div>
      <div class="app-body-scroll">
        ${newsHtml}
      </div>
    `;

    screen.querySelector('#btn-back-home').addEventListener('click', () => this.openApp('home'));
  }

  renderGeopolitics(screen) {
    const geo = this.game.geopolitics;
    const defconInfo = geo.getDefconStatus();

    const conflictsHtml = geo.activeConflicts.map(c => `
      <div class="conflict-item">
        <div class="conflict-title">⚠️ ${c.title}</div>
        <div class="conflict-sub">Región: ${c.region} | Intensidad: ${c.intensity}</div>
        <div class="conflict-impact">${c.impact}</div>
      </div>
    `).join('') || '<p class="text-muted">No hay guerras mayores activas actualmente.</p>';

    const nationsHtml = geo.nations.map(n => `
      <div class="nation-row">
        <div>
          <strong>${n.name}</strong> <span class="text-muted">(${n.stance})</span>
        </div>
        <div>PIB: $${n.gdp} | Defensa: $${n.budgetDefense}</div>
      </div>
    `).join('');

    screen.innerHTML = `
      <div class="app-view-header">
        <button class="btn-back" id="btn-back-home">←</button>
        <h3>Geopolítica & Guerras</h3>
      </div>
      <div class="app-body-scroll">
        <div class="defcon-banner" style="border-left: 4px solid ${defconInfo.color}">
          <div class="defcon-title" style="color: ${defconInfo.color}">${defconInfo.text}</div>
          <div class="defcon-gauge">Índice de Tensión Mundial: ${geo.tensionIndex.toFixed(0)}/100</div>
        </div>

        <h4 class="section-title">Conflictos Bélicos y Crisis</h4>
        ${conflictsHtml}

        <h4 class="section-title">Potencias Mundiales</h4>
        ${nationsHtml}
      </div>
    `;

    screen.querySelector('#btn-back-home').addEventListener('click', () => this.openApp('home'));
  }

  renderRealEstate(screen) {
    const market = this.game.realEstateMarket;
    const propsHtml = market.properties.map(p => `
      <div class="property-card">
        <div class="prop-icon">${p.icon}</div>
        <div class="prop-details">
          <h4>${p.title}</h4>
          <p class="text-muted">${p.district}</p>
          <div class="prop-price">Precio: $${p.price.toLocaleString('es-ES')}</div>
          <div class="prop-rent text-green">Renta pasiva: +$${p.rentIncomeDaily}/día</div>
        </div>
        <div class="prop-action">
          ${p.owned ?
            '<span class="badge-owned">Propiedad Adquirida</span>' :
            `<button class="btn-buy-prop" data-id="${p.id}">Comprar</button>`
          }
        </div>
      </div>
    `).join('');

    screen.innerHTML = `
      <div class="app-view-header">
        <button class="btn-back" id="btn-back-home">←</button>
        <h3>Mercado Inmobiliario</h3>
      </div>
      <div class="app-body-scroll">
        <p class="text-sub">Adquiere inmuebles para habitar o cobrar alquileres periódicos.</p>
        ${propsHtml}
      </div>
    `;

    screen.querySelector('#btn-back-home').addEventListener('click', () => this.openApp('home'));

    screen.querySelectorAll('.btn-buy-prop').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const res = market.buyProperty(id, this.game.player.cash);
        if (res.success) {
          this.game.player.cash -= res.cost;
          if (this.game.audioManager) this.game.audioManager.playCash();
          this.renderRealEstate(screen);
        } else {
          alert(res.msg);
        }
      });
    });
  }

  renderJobs(screen) {
    const jobsList = [
      { id: 'job_delivery', title: 'Repartidor de Paquetería', salary: 65, reqLevel: 0, company: 'MetroExpress' },
      { id: 'job_dev', title: 'Ingeniero de Software e IA', salary: 280, reqLevel: 1, company: 'NeuroVortex Labs' },
      { id: 'job_trader', title: 'Trader Senior de Inversión', salary: 650, reqLevel: 2, company: 'Wall Street Nexus' },
      { id: 'job_ceo', title: 'CEO Corporativo', salary: 2200, reqLevel: 3, company: 'Titan Global Industries' }
    ];

    const currentJob = this.game.player.job;

    const listHtml = jobsList.map(j => `
      <div class="job-item">
        <div class="job-info">
          <h4>${j.title}</h4>
          <span class="text-muted">${j.company}</span>
          <div class="job-salary text-green">Salario: $${j.salary}/día</div>
        </div>
        <div>
          ${currentJob.title === j.title ?
            '<span class="badge-active-job">Puesto Actual</span>' :
            `<button class="btn-apply-job" data-id="${j.id}" data-title="${j.title}" data-salary="${j.salary}" data-company="${j.company}">Aplicar</button>`
          }
        </div>
      </div>
    `).join('');

    screen.innerHTML = `
      <div class="app-view-header">
        <button class="btn-back" id="btn-back-home">←</button>
        <h3>Bolsa de Empleo y Carrera</h3>
      </div>
      <div class="app-body-scroll">
        <div class="current-job-card">
          <span>Tu Trabajo Actual:</span>
          <h3>${currentJob.title}</h3>
          <p class="text-green">Cobras $${currentJob.salaryDaily} al final de cada jornada laboral.</p>
        </div>
        <h4 class="section-title">Ofertas Disponibles</h4>
        ${listHtml}
      </div>
    `;

    screen.querySelector('#btn-back-home').addEventListener('click', () => this.openApp('home'));

    screen.querySelectorAll('.btn-apply-job').forEach(btn => {
      btn.addEventListener('click', () => {
        this.game.player.job = {
          title: btn.getAttribute('data-title'),
          company: btn.getAttribute('data-company'),
          salaryDaily: +btn.getAttribute('data-salary')
        };
        if (this.game.audioManager) this.game.audioManager.playCash();
        this.renderJobs(screen);
      });
    });
  }

  renderTech(screen) {
    const techTree = this.game.techTree;
    const techsHtml = techTree.technologies.map(t => `
      <div class="tech-card">
        <div class="tech-top">
          <h4>${t.name}</h4>
          <span class="tech-percent">${t.progress.toFixed(0)}%</span>
        </div>
        <div class="tech-bar-bg">
          <div class="tech-bar-fill" style="width: ${t.progress}%"></div>
        </div>
        <p class="tech-desc">${t.desc}</p>
        <div class="tech-actions">
          ${t.completed ?
            '<span class="text-green">✅ Descubrimiento Consolidado</span>' :
            `<button class="btn-invest-tech" data-id="${t.id}">Acelerar I+D ($${t.costToAccelerate})</button>`
          }
        </div>
      </div>
    `).join('');

    screen.innerHTML = `
      <div class="app-view-header">
        <button class="btn-back" id="btn-back-home">←</button>
        <h3>Desarrollo Tecnológico Planetario</h3>
      </div>
      <div class="app-body-scroll">
        <p class="text-sub">Investigaciones globales. Los avances impulsan las acciones de la bolsa.</p>
        ${techsHtml}
      </div>
    `;

    screen.querySelector('#btn-back-home').addEventListener('click', () => this.openApp('home'));

    screen.querySelectorAll('.btn-invest-tech').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const res = techTree.investInTech(id, this.game.player.cash);
        if (res.success) {
          this.game.player.cash -= res.cost;
          if (this.game.audioManager) this.game.audioManager.playCash();
          this.renderTech(screen);
        } else {
          alert(res.msg);
        }
      });
    });
  }
}
