// Commodities.js - Precios de productos de consumo, combustible y catálogo de vehículos
export class Commodities {
  constructor() {
    this.fuelPricePerLiter = 1.65; // Precio base de la gasolina por litro
    this.foodBasketPrice = 35.0; // Comida básica

    this.storeProducts = [
      { id: 'coffee', name: 'Café Espresso Gourmet', price: 4.5, staminaRestore: 30, icon: '☕' },
      { id: 'energy_meal', name: 'Almuerzo Nutricional Equilibrado', price: 18.0, staminaRestore: 70, icon: '🍱' },
      { id: 'laptop_pro', name: 'Laptop Ultrabook I+D', price: 1850.0, workBonus: 1.25, icon: '💻' },
      { id: 'smartwatch', name: 'Reloj Biométrico Inteligente', price: 450.0, staminaBonus: 1.15, icon: '⌚' }
    ];

    this.carDealership = [
      {
        id: 'car_sedan',
        name: 'EcoCruiser Sedán',
        price: 18500,
        topSpeed: 22,
        acceleration: 14,
        handling: 1.8,
        fuelCapacity: 50,
        fuelConsumption: 0.8,
        color: 0x3498db,
        desc: 'Económico y fiable para desplazarse por la ciudad'
      },
      {
        id: 'car_sport',
        name: 'Apex GT Roadster',
        price: 68000,
        topSpeed: 34,
        acceleration: 24,
        handling: 2.3,
        fuelCapacity: 65,
        fuelConsumption: 1.4,
        color: 0xe74c3c,
        desc: 'Alta velocidad, aceleración deportiva y diseño aerodinámico'
      },
      {
        id: 'car_electric',
        name: 'Volt Hyperion CyberCar',
        price: 125000,
        topSpeed: 40,
        acceleration: 30,
        handling: 2.6,
        fuelCapacity: 100, // Batería eléctrica kWh
        fuelConsumption: 0.5,
        color: 0x2ecc71,
        desc: 'Cero emisiones, aceleración instantánea y tecnología de punta'
      }
    ];
  }

  update(crudeOilPrice, inflationRate) {
    // La gasolina varía directamente con el precio del barril de crudo + margen de refinación
    this.fuelPricePerLiter = +(0.45 + (crudeOilPrice * 0.015) * (1 + inflationRate / 100)).toFixed(2);
    this.foodBasketPrice = +(35.0 * (1 + inflationRate / 100)).toFixed(2);
  }
}
