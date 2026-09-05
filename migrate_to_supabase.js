/**
 * migrate_to_supabase.js
 * Sube automáticamente la cartera de clientes del Excel y el historial de resultados
 * directamente a las tablas de Supabase.
 */

const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const { supabase } = require('./supabase_client');

async function migrarDatos() {
  console.log('🚀 Iniciando migración de datos hacia Supabase...');

  // 1. Extraer Clientes desde el Excel principal
  const excelPath = path.join(__dirname, 'CLAVE SOL - CLIENTES  -  ACTUALIZADO JULIO - 2026.xlsm');
  if (!fs.existsSync(excelPath)) {
    console.error('❌ Archivo Excel no encontrado en la raíz.');
    return;
  }

  const workbook = xlsx.readFile(excelPath, { cellStyles: true });
  const sheetName = workbook.SheetNames.includes('CLIENTES') ? 'CLIENTES' : workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  const clientesParaSubir = [];
  for (let i = 8; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[1] || !row[2]) continue;

    const razonSocial = String(row[1]).trim();
    const ruc = String(row[2]).trim();
    const regimenTributario = row[3] ? String(row[3]).trim() : 'GENERAL';
    const usuario = row[5] ? String(row[5]).trim().toUpperCase() : '';
    const clave = row[6] ? String(row[6]).trim() : '';

    const excelRowNum = i + 1;
    const cellB = sheet['B' + excelRowNum];
    const cellC = sheet['C' + excelRowNum];
    const fgB = cellB && cellB.s && cellB.s.fgColor ? (cellB.s.fgColor.rgb || '') : '';
    const fgC = cellC && cellC.s && cellC.s.fgColor ? (cellC.s.fgColor.rgb || '') : '';
    const esRojo = fgB.toUpperCase().includes('FF0000') || fgC.toUpperCase().includes('FF0000');

    if (ruc.length >= 10 && razonSocial) {
      clientesParaSubir.push({
        id: `excel_${i}_${ruc}`,
        ruc,
        razon_social: razonSocial,
        regimen_tributario: regimenTributario,
        usuario_sol: usuario,
        clave_sol: clave,
        es_rojo: esRojo,
        anio_periodo: '2026',
        mes_periodo: 'Agosto'
      });
    }
  }

  console.log(`📋 Encontradas ${clientesParaSubir.length} empresas en el Excel. Subiendo a Supabase...`);

  // Subir clientes a Supabase con upsert por RUC
  const { data: dataClientes, error: errorClientes } = await supabase
    .from('clientes')
    .upsert(clientesParaSubir, { onConflict: 'ruc' });

  if (errorClientes) {
    console.error('❌ Error subiendo clientes a Supabase:', errorClientes.message);
    return;
  }
  console.log(`✅ ¡${clientesParaSubir.length} clientes migrados a la tabla 'clientes' en Supabase!`);

  // 2. Extraer Resultados de Auditoría previos desde registro_rce_resultados.json
  const resultsPath = path.join(__dirname, 'registro_rce_resultados.json');
  if (fs.existsSync(resultsPath)) {
    try {
      const raw = fs.readFileSync(resultsPath, 'utf8');
      const resultadosLocales = JSON.parse(raw) || [];

      if (Array.isArray(resultadosLocales) && resultadosLocales.length > 0) {
        console.log(`📊 Migrando ${resultadosLocales.length} registros de auditoría previos...`);

        const auditoriasParaSubir = resultadosLocales.map(r => ({
          ruc: r.ruc,
          razon_social: r.razonSocial || null,
          anio: r.periodo?.anio || '2026',
          mes: r.periodo?.mes || 'AGO',
          estado: r.estado || 'SIN_MODIFICACIONES',
          total_comprobantes: r.totalComprobantes || 0,
          comprobantes_modificados: r.comprobantesModificados || [],
          aviso_sunat: r.avisoSunat || null,
          mensaje: r.mensaje || null,
          fecha_hora: r.fechaHora || new Date().toLocaleString(),
          doble_verificacion: true
        }));

        const { error: errorAuditorias } = await supabase
          .from('auditorias_rce')
          .upsert(auditoriasParaSubir, { onConflict: 'ruc, anio, mes' });

        if (errorAuditorias) {
          console.warn('⚠️ Error subiendo historial de auditorías:', errorAuditorias.message);
        } else {
          console.log(`✅ ¡Historial de auditorías migrado exitosamente a 'auditorias_rce' en Supabase!`);
        }
      }
    } catch (e) {
      console.warn('Error leyendo registro_rce_resultados.json:', e.message);
    }
  }

  console.log('\n🎉 MIGRACIÓN COMPLETA A SUPABASE FINALIZADA CON ÉXITO.\n');
}

if (require.main === module) {
  migrarDatos();
}

module.exports = { migrarDatos };
