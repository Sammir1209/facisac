/**
 * facisac_app.js - SISTEMA UNIFICADO TODO-EN-UNO FACISAC RCE SUNAT
 * 
 * Este archivo contiene TODO el sistema en un solo archivo:
 * 1. Servidor HTTP REST API completo.
 * 2. Panel Web Moderno Reactivo Embebido (HTML5 + CSS Glassmorphism + JS Vanilla reactivo).
 * 3. Selector de empresas con carga directa de Excel (CLAVE SOL - CLIENTES).
 * 4. Calendario y Cronograma Oficial SUNAT según último dígito de RUC.
 * 5. Fast Check de Claves SOL directo contra pasarela SUNAT (sin abrir navegador).
 * 6. Orquestador de Cola y Automatización Playwright RCE (Gestión de Compras y modificación a 0.00).
 * 7. Integración WhatsApp Web (Baileys) con generación de QR en pantalla y envío a grupos.
 * 8. Exportador de auditoría y descarga de reporte consolidado en Excel (.xlsx).
 * 
 * USO LOCAL:
 *   node facisac_app.js
 *   (Se abrirá automáticamente en http://localhost:3000)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const https = require('https');
const { exec } = require('child_process');

// Importaciones de módulos del core si existen, con blindaje defensivo
let ejecutarPaso1Login;
try {
  ejecutarPaso1Login = require('./login_automator').ejecutarPaso1Login;
} catch (e) {
  console.warn('[WARN] No se pudo cargar login_automator directamente:', e.message);
}

let whatsAppService;
try {
  whatsAppService = require('./whatsapp_service').whatsAppService;
} catch (e) {
  whatsAppService = {
    getStatus: () => ({ isConnected: false, isConnecting: false, qrDataUrl: null, selectedGroupId: null, selectedGroupName: null }),
    refreshGroups: async () => [],
    setSelectedGroup: () => {},
    sendGroupMessage: async () => ({ success: false, error: 'NO_WHATSAPP' }),
    disconnect: async () => ({ success: true })
  };
}

let auditExporter;
try {
  auditExporter = require('./audit_exporter').auditExporter;
} catch (e) {
  auditExporter = {
    saveAuditTrail: () => null,
    hasAuditEvidence: () => false
  };
}

let circuitBreaker;
try {
  circuitBreaker = require('./circuit_breaker').circuitBreaker;
} catch (e) {
  circuitBreaker = {
    recordSuccess: () => {},
    recordFailure: () => {},
    getStatus: () => ({ state: 'CLOSED', isAvailable: true, cooldownRemainingSeconds: 0 })
  };
}

let supabase;
try {
  supabase = require('./supabase_client').supabase;
} catch (e) {
  supabase = {
    from: () => ({
      select: () => Promise.resolve({ data: [], error: null }),
      upsert: () => Promise.resolve({ data: null, error: null })
    })
  };
}

const PORT = process.env.PORT || 3000;
const RESULTS_FILE = path.join(__dirname, 'registro_rce_resultados.json');
const EXCEL_DEFAULT_FILE = path.join(__dirname, 'CLAVE SOL - CLIENTES  -  ACTUALIZADO JULIO - 2026.xlsm');

// =========================================================================
// GESTOR DE COLA DE TRABAJOS (QUEUE MANAGER)
// =========================================================================
const jobs = new Map();

class QueueManager {
  constructor(maxConcurrency = 1) {
    this.maxConcurrency = maxConcurrency;
    this.queue = [];
    this.runningCount = 0;
  }

  enqueue(cliente, onLogCallback = null) {
    const jobId = 'job_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const abortController = new AbortController();

    const job = {
      id: jobId,
      cliente,
      progreso: 0,
      fase: 'En Cola',
      estado: 'EN_COLA',
      logs: [`[${new Date().toLocaleTimeString('es-PE')}] Tarea agregada a la cola`],
      screenshot: null,
      resultado: null,
      creadoEn: new Date(),
      abortController
    };

    jobs.set(jobId, job);
    this.queue.push(job);
    setTimeout(() => this.processNext(), 100);
    return job;
  }

  async processNext() {
    if (this.runningCount >= this.maxConcurrency || this.queue.length === 0) return;

    const job = this.queue.shift();
    if (!job || job.estado === 'CANCELADO') {
      return this.processNext();
    }

    this.runningCount++;
    job.estado = 'PROCESANDO';
    job.fase = 'Iniciando Automatización';
    job.iniciadoEn = new Date();

    const updateLog = (msg) => {
      job.logs.push(msg);
      if (job.logs.length > 250) job.logs.shift();
      console.log(`[${job.cliente.ruc}] ${msg}`);
    };

    try {
      updateLog(`Iniciando tarea para ${job.cliente.razonSocial || job.cliente.ruc}...`);

      if (!ejecutarPaso1Login) {
        throw new Error("El motor Playwright (login_automator.js) no está disponible.");
      }

      const resultado = await ejecutarPaso1Login(
        {
          ruc: job.cliente.ruc,
          usuario: job.cliente.usuario,
          clave: job.cliente.clave,
          anio: job.cliente.anio || '2026',
          mes: job.cliente.mes || 'Agosto'
        },
        updateLog,
        {
          abortSignal: job.abortController.signal
        }
      );

      if (job.estado !== 'CANCELADO') {
        job.resultado = resultado;
        job.progreso = 100;
        job.estado = 'COMPLETADO';
        job.fase = 'Finalizado con Éxito';
        if (resultado && resultado.screenshot) job.screenshot = resultado.screenshot;

        circuitBreaker.recordSuccess();
        auditExporter.saveAuditTrail(job.cliente, null, null, resultado);

        // Notificación de WhatsApp
        let estadoLegible = 'Libros Modificados';
        if (resultado && (resultado.estado === 'SIN_MODIFICACIONES' || resultado.estado === 'EN_CERO')) {
          estadoLegible = 'Libros Verificados (0.00)';
        } else if (resultado && resultado.estado === 'MODIFICADO_EXITOSO') {
          estadoLegible = `Libros Modificados (${resultado.comprobantesModificados?.length || 1} comprobante(s) ajustados)`;
        }

        const horaPeru = new Date().toLocaleTimeString('es-PE', {
          timeZone: 'America/Lima',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });

        const mensajeWa = `*RCE SUNAT: ${job.cliente.ruc}*\n` +
          `${job.cliente.razonSocial || 'EMPRESA'}\n` +
          `• *Periodo:* ${job.cliente.mes || 'Agosto'} ${job.cliente.anio || '2026'}\n` +
          `• *Estado:* ${estadoLegible}\n` +
          `• *Hora:* ${horaPeru}`;

        whatsAppService.sendGroupMessage(mensajeWa).catch(() => {});
      }
    } catch (err) {
      if (job.estado !== 'CANCELADO') {
        job.estado = 'ERROR';
        job.fase = 'Error en Ejecución';
        updateLog(`[ERROR] ${err.message}`);
        circuitBreaker.recordFailure(err);

        const horaPeru = new Date().toLocaleTimeString('es-PE', {
          timeZone: 'America/Lima',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });

        const mensajeErrorWa = `*ALERTA SUNAT: ${job.cliente.ruc}*\n` +
          `${job.cliente.razonSocial || 'EMPRESA'}\n` +
          `• *Incidencia:* ${err.message.substring(0, 100)}\n` +
          `• *Hora:* ${horaPeru}`;

        whatsAppService.sendGroupMessage(mensajeErrorWa).catch(() => {});
      }
    } finally {
      job.finalizadoEn = new Date();
      this.runningCount--;
      setTimeout(() => this.processNext(), 500);
    }
  }

  cancelJob(jobId) {
    const job = jobs.get(jobId);
    if (!job) return false;
    job.estado = 'CANCELADO';
    job.fase = 'Cancelado';
    if (job.abortController) job.abortController.abort();
    this.queue = this.queue.filter(j => j.id !== jobId);
    return true;
  }

  cancelAll() {
    this.queue.forEach(j => {
      j.estado = 'CANCELADO';
      j.fase = 'Cancelado';
      if (j.abortController) j.abortController.abort();
    });
    this.queue = [];
    jobs.forEach(j => {
      if (j.estado === 'PROCESANDO' || j.estado === 'EN_COLA') {
        j.estado = 'CANCELADO';
        j.fase = 'Detenido por Usuario';
        if (j.abortController) j.abortController.abort();
      }
    });
  }

  getStatus() {
    return {
      enCola: this.queue.length,
      enEjecucion: this.runningCount,
      maxConcurrency: this.maxConcurrency
    };
  }
}

const queueManager = new QueueManager(1);

// =========================================================================
// VALIDACIÓN ULTRARRÁPIDA DE CLAVE SOL
// =========================================================================
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
      timeout: 8000
    };

    const req = https.request('https://api-seguridad.sunat.gob.pe/v1/clientessol/4f3b88b3-d9d6-402a-b85d-6a0bc857746a/oauth2/j_security_check', options, (res) => {
      const location = res.headers['location'] || '';
      if (location.includes('AutenticaMenuInternet') && location.includes('code=')) {
        return resolve({ ruc, valido: true, estado: 'VALIDA', mensaje: 'Clave SOL válida y operativa' });
      }
      if (location.includes('/oauth2/error') || location.includes('login_error')) {
        return resolve({ ruc, valido: false, estado: 'CLAVE_INCORRECTA', mensaje: 'Usuario o Clave SOL incorrecta' });
      }
      if (res.statusCode === 503 || res.statusCode === 502) {
        return resolve({ ruc, valido: false, estado: 'SUNAT_SATURADA', mensaje: 'Servidor SUNAT saturado' });
      }
      if (res.statusCode === 302 && !location.includes('error')) {
        return resolve({ ruc, valido: true, estado: 'VALIDA', mensaje: 'Clave SOL aceptada' });
      }
      resolve({ ruc, valido: false, estado: 'ERROR_CONSULTA', mensaje: `Respuesta código ${res.statusCode}` });
    });

    req.on('timeout', () => { req.destroy(); resolve({ ruc, valido: false, estado: 'TIMEOUT', mensaje: 'Tiempo de espera agotado' }); });
    req.on('error', (err) => resolve({ ruc, valido: false, estado: 'ERROR_CONEXION', mensaje: err.message }));
    req.write(postParams);
    req.end();
  });
}

// =========================================================================
// SERVIDOR HTTP + REST API + PANEL WEB INTEGRADO
// =========================================================================
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. PÁGINA PRINCIPAL: Panel Web Embebido Todo-en-Uno
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(getEmbeddedHTML());
    return;
  }

  // 2. API: Cargar clientes desde el archivo Excel oficial
  if (req.method === 'GET' && req.url === '/api/excel/import-clients') {
    try {
      if (!fs.existsSync(EXCEL_DEFAULT_FILE)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Archivo Excel oficial no encontrado' }));
        return;
      }

      const workbook = xlsx.readFile(EXCEL_DEFAULT_FILE, { cellStyles: true });
      const sheetName = workbook.SheetNames.includes('CLIENTES') ? 'CLIENTES' : workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

      const clientes = [];
      for (let i = 8; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[1] || !row[2]) continue;

        const razonSocial = String(row[1]).trim();
        const ruc = String(row[2]).trim();
        const regimenTributario = row[3] ? String(row[3]).trim() : '';
        const usuario = row[5] ? String(row[5]).trim().toUpperCase() : '';
        const clave = row[6] ? String(row[6]).trim() : '';

        const excelRowNum = i + 1;
        const cellB = sheet['B' + excelRowNum];
        const cellC = sheet['C' + excelRowNum];
        const fgB = cellB && cellB.s && cellB.s.fgColor ? (cellB.s.fgColor.rgb || '') : '';
        const fgC = cellC && cellC.s && cellC.s.fgColor ? (cellC.s.fgColor.rgb || '') : '';
        const esRojo = fgB.toUpperCase().includes('FF0000') || fgC.toUpperCase().includes('FF0000');

        if (ruc.length >= 10 && razonSocial) {
          clientes.push({
            id: `excel_${i}_${ruc}`,
            razonSocial,
            ruc,
            regimenTributario,
            usuario,
            clave,
            anio: '2026',
            mes: 'Agosto',
            esRojo: !!esRojo
          });
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, total: clientes.length, clientes }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  // 3. API: Encolar o ejecutar una empresa
  if (req.method === 'POST' && req.url === '/api/sire/execute') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const cliente = JSON.parse(body);
        const job = queueManager.enqueue(cliente);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, jobId: job.id, estado: job.estado }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // 4. API: Consultar estado de un trabajo
  if (req.method === 'GET' && req.url.startsWith('/api/job/status/')) {
    const jobId = req.url.split('/api/job/status/')[1];
    const job = jobs.get(jobId);
    if (!job) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Trabajo no encontrado' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      jobId: job.id,
      progreso: job.progreso,
      fase: job.fase,
      estado: job.estado,
      logs: job.logs,
      screenshot: job.screenshot,
      resultado: job.resultado
    }));
    return;
  }

  // 5. API: Cancelar un trabajo
  if (req.method === 'POST' && req.url.startsWith('/api/job/cancel/')) {
    const jobId = req.url.split('/api/job/cancel/')[1];
    const ok = queueManager.cancelJob(jobId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: ok }));
    return;
  }

  // 6. API: Detener todo
  if (req.method === 'POST' && req.url === '/api/queue/stop-all') {
    queueManager.cancelAll();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // 7. API: Consultar estado general de la cola
  if (req.method === 'GET' && req.url === '/api/queue/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, queue: queueManager.getStatus() }));
    return;
  }

  // 8. API: Resultados de auditoría
  if (req.method === 'GET' && req.url === '/api/rce/results') {
    let data = [];
    if (fs.existsSync(RESULTS_FILE)) {
      try { data = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8')); } catch (e) {}
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, total: data.length, registros: data }));
    return;
  }

  // 9. API: Exportar Excel consolidado
  if (req.method === 'GET' && req.url === '/api/rce/export-excel') {
    try {
      let registros = [];
      if (fs.existsSync(RESULTS_FILE)) {
        registros = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8'));
      }
      const wb = xlsx.utils.book_new();
      const resumenRows = registros.map((r, i) => ({
        'N°': i + 1,
        'RUC': r.ruc,
        'Periodo': `${r.periodo?.anio || '2026'} - ${r.periodo?.mes || 'AGO'}`,
        'Estado': r.estado,
        'Total Comprobantes': r.totalComprobantes || 0,
        'Fecha y Hora': r.fechaHora || '',
        'Mensaje': r.mensaje || ''
      }));
      const ws = xlsx.utils.json_to_sheet(resumenRows);
      xlsx.utils.book_append_sheet(wb, ws, 'Resumen RCE');
      const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.writeHead(200, {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="REPORTE_RCE_SUNAT.xlsx"'
      });
      res.end(buf);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  // 10. API: Test rápido de Claves SOL
  if (req.method === 'POST' && req.url === '/api/sunat/fast-check') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { clientes } = JSON.parse(body);
        const promesas = (clientes || []).map(c => validarCredencialSol(c.ruc, c.usuarioSol || c.usuario, c.claveSol || c.clave));
        const resultados = await Promise.all(promesas);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, resultados }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // 11. API: WhatsApp Estado
  if (req.method === 'GET' && req.url === '/api/whatsapp/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: whatsAppService.getStatus() }));
    return;
  }

  // 12. API: WhatsApp Grupos
  if (req.method === 'GET' && req.url === '/api/whatsapp/groups') {
    whatsAppService.refreshGroups().then(groups => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, groups }));
    }).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    });
    return;
  }

  // 13. API: WhatsApp Seleccionar Grupo
  if (req.method === 'POST' && req.url === '/api/whatsapp/select-group') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { groupId, groupName } = JSON.parse(body);
        whatsAppService.setSelectedGroup(groupId, groupName);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // Rutas no encontradas
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint no encontrado' }));
});

// =========================================================================
// HTML / CSS / JS EMBEBIDO PARA EL PANEL WEB TODO-EN-UNO
// =========================================================================
function getEmbeddedHTML() {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FACISAC - Panel Todo-en-Uno SUNAT RCE</title>
  <style>
    :root {
      --bg: #090d16;
      --card-bg: rgba(15, 23, 42, 0.75);
      --border: rgba(51, 65, 85, 0.6);
      --primary: #3b82f6;
      --primary-hover: #2563eb;
      --success: #10b981;
      --danger: #ef4444;
      --text: #f1f5f9;
      --text-muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      background: rgba(15, 23, 42, 0.9);
      border-bottom: 1px solid var(--border);
      backdrop-filter: blur(12px);
      position: sticky;
      top: 0;
      z-index: 50;
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand-icon {
      background: linear-gradient(135deg, #2563eb, #6366f1);
      width: 36px; height: 36px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      font-weight: bold; font-size: 18px; color: white;
    }
    .brand-title { font-size: 18px; font-weight: 700; }
    .badge {
      background: rgba(59, 130, 246, 0.15);
      color: #60a5fa;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 9999px;
      border: 1px solid rgba(59, 130, 246, 0.3);
    }
    .header-actions { display: flex; gap: 10px; align-items: center; }
    button {
      background: rgba(30, 41, 59, 0.8);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 7px 14px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }
    button:hover { background: rgba(51, 65, 85, 0.8); }
    button.primary { background: var(--primary); border-color: var(--primary); color: white; }
    button.primary:hover { background: var(--primary-hover); }
    button.success { background: rgba(16, 185, 129, 0.15); border-color: rgba(16, 185, 129, 0.3); color: #34d399; }
    button.success:hover { background: rgba(16, 185, 129, 0.25); }
    button.danger { background: rgba(239, 68, 68, 0.15); border-color: rgba(239, 68, 68, 0.3); color: #f87171; }
    button.danger:hover { background: rgba(239, 68, 68, 0.25); }

    main { max-width: 1400px; width: 100%; margin: 0 auto; padding: 24px; flex: 1; display: flex; flex-direction: column; gap: 20px; }
    
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
    .kpi-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .kpi-title { font-size: 12px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
    .kpi-value { font-size: 26px; font-weight: 700; color: white; }

    .period-bar {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 14px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
    .search-input {
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid var(--border);
      color: white;
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 13px;
      min-width: 280px;
    }
    .search-input:focus { outline: none; border-color: var(--primary); }

    .companies-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 16px;
    }
    .company-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      transition: transform 0.15s, border-color 0.15s;
    }
    .company-card:hover { border-color: rgba(59, 130, 246, 0.5); transform: translateY(-2px); }
    .company-card.rojo { border-left: 4px solid #ef4444; }
    .company-header { display: flex; justify-content: space-between; align-items: flex-start; }
    .company-name { font-size: 14px; font-weight: 600; line-height: 1.3; }
    .company-ruc { font-size: 12px; color: var(--text-muted); font-family: monospace; }
    .company-meta { display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); }
    .company-actions { display: flex; gap: 8px; margin-top: auto; }

    /* Modal */
    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(4px); display: none; align-items: center; justify-content: center; z-index: 100;
    }
    .modal-backdrop.open { display: flex; }
    .modal-box {
      background: #0f172a; border: 1px solid var(--border);
      border-radius: 16px; width: 90%; max-width: 600px;
      max-height: 85vh; display: flex; flex-direction: column; overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .modal-header { padding: 16px 20px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
    .modal-body { padding: 20px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 14px; }
    .log-terminal {
      background: #050811; border: 1px solid #1e293b; border-radius: 8px; padding: 12px;
      font-family: monospace; font-size: 11px; height: 200px; overflow-y: auto; color: #a5b4fc;
    }
    .progress-bar-bg { width: 100%; height: 8px; background: #1e293b; border-radius: 4px; overflow: hidden; }
    .progress-bar-fill { height: 100%; width: 0%; background: var(--primary); transition: width 0.3s; }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <div class="brand-icon">F</div>
      <div>
        <div class="brand-title">FACISAC <span class="badge">TODO-EN-UNO</span></div>
        <div style="font-size: 11px; color: var(--text-muted);">Automatizador RCE SUNAT & SIRE 2026</div>
      </div>
    </div>
    <div class="header-actions">
      <button class="success" onclick="abrirModalWhatsApp()">💬 WhatsApp Grupo</button>
      <button onclick="ejecutarTestClaves()">🔑 Test Claves SOL</button>
      <button onclick="descargarExcel()">📥 Exportar Excel</button>
      <button class="danger" onclick="detenerTodo()">⏹ Detener Todo</button>
      <button class="primary" onclick="procesarSeleccionados()">🚀 Procesar Todo</button>
    </div>
  </header>

  <main>
    <!-- KPIs -->
    <div class="kpis">
      <div class="kpi-card">
        <div class="kpi-title">Total Empresas</div>
        <div class="kpi-value" id="kpi-total">0</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Libros Verificados (0.00)</div>
        <div class="kpi-value" style="color: #34d399;" id="kpi-verificados">0</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Pendientes / Alertas</div>
        <div class="kpi-value" style="color: #f87171;" id="kpi-alertas">0</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Periodo Activo</div>
        <div class="kpi-value" style="font-size: 20px; color: #60a5fa;">Agosto 2026</div>
      </div>
    </div>

    <!-- Barra de Búsqueda y Filtros -->
    <div class="period-bar">
      <input type="text" class="search-input" id="search" placeholder="🔍 Buscar por RUC o Razón Social..." oninput="filtrarEmpresas()">
      <div style="display: flex; gap: 8px;">
        <button onclick="filtrarTab('todos')">Todos</button>
        <button onclick="filtrarTab('verificados')">Verificados</button>
        <button onclick="filtrarTab('pendientes')">Pendientes</button>
      </div>
    </div>

    <!-- Cuadrícula de Empresas -->
    <div class="companies-grid" id="companies-list">
      <div style="padding: 40px; text-align: center; grid-column: 1/-1; color: var(--text-muted);">
        Cargando cartera de clientes desde el archivo oficial...
      </div>
    </div>
  </main>

  <!-- Modal de Ejecución en Vivo -->
  <div class="modal-backdrop" id="modal-exec">
    <div class="modal-box">
      <div class="modal-header">
        <span style="font-weight: 700; font-size: 15px;" id="exec-title">Ejecución en Curso</span>
        <button onclick="cerrarModalExec()">✕</button>
      </div>
      <div class="modal-body">
        <div style="font-size: 13px; font-weight: 600;" id="exec-phase">Iniciando...</div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" id="exec-bar"></div>
        </div>
        <div class="log-terminal" id="exec-logs"></div>
      </div>
    </div>
  </div>

  <!-- Modal de WhatsApp -->
  <div class="modal-backdrop" id="modal-wa">
    <div class="modal-box">
      <div class="modal-header">
        <span style="font-weight: 700; font-size: 15px;">Vinculación de WhatsApp</span>
        <button onclick="cerrarModalWhatsApp()">✕</button>
      </div>
      <div class="modal-body" style="text-align: center;" id="wa-body">
        <p style="font-size: 12px; color: var(--text-muted);">Cargando estado de WhatsApp...</p>
      </div>
    </div>
  </div>

  <script>
    let clientes = [];
    let resultados = [];
    let filtroTab = 'todos';
    let pollingInterval = null;

    // Cronograma oficial SUNAT para presentación (Último dígito RUC)
    const CRONOGRAMA = { '0': 14, '1': 15, '2': 16, '3': 16, '4': 17, '5': 17, '6': 18, '7': 18, '8': 21, '9': 21 };

    async function init() {
      await cargarClientes();
      await cargarResultados();
      renderEmpresas();
    }

    async function cargarClientes() {
      try {
        const res = await fetch('/api/excel/import-clients');
        const json = await res.json();
        if (json.success && json.clientes) {
          clientes = json.clientes;
        }
      } catch (e) {
        console.error('Error cargando clientes:', e);
      }
    }

    async function cargarResultados() {
      try {
        const res = await fetch('/api/rce/results');
        const json = await res.json();
        if (json.success && json.registros) {
          resultados = json.registros;
        }
      } catch (e) {
        console.error('Error cargando resultados:', e);
      }
    }

    function renderEmpresas() {
      const listEl = document.getElementById('companies-list');
      const searchVal = document.getElementById('search').value.toLowerCase().trim();

      const filtered = clientes.filter(c => {
        const matchSearch = c.razonSocial.toLowerCase().includes(searchVal) || c.ruc.includes(searchVal);
        const res = resultados.find(r => r.ruc === c.ruc);
        const isVerificado = res && (res.estado === 'SIN_MODIFICACIONES' || res.estado === 'MODIFICADO_EXITOSO');

        if (filtroTab === 'verificados') return matchSearch && isVerificado;
        if (filtroTab === 'pendientes') return matchSearch && !isVerificado;
        return matchSearch;
      });

      // Actualizar KPIs
      document.getElementById('kpi-total').innerText = clientes.length;
      const countVerif = clientes.filter(c => resultados.some(r => r.ruc === c.ruc && (r.estado === 'SIN_MODIFICACIONES' || r.estado === 'MODIFICADO_EXITOSO'))).length;
      document.getElementById('kpi-verificados').innerText = countVerif;
      document.getElementById('kpi-alertas').innerText = clientes.length - countVerif;

      if (filtered.length === 0) {
        listEl.innerHTML = '<div style="padding: 40px; text-align: center; grid-column: 1/-1; color: var(--text-muted);">No se encontraron empresas con ese filtro.</div>';
        return;
      }

      listEl.innerHTML = filtered.map(c => {
        const res = resultados.find(r => r.ruc === c.ruc);
        const ultimoDigito = c.ruc.slice(-1);
        const diaVence = CRONOGRAMA[ultimoDigito] || 15;
        const estadoTag = res ? res.estado : 'PENDIENTE';
        const isOk = res && (res.estado === 'SIN_MODIFICACIONES' || res.estado === 'MODIFICADO_EXITOSO');

        return \`
          <div class="company-card \${c.esRojo ? 'rojo' : ''}">
            <div class="company-header">
              <div>
                <div class="company-name">\${c.razonSocial}</div>
                <div class="company-ruc">RUC: \${c.ruc}</div>
              </div>
              <span class="badge" style="background: \${isOk ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}; color: \${isOk ? '#34d399' : '#f87171'}; border-color: \${isOk ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'};">
                \${isOk ? 'VERIFICADO (0.00)' : 'PENDIENTE'}
              </span>
            </div>
            <div class="company-meta">
              <span>Vencimiento: <strong>\${diaVence} Sept</strong></span>
              <span>Régimen: \${c.regimenTributario || 'GENERAL'}</span>
            </div>
            <div class="company-actions">
              <button class="primary" style="flex: 1;" onclick="ejecutarEmpresa('\${c.ruc}')">▶ Procesar RCE</button>
            </div>
          </div>
        \`;
      }).join('');
    }

    function filtrarEmpresas() { renderEmpresas(); }
    function filtrarTab(tab) { filtroTab = tab; renderEmpresas(); }

    async function ejecutarEmpresa(ruc) {
      const c = clientes.find(x => x.ruc === ruc);
      if (!c) return;
      abrirModalExec(c.razonSocial);

      try {
        const res = await fetch('/api/sire/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(c)
        });
        const json = await res.json();
        if (json.success && json.jobId) {
          monitorearJob(json.jobId);
        }
      } catch (e) {
        alert('Error al iniciar: ' + e.message);
      }
    }

    async function procesarSeleccionados() {
      if (!confirm(\`¿Deseas procesar todas las \${clientes.length} empresas en cola secuencial?\`)) return;
      for (const c of clientes) {
        await fetch('/api/sire/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(c)
        });
      }
      alert('Todas las empresas han sido agregadas a la cola de procesamiento.');
    }

    function monitorearJob(jobId) {
      if (pollingInterval) clearInterval(pollingInterval);
      pollingInterval = setInterval(async () => {
        try {
          const res = await fetch('/api/job/status/' + jobId);
          const job = await res.json();
          if (job.success) {
            document.getElementById('exec-phase').innerText = job.fase || 'Procesando...';
            document.getElementById('exec-bar').style.width = (job.progreso || 10) + '%';
            document.getElementById('exec-logs').innerHTML = (job.logs || []).map(l => '<div>' + l + '</div>').join('');
            document.getElementById('exec-logs').scrollTop = document.getElementById('exec-logs').scrollHeight;

            if (job.estado === 'COMPLETADO' || job.estado === 'ERROR' || job.estado === 'CANCELADO') {
              clearInterval(pollingInterval);
              await cargarResultados();
              renderEmpresas();
            }
          }
        } catch (e) {}
      }, 1500);
    }

    function abrirModalExec(nombre) {
      document.getElementById('exec-title').innerText = nombre;
      document.getElementById('modal-exec').classList.add('open');
    }
    function cerrarModalExec() {
      document.getElementById('modal-exec').classList.remove('open');
      if (pollingInterval) clearInterval(pollingInterval);
    }

    async function abrirModalWhatsApp() {
      document.getElementById('modal-wa').classList.add('open');
      const body = document.getElementById('wa-body');
      body.innerHTML = '<p>Consultando sesión de WhatsApp...</p>';

      try {
        const res = await fetch('/api/whatsapp/status');
        const json = await res.json();
        if (json.success && json.data) {
          if (json.data.isConnected) {
            body.innerHTML = \`
              <div style="color: #34d399; font-size: 16px; font-weight: 700;">✅ WhatsApp Conectado</div>
              <p style="font-size: 12px; color: var(--text-muted); margin-top: 6px;">Grupo Destino: \${json.data.selectedGroupName || 'Ninguno'}</p>
            \`;
          } else if (json.data.qrDataUrl) {
            body.innerHTML = \`
              <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">Escanea este código QR desde tu celular (Dispositivos Vinculados):</p>
              <img src="\${json.data.qrDataUrl}" style="width: 250px; height: 250px; border-radius: 8px; border: 2px solid #334155;">
            \`;
          } else {
            body.innerHTML = '<p style="color: var(--text-muted);">Generando código QR, por favor espera 3 segundos...</p>';
          }
        }
      } catch (e) {
        body.innerHTML = '<p style="color: #f87171;">Error al consultar WhatsApp: ' + e.message + '</p>';
      }
    }
    function cerrarModalWhatsApp() { document.getElementById('modal-wa').classList.remove('open'); }

    async function ejecutarTestClaves() {
      alert('Iniciando Fast Check directo con pasarela de SUNAT en segundo plano...');
      const payload = clientes.map(c => ({ ruc: c.ruc, usuarioSol: c.usuario, claveSol: c.clave }));
      const res = await fetch('/api/sunat/fast-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientes: payload })
      });
      const data = await res.json();
      if (data.success) {
        const validas = data.resultados.filter(r => r.valido).length;
        alert(\`Test Finalizado: \${validas} de \${data.resultados.length} Claves SOL validadas con éxito en SUNAT.\`);
      }
    }

    function descargarExcel() {
      window.open('/api/rce/export-excel', '_blank');
    }

    async function detenerTodo() {
      if (!confirm('¿Deseas detener todas las tareas activas y limpiar la cola?')) return;
      await fetch('/api/queue/stop-all', { method: 'POST' });
      alert('Todas las tareas han sido detenidas.');
      cerrarModalExec();
    }

    window.onload = init;
  </script>
</body>
</html>`;
}

// Iniciar servidor y abrir navegador automáticamente
server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 FACISAC SISTEMA UNIFICADO TODO-EN-UNO OPERATIVO`);
  console.log(`👉 Panel de Control en: http://localhost:${PORT}`);
  console.log(`======================================================\n`);

  // Abrir navegador automáticamente en Windows
  if (process.platform === 'win32') {
    exec(`start http://localhost:${PORT}`);
  }
});
