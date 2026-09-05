/**
 * audit_exporter.js
 * Almacena y consolida la carpeta de evidencias de auditoría y constancias RCE para cada empresa.
 */

const fs = require('fs');
const path = require('path');

const AUDIT_BASE_DIR = path.join(__dirname, 'auditoria_rce');

class AuditExporter {
  constructor() {
    if (!fs.existsSync(AUDIT_BASE_DIR)) {
      fs.mkdirSync(AUDIT_BASE_DIR, { recursive: true });
    }
  }

  getCompanyAuditDir(ruc, anio, mes, razonSocial = '') {
    const safeRazon = (razonSocial || 'EMPRESA').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
    const periodoFolder = `${anio || '2026'}_${(mes || 'AGO').toUpperCase()}`;
    const dir = path.join(AUDIT_BASE_DIR, periodoFolder, `${ruc}_${safeRazon}`);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  saveAuditTrail(cliente, datosAntes, datosDespues, resultado) {
    try {
      const dir = this.getCompanyAuditDir(cliente.ruc, cliente.anio, cliente.mes, cliente.razonSocial);
      const auditPayload = {
        empresa: {
          ruc: cliente.ruc,
          razonSocial: cliente.razonSocial,
          regimenTributario: cliente.regimenTributario
        },
        periodo: {
          anio: cliente.anio || '2026',
          mes: cliente.mes || 'Agosto'
        },
        fechaAuditoria: new Date().toISOString(),
        dobleVerificacionConforme: resultado.estado === 'SIN_MODIFICACIONES' || resultado.estado === 'MODIFICADO_EXITOSO',
        saldoFinal: {
          baseImponibleGravada: "0.00",
          igvGravado: "0.00"
        },
        resultado,
        evidencia: {
          antes: datosAntes || null,
          despues: datosDespues || null
        }
      };

      const filepath = path.join(dir, 'evidencia_auditoria.json');
      fs.writeFileSync(filepath, JSON.stringify(auditPayload, null, 2), 'utf8');

      console.log(`[AUDIT] Evidencia guardada para RUC ${cliente.ruc} en: ${filepath}`);
      return filepath;
    } catch (e) {
      console.warn(`[AUDIT] Error guardando evidencia de auditoría:`, e.message);
      return null;
    }
  }

  hasAuditEvidence(ruc, anio, mes) {
    const periodoFolder = `${anio || '2026'}_${(mes || 'AGO').toUpperCase()}`;
    const parentDir = path.join(AUDIT_BASE_DIR, periodoFolder);
    if (!fs.existsSync(parentDir)) return false;

    const matches = fs.readdirSync(parentDir).filter(name => name.startsWith(ruc));
    return matches.length > 0;
  }
}

const auditExporter = new AuditExporter();

module.exports = {
  auditExporter,
  AuditExporter
};
