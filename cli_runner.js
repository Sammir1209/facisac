const fs = require('fs');
const path = require('path');
const readline = require('readline');
const xlsx = require('xlsx');
const { ejecutarPaso1Login } = require('./login_automator');

// Cargar clientes desde el archivo Excel oficial
function cargarClientesDesdeExcel() {
  const excelPath = path.join(__dirname, 'CLAVE SOL - CLIENTES  -  ACTUALIZADO JULIO - 2026.xlsm');
  if (!fs.existsSync(excelPath)) {
    console.error("❌ No se encontró el archivo Excel oficial.");
    return [];
  }

  const wb = xlsx.readFile(excelPath);
  const sheetName = wb.SheetNames.includes('CLIENTES') ? 'CLIENTES' : wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  const clientes = [];
  for (let i = 8; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[1] || !row[2]) continue;

    const razonSocial = String(row[1]).trim();
    const ruc = String(row[2]).trim().replace(/[^0-9]/g, '');
    const usuario = row[5] ? String(row[5]).trim().toUpperCase() : '';
    const clave = row[6] ? String(row[6]).trim() : '';

    if (ruc.length === 11 && usuario && clave) {
      clientes.push({
        id: (i + 1).toString(),
        razonSocial,
        ruc,
        usuario,
        clave,
        anio: '2026',
        mes: 'Agosto'
      });
    }
  }

  return clientes;
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function main() {
  console.log("\n=======================================================");
  console.log("   SISTEMA AUTOMATIZADO SUNAT RCE - MODO VISIBLE DIRECTO");
  console.log("=======================================================\n");

  const clientes = cargarClientesDesdeExcel();
  console.log(`📋 Se cargaron ${clientes.length} empresas desde el archivo Excel.\n`);

  console.log("Selecciona una opción:");
  console.log("1. Ejecutar BUILDINGS ENGINEERS EIRL (RUC: 20404383940)");
  console.log("2. Ejecutar SUPERMARKET EL GOOL SAC (RUC: 20602118640)");
  console.log("3. Ejecutar GUERRERO RENGIFO VALERIA (RUC: 10481217020)");
  console.log("4. Ejecutar FACI SERVICIOS GENERALES (RUC: 20603462476)");
  console.log("5. Elegir de la lista por número (1 a " + clientes.length + ")");
  console.log("6. Ejecutar TODAS las empresas una tras otra (Secuencial)");
  console.log("0. Salir\n");

  rl.question("Ingresa tu opción (1-6): ", async (opcion) => {
    let seleccionados = [];

    if (opcion === '1') {
      const c = clientes.find(x => x.ruc === '20404383940');
      if (c) seleccionados.push(c);
    } else if (opcion === '2') {
      const c = clientes.find(x => x.ruc === '20602118640');
      if (c) seleccionados.push(c);
    } else if (opcion === '3') {
      const c = clientes.find(x => x.ruc === '10481217020');
      if (c) seleccionados.push(c);
    } else if (opcion === '4') {
      const c = clientes.find(x => x.ruc === '20603462476');
      if (c) seleccionados.push(c);
    } else if (opcion === '6') {
      seleccionados = clientes;
    } else if (opcion === '5') {
      rl.question(`Ingresa el número de empresa (1 - ${clientes.length}): `, async (numStr) => {
        const n = parseInt(numStr, 10);
        if (n >= 1 && n <= clientes.length) {
          await procesarLista([clientes[n - 1]]);
        } else {
          console.log("❌ Número inválido.");
        }
        rl.close();
      });
      return;
    } else {
      console.log("Saliendo...");
      rl.close();
      return;
    }

    if (seleccionados.length > 0) {
      await procesarLista(seleccionados);
    } else {
      console.log("❌ No se encontró la empresa solicitada.");
    }
    rl.close();
  });
}

async function procesarLista(lista) {
  for (let i = 0; i < lista.length; i++) {
    const c = lista[i];
    console.log(`\n-----------------------------------------------------------`);
    console.log(`🚀 [${i + 1}/${lista.length}] PROCESANDO: ${c.razonSocial} | RUC: ${c.ruc}`);
    console.log(`-----------------------------------------------------------`);

    try {
      await ejecutarPaso1Login({
        ruc: c.ruc,
        usuario: c.usuario,
        clave: c.clave,
        anio: c.anio || '2026',
        mes: c.mes || 'Agosto'
      }, (logMsg) => {
        const time = new Date().toLocaleTimeString();
        console.log(`[${time}] ${logMsg}`);
      });
      console.log(`\n✅ ${c.razonSocial} completado con éxito.`);
    } catch (err) {
      console.error(`\n❌ Error en ${c.razonSocial}: ${err.message}`);
    }
  }

  console.log("\n=======================================================");
  console.log("🎉 Proceso finalizado. Resultados guardados en registro_rce_resultados.json");
  console.log("=======================================================\n");
}

main();
