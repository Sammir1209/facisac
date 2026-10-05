/**
 * sunat_api_sniffer.js
 * Interceptor pasivo de peticiones y respuestas HTTP de SUNAT SIRE.
 * Captura tokens, cabeceras, endpoints REST de la API de SUNAT y payloads JSON
 * para permitir la transición completa a llamadas cURL / Fetch ultrarrápidas sin Chromium.
 */

const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, 'sunat_api_logs');

class SunatApiSniffer {
  constructor() {
    this.capturedRequests = [];
    this.sessionTokens = {};
    this.apiEndpoints = {};
    this.ensureDir();
  }

  ensureDir() {
    if (!fs.existsSync(LOG_DIR)) {
      try {
        fs.mkdirSync(LOG_DIR, { recursive: true });
      } catch (e) {}
    }
  }

  /**
   * Conecta el interceptor a una página de Playwright
   */
  attach(page, onLog = console.log) {
    page.on('request', (request) => {
      const url = request.url();
      const method = request.method();

      // Interceptar endpoints de API SIRE, OAuth o e-menu
      if (url.includes('api-sire') || url.includes('/mige/') || url.includes('/rce/') || url.includes('e-menu') || url.includes('clientessol')) {
        const headers = request.headers();
        const authHeader = headers['authorization'] || headers['Authorization'];
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
          this.sessionTokens.bearerToken = authHeader;
          onLog(`[SNIFFER] 🎯 Bearer Token de API SIRE capturado: ${authHeader.substring(0, 25)}...`);
        }

        const postData = request.postData();
        const reqRecord = {
          timestamp: new Date().toISOString(),
          url,
          method,
          headers,
          postData: postData ? (postData.length > 5000 ? postData.substring(0, 5000) + '...[truncado]' : postData) : null
        };

        this.capturedRequests.push(reqRecord);
      }
    });

    page.on('response', async (response) => {
      const url = response.url();
      const status = response.status();

      // Interceptar respuestas JSON clave del SIRE
      if ((url.includes('/rce/') || url.includes('/propuesta') || url.includes('/mige/')) && status === 200) {
        try {
          const contentType = response.headers()['content-type'] || '';
          if (contentType.includes('application/json')) {
            const body = await response.json().catch(() => null);
            if (body) {
              onLog(`[SNIFFER] 📦 Respuesta JSON capturada de endpoint: ${url.split('?')[0]}`);
              this.apiEndpoints[url] = {
                status,
                sampleResponse: body
              };
            }
          }
        } catch (e) {}
      }
    });
  }

  /**
   * Guarda todo el catálogo de peticiones interceptadas para ingeniería inversa de cURL
   */
  saveDump(ruc) {
    try {
      this.ensureDir();
      const file = path.join(LOG_DIR, `sire_endpoints_${ruc || 'general'}.json`);
      fs.writeFileSync(
        file,
        JSON.stringify(
          {
            tokens: this.sessionTokens,
            endpoints: this.apiEndpoints,
            totalRequestsCaptured: this.capturedRequests.length,
            requests: this.capturedRequests.slice(-30) // Últimas 30 peticiones relevantes
          },
          null,
          2
        ),
        'utf8'
      );
    } catch (e) {
      console.warn('[SNIFFER] Error guardando dump de API:', e.message);
    }
  }
}

const sunatApiSniffer = new SunatApiSniffer();

module.exports = {
  sunatApiSniffer,
  SunatApiSniffer
};
