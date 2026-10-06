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
   * Conecta el interceptor a un contexto o página de Playwright
   */
  attach(target, onLog = console.log) {
    const handleRequest = (request) => {
      const url = request.url();
      const method = request.method();

      // Interceptar todo el tráfico con SUNAT (api-sire, mige, rce, e-menu, sunat.gob.pe)
      if (url.includes('sunat.gob.pe')) {
        const headers = request.headers();
        const authHeader = headers['authorization'] || headers['Authorization'];
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
          this.sessionTokens.bearerToken = authHeader;
          onLog(`[SNIFFER] 🎯 Bearer Token capturado: ${authHeader.substring(0, 30)}...`);
        }

        const cookieHeader = headers['cookie'] || headers['Cookie'];
        if (cookieHeader) {
          this.sessionTokens.cookies = cookieHeader;
        }

        const postData = request.postData();
        const reqRecord = {
          timestamp: new Date().toISOString(),
          url,
          method,
          headers,
          postData: postData ? (postData.length > 5000 ? postData.substring(0, 5000) + '...[truncado]' : postData) : null
        };

        // Registro y telemetría de endpoints relevantes de SIRE y SOL
        if (url.includes('api-sire') || url.includes('clientessol') || url.includes('migeigv') || url.includes('libros')) {
          const endpointPath = url.replace('https://api-sire.sunat.gob.pe', '').replace('https://api-seguridad.sunat.gob.pe', '').split('?')[0];
          let detallePost = '';
          if (method === 'POST' && postData) {
            try {
              const parsed = JSON.parse(postData);
              const keys = Object.keys(parsed).slice(0, 4).join(', ');
              detallePost = ` [Payload: {${keys}...}]`;
            } catch (e) {
              detallePost = ` [Payload: ${postData.substring(0, 40)}...]`;
            }
          }
          onLog(`📡 [API ${method}] ${endpointPath}${detallePost}`);
        }

        this.capturedRequests.push(reqRecord);
      }
    };

    const handleResponse = async (response) => {
      const url = response.url();
      const status = response.status();

      if (url.includes('sunat.gob.pe')) {
        try {
          const contentType = response.headers()['content-type'] || '';
          if (contentType.includes('application/json')) {
            const body = await response.json().catch(() => null);
            if (body) {
              const endpointPath = url.replace('https://api-sire.sunat.gob.pe', '').replace('https://api-seguridad.sunat.gob.pe', '').split('?')[0];
              if (url.includes('api-sire') || url.includes('clientessol') || url.includes('migeigv')) {
                const totalItems = Array.isArray(body) ? ` (${body.length} items)` : (body.registros ? ` (${body.registros.length} registros)` : '');
                onLog(`📥 [RESPUESTA ${status}] ${endpointPath}${totalItems}`);
              }
              this.apiEndpoints[url] = {
                status,
                sampleResponse: body
              };
            }
          }
        } catch (e) {}
      }
    };

    if (target.on) {
      target.on('request', handleRequest);
      target.on('response', handleResponse);
    }
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
