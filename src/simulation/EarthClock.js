// EarthClock.js - Reloj planetario en tiempo real con ciclo astronómico y económico
export class EarthClock {
  constructor() {
    // Fecha inicial: Hoy en el año actual
    this.date = new Date(2026, 9, 12, 8, 30, 0); // 12 de Octubre de 2026, 08:30 AM
    this.timeScale = 15; // 1 segundo real = 15 segundos del juego (1 día = ~96 minutos reales, o acelerable)
    this.isPaused = false;

    this.listeners = {
      onHourChange: [],
      onDayChange: []
    };

    this.lastHour = this.date.getHours();
    this.lastDay = this.date.getDate();
  }

  update(deltaSeconds) {
    if (this.isPaused) return;

    const gameSecondsToAdd = deltaSeconds * this.timeScale;
    const oldTime = this.date.getTime();
    this.date = new Date(oldTime + gameSecondsToAdd * 1000);

    const currentHour = this.date.getHours();
    const currentDay = this.date.getDate();

    if (currentHour !== this.lastHour) {
      this.lastHour = currentHour;
      this.listeners.onHourChange.forEach(cb => cb(this.date));
    }

    if (currentDay !== this.lastDay) {
      this.lastDay = currentDay;
      this.listeners.onDayChange.forEach(cb => cb(this.date));
    }
  }

  getTimeFraction() {
    // Retorna la fracción del día actual (0.0 a 1.0) para el ciclo solar
    const hours = this.date.getHours();
    const minutes = this.date.getMinutes();
    const seconds = this.date.getSeconds();
    return (hours * 3600 + minutes * 60 + seconds) / 86400;
  }

  getFormattedTime() {
    const hh = String(this.date.getHours()).padStart(2, '0');
    const mm = String(this.date.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  getFormattedDate() {
    const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
    return this.date.toLocaleDateString('es-ES', options);
  }

  onHour(cb) {
    this.listeners.onHourChange.push(cb);
  }

  onDay(cb) {
    this.listeners.onDayChange.push(cb);
  }

  setTimeScale(scale) {
    this.timeScale = Math.max(1, Math.min(100, scale));
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    return this.isPaused;
  }
}
