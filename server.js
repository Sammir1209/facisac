const http = require('http');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { ejecutarPaso1Login } = require('./login_automator');
const { circuitBreaker } = require('./circuit_breaker');
const { validarCredencialSol, validarLoteCredenciales } = require('./sunat_fast_checker');
const { whatsAppService } = require('./whatsapp_service');
const { auditExporter } = require('./audit_exporter');
const { supabase } = require('./supabase_client');

const PORT = process.env.PORT || 3000;
const RESULTS_FILE = path.join(__dirname, 'registro_rce_resultados.json');

// Iniciar WhatsApp Service en segundo plano
whatsAppService.init().catch(err => console.warn('[WA] No se pudo iniciar de inmediato:', err.message));

// Blindaje contra errores de protocolo o páginas cerradas en Playwright
process.on('uncaughtException', (err) => {
  if (err.message && (err.message.includes('Protocol error') || err.message.includes('Target page, context or browser has been closed') || err.message.includes('closed'))) {
    console.warn(`[WARN] Excepción controlada de navegador: ${err.message}`);
    return;
  }
  console.error(`[ERROR NO CONTROLADO]`, err);
});

process.on('unhandledRejection', (reason) => {
  console.warn(`[WARN] Rechazo de promesa no manejado:`, reason);
});

// Almacén en memoria de trabajos activos
const jobs = new Map();

// ==========================================
// SISTEMA DE COLA INTELIGENTE (QUEUE MANAGER)
// ==========================================
class QueueManager {
  constructor(maxConcurrency = 2) {
    this.maxConcurrency = maxConcurrency;
    this.queue = [];
    this.runningCount = 0;
    this.isPaused = false;
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
      logs: [`[${new Date().toLocaleTimeString()}] Tarea agregada a la cola de procesamiento`],
      screenshot: null,
      resultado: null,
      creadoEn: new Date(),
      iniciadoEn: null,
      finalizadoEn: null,
      abortController,
      browserInstance: null
    };

