// RealEstateMarket.js - Mercado inmobiliario, distritos, precios de viviendas y rentas
export class RealEstateMarket {
  constructor() {
    this.properties = [
      {
        id: 'prop_suburb',
        title: 'Estudio Urbano Básico',
        district: 'Distrito Residencial Oeste',
        price: 95000,
        rentIncomeDaily: 45,
        owned: false,
        isRentedOut: false,
        icon: '🏠'
      },
      {
        id: 'prop_loft',
        title: 'Loft Tecnológico Minimalista',
        district: 'Silicon Valley Central',
        price: 240000,
        rentIncomeDaily: 120,
        owned: false,
        isRentedOut: false,
        icon: '🏢'
      },
      {
        id: 'prop_penthouse',
        title: 'Ático Skyline con Vistas al Mar',
        district: 'Financial Core / Skyline',
        price: 780000,
        rentIncomeDaily: 420,
        owned: false,
        isRentedOut: false,
        icon: '🌆'
      },
      {
        id: 'prop_mansion',
        title: 'Mansión Inteligente con Helipuerto',
        district: 'Colinas de Lujo',
        price: 2600000,
        rentIncomeDaily: 1550,
        owned: false,
        isRentedOut: false,
        icon: '🏰'
      }
    ];
  }

  update(inflationRate = 3.0, interestRate = 4.5) {
    // La inflación aumenta el precio del activo inmobiliario; las tasas altas lo enfrían ligeramente
    const netGrowth = ((inflationRate * 0.8) - (interestRate * 0.3) + (Math.random() - 0.48)) * 0.005;
    this.properties.forEach(prop => {
      prop.price = Math.round(prop.price * (1 + netGrowth));
      prop.rentIncomeDaily = Math.round(prop.price * 0.0005);
    });
  }

  buyProperty(propId, playerMoney) {
    const prop = this.properties.find(p => p.id === propId);
    if (!prop) return { success: false, msg: 'Propiedad no encontrada' };
    if (prop.owned) return { success: false, msg: 'Ya eres dueño de esta propiedad' };
    if (playerMoney < prop.price) {
      return { success: false, msg: 'Fondos insuficientes para comprar este inmueble' };
    }
    prop.owned = true;
    prop.isRentedOut = true; // Empieza a generar alquiler pasivo
    return { success: true, cost: prop.price, property: prop };
  }

  calculateDailyRent() {
    let total = 0;
    this.properties.forEach(p => {
      if (p.owned && p.isRentedOut) {
        total += p.rentIncomeDaily;
      }
    });
    return total;
  }
}
