/**
 * test_local_sniffer.js
 * Script de prueba local visible para inspeccionar y capturar los endpoints reales del SIRE
 */

const { chromium } = require('playwright');
const { sunatApiSniffer } = require('./sunat_api_sniffer');
const { ejecutarPaso1Login } = require('./login_automator');

// Cliente de prueba tomado del Excel oficial
const clientePrueba = {
  ruc: '20602118640',
  usuario: 'SSENECES',
  clave: 'SUPERMARKe10',
  razonSocial: 'SUPERMARKET EL GOOL SAC',
  anio: '2026',
  mes: 'Agosto'
};

async function ejecutarTestLocal() {
  console.log(`\n======================================================`);
  console.log(`🧪 INICIANDO TEST LOCAL DE INTERCEPCIÓN API SIRE`);
  console.log(`Empresa: ${clientePrueba.razonSocial} (RUC: ${clientePrueba.ruc})`);
  console.log(`======================================================\n`);

  try {
    const resultado = await ejecutarPaso1Login(clientePrueba, (msg) => {
      console.log(`[TEST-LOG] ${msg}`);
    });

    console.log('\n✅ RESULTADO DEL TEST LOCAL:', JSON.stringify(resultado, null, 2));
    console.log('\n🎯 Revisando endpoints capturados por el sniffer...');
    
    const dumpPath = `./sunat_api_logs/sire_endpoints_${clientePrueba.ruc}.json`;
    const fs = require('fs');
    if (fs.existsSync(dumpPath)) {
      const dump = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));
      console.log('Total peticiones API interceptadas:', dump.totalRequestsCaptured);
      console.log('Bearer Token detectado:', dump.tokens.bearerToken ? 'SÍ' : 'NO');
      console.log('Endpoints registrados:', Object.keys(dump.endpoints));
    } else {
      console.log('No se generó dump de API.');
    }
  } catch (error) {
    console.error('❌ Error en el test local:', error.message);
  }
}

ejecutarTestLocal();
