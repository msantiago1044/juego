// Geopolitics.js - Simulación geopolítica: Gobiernos, Guerras, Tratados y DEFCON
export class Geopolitics {
  constructor() {
    this.defcon = 4; // Escala 1 (Guerra Total) a 5 (Paz Total)
    this.nations = [
      { id: 'USA', name: 'Estados Unidos', gdp: '28.2T', stance: 'Democracia Tecnológica', tension: 35, budgetDefense: '886B' },
      { id: 'CHN', name: 'China', gdp: '18.9T', stance: 'Potencia Industrial / Tech', tension: 40, budgetDefense: '290B' },
      { id: 'EU', name: 'Unión Europea', gdp: '19.4T', stance: 'Transición Verde y Mercado Común', tension: 25, budgetDefense: '380B' },
      { id: 'ME', name: 'Alianza Oriente Medio', gdp: '3.8T', stance: 'Monopolio Petrolero / OPEP', tension: 65, budgetDefense: '160B' },
      { id: 'RUS', name: 'Bloque Euroasiático', gdp: '2.1T', stance: 'Recursos Energéticos / Sanciones', tension: 75, budgetDefense: '110B' }
    ];

    this.activeConflicts = [
      {
        id: 'conf_1',
        title: 'Tensión en Rutas Marítimas del Estrecho',
        region: 'Oriente Medio',
        intensity: 'Media',
        impact: 'Aumento del flete marítimo y precio del petróleo',
        affectedCommodities: ['oil', 'shipping']
      }
    ];

    this.peaceTreaties = [
      { id: 'tr_1', title: 'Tratado de No Proliferación y Comercio Electrónico', signatories: ['USA', 'EU'] }
    ];

    this.tensionIndex = 48; // 0 (Utopía) a 100 (Guerra Mundial)
  }

  update(deltaDays = 0) {
    // Fluctuación natural de la tensión política global
    const drift = (Math.random() - 0.49) * 0.8;
    this.tensionIndex = Math.max(10, Math.min(95, this.tensionIndex + drift));

    // Ajustar nivel DEFCON según tensión
    if (this.tensionIndex > 80) this.defcon = 2;
    else if (this.tensionIndex > 60) this.defcon = 3;
    else if (this.tensionIndex > 35) this.defcon = 4;
    else this.defcon = 5;
  }

  triggerCrisis(conflictName, region, commodityList) {
    this.tensionIndex = Math.min(95, this.tensionIndex + 12);
    const newConflict = {
      id: 'conf_' + Date.now(),
      title: conflictName,
      region: region,
      intensity: 'Alta',
      impact: 'Riesgo de suministro crítico y volatilidad bursátil',
      affectedCommodities: commodityList || ['oil']
    };
    this.activeConflicts.unshift(newConflict);
    if (this.activeConflicts.length > 4) this.activeConflicts.pop();
    return newConflict;
  }

  resolveConflict() {
    if (this.activeConflicts.length > 0) {
      const resolved = this.activeConflicts.pop();
      this.tensionIndex = Math.max(15, this.tensionIndex - 10);
      return resolved;
    }
    return null;
  }

  getDefconStatus() {
    const labels = {
      1: { text: 'DEFCON 1 — GUERRA TOTAL INMINENTE', color: '#ff0033' },
      2: { text: 'DEFCON 2 — MÁXIMA ALERTA MILITAR', color: '#ff4400' },
      3: { text: 'DEFCON 3 — FUERZAS EN ALERTA ELEVADA', color: '#ffaa00' },
      4: { text: 'DEFCON 4 — VIGILANCIA INTELIGENTE', color: '#00d4ff' },
      5: { text: 'DEFCON 5 — TIEMPO DE PAZ NORMAL', color: '#00ff88' }
    };
    return labels[this.defcon] || labels[4];
  }
}
