/**
 * sunat_fast_checker.js
 * Validación ultrarrápida de Clave SOL sin navegador.
 * Realiza peticiones HTTPS directas al endpoint oficial 'j_security_check' de SUNAT.
 */

const https = require('https');

const SUNAT_SECURITY_CHECK_URL = "https://api-seguridad.sunat.gob.pe/v1/clientessol/4f3b88b3-d9d6-402a-b85d-6a0bc857746a/oauth2/j_security_check";

/**
 * Valida si el RUC, Usuario y Clave SOL son válidos directamente con el servidor de SUNAT.
 */
async function validarCredencialSol(ruc, usuario, clave) {
  return new Promise((resolve) => {
    const postParams = new URLSearchParams({
      tipo: '2',
      dni: '',
      custom_ruc: (ruc || '').trim(),
      j_username: (usuario || '').trim(),
      j_password: (clave || '').trim(),
      captcha: '',
      originalUrl: 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/AutenticaMenuInternet.htm',
      lang: 'es-PE',
      state: 'test'
    }).toString();

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 10000
    };

    const req = https.request(SUNAT_SECURITY_CHECK_URL, options, (res) => {
      const statusCode = res.statusCode;
      const location = res.headers['location'] || '';

      // SUNAT responde 302 Redirection
      // 1. Si las credenciales son VÁLIDAS: Redirige hacia AutenticaMenuInternet.htm con ?code=...
      if (location.includes('AutenticaMenuInternet') && location.includes('code=')) {
        return resolve({
          ruc,
          valido: true,
          estado: 'VALIDA',
          mensaje: 'Clave SOL válida y operativa en SUNAT',
          statusCode
        });
      }

      // 2. Si las credenciales son INVÁLIDAS: Redirige hacia oauth2/error
      if (location.includes('/oauth2/error') || location.includes('login_error')) {
        return resolve({
          ruc,
          valido: false,
          estado: 'CLAVE_INCORRECTA',
          mensaje: 'Usuario o Clave SOL incorrecta en SUNAT',
          statusCode
        });
      }

      // 3. Casos de saturación de SUNAT
      if (statusCode === 503 || statusCode === 502) {
        return resolve({
          ruc,
          valido: false,
          estado: 'SUNAT_SATURADA',
          mensaje: `Servidor SUNAT saturado temporalmente (${statusCode})`,
          statusCode
        });
      }

      // 4. Si dio 302 pero sin error
      if (statusCode === 302 && !location.includes('error')) {
        return resolve({
          ruc,
          valido: true,
          estado: 'VALIDA',
          mensaje: 'Clave SOL aceptada por pasarela SUNAT',
          statusCode
        });
      }

      resolve({
        ruc,
        valido: false,
        estado: 'ERROR_CONSULTA',
        mensaje: `Respuesta desconocida de SUNAT (Código ${statusCode})`,
        statusCode
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        ruc,
        valido: false,
        estado: 'TIMEOUT',
        mensaje: 'SUNAT tardó demasiado en responder'
      });
    });

    req.on('error', (err) => {
      resolve({
        ruc,
        valido: false,
        estado: 'ERROR_CONEXION',
        mensaje: `Error de red: ${err.message}`
      });
    });

    req.write(postParams);
    req.end();
  });
}

/**
 * Valida un lote de clientes en bloques concurrentes
 */
async function validarLoteCredenciales(clientes, batchSize = 5) {
  const resultados = [];
  for (let i = 0; i < clientes.length; i += batchSize) {
    const bloque = clientes.slice(i, i + batchSize);
    const promesas = bloque.map(c => validarCredencialSol(c.ruc, c.usuarioSol, c.claveSol));
    const respuestas = await Promise.all(promesas);
    resultados.push(...respuestas);
  }
  return resultados;
}

module.exports = {
  validarCredencialSol,
  validarLoteCredenciales
};
