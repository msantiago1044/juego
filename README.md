# 🌍 TerraSim 3D — Simulación Planetaria en Tiempo Real

Simulador en tercera persona del planeta Tierra con economía viva, física newtoniana, leyes de la naturaleza, geopolítica, guerras, bolsas de valores, mercado inmobiliario y empleos, diseñado con estilo Low-Poly para una fluidez óptima (60+ FPS).

---

## 🚀 Cómo Jugar

El servidor de desarrollo está activo en tu máquina. Solo abre tu navegador favorito en:
👉 **[http://localhost:5173/](http://localhost:5173/)**

Para iniciarlo manualmente en cualquier momento desde esta carpeta:
```bash
npm run dev
```

---

## 🎮 Controles del Juego

| Tecla / Control | Acción |
| :--- | :--- |
| **[W] [A] [S] [D]** | Moverse a pie / Conducir vehículo (Acelerar, Frenar/Reversa, Girar) |
| **[Ratón]** | Rotación orbital de la cámara en 3ra persona |
| **[Shift]** | Correr a pie (consume estamina biológica) |
| **[Espacio]** | Saltar a pie / Freno de mano en coche |
| **[E]** | **Interactuar**: Subir/Bajar del coche, repostar gasolina en la gasolinera, o acceder a edificios |
| **[TAB]** | Abrir / Cerrar el **Smartphone / PDA** del jugador |
| **1x / 5x / 20x / ⏸** | Acelerar el tiempo planetario o pausar la simulación |

---

## ⚛️ Físicas y Leyes de la Naturaleza Implementadas

1. **Cinemática y Dinámica de Newton**:
   - Gravedad continua ($g = 9.81 \, m/s^2$).
   - Inercia, aceleración ($F = m \cdot a$) y masa de cuerpos y vehículos.
   - Resistencia aerodinámica del aire ($F_{drag} \propto v^2$).
   - Colisiones sólidas contra edificios y mobiliario urbano con cálculo de penetración e impulsos elásticos.
2. **Ciclo Astronómico Solar y Día/Noche**:
   - Movimiento orbital del Sol y la Luna en tiempo real.
   - Variación continua de iluminación: amanecer dorado, mediodía nítido, atardecer rojizo y noche profunda con constelaciones de estrellas.
   - Las farolas urbanas se encienden automáticamente al caer la noche.
3. **Clima y Termodinámica Ambiental**:
   - Estados meteorológicos: Despejado, Lluvia, Tormenta Eléctrica y Neblina.
   - Gotas de lluvia físicas con gravedad y arrastre por viento.
   - **Fricción del Asfalto Dinámica**: La lluvia moja el asfalto reduciendo el coeficiente de fricción ($\mu$ de 0.85 a 0.32), provocando derrapes y aquaplaning al conducir.
   - Consumo de combustible del vehículo con recarga en gasolinera según los precios de mercado.
4. **Biología del Personaje**:
   - Barra de estamina biológica que se agota al esprintar y se recupera caminando o descansando.

---

## 📈 Simulación Económica y Geopolítica

- **Wall Street & Bolsa de Valores**: Acciones con fluctuación dinámica (`NVX` NeuroVortex AI, `AER` Aegis Defense, `PET` PetroGlobal, `SOL` Helios Clean Energy, `HLT` BioGenesis, `BTC` CyberCoin). Compra/venta de acciones y cobro de dividendos.
- **Geopolítica y Guerras**: Indicador DEFCON (1 a 5), tensiones entre potencias (EEUU, China, UE, Medio Oriente) y zonas de conflicto que afectan directamente el precio del crudo y las acciones de defensa.
- **Noticias en Vivo ("Breaking News")**: Feed procedimental de noticias de impacto financiero y bélico.
- **Mercado Inmobiliario**: Compra de estudios, lofts, áticos y mansiones que generan rentas pasivas diarias.
- **Carrera Laboral**: Progresión de empleos con salario diario (Repartidor, Ingeniero de IA, Trader de Wall Street, CEO).
- **Árbol Tecnológico (I+D)**: Investigación de IA cuántica, fusión nuclear y sistemas antimisiles con opción de inversión directa.
