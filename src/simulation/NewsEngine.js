// NewsEngine.js - Generador dinámico de noticias mundiales y eventos en tiempo real
export class NewsEngine {
  constructor() {
    this.newsFeed = [
      {
        id: 'news_init_1',
        time: '08:30',
        headline: 'Apertura de Mercados: Wall Street y Tokio operan con volatilidad moderada',
        category: 'ECONOMÍA',
        impactStock: 'NVX',
        impactPercent: 1.5
      },
      {
        id: 'news_init_2',
        time: '08:15',
        headline: 'Nueva cumbre internacional sobre inteligencia artificial y energía limpia',
        category: 'TECNOLOGÍA',
        impactStock: 'SOL',
        impactPercent: 2.2
      }
    ];

    this.eventPool = [
      {
        headline: 'Alza histórica del crudo tras advertencia de cuotas de la OPEP en el Golfo',
        category: 'GEOPOLÍTICA',
        impactStock: 'PET',
        impactPercent: 5.4,
        defconDelta: 0,
        triggerCrisis: { name: 'Restricción de exportaciones petroleras', region: 'Oriente Medio', commodities: ['oil'] }
      },
      {
        headline: 'NeuroVortex presenta microprocesador cuántico con 10x eficiencia energética',
        category: 'TECNOLOGÍA',
        impactStock: 'NVX',
        impactPercent: 8.2
      },
      {
        headline: 'Aegis Defense se adjudica contrato multimillonario de escudos antidrones',
        category: 'DEFENSA',
        impactStock: 'AER',
        impactPercent: 6.1
      },
      {
        headline: 'Reguladores financieros aprueban fondos cotizados de CyberCoin en bolsas globales',
        category: 'CRIPTOMONEDAS',
        impactStock: 'BTC',
        impactPercent: 11.5
      },
      {
        headline: 'Tratado de Paz y Cooperación firmado entre bloques comerciales',
        category: 'DIPLOMACIA',
        impactStock: 'PET',
        impactPercent: -3.5,
        resolveConflict: true
      },
      {
        headline: 'BioGenesis Labs supera fase clínica de terapia génica preventiva',
        category: 'SALUD & CIENCIA',
        impactStock: 'HLT',
        impactPercent: 7.8
      },
      {
        headline: 'Banco Central mantiene tasas de interés para contener presiones inflacionarias',
        category: 'MACROECONOMÍA',
        impactStock: null,
        impactPercent: 0
      },
      {
        headline: 'Tormenta solar menor causa fluctuaciones transitorias en redes satelitales',
        category: 'CIENCIA & ESPACIO',
        impactStock: 'NVX',
        impactPercent: -1.8
      }
    ];

    this.timer = 0;
    this.intervalSeconds = 25; // Cada 25 segundos del juego se genera una noticia
  }

  update(deltaSeconds, clock, geopolitics, economy, audioManager) {
    this.timer += deltaSeconds;
    if (this.timer >= this.intervalSeconds) {
      this.timer = 0;
      return this.generateRandomNews(clock, geopolitics, economy, audioManager);
    }
    return null;
  }

  generateRandomNews(clock, geopolitics, economy, audioManager) {
    const template = this.eventPool[Math.floor(Math.random() * this.eventPool.length)];
    const timeStr = clock ? clock.getFormattedTime() : '12:00';

    const newsItem = {
      id: 'news_' + Date.now(),
      time: timeStr,
      headline: template.headline,
      category: template.category,
      impactStock: template.impactStock,
      impactPercent: template.impactPercent
    };

    this.newsFeed.unshift(newsItem);
    if (this.newsFeed.length > 20) {
      this.newsFeed.pop();
    }

    // Aplicar efectos en la economía y geopolítica
    if (economy && template.impactStock) {
      economy.update(geopolitics, template);
    }

    if (geopolitics) {
      if (template.triggerCrisis) {
        geopolitics.triggerCrisis(
          template.triggerCrisis.name,
          template.triggerCrisis.region,
          template.triggerCrisis.commodities
        );
      }
      if (template.resolveConflict) {
        geopolitics.resolveConflict();
      }
    }

    if (audioManager) {
      audioManager.playNewsAlert();
    }

    return newsItem;
  }
}
