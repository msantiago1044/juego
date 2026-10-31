// GlobalEconomy.js - Bolsa de valores, divisas, commodities, inflación y tipos de interés
export class GlobalEconomy {
  constructor() {
    this.interestRate = 4.75; // Tipo de interés del Banco Central (%)
    this.inflationRate = 3.2; // Inflación anual (%)

    // Acciones de empresas cotizadas
    this.stocks = [
      {
        ticker: 'NVX',
        name: 'NeuroVortex AI',
        sector: 'Inteligencia Artificial & Chips',
        price: 420.50,
        history: [410, 415, 418, 420.50],
        changePercent: 1.2,
        dividendYield: 0.015,
        sharesOwned: 0
      },
      {
        ticker: 'AER',
        name: 'Aegis Defense Corp',
        sector: 'Defensa, Drones & Armamento',
        price: 185.20,
        history: [180, 182, 184, 185.20],
        changePercent: 0.8,
        dividendYield: 0.032,
        sharesOwned: 0
      },
      {
        ticker: 'PET',
        name: 'PetroGlobal Energy',
        sector: 'Petróleo & Gas Natural',
        price: 88.40,
        history: [90, 89, 88.5, 88.40],
        changePercent: -0.4,
        dividendYield: 0.055,
        sharesOwned: 0
      },
      {
        ticker: 'SOL',
        name: 'Helios Clean Power',
        sector: 'Energía Renovable & Fusión',
        price: 64.10,
        history: [62, 63, 63.8, 64.10],
        changePercent: 2.1,
        dividendYield: 0.018,
        sharesOwned: 0
      },
      {
        ticker: 'HLT',
        name: 'BioGenesis Labs',
        sector: 'Biotecnología & Genómica',
        price: 142.00,
        history: [140, 141, 141.5, 142.00],
        changePercent: 0.3,
        dividendYield: 0.024,
        sharesOwned: 0
      },
      {
        ticker: 'BTC',
        name: 'CyberCoin',
        sector: 'Criptomoneda Descentralizada',
        price: 68500.00,
        history: [66200, 67400, 67900, 68500],
        changePercent: 3.4,
        dividendYield: 0.0,
        sharesOwned: 0
      }
    ];

    // Materias primas
    this.commodities = {
      crudeOil: { name: 'Petróleo Crudo (Barril)', price: 78.50, unit: '$ / bbl' },
      gold: { name: 'Oro (Onza Troy)', price: 2450.00, unit: '$ / oz' },
      wheat: { name: 'Trigo (Tonelada)', price: 210.00, unit: '$ / t' },
      lithium: { name: 'Litio Grado Batería', price: 14200.00, unit: '$ / t' }
    };
  }

  update(geopolitics, newsEvent = null) {
    // Ruido browniano del mercado (fluctuación estocástica)
    this.stocks.forEach(stock => {
      let shock = 0;

      // Reacción al estado geopolítico
      if (geopolitics) {
        if (stock.ticker === 'AER' && geopolitics.defcon <= 3) {
          shock += 0.015; // Armas suben con la tensión bélica
        }
        if (stock.ticker === 'PET' && geopolitics.defcon <= 3) {
          shock += 0.012; // Petróleo sube por riesgo de suministro
        }
        if (stock.ticker === 'BTC' && geopolitics.defcon <= 2) {
          shock += 0.025; // Cripto como activo de escape
        }
      }

      // Reacción si hay un evento de noticias específico
      if (newsEvent && newsEvent.impactStock === stock.ticker) {
        shock += newsEvent.impactPercent / 100;
      }

      const randomDrift = (Math.random() - 0.495) * 0.018;
      const totalFactor = 1 + randomDrift + shock;
      const oldPrice = stock.price;
      stock.price = Math.max(1, +(oldPrice * totalFactor).toFixed(2));
      stock.changePercent = +(((stock.price - oldPrice) / oldPrice) * 100).toFixed(2);

      stock.history.push(stock.price);
      if (stock.history.length > 25) {
        stock.history.shift();
      }
    });

    // Actualizar materias primas según el crudo y la economía
    const petStock = this.stocks.find(s => s.ticker === 'PET');
    if (petStock) {
      this.commodities.crudeOil.price = +(petStock.price * 0.9).toFixed(2);
    }
  }

  buyStock(ticker, quantity, playerMoney) {
    const stock = this.stocks.find(s => s.ticker === ticker);
    if (!stock) return { success: false, msg: 'Acción no encontrada' };
    const totalCost = stock.price * quantity;
    if (playerMoney < totalCost) {
      return { success: false, msg: 'Fondos insuficientes' };
    }
    stock.sharesOwned += quantity;
    return { success: true, cost: totalCost, stock };
  }

  sellStock(ticker, quantity) {
    const stock = this.stocks.find(s => s.ticker === ticker);
    if (!stock) return { success: false, msg: 'Acción no encontrada' };
    if (stock.sharesOwned < quantity) {
      return { success: false, msg: 'No posees tantas acciones' };
    }
    const totalRevenue = stock.price * quantity;
    stock.sharesOwned -= quantity;
    return { success: true, revenue: totalRevenue, stock };
  }

  calculateDividends() {
    let totalDividends = 0;
    this.stocks.forEach(stock => {
      if (stock.sharesOwned > 0 && stock.dividendYield > 0) {
        const dividendPerDay = (stock.price * stock.dividendYield) / 30;
        totalDividends += dividendPerDay * stock.sharesOwned;
      }
    });
    return +totalDividends.toFixed(2);
  }
}