    jobs.set(jobId, job);
    this.queue.push(job);
    this.processNext();
    return job;
  }

  cancelJob(jobId) {
    const job = jobs.get(jobId);
    if (!job) return false;

    // Si aún está en la cola pendiente
    const idx = this.queue.findIndex(j => j.id === jobId);
    if (idx !== -1) {
      this.queue.splice(idx, 1);
      job.estado = 'CANCELADO';
      job.fase = 'Cancelado antes de iniciar';
      job.logs.push(`[${new Date().toLocaleTimeString()}] 🛑 Tarea removida de la cola por el usuario.`);
      return true;
    }

    // Si está ejecutándose actualmente
    if (job.estado === 'PROCESANDO') {
      job.estado = 'CANCELADO';
      job.fase = 'Cancelado por el usuario';
      if (job.abortController) {
        job.abortController.abort();
      }
      if (job.browserInstance) {
        try { job.browserInstance.close().catch(() => {}); } catch(e) {}
      }
      job.logs.push(`[${new Date().toLocaleTimeString()}] 🛑 Tarea detenida en caliente por el usuario.`);
      return true;
    }

    return false;
  }

  cancelAll() {
    // Cancelar en cola
    while (this.queue.length > 0) {
      const j = this.queue.shift();
      j.estado = 'CANCELADO';
      j.fase = 'Cancelado por parada global';
    }

    // Cancelar activos
    for (const job of jobs.values()) {
      if (job.estado === 'PROCESANDO') {
        job.estado = 'CANCELADO';
        job.fase = 'Detenido por parada global';
        if (job.abortController) job.abortController.abort();
        if (job.browserInstance) {
          try { job.browserInstance.close().catch(() => {}); } catch(e) {}
        }
      }
    }
  }

  async processNext() {
    if (this.isPaused) return;
    if (this.runningCount >= this.maxConcurrency) return;
    if (this.queue.length === 0) return;

    const job = this.queue.shift();
    if (!job || job.estado === 'CANCELADO') {
      this.processNext();
      return;
    }

    this.runningCount++;
    job.estado = 'PROCESANDO';
    job.fase = 'Iniciando Navegador';
    job.iniciadoEn = new Date();
    job.progreso = 5;

    const updateLog = (msg) => {
      const timestamp = new Date().toLocaleTimeString();
      const entry = `[${timestamp}] ${msg}`;
      console.log(`[${job.cliente.ruc || 'SUNAT'}] ${entry}`);
      job.logs.push(entry);
      if (job.logs.length > 100) job.logs.shift();

      // Detección de fases para la barra de progreso
      if (msg.includes("Navegando a la pasarela") || msg.includes("Rellenando")) {
        job.progreso = 15;
        job.fase = "Autenticación SOL";
      } else if (msg.includes("Sesión autenticada")) {
        job.progreso = 30;
        job.fase = "Menús SIRE";
      } else if (msg.includes("Gestion de Compras")) {
        job.progreso = 50;
        job.fase = "Selección de Periodo";
      } else if (msg.includes("confirmado en el control") || msg.includes("Botón 'Aceptar' presionado")) {
        job.progreso = 70;
        job.fase = "Accediendo a la Propuesta";
      } else if (msg.includes("Ubicado en la tabla") || msg.includes("Escaneando tabla")) {
        job.progreso = 85;
        job.fase = "Revisión de Comprobantes";
      } else if (msg.includes("NO HAY COMPROBANTES") || msg.includes("modificados satisfactoriamente")) {
        job.progreso = 95;
        job.fase = "Cerrando Sesión";
      } else if (msg.includes("Cerrada completamente") || msg.includes("completado y ventana cerrada")) {
        job.progreso = 100;
        job.fase = "Finalizado con Éxito";
        job.estado = "COMPLETADO";
      }
    };

    try {
      // 1. Verificación previa con Circuit Breaker
      if (!circuitBreaker.isAvailable()) {
        const cooldown = circuitBreaker.getRemainingCooldownSeconds();
        updateLog(`[CIRCUIT BREAKER] Pausa activa por saturación previa de SUNAT. Esperando ${cooldown}s antes de reintentar...`);
        await new Promise(res => setTimeout(res, Math.min(cooldown * 1000, 15000)));
      }

      updateLog(`Iniciando tarea para ${job.cliente.razonSocial || job.cliente.ruc} (Periodo: ${job.cliente.anio || '2026'} / ${job.cliente.mes || 'Agosto'})`);
      
      const resultado = await ejecutarPaso1Login({
        ruc: job.cliente.ruc,
        usuario: job.cliente.usuario,
        clave: job.cliente.clave,
        anio: job.cliente.anio || '2026',
        mes: job.cliente.mes || 'Agosto'
      }, updateLog, {
        abortSignal: job.abortController.signal,
        onBrowserCreated: (browser) => {
          job.browserInstance = browser;
        }
      });

      if (job.estado !== 'CANCELADO') {
        job.resultado = resultado;
        job.progreso = 100;
        job.estado = "COMPLETADO";
        job.fase = "Finalizado con Éxito";
        if (resultado && resultado.screenshot) {
          job.screenshot = resultado.screenshot;
        }

        // Registrar éxito en Circuit Breaker
        circuitBreaker.recordSuccess();

        // Guardar evidencia formal en carpeta de auditoría
        auditExporter.saveAuditTrail(job.cliente, null, null, resultado);

        // Sincronizar automáticamente en la tabla auditorias_rce de Supabase
        supabase.from('auditorias_rce').upsert({
          ruc: job.cliente.ruc,
          razon_social: job.cliente.razonSocial || null,
          anio: job.cliente.anio || '2026',
          mes: job.cliente.mes || 'Agosto',
          estado: resultado.estado || 'SIN_MODIFICACIONES',
          total_comprobantes: resultado.totalComprobantes || 0,
          comprobantes_modificados: resultado.comprobantesModificados || [],
          mensaje: resultado.mensaje || null,
          fecha_hora: new Date().toLocaleString(),
          doble_verificacion: true
        }, { onConflict: 'ruc, anio, mes' }).then(({ error }) => {
          if (error) console.warn('[SUPABASE] No se pudo sincronizar auditoría:', error.message);
          else console.log(`[SUPABASE] Auditoría de ${job.cliente.ruc} sincronizada en la nube.`);
        }).catch(() => {});

        // Enviar notificación limpia y ejecutiva a Grupo de WhatsApp
        const estadoCorto = resultado.estado === 'SIN_MODIFICACIONES' 
          ? 'OK (0.00 verificado)' 
          : resultado.estado === 'MODIFICADO_EXITOSO' 
          ? `AJUSTADO A 0.00 (${resultado.comprobantesModificados?.length || 0} comprobantes)`
          : resultado.estado;

        const mensajeWa = `*RCE SUNAT: ${job.cliente.ruc}*\n` +
          `${job.cliente.razonSocial}\n` +
          `• *Periodo:* ${job.cliente.mes || 'Agosto'} ${job.cliente.anio || '2026'}\n` +
          `• *Estado:* ${estadoCorto}\n` +
          `• *Hora:* ${new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`;

        whatsAppService.sendGroupMessage(mensajeWa).catch(() => {});
      }
    } catch (err) {
      if (job.estado !== 'CANCELADO') {
        job.estado = "ERROR";
        job.fase = "Error en Ejecución";
        updateLog(`[ERROR] ${err.message}`);

        // Registrar fallo en Circuit Breaker
        circuitBreaker.recordFailure(err);

        // Notificar incidencia de forma concisa al Grupo
        const mensajeErrorWa = `*ALERTA SUNAT: ${job.cliente.ruc}*\n` +
          `${job.cliente.razonSocial || 'EMPRESA'}\n` +
          `• *Incidencia:* ${err.message.substring(0, 100)}\n` +
          `• *Hora:* ${new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`;

        whatsAppService.sendGroupMessage(mensajeErrorWa).catch(() => {});
      }
    } finally {
      job.finalizadoEn = new Date();
      this.runningCount--;
      // Procesar el siguiente en la cola
      setTimeout(() => this.processNext(), 800);
    }
  }

  getStatus() {
    return {
      enCola: this.queue.length,
      enEjecucion: this.runningCount,
      maxConcurrency: this.maxConcurrency
    };
  }
}

