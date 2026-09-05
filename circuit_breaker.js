/**
 * circuit_breaker.js
 * Monitor de salud y pasarela resiliente para servicios SUNAT.
 * Maneja caídas tipo 503, 502, bloqueos temporales y saturación de red con retroceso exponencial.
 */

class SunatCircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 3; // Fallos consecutivos para abrir circuito
    this.cooldownSeconds = options.cooldownSeconds || 60;  // Tiempo de espera inicial cuando el circuito se abre
    this.failureCount = 0;
    this.state = 'CLOSED'; // 'CLOSED' (Normal), 'OPEN' (Bloqueado/En pausa), 'HALF_OPEN' (Probando recuperación)
    this.lastFailureTime = null;
    this.nextRetryTime = null;
    this.consecutive503s = 0;
  }

  isAvailable() {
    if (this.state === 'CLOSED') return true;

    if (this.state === 'OPEN') {
      const now = Date.now();
      if (now >= this.nextRetryTime) {
        this.state = 'HALF_OPEN';
        console.log('[CIRCUIT BREAKER] Estado cambiado a HALF_OPEN. Intentando petición de prueba a SUNAT...');
        return true;
      }
      return false;
    }

    if (this.state === 'HALF_OPEN') {
      return true;
    }

    return true;
  }

  getRemainingCooldownSeconds() {
    if (this.state !== 'OPEN' || !this.nextRetryTime) return 0;
    const diff = Math.max(0, this.nextRetryTime - Date.now());
    return Math.ceil(diff / 1000);
  }

  recordSuccess() {
    this.failureCount = 0;
    this.consecutive503s = 0;
    if (this.state !== 'CLOSED') {
      console.log('[CIRCUIT BREAKER] Servidores de SUNAT respondiendo con normalidad. Circuito CERRADO.');
    }
    this.state = 'CLOSED';
    this.nextRetryTime = null;
  }

  recordFailure(error) {
    const errorMsg = (error && error.message) ? error.message : String(error);
    const is503OrNetwork = errorMsg.includes('503') || 
                           errorMsg.includes('502') || 
                           errorMsg.includes('NXSI045') ||
                           errorMsg.includes('ETIMEDOUT') ||
                           errorMsg.includes('ECONNRESET');

    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (is503OrNetwork) {
      this.consecutive503s++;
    }

    // Si supera el umbral o es un 503 flagrante, abrir el circuito
    if (this.failureCount >= this.failureThreshold || this.consecutive503s >= 2) {
      this.state = 'OPEN';
      // Retroceso exponencial: 60s, 120s, 240s
      const multiplicador = Math.min(4, Math.max(1, this.consecutive503s));
      const espera = this.cooldownSeconds * multiplicador * 1000;
      this.nextRetryTime = Date.now() + espera;

      console.warn(`[CIRCUIT BREAKER] ¡ALERTA! SUNAT no responde adecuadamente (${errorMsg}). Circuito ABIERTO. Pausa de ${espera / 1000}s.`);
    }
  }

  getStatus() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      consecutive503s: this.consecutive503s,
      cooldownRemainingSeconds: this.getRemainingCooldownSeconds(),
      isAvailable: this.isAvailable()
    };
  }
}

const circuitBreaker = new SunatCircuitBreaker();

module.exports = {
  circuitBreaker,
  SunatCircuitBreaker
};
