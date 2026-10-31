// TechTree.js - Tecnologías actuales, I+D y avances mundiales
export class TechTree {
  constructor() {
    this.technologies = [
      {
        id: 'tech_ai',
        name: 'Modelos de Razonamiento & Agentes de IA',
        category: 'Computación',
        progress: 68,
        costToAccelerate: 5000,
        completed: false,
        boostStock: 'NVX',
        boostValue: 12,
        desc: 'Revoluciona la productividad corporativa y dispara la valoración de semiconductores.'
      },
      {
        id: 'tech_fusion',
        name: 'Reactores de Fusión Comercial',
        category: 'Energía',
        progress: 42,
        costToAccelerate: 12000,
        completed: false,
        boostStock: 'SOL',
        boostValue: 18,
        desc: 'Energía infinita sin carbono. Desploma la dependencia del petróleo crudo.'
      },
      {
        id: 'tech_quantum',
        name: 'Supremacía Cuántica de 10.000 Qubits',
        category: 'Criptografía & Datos',
        progress: 35,
        costToAccelerate: 15000,
        completed: false,
        boostStock: 'BTC',
        boostValue: -15, // Alerta criptográfica o adaptación
        desc: 'Procesamiento masivo paralelo para ciencia de materiales y simulaciones.'
      },
      {
        id: 'tech_defense_drones',
        name: 'Enjambres de Drones Autónomos y Láser',
        category: 'Defensa Militar',
        progress: 55,
        costToAccelerate: 8500,
        completed: false,
        boostStock: 'AER',
        boostValue: 14,
        desc: 'Sistemas antimisiles de última generación que modifican el equilibrio geopolítico.'
      }
    ];
  }

  update() {
    this.technologies.forEach(tech => {
      if (!tech.completed) {
        // Progreso natural global
        tech.progress += +(Math.random() * 0.15).toFixed(2);
        if (tech.progress >= 100) {
          tech.progress = 100;
          tech.completed = true;
        }
      }
    });
  }

  investInTech(techId, playerMoney) {
    const tech = this.technologies.find(t => t.id === techId);
    if (!tech) return { success: false, msg: 'Tecnología no encontrada' };
    if (tech.completed) return { success: false, msg: 'Esta tecnología ya ha alcanzado el 100%' };
    if (playerMoney < tech.costToAccelerate) {
      return { success: false, msg: 'Fondos insuficientes para financiar esta investigación' };
    }
    tech.progress = Math.min(100, tech.progress + 15);
    if (tech.progress >= 100) tech.completed = true;
    return { success: true, cost: tech.costToAccelerate, tech };
  }
}