const queueManager = new QueueManager(1); // 1 navegador a la vez por defecto para máxima estabilidad con SUNAT

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 0. API: Subir archivo Excel personalizado y validar estructura obligatoria
  if (req.method === 'POST' && req.url === '/api/excel/upload-parse') {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      try {
        const buffer = Buffer.concat(chunks);
        if (!buffer || buffer.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'No se recibió ningún archivo' }));
          return;
        }

        const workbook = xlsx.read(buffer, { type: 'buffer' });
        let clientesExtraidos = [];
        let camposValidados = false;
        let detalleColumnas = {};

        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
          if (!rows || rows.length < 5) continue;

          let headerRowIdx = -1;
          let colIdxRazon = -1;
          let colIdxRuc = -1;
          let colIdxUser = -1;
          let colIdxClave = -1;

          for (let r = 0; r < Math.min(rows.length, 25); r++) {
            const row = rows[r];
            if (!row || !Array.isArray(row)) continue;

            row.forEach((cell, idx) => {
              if (!cell) return;
              const text = String(cell).toUpperCase().trim();
              if (text.includes('RAZÓN SOCIAL') || text.includes('RAZON SOCIAL') || text.includes('APELLIDOS Y NOMBRES') || text.includes('CLIENTE')) {
                colIdxRazon = idx;
              }
              if (text === 'RUC' || text.includes('NUMERO RUC') || text.includes('NRO RUC') || text.includes('NUM RUC')) {
                colIdxRuc = idx;
              }
              if (text.includes('USUARIO') || text.includes('USER')) {
                if (colIdxUser === -1) colIdxUser = idx;
              }
              if (text.includes('CLAVE') || text.includes('PASSWORD') || text.includes('CONTRASENA')) {
                if (colIdxClave === -1) colIdxClave = idx;
              }
            });

            if (colIdxRazon !== -1 && colIdxRuc !== -1) {
              headerRowIdx = r;
              break;
            }
          }

          if (headerRowIdx !== -1 && colIdxRazon !== -1 && colIdxRuc !== -1) {
            if (colIdxUser === -1) colIdxUser = 5;
            if (colIdxClave === -1) colIdxClave = 6;

            camposValidados = true;
            detalleColumnas = {
              hoja: sheetName,
              columnaRazonSocial: colIdxRazon,
              columnaRuc: colIdxRuc,
              columnaUsuario: colIdxUser,
              columnaClave: colIdxClave
            };

            for (let i = headerRowIdx + 1; i < rows.length; i++) {
              const row = rows[i];
              if (!row) continue;

              const razonSocial = row[colIdxRazon] ? String(row[colIdxRazon]).trim() : '';
              const ruc = row[colIdxRuc] ? String(row[colIdxRuc]).trim() : '';
              const regimenTributario = row[3] ? String(row[3]).trim() : '';
              const usuario = row[colIdxUser] ? String(row[colIdxUser]).trim().toUpperCase() : '';
              const clave = row[colIdxClave] ? String(row[colIdxClave]).trim() : '';

              if (ruc.length >= 10 && razonSocial && !razonSocial.toUpperCase().includes('TOTAL')) {
                clientesExtraidos.push({
                  id: `upload_${i}_${ruc}`,
                  razonSocial,
                  ruc,
                  regimenTributario,
                  usuario,
                  clave,
                  anio: '2026',
                  mes: 'Agosto'
                });
              }
            }
            if (clientesExtraidos.length > 0) break;
          }
        }

        if (!camposValidados || clientesExtraidos.length === 0) {
          res.writeHead(422, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: 'El archivo Excel seleccionado no contiene las columnas requeridas: [RAZÓN SOCIAL/APELLIDOS Y NOMBRES], [RUC], [USUARIO SOL] y [CLAVE SOL].'
          }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          mensaje: `Archivo validado exitosamente en la hoja '${detalleColumnas.hoja}'.`,
          total: clientesExtraidos.length,
          clientes: clientesExtraidos
        }));

      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Error al procesar el archivo Excel: ' + err.message }));
      }
    });
    return;
  }

  // Importar desde el Excel por defecto con detección de estilo en Rojo
  if (req.method === 'GET' && req.url === '/api/excel/import-clients') {
    try {
      const excelPath = path.join(__dirname, 'CLAVE SOL - CLIENTES  -  ACTUALIZADO JULIO - 2026.xlsm');
      if (!fs.existsSync(excelPath)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Archivo Excel no encontrado en la raíz del proyecto' }));
        return;
      }

      const workbook = xlsx.readFile(excelPath, { cellStyles: true });
      const sheetName = workbook.SheetNames.includes('CLIENTES') ? 'CLIENTES' : workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

      const clientesExtraidos = [];
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
          clientesExtraidos.push({
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
      res.end(JSON.stringify({
        success: true,
        total: clientesExtraidos.length,
        clientes: clientesExtraidos
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Error al leer archivo Excel: ' + err.message }));
    }
    return;
  }

  // Endpoint para consultar o descargar registro_rce_resultados.json
  if (req.method === 'GET' && req.url === '/api/rce/results') {
    if (!fs.existsSync(RESULTS_FILE)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, total: 0, registros: [] }));
      return;
    }

    try {
      const data = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, total: data.length, registros: data }));
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  // NUEVO: Exportar Reporte Ejecutivo completo en Formato Excel (.xlsx)
  if (req.method === 'GET' && req.url === '/api/rce/export-excel') {
    try {
      let registros = [];
      if (fs.existsSync(RESULTS_FILE)) {
        registros = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8'));
      }

      const wb = xlsx.utils.book_new();

      // Hoja 1: Resumen de Auditoría por Empresa
      const resumenRows = registros.map((r, index) => {
        const totalCompMod = Array.isArray(r.comprobantesModificados) ? r.comprobantesModificados.length : 0;
        const totalBiAjustada = Array.isArray(r.comprobantesModificados) 
          ? r.comprobantesModificados.reduce((sum, item) => sum + Math.abs(Number(item.bi) || 0), 0) 
          : 0;
        const totalIgvAjustado = Array.isArray(r.comprobantesModificados) 
          ? r.comprobantesModificados.reduce((sum, item) => sum + Math.abs(Number(item.igv) || 0), 0) 
          : 0;

        return {
          'N°': index + 1,
          'RUC': r.ruc,
          'Periodo': `${r.periodo?.anio || '2026'} - ${r.periodo?.mes || 'AGO'}`,
          'Estado SUNAT': r.estado,
          'Total Comprobantes en Propuesta': r.totalComprobantes || 0,
          'Comprobantes Modificados a 0.00': totalCompMod,
          'Monto BI Ajustado (S/)': Number(totalBiAjustada.toFixed(2)),
          'Monto IGV Ajustado (S/)': Number(totalIgvAjustado.toFixed(2)),
          'Fecha / Hora Proceso': r.fechaHora || '',
          'Detalle / Mensaje': r.mensaje || ''
        };
      });

      const wsResumen = xlsx.utils.json_to_sheet(resumenRows);
      xlsx.utils.book_append_sheet(wb, wsResumen, 'Resumen RCE');

      // Hoja 2: Detalle Comprobante por Comprobante
      const detalleRows = [];
      registros.forEach(r => {
        if (Array.isArray(r.comprobantesModificados) && r.comprobantesModificados.length > 0) {
          r.comprobantesModificados.forEach(c => {
            detalleRows.push({
              'RUC Empresa': r.ruc,
              'Periodo': `${r.periodo?.anio || '2026'} - ${r.periodo?.mes || 'AGO'}`,
              'Fila SUNAT': c.indiceFila || '',
              'Documento / Serie': c.documento || '',
              'Base Imponible Original (BI)': c.bi || 0,
              'IGV Original': c.igv || 0,
              'Nuevo Saldo Gravado': 0.00,
              'Destino': 'Casilla No Gravada / Sin Crédito Fiscal',
              'Fecha Proceso': r.fechaHora || ''
            });
          });
        }
      });

      const wsDetalle = xlsx.utils.json_to_sheet(detalleRows.length > 0 ? detalleRows : [{ 'Mensaje': 'No hay comprobantes modificados registrados aún.' }]);
      xlsx.utils.book_append_sheet(wb, wsDetalle, 'Comprobantes Modificados');

      const excelBuffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.writeHead(200, {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="REPORTE_AUDITORIA_RCE_SUNAT.xlsx"'
      });
      res.end(excelBuffer);
      return;
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Error al generar Excel: ' + e.message }));
      return;
    }
  }

  // 1. API: Consultar estado y progreso de un Job específico
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

  // Compatibilidad con GET /api/job/:id
  if (req.method === 'GET' && req.url.startsWith('/api/job/') && !req.url.includes('/cancel')) {
    const jobId = req.url.split('/api/job/')[1];
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

  // NUEVO: Cancelar / Abortar un Job específico
  if (req.method === 'POST' && req.url.startsWith('/api/job/cancel/')) {
    const jobId = req.url.split('/api/job/cancel/')[1];
    const cancelado = queueManager.cancelJob(jobId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: cancelado, message: cancelado ? 'Tarea cancelada con éxito' : 'No se pudo cancelar o ya había terminado' }));
    return;
  }

  // NUEVO: Detener toda la cola activa
  if (req.method === 'POST' && req.url === '/api/queue/stop-all') {
    queueManager.cancelAll();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Todas las tareas en cola y en ejecución fueron detenidas.' }));
    return;
  }

  // NUEVO: Consultar estado de la cola
  if (req.method === 'GET' && req.url === '/api/queue/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, queue: queueManager.getStatus() }));
    return;
  }

  // 2. API: Encolar o ejecutar clientes
  if (req.method === 'POST' && req.url === '/api/sire/execute') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const cliente = JSON.parse(body);
        if (!cliente.ruc || !cliente.usuario || !cliente.clave) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Credenciales incompletas' }));
          return;
        }

        const job = queueManager.enqueue(cliente);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          jobId: job.id,
          estado: job.estado,
          message: `Automatización encolada para ${cliente.razonSocial || cliente.ruc}`
        }));

      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Compatibilidad de logs
  if (req.method === 'GET' && req.url === '/api/logs') {
    const lastJob = Array.from(jobs.values()).pop();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      logs: lastJob ? lastJob.logs : [],
      screenshot: lastJob ? lastJob.screenshot : null
    }));
    return;
  }

  // ==========================================
  // NUEVAS APIS: FAST CHECK, WHATSAPP Y CIRCUIT
  // ==========================================

  // 1. Estado y QR de WhatsApp Web
  if (req.method === 'GET' && req.url === '/api/whatsapp/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      data: whatsAppService.getStatus()
    }));
    return;
  }

  // 2. Desconectar sesión de WhatsApp
  if (req.method === 'POST' && req.url === '/api/whatsapp/disconnect') {
    whatsAppService.disconnect().then(result => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    });
    return;
  }

  // 3. Obtener lista de Grupos de WhatsApp
  if (req.method === 'GET' && req.url === '/api/whatsapp/groups') {
    whatsAppService.refreshGroups().then(groups => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        groups
      }));
    }).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    });
    return;
  }

  // 4. Seleccionar Grupo de WhatsApp para Notificaciones
  if (req.method === 'POST' && req.url === '/api/whatsapp/select-group') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { groupId, groupName } = JSON.parse(body);
        whatsAppService.setSelectedGroup(groupId, groupName);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: `Grupo ${groupName} configurado correctamente` }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // 5. Enviar mensaje de prueba al Grupo de WhatsApp
  if (req.method === 'POST' && req.url === '/api/whatsapp/test-message') {
    const msg = `*PRUEBA DE CONEXION FACISAC*\n` +
      `✅ El sistema de notificaciones de Libros RCE SUNAT se ha vinculado correctamente a este grupo.\n` +
      `⏰ Hora: ${new Date().toLocaleTimeString('es-PE')}`;

    whatsAppService.sendGroupMessage(msg).then(result => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    });
    return;
  }

  // 6. Pre-validación ultrarrápida de Clave SOL sin navegador (Fast Credential Check)
  if (req.method === 'POST' && req.url === '/api/sunat/fast-check') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const { clientes } = JSON.parse(body);
        if (!Array.isArray(clientes) || clientes.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Lista de clientes vacía' }));
          return;
        }

        const resultados = await validarLoteCredenciales(clientes, 4);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          resultados
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 7. Estado del Circuit Breaker de SUNAT
  if (req.method === 'GET' && req.url === '/api/sunat/circuit-status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      status: circuitBreaker.getStatus()
    }));
    return;
  }

  // Manejar favicon.ico silenciosamente
  if (req.url === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Redirigir la raíz al nuevo panel modular en puerto 3001
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(302, { 'Location': 'http://localhost:3001' });
    res.end();
    return;
  }

  // Rutas no encontradas
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint no encontrado' }));
});

server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 Servidor API Playwright Activo en: http://localhost:${PORT}`);
  console.log(`✨ Panel Modular (Next.js + HeroUI) en: http://localhost:3001`);
  console.log(`==================================================\n`);
});
