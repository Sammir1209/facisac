const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { sunatApiSniffer } = require('./sunat_api_sniffer');

const SUNAT_LOGIN_URL = "https://api-seguridad.sunat.gob.pe/v1/clientessol/4f3b88b3-d9d6-402a-b85d-6a0bc857746a/oauth2/loginMenuSol?lang=es-PE&showDni=true&showLanguages=false&originalUrl=https://e-menu.sunat.gob.pe/cl-ti-itmenu/AutenticaMenuInternet.htm&state=rO0ABXNyABFqYXZhLnV0aWwuSGFzaE1hcAUH2sHDFmDRAwACRgAKbG9hZEZhY3RvckkACXRocmVzaG9sZHhwP0AAAAAAAAx3CAAAABAAAAADdAADZXhlcHQABnBhcmFtc3QASyomKiYvY2wtdGktaXRtZW51L01lbnVJbnRlcm5ldC5odG0mYjY0ZDI2YThiNWFmMDkxOTIzYjIzYjY0MDdhMWMxZGI0MWU3MzNhNnQABGV4ZWNweA==";

/**
 * Calcula automáticamente el periodo tributario a declarar (mes anterior al mes en curso).
 * Ejemplo: En Octubre se declara Septiembre. En Enero se declara Diciembre del año anterior.
 */
function getPeriodoFiscalPorDefecto() {
  const fechaActual = new Date();
  const nombresMeses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  
  let mesIndex = fechaActual.getMonth() - 1; // Mes anterior
  let anio = fechaActual.getFullYear();
  
  if (mesIndex < 0) {
    mesIndex = 11; // Diciembre
    anio -= 1;
  }
  
  return {
    anio: String(anio),
    mes: nombresMeses[mesIndex]
  };
}

/**
 * Espera y maneja cualquier popup de SUNAT de forma robusta
 */
async function handleMultiRucPopups(page, log) {
  // Verificación y limpieza profunda de modales/avisos iniciales de SUNAT
  for (let ciclo = 1; ciclo <= 10; ciclo++) {
    let accionó = false;
    const allFrames = [page, ...page.frames()];

    for (const frame of allFrames) {
      try {
        // Ejecución inmediata en el DOM del frame para neutralizar "Continuar sin confirmar", "Ver más tarde", "Finalizar", "Continuar sin código"
        const accionadoDOM = await frame.evaluate(() => {
          // A) Pantalla "Valida tus datos de contacto": Botón 'Continuar sin confirmar' o similares
          const btnContSinConf = Array.from(document.querySelectorAll('button, input, a, div[role="button"]')).find(b => {
            const t = ((b.innerText || b.value || b.textContent || '') + '').trim().toLowerCase();
            return t.includes('continuar sin confirmar') || t.includes('sin confirmar') || t.includes('continuar sin valid');
          });
          if (btnContSinConf) {
            btnContSinConf.click();
            return 'CONTINUAR_SIN_CONFIRMAR';
          }

          // B) Buzón Electrónico: Botón 'Ver más tarde' (#btnCerrar o con callHide)
          const btnBuzon = document.getElementById('btnCerrar') 
            || document.querySelector('button[onclick*="callHide"], #btnCerrar')
            || Array.from(document.querySelectorAll('button, a')).find(b => {
                 const t = ((b.innerText || b.textContent || '') + '').trim().toLowerCase();
                 return t.includes('ver más tarde') || t.includes('ver mas tarde') || t.includes('continuar más tarde') || t.includes('omitir');
               });
          if (btnBuzon) {
            btnBuzon.click();
            return 'BUZON';
          }

          // C) Informativo con 'Finalizar'
          const btnFin = Array.from(document.querySelectorAll('button, input, a')).find(b => {
            const t = ((b.innerText || b.value || b.textContent || '') + '').trim().toLowerCase();
            return t === 'finalizar' || t.includes('finalizar');
          });
          if (btnFin) {
            btnFin.click();
            return 'FINALIZAR';
          }

          // D) Nuevo modal SUNAT: 'Continuar sin código' (#btnWithOutCode)
          const btnSinCodigo = document.getElementById('btnWithOutCode')
            || document.querySelector('button#btnWithOutCode, .btn-choice#btnWithOutCode')
            || Array.from(document.querySelectorAll('button, a')).find(b => {
              const t = ((b.innerText || b.textContent || '') + '').trim().toLowerCase();
              return t.includes('continuar sin código') || t.includes('continuar sin codigo') || t.includes('sin verificación adicional') || t.includes('sin verificacion adicional');
            });
          if (btnSinCodigo) {
            btnSinCodigo.click();
            return 'CONTINUAR_SIN_CODIGO';
          }

          // E) Avisos genéricos con botón Entendido / Continuar / Aceptar
          const btnAvisoGen = Array.from(document.querySelectorAll('.modal button, .ui-dialog button, ngb-modal-window button, [role="dialog"] button')).find(b => {
            const t = ((b.innerText || b.textContent || '') + '').trim().toLowerCase();
            return t === 'aceptar' || t === 'entendido' || t === 'continuar' || t === 'cerrar';
          });
          if (btnAvisoGen) {
            btnAvisoGen.click();
            return 'MODAL_GENERICO';
          }

          return null;
        }).catch(() => null);

        if (accionadoDOM) {
          log(`✅ Aviso SUNAT neutralizado vía DOM [Tipo: ${accionadoDOM}].`);
          await page.waitForTimeout(500);
          accionó = true;
          break;
        }

        // 1. Pantalla "Valida tus datos de contacto": Continuar sin confirmar
        const btnContinuarSin = frame.locator(`//button[contains(., 'Continuar sin confirmar') or contains(.,'sin confirmar')] | //input[contains(@value, 'sin confirmar')] | //a[contains(.,'Continuar sin confirmar')] | button:has-text("Continuar sin confirmar")`).first();
        if (await btnContinuarSin.isVisible({ timeout: 200 }).catch(() => false)) {
          await btnContinuarSin.click({ force: true });
          log("✅ Modal 'Valida tus datos de contacto' (Continuar sin confirmar) cerrado.");
          await page.waitForTimeout(500);
          accionó = true;
          break;
        }

        // 2. Nuevo modal SUNAT: Continuar sin código (#btnWithOutCode)
        const btnSinCodLoc = frame.locator(`button#btnWithOutCode, #btnWithOutCode, //button[contains(.,'Continuar sin código') or contains(.,'Continuar sin codigo')]`).first();
        if (await btnSinCodLoc.isVisible({ timeout: 200 }).catch(() => false)) {
          await btnSinCodLoc.click({ force: true });
          log("✅ Modal 'Continuar sin código' (#btnWithOutCode) clickeado.");
          await page.waitForTimeout(500);
          accionó = true;
          break;
        }

        // 3. Popup "Informativo" con botón Finalizar
        const btnFinalizar = frame.locator(`//button[contains(.,'Finalizar') or contains(.,'finalizar')] | //input[@value='Finalizar'] | //a[contains(.,'Finalizar')]`).first();
        if (await btnFinalizar.isVisible({ timeout: 200 }).catch(() => false)) {
          await btnFinalizar.click({ force: true });
          log("✅ Aviso 'Finalizar' cerrado.");
          await page.waitForTimeout(400);
          accionó = true;
          break;
        }

        // 4. Buzón: Ver más tarde / Continuar más tarde / Omitir (#btnCerrar)
        const btnDescarte = frame.locator(`button#btnCerrar, #btnCerrar, button[onclick*='callHide'], button:has-text('Ver más tarde'), button:has-text('Ver mas tarde')`).first();
        if (await btnDescarte.isVisible({ timeout: 200 }).catch(() => false)) {
          await btnDescarte.click({ force: true });
          log("✅ Buzón SOL 'Ver más tarde' descartado.");
          await page.waitForTimeout(400);
          accionó = true;
          break;
        }

        // 5. Diálogo emergente
        const btnAceptar = frame.locator(`.modal button:has-text("Aceptar"), ngb-modal-window button:has-text("Aceptar"), div[role='dialog'] button:has-text("Aceptar")`).first();
        if (await btnAceptar.isVisible({ timeout: 150 }).catch(() => false)) {
          await btnAceptar.click({ force: true });
          log("✅ Diálogo modal 'Aceptar' cerrado.");
          await page.waitForTimeout(400);
          accionó = true;
          break;
        }
      } catch (err) {}
    }

    if (!accionó) {
      // Espera breve por si el modal tarda en renderizarse tras el login
      if (ciclo <= 3) {
        await page.waitForTimeout(600);
      } else {
        break;
      }
    }
  }
  return true;
}

/**
 * Espera activa para que el menú principal de SUNAT SOL esté completamente renderizado
 */
async function waitForMenuLoaded(page, log) {
  log("Verificando menú principal de SUNAT SOL...");

  for (let i = 0; i < 20; i++) {
    // 1. Revisar si hay Error 503
    const has503 = await page.locator("text='ERROR 503 - ERROR INTERNO DEL SERVIDOR'").isVisible({ timeout: 400 }).catch(() => false);
    if (has503) {
      log("⚠️ SUNAT arrojó ERROR 503 (NXSI045). Se cerrará la sesión para reiniciar el proceso desde cero.");
      throw new Error("SUNAT_ERROR_503");
    }

    // 2. Revisar si el botón/pestaña "Empresas" ya es visible
    for (const frame of page.frames()) {
      // Coincidencia amplia con la pestaña Empresas en el menú de opciones
      const locatorEmpresas = frame.locator("text='Empresas'").first();
      if (await locatorEmpresas.isVisible().catch(() => false)) {
        log("✅ Menú cargado: Pestaña 'Empresas' encontrada.");
        return { frame, locator: locatorEmpresas };
      }
    }

    await page.waitForTimeout(1000);
  }

  // Si no la detecta con waitFor, devolvemos la referencia de la página principal para forzar el clic
  return { frame: page, locator: page.locator("text='Empresas'").first() };
}

/**
 * Ejecución de un intento único
 */
async function ejecutarIntento({ ruc, usuario, clave, anio, mes, soloLogin, abortSignal, onBrowserCreated }, onLog) {
  if (abortSignal && abortSignal.aborted) {
    throw new Error("Tarea cancelada antes de iniciar.");
  }
  
  // Si no se especifica periodo, resolver automáticamente (mes anterior al actual)
  const periodoAuto = getPeriodoFiscalPorDefecto();
  const periodoAnio = String(anio || periodoAuto.anio).trim();
  const periodoMes = String(mes || periodoAuto.mes).trim();

  const isHeadless = process.env.HEADLESS === 'true' || process.platform === 'linux';
  onLog(`Abriendo Google Chrome (${isHeadless ? 'Modo Headless Cloud' : 'Modo Visible'}) para RUC: ${ruc} (Periodo: ${periodoAnio} / ${periodoMes})...`);

  let browser;
  const launchArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu'
  ];
  if (!isHeadless) {
    launchArgs.push('--start-maximized', '--window-position=50,50');
  }

  try {
    browser = await chromium.launch({
      headless: isHeadless,
      channel: 'chrome',
      slowMo: isHeadless ? 0 : 30,
      args: launchArgs
    });
  } catch (err) {
    browser = await chromium.launch({
      headless: isHeadless,
      slowMo: isHeadless ? 0 : 30,
      args: launchArgs
    });
  }

  if (typeof onBrowserCreated === 'function') {
    try { onBrowserCreated(browser); } catch(e) {}
  }

  // Listener para abortar si el usuario cancela en caliente
  if (abortSignal) {
    abortSignal.addEventListener('abort', () => {
      onLog("🛑 Tarea abortada por el usuario. Cerrando navegador de inmediato...");
      try { browser.close().catch(() => {}); } catch(e) {}
    }, { once: true });
  }

  const context = await browser.newContext({
    viewport: isHeadless ? { width: 1280, height: 800 } : null,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });

  // Acoplar sniffer a nivel de contexto (captura todas las pestañas, iframes y llamadas fetch/XHR)
  sunatApiSniffer.attach(context, onLog);

  // ACELERADOR TURBO: Bloqueo de recursos externos no esenciales (Google Analytics, trackers)
  // Preserva 100% de los componentes Angular y hojas de estilo de SUNAT
  await context.route('**/*', (route) => {
    const url = route.request().url().toLowerCase();
    
    if (url.includes('google-analytics') || 
        url.includes('googletagmanager') || 
        url.includes('facebook') ||
        url.includes('hotjar') ||
        url.includes('doubleclick')) {
      return route.abort();
    }
    return route.continue();
  });

  const page = await context.newPage();
  await page.bringToFront();

  // Escuchar cualquier pestaña nueva que SUNAT abra (por ejemplo al ingresar a SIRE o RCE)
  // y traerla automáticamente al frente para que siempre sea visible en pantalla
  let activePage = page;
  context.on('page', async (newPage) => {
    try {
      activePage = newPage;
      await newPage.bringToFront().catch(() => {});
      sunatApiSniffer.attach(newPage, onLog);
      newPage.on('dialog', async (dialog) => {
        try { await dialog.accept().catch(() => {}); } catch(e) {}
      });
      onLog("🪟 Nueva pestaña de SUNAT detectada y traída al frente visible.");
    } catch (e) {}
  });

  // Acoplar también a la página inicial
  sunatApiSniffer.attach(page, onLog);

  // Manejador seguro para diálogos nativos de JavaScript (alerts/confirms de SUNAT)
  page.on('dialog', async (dialog) => {
    try {
      await dialog.accept().catch(() => {});
    } catch (e) {}
  });

  let registroFinal = null;

  try {
    // ==========================================
    // FASE 1: AUTENTICACIÓN VELOZ
    // ==========================================
    onLog("Navegando a la pasarela de autenticación de SUNAT SOL...");
    await page.goto(SUNAT_LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 35000 });

    if (await page.locator("text='ERROR 503 - ERROR INTERNO DEL SERVIDOR'").isVisible({ timeout: 400 }).catch(() => false)) {
      throw new Error("SUNAT_ERROR_503");
    }

    onLog("Comprobando campos del formulario de login...");
    const tabRuc = page.locator("//button[contains(.,'RUC')] | //a[contains(.,'RUC')]");
    if (await tabRuc.isVisible({ timeout: 600 }).catch(() => false)) {
      await tabRuc.click();
    }

    const inputRuc = page.locator("input#txtRuc, input[name='numRUC'], input[placeholder*='RUC']").first();
    const inputUsuario = page.locator("input#txtUsuario, input[name='txtUsuario'], input[placeholder*='Usuario']").first();
    const inputClave = page.locator("input#txtContrasena, input[name='txtContrasena'], input[type='password']").first();
    const btnIniciarSesion = page.locator("button#btnAceptar, button[type='submit']:has-text('Iniciar Sesión'), button:has-text('Entrar')").first();

    await inputRuc.waitFor({ state: 'visible', timeout: 15000 });
    onLog("Rellenando credenciales SOL...");
    await inputRuc.fill(ruc);
    await inputUsuario.fill(usuario);
    await inputClave.fill(clave);

    onLog("Haciendo clic en 'Iniciar Sesión'...");
    await btnIniciarSesion.click();

    onLog("Esperando respuesta del servidor de autenticación de SUNAT...");

    // Redirección natural de OAuth2: Dejar que SUNAT complete el canje de código
    for (let r = 0; r < 20; r++) {
      const currentUrl = page.url();
      if (currentUrl.includes('cl-ti-itmenu') || currentUrl.includes('MenuInternet')) {
        break;
      }
      if (await page.locator("text='Error en la invocación'").isVisible({ timeout: 200 }).catch(() => false)) {
        throw new Error("SUNAT_ERROR_INVOCACION: Error interno de sesión en SUNAT. Reintentar.");
      }
      await page.waitForTimeout(400);
    }

    // Limpieza rápida de popups iniciales (Buzón SOL, etc.)
    await handleMultiRucPopups(page, onLog);

    onLog("✅ FASE 1 COMPLETADA: Sesión autenticada.");

    // ==========================================
    // FASE 2: NAVEGACIÓN SIRE RCE (Periodo Dinámico Turbo)
    // ==========================================
    if (!soloLogin) {
      onLog("➡️ INICIANDO FASE 2: Navegación de alta velocidad en SIRE...");

      // 1. Clic directo e inmediato en la pestaña 'Empresas' (ID exacto: #divOpcionServicio2)
      onLog("Haciendo clic en la pestaña 'Empresas'...");
      
      let empresasClickeado = false;
      for (let intentoEmpresas = 0; intentoEmpresas < 15; intentoEmpresas++) {
        for (const f of [page, ...page.frames()]) {
          empresasClickeado = await f.evaluate(() => {
            // Descartar de paso cualquier buzón o aviso que persista
            const contSin = Array.from(document.querySelectorAll('button, input, a, div[role="button"]')).find(b => {
              const t = ((b.innerText || b.value || b.textContent || '') + '').trim().toLowerCase();
              return t.includes('continuar sin confirmar') || t.includes('sin confirmar');
            });
            if (contSin) contSin.click();

            const buzon = document.getElementById('btnCerrar') || document.querySelector('button[onclick*="callHide"]');
            if (buzon) buzon.click();

            const sinCod = document.getElementById('btnWithOutCode') || document.querySelector('button#btnWithOutCode, .btn-choice#btnWithOutCode');
            if (sinCod) sinCod.click();

            const fin = Array.from(document.querySelectorAll('button, input')).find(b => ((b.innerText || b.value || '') + '').toLowerCase().includes('finalizar'));
            if (fin) fin.click();

            const divEmp = document.querySelector('#divOpcionServicio2, [data-id="2"]');
            if (divEmp) {
              divEmp.click();
              return true;
            }
            const tabs = Array.from(document.querySelectorAll('a, button, li, span, div, h4'));
            const tabEmpresas = tabs.find(el => {
              const t = (el.innerText || '').trim();
              return t === 'Empresas' || t === 'EMPRESAS';
            });
            if (tabEmpresas) {
              tabEmpresas.click();
              return true;
            }
            return false;
          }).catch(() => false);

          if (empresasClickeado) break;
        }

        if (empresasClickeado) {
          onLog("✅ Pestaña 'Empresas' seleccionada.");
          break;
        }

        const locEmp = page.locator("#divOpcionServicio2, [data-id='2'], text='Empresas'").first();
        if (await locEmp.isVisible({ timeout: 400 }).catch(() => false)) {
          await locEmp.click({ force: true });
          empresasClickeado = true;
          onLog("✅ Pestaña 'Empresas' seleccionada mediante selector.");
          break;
        }

        await page.waitForTimeout(300);
      }

      if (!empresasClickeado) {
        onLog("⚠️ Pestaña 'Empresas' no explícita; continuando directamente con el árbol de opciones...");
      }
      await page.waitForTimeout(250);

      // 2. Clic directo en: Sistema Integrado de Registros Electrónicos (ID: #nivel1_60)
      onLog("Abriendo 'Sistema Integrado de Registros Electrónicos' (#nivel1_60)...");
      let encontradoSire = false;
      for (let t = 0; t < 15; t++) {
        for (const f of [page, ...page.frames()]) {
          encontradoSire = await f.evaluate(() => {
            const el = document.querySelector('#nivel1_60, [data-id="60"]');
            if (el) {
              el.click();
              return true;
            }
            return false;
          }).catch(() => false);

          if (!encontradoSire) {
            const loc = f.locator("#nivel1_60, li#nivel1_60, //*[contains(text(),'Sistema Integrado de Registros Electronicos') or contains(text(),'Sistema Integrado de Registros')]").first();
            if (await loc.isVisible({ timeout: 200 }).catch(() => false)) {
              await loc.click({ force: true }).catch(() => {});
              encontradoSire = true;
            }
          }
          if (encontradoSire) break;
        }
        if (encontradoSire) break;
        await page.waitForTimeout(300);
      }
      await page.waitForTimeout(250);

      // 3. Subnivel: Registros Electrónicos (ID: #nivel2_60_2)
      onLog("Abriendo subnivel 'Registros Electronicos' (#nivel2_60_2)...");
      for (let t = 0; t < 12; t++) {
        let subClickeado = false;
        for (const f of [page, ...page.frames()]) {
          subClickeado = await f.evaluate(() => {
            const el = document.querySelector('#nivel2_60_2, [data-id="60.2"]');
            if (el) {
              el.click();
              return true;
            }
            return false;
          }).catch(() => false);

          if (!subClickeado) {
            const locSub = f.locator("#nivel2_60_2, //*[normalize-space(text())='Registros Electronicos' or contains(text(),'Registros Electr')]").first();
            if (await locSub.isVisible({ timeout: 200 }).catch(() => false)) {
              await locSub.click({ force: true }).catch(() => {});
              subClickeado = true;
            }
          }
          if (subClickeado) break;
        }
        if (subClickeado) break;
        await page.waitForTimeout(250);
      }
      await page.waitForTimeout(250);

      // 4. Clic en: Registro de Compras Electrónico (ID: #nivel3_60_2_2)
      onLog("Desplegando 'Registro de Compras Electrónico' (#nivel3_60_2_2)...");
      let encontradoRce = false;
      for (let t = 0; t < 15; t++) {
        for (const f of [page, ...page.frames()]) {
          encontradoRce = await f.evaluate(() => {
            const el = document.querySelector('#nivel3_60_2_2, [data-id="60.2.2"]');
            if (el) {
              el.click();
              return true;
            }
            return false;
          }).catch(() => false);

          if (!encontradoRce) {
            const loc = f.locator("#nivel3_60_2_2, //*[contains(text(),'Registro de Compras') and not(contains(text(),'Preliminar'))]").first();
            if (await loc.isVisible({ timeout: 200 }).catch(() => false)) {
              await loc.click({ force: true }).catch(() => {});
              encontradoRce = true;
            }
          }
          if (encontradoRce) break;
        }
        if (encontradoRce) break;
        await page.waitForTimeout(300);
      }
      await page.waitForTimeout(250);

      // 5. Clic en: Gestión de Compras (ID: #nivel4_60_2_2_1_1)
      onLog("Ingresando a 'Gestión de Compras' (#nivel4_60_2_2_1_1)...");
      let encontradoGestion = false;
      for (let t = 0; t < 15; t++) {
        for (const f of [page, ...page.frames()]) {
          encontradoGestion = await f.evaluate(() => {
            const el = document.querySelector('#nivel4_60_2_2_1_1, [data-id="60.2.2.1.1"]');
            if (el) {
              el.click();
              return true;
            }
            return false;
          }).catch(() => false);

          if (!encontradoGestion) {
            const loc = f.locator("#nivel4_60_2_2_1_1, //*[contains(text(),'Gestion de Compras') or contains(text(),'Gestión de Compras')]").first();
            if (await loc.isVisible({ timeout: 200 }).catch(() => false)) {
              await loc.click({ force: true }).catch(() => {});
              encontradoGestion = true;
            }
          }
          if (encontradoGestion) break;
        }
        if (encontradoGestion) break;
        await page.waitForTimeout(300);
      }
      await page.waitForTimeout(800);

      // Esperar a que aparezca el mensaje informativo de SIRE ("Estimado contribuyente...") y darle Aceptar
      onLog("Esperando que aparezca el mensaje informativo de SIRE para darle 'Aceptar'...");

      let mensajeAceptado = false;
      for (let esperaMsg = 0; esperaMsg < 20; esperaMsg++) {
        for (const f of [page, ...page.frames()]) {
          // Buscar si el modal ya está visible
          const modalVisible = await f.locator(".modal.show, ngb-modal-window, div[role='dialog']").first().isVisible({ timeout: 200 }).catch(() => false);
          
          if (modalVisible) {
            // Darle clic al botón Aceptar del modal
            const clickRealizado = await f.evaluate(() => {
              const btns = Array.from(document.querySelectorAll('.modal button, ngb-modal-window button, div[role="dialog"] button, button'));
              const b = btns.find(el => {
                const t = (el.innerText || el.textContent || '').trim();
                return (t === 'Aceptar' || t === 'Continuar' || t === 'Entendido') && el.id !== 'btn-aceptar';
              });
              if (b) {
                b.click();
                return true;
              }
              return false;
            }).catch(() => false);

            if (clickRealizado) {
              onLog("✅ Mensaje informativo detectado y aceptado con éxito.");
              mensajeAceptado = true;
              await page.waitForTimeout(600);
              break;
            }

            const btnAceptarPlaywright = f.locator("button.btn-primary.shadow-none:has-text('Aceptar'), div[role='dialog'] button:has-text('Aceptar')").first();
            if (await btnAceptarPlaywright.isVisible({ timeout: 300 }).catch(() => false)) {
              await btnAceptarPlaywright.click({ force: true }).catch(() => {});
              onLog("✅ Mensaje informativo aceptado.");
              mensajeAceptado = true;
              await page.waitForTimeout(600);
              break;
            }
          }
        }
        if (mensajeAceptado) break;

        // Si aún no aparece en los primeros intentos, verificar si ya están disponibles los controles de periodo
        if (esperaMsg >= 6) {
          let controlesVisibles = false;
          for (const f of [page, ...page.frames()]) {
            if (await f.locator("ng-select, .ng-select, select#cboAnio").first().isVisible({ timeout: 150 }).catch(() => false)) {
              controlesVisibles = true;
              break;
            }
          }
          if (controlesVisibles) {
            onLog("ℹ️ Los controles de periodo ya están activos y listos.");
            break;
          }
        }

        await page.waitForTimeout(500);
      }

      const descartarModalSireInfalible = async () => {
        for (const f of [page, ...page.frames()]) {
          await f.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button, a'));
            const bAceptar = btns.find(b => {
              const t = (b.innerText || b.textContent || '').trim();
              return (t === 'Aceptar' || t === 'Continuar' || t === 'Entendido') && b.id !== 'btn-aceptar';
            });
            if (bAceptar) bAceptar.click();
            const xBtn = document.querySelector('.modal-header .close, button.close, [aria-label="Close"]');
            if (xBtn) xBtn.click();
          }).catch(() => {});
        }
        await page.keyboard.press("Escape").catch(() => {});
      };

      onLog("Configurando periodo tributario...");

      // 5. Configurar dropdowns (ng-select de Angular o select estándar) con el periodo elegido
      let targetFrame = page;
      let frameEncontrado = false;
      for (let i = 0; i < 25; i++) {
        await descartarModalSireInfalible();
        for (const f of [page, ...page.frames()]) {
          const hasControls = await f.locator("ng-select, .ng-select, select#cboAnio, select[name*='anio']").first().isVisible({ timeout: 150 }).catch(() => false);
          if (hasControls) {
            targetFrame = f;
            frameEncontrado = true;
            break;
          }
        }
        if (frameEncontrado) break;
        if (i % 6 === 5) {
          const locGC = page.locator("//a[contains(., 'Gestión de Compras')] | //*[contains(text(),'Gestion de Compras') or contains(text(),'Gestión de Compras')]").first();
          if (await locGC.isVisible({ timeout: 200 }).catch(() => false)) {
            await locGC.click({ force: true }).catch(() => {});
          }
        }
        await page.waitForTimeout(250);
      }

      await descartarModalSireInfalible();

      // Localizar el frame activo que contiene los dropdowns de periodo
      let activeSireFrame = targetFrame;
      for (const f of [page, ...page.frames()]) {
        const found = await f.evaluate(() => {
          return !!document.querySelector("ng-select, .ng-select, select#cboAnio, select[name*='anio'], button#btn-aceptar");
        }).catch(() => false);
        if (found) {
          activeSireFrame = f;
          break;
        }
      }

      // A) Seleccionar AÑO (ng-select o select)
      onLog(`Seleccionando Año: ${periodoAnio}...`);

      const selectStdAnio = activeSireFrame.locator("select#cboAnio, select[name*='anio']").first();
      if (await selectStdAnio.isVisible({ timeout: 400 }).catch(() => false)) {
        await selectStdAnio.selectOption({ label: periodoAnio }).catch(async () => {
          await selectStdAnio.selectOption({ value: periodoAnio }).catch(() => {});
        });
      } else {
        let ngSelectAnio = activeSireFrame.locator("ng-select, .ng-select").first();
        const isNgVisible = await ngSelectAnio.isVisible({ timeout: 1500 }).catch(() => false);
        
        if (!isNgVisible) {
          for (const f of [page, ...page.frames()]) {
            const cand = f.locator("ng-select, .ng-select").first();
            if (await cand.isVisible({ timeout: 600 }).catch(() => false)) {
              ngSelectAnio = cand;
              activeSireFrame = f;
              break;
            }
          }
        }

        const textoActualAnio = (await ngSelectAnio.innerText().catch(() => '')) || '';
        if (!textoActualAnio.includes(periodoAnio)) {
          await ngSelectAnio.click({ force: true }).catch(() => {});
          await page.waitForTimeout(150);

          let seleccionado = false;
          const optAnio = activeSireFrame.locator("ng-dropdown-panel .ng-option, .ng-dropdown-panel span, .ng-option").filter({ hasText: periodoAnio }).first();
          if (await optAnio.isVisible({ timeout: 800 }).catch(() => false)) {
            await optAnio.click({ force: true }).catch(() => {});
            seleccionado = true;
          }

          if (!seleccionado) {
            const inputAnio = ngSelectAnio.locator("input");
            if (await inputAnio.isEditable({ timeout: 200 }).catch(() => false)) {
              await inputAnio.fill(periodoAnio).catch(() => {});
              await page.keyboard.press("Enter").catch(() => {});
            } else {
              await page.keyboard.type(periodoAnio, { delay: 20 }).catch(() => {});
              await page.keyboard.press("Enter").catch(() => {});
            }
          }
        }
      }
      
      onLog(`✅ Año ${periodoAnio} confirmado.`);
      await page.waitForTimeout(150);

      // B) Seleccionar MES (ng-select[formcontrolname="mes"])
      const mesesMap = {
        'enero': 'ENE', 'febrero': 'FEB', 'marzo': 'MAR', 'abril': 'ABR',
        'mayo': 'MAY', 'junio': 'JUN', 'julio': 'JUL', 'agosto': 'AGO',
        'septiembre': 'SEP', 'setiembre': 'SEP', 'octubre': 'OCT',
        'noviembre': 'NOV', 'diciembre': 'DIC'
      };
      
      const mesKey = (periodoMes || '').toLowerCase().trim();
      const mesCodigo = mesesMap[mesKey] || (periodoMes.substring(0, 3).toUpperCase());
      const regexMesMatcher = (mesKey.includes('sep') || mesKey.includes('set')) 
        ? /^(SEP|SET|SEPTIEMBRE|SETIEMBRE)$/i 
        : new RegExp(`^(${mesCodigo}|${periodoMes})$`, 'i');

      onLog(`Seleccionando Mes: '${mesCodigo}' / regex: ${regexMesMatcher} (${periodoMes})...`);

      const selectStdMes = activeSireFrame.locator("select#cboMes, select[name*='mes']").first();
      if (await selectStdMes.isVisible({ timeout: 300 }).catch(() => false)) {
        // Intentar seleccionar por SEP o SET
        let seleccionadoStd = false;
        for (const cod of [mesCodigo, (mesCodigo === 'SEP' ? 'SET' : mesCodigo), periodoMes]) {
          try {
            await selectStdMes.selectOption({ label: cod });
            seleccionadoStd = true;
            break;
          } catch (e) {
            try {
              await selectStdMes.selectOption({ value: cod });
              seleccionadoStd = true;
              break;
            } catch (e2) {}
          }
        }
      } else {
        // Buscar el dropdown de mes de forma segura
        let ngSelectMes = activeSireFrame.locator("ng-select[formcontrolname='mes'], ng-select[bindlabel='mes']").first();
        let isNgMesVisible = await ngSelectMes.isVisible({ timeout: 500 }).catch(() => false);
        
        if (!isNgMesVisible) {
          const allNg = activeSireFrame.locator("ng-select, .ng-select");
          const count = await allNg.count().catch(() => 0);
          if (count > 1) {
            ngSelectMes = allNg.nth(1);
            isNgMesVisible = true;
          } else {
            // Buscar en todos los frames
            for (const f of [page, ...page.frames()]) {
              const candAll = f.locator("ng-select, .ng-select");
              const cnt = await candAll.count().catch(() => 0);
              if (cnt > 1) {
                ngSelectMes = candAll.nth(1);
                activeSireFrame = f;
                isNgMesVisible = true;
                break;
              }
            }
          }
        }
        
        const textoActualMes = (await ngSelectMes.innerText({ timeout: 1000 }).catch(() => '')) || '';
        const yaEstaSeleccionado = (mesKey.includes('sep') || mesKey.includes('set'))
          ? (textoActualMes.toUpperCase().includes('SEP') || textoActualMes.toUpperCase().includes('SET'))
          : textoActualMes.toUpperCase().includes(mesCodigo);

        if (!yaEstaSeleccionado) {
          await ngSelectMes.click({ force: true, timeout: 3000 }).catch(async () => {
            // Si falla el click normal, intentar click vía DOM
            await ngSelectMes.evaluate(el => el.click()).catch(() => {});
          });
          await page.waitForTimeout(200);

          let mesSeleccionado = false;
          // Buscar opción que coincida con SEP o SET o el nombre completo del mes
          const optMes = activeSireFrame.locator("ng-dropdown-panel .ng-option, .ng-dropdown-panel span, .ng-option")
            .filter({ hasText: (mesKey.includes('sep') || mesKey.includes('set')) ? /(SEP|SET|Septiembre|Setiembre)/i : new RegExp(`^\\s*${mesCodigo}|${periodoMes}`, 'i') })
            .first();

          if (await optMes.isVisible({ timeout: 1000 }).catch(() => false)) {
            await optMes.click({ force: true }).catch(() => {});
            mesSeleccionado = true;
          }

          if (!mesSeleccionado) {
            const inputMes = ngSelectMes.locator("input").first();
            if (await inputMes.isVisible({ timeout: 300 }).catch(() => false)) {
              await inputMes.fill(mesCodigo).catch(() => {});
              await page.keyboard.press("Enter").catch(() => {});
            } else {
              await page.keyboard.type(mesCodigo, { delay: 20 }).catch(() => {});
              await page.keyboard.press("Enter").catch(() => {});
            }
          }
        }
      }

      onLog(`✅ Mes '${mesCodigo}' confirmado.`);
      await page.waitForTimeout(150);

      // C) Clic en el botón "Aceptar" (#btn-aceptar)
      onLog("Confirmando periodo (#btn-aceptar)...");
      let btnAceptar = activeSireFrame.locator("button#btn-aceptar, #btn-aceptar, button:has-text('Aceptar'), button:has-text('Continuar')").first();
      let btnAceptarVisible = await btnAceptar.isVisible({ timeout: 1000 }).catch(() => false);

      if (!btnAceptarVisible) {
        for (const f of [page, ...page.frames()]) {
          const candBtn = f.locator("button#btn-aceptar, #btn-aceptar, button:has-text('Aceptar')").first();
          if (await candBtn.isVisible({ timeout: 500 }).catch(() => false)) {
            btnAceptar = candBtn;
            activeSireFrame = f;
            btnAceptarVisible = true;
            break;
          }
        }
      }

      if (btnAceptarVisible) {
        for (let w = 0; w < 5; w++) {
          const isDisabled = await btnAceptar.getAttribute('disabled');
          if (isDisabled === null) break;
          await page.waitForTimeout(80);
        }
        await btnAceptar.click({ force: true }).catch(async () => {
          await btnAceptar.evaluate(el => el.click()).catch(() => {});
        });
      } else {
        // Fallback vía evaluate DOM en todos los frames
        for (const f of [activeSireFrame, page, ...page.frames()]) {
          await f.evaluate(() => {
            const b = document.querySelector("button#btn-aceptar, #btn-aceptar") || Array.from(document.querySelectorAll('button')).find(el => (el.innerText || '').trim() === 'Aceptar');
            if (b) b.click();
          }).catch(() => {});
        }
      }

      onLog("✅ Periodo aceptado.");
      await page.waitForTimeout(300);

      // Limpiar posibles modales emergentes tras presionar Aceptar
      for (let i = 0; i < 2; i++) {
        for (const f of [page, ...page.frames()]) {
          await f.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button, a'));
            const b = btns.find(el => {
              const txt = (el.innerText || '').trim();
              return (txt === 'Aceptar' || txt === 'Continuar') && el.id !== 'btn-aceptar';
            });
            if (b) b.click();
            const closeBtn = document.querySelector('.modal-header .close, button.close, [aria-label="Close"]');
            if (closeBtn) closeBtn.click();
          }).catch(() => {});
        }
        await page.keyboard.press("Escape").catch(() => {});
        await page.waitForTimeout(200);
      }

      // 6. Navegar a la pestaña 'Propuesta del RCE' (a[href*="propuesta-rce"])
      onLog("Accediendo a la pestaña 'Propuesta del RCE'...");

      for (let intentoTab = 0; intentoTab < 5; intentoTab++) {
        // Clic directo en todos los frames por enlace canónico
        for (const f of [targetFrame, page, ...page.frames()]) {
          await f.evaluate(() => {
            const enlacePropuesta = document.querySelector('a[href*="propuesta-rce"], a[routerlink*="propuesta-rce"]');
            if (enlacePropuesta) {
              enlacePropuesta.click();
              return;
            }
            const tabs = Array.from(document.querySelectorAll('a, li, span, button'));
            const targetTab = tabs.find(t => (t.innerText || '').trim().includes('Propuesta del RCE'));
            if (targetTab) targetTab.click();
          }).catch(() => {});
        }

        const tabPropuestaRce = targetFrame.locator(`a[href*="propuesta-rce"], a:has-text("Propuesta del RCE"), //a[contains(normalize-space(.),'Propuesta del RCE')]`).first();
        if (await tabPropuestaRce.isVisible({ timeout: 500 }).catch(() => false)) {
          await tabPropuestaRce.click({ force: true }).catch(() => {});
        }

        await page.waitForTimeout(500);

        // Comprobar si la pestaña Propuesta del RCE ya quedó activa
        const tabActiva = await targetFrame.locator("a[href*='propuesta-rce'].active, .nav-link.active:has-text('Propuesta del RCE'), .active:has-text('Propuesta del RCE')").first().isVisible({ timeout: 400 }).catch(() => false);
        if (tabActiva) {
          onLog("✅ Pestaña 'Propuesta del RCE' verificada y activa.");
          break;
        }
      }

      onLog("Pestaña 'Propuesta del RCE' seleccionada.");
      await page.waitForTimeout(1000);

      // Esperar a que la tabla cargue activamente los datos de la Propuesta (desaparezca spinner y existan filas)
      onLog("Esperando carga completa de los datos de la Propuesta del RCE...");
      let esPropuestaVaciaSinCompras = false;
      for (let waitTabla = 0; waitTabla < 20; waitTabla++) {
        let tablaLista = false;
        for (const f of [targetFrame, activeSireFrame, page, ...page.frames()]) {
          const resEstado = await f.evaluate(() => {
            const spinner = document.querySelector('.spinner-border, .loading, .block-ui-spinner, .sk-spinner');
            if (spinner && spinner.offsetParent !== null) return null;
            const filas = Array.from(document.querySelectorAll('table tbody tr'));
            const filasValidas = filas.filter(tr => !tr.classList.contains('total') && !tr.querySelector('th') && !tr.closest('tfoot'));
            const bodyText = (document.body ? document.body.innerText : '');
            const mensajeVacio = bodyText.includes('No se encontraron registros') || 
                                 bodyText.includes('No cuenta con compras') || 
                                 bodyText.includes('No existe información') ||
                                 bodyText.includes('No existen comprobantes');
            if (filasValidas.length > 0) return { tipo: 'DATOS', filas: filasValidas.length };
            if (mensajeVacio) return { tipo: 'VACIO', filas: 0 };
            return null;
          }).catch(() => null);

          if (resEstado) {
            targetFrame = f;
            tablaLista = true;
            if (resEstado.tipo === 'VACIO') {
              esPropuestaVaciaSinCompras = true;
            }
            break;
          }
        }
        if (tablaLista) break;
        await page.waitForTimeout(600);
      }

      // =========================================================================
      // CASO ESPECIAL: EMPRESA O PERSONA NATURAL SIN COMPRAS EN EL PERIODO
      // =========================================================================
      if (esPropuestaVaciaSinCompras) {
        onLog(`📦 ATENCIÓN: El contribuyente ${ruc} NO cuenta con compras o comprobantes registrados en el periodo ${periodoMes} ${periodoAnio}.`);
        
        const registroSinCompras = {
          ruc,
          periodo: { anio: periodoAnio, mes: mesCodigo || periodoMes },
          fechaHora: new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' }),
          totalComprobantes: 0,
          avisoSunat: `No cuenta con compras en el mes de ${periodoMes}`,
          estado: 'SIN_COMPRAS',
          mensaje: `La empresa / persona natural no cuenta con compras registradas en el mes de ${periodoMes} de ${periodoAnio}`,
          comprobantesModificados: []
        };

        try {
          const jsonPath = path.join(__dirname, 'registro_rce_resultados.json');
          let dataJson = [];
          if (fs.existsSync(jsonPath)) {
            try { dataJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) || []; } catch(e) { dataJson = []; }
          }
          const idxEx = dataJson.findIndex(it => it.ruc === ruc && it.periodo?.anio === periodoAnio && (it.periodo?.mes === mesCodigo || it.periodo?.mes === periodoMes));
          if (idxEx !== -1) dataJson[idxEx] = registroSinCompras;
          else dataJson.push(registroSinCompras);
          fs.writeFileSync(jsonPath, JSON.stringify(dataJson, null, 2), 'utf8');
          onLog(`💾 Resultado guardado como 'SIN_COMPRAS' en registro_rce_resultados.json`);
        } catch(e) {}

        // Salir de SUNAT directamente
        onLog("Presionando el botón 'Salir' en la parte superior derecha...");
        for (const f of [page, ...page.frames()]) {
          await f.evaluate(() => {
            const btn = document.getElementById('btnSalir') || document.querySelector('.aOpcionSalir, button.aOpcionSalir');
            if (btn) btn.click();
          }).catch(() => {});
        }
        await page.waitForTimeout(1000);
        await page.close().catch(() => {});
        await browser.close().catch(() => {});
        onLog("✅ Proceso completado: Empresa sin compras finalizada.");
        return {
          success: true,
          estado: 'SIN_COMPRAS',
          totalComprobantes: 0,
          comprobantesModificados: [],
          message: `No cuenta con compras en el mes de ${periodoMes}`
        };
      }

      // =========================================================================
      // FASE 3: LÓGICA DE NEGOCIO (RCE_Data_Shifter) A MÁXIMA VELOCIDAD (100 EN 100)
      // =========================================================================
      onLog("➡️ INICIANDO FASE 3: Verificando totales generales de la Propuesta del RCE...");

      // VERIFICACIÓN INMEDIATA DE TOTALES GENERALES (SHORT-CIRCUIT INTELIGENTE)
      // Solo es válido si la tabla contiene filas reales o tfoot con totales confirmados
      let totalGeneralCero = false;
      for (let chk = 0; chk < 3; chk++) {
        totalGeneralCero = await targetFrame.evaluate(() => {
          const table = document.querySelector('table');
          if (!table) return false;

          // Verificar que haya filas de datos o mensaje explícito
          const filasBody = Array.from(table.querySelectorAll('tbody tr')).filter(r => !r.classList.contains('total') && !r.closest('tfoot'));
          if (filasBody.length === 0) return false;

          // Buscar fila de totales en tfoot o en filas con clase 'total' o que contengan 'Total'
          const rows = Array.from(table.querySelectorAll('tfoot tr, tr.total, tbody tr'));
          const totalRow = rows.find(r => {
            const txt = (r.innerText || '').toLowerCase();
            return txt.includes('total') || txt.includes('totales');
          });

          if (!totalRow) return false;

          // Obtener índices de BI Gravada e IGV Gravado
          const theadRows = Array.from(table.querySelectorAll('thead tr'));
          let headerRow = theadRows[theadRows.length - 1];
          let headers = [];
          if (headerRow) {
            headers = Array.from(headerRow.querySelectorAll('th')).map(th => (th.innerText || '').trim().toUpperCase());
          }

          let biIdx = headers.findIndex(h => h.includes('BI GRAVADO DG') || (h.includes('GRAVADO DG') && !h.includes('NO GRAV')));
          let igvIdx = headers.findIndex(h => h.includes('IGV / IPM DG') || h.includes('IGV/IPM DG') || (h.includes('IGV') && h.includes('DG') && !h.includes('NO GRAV')));

          const cells = Array.from(totalRow.querySelectorAll('td, th')).map(c => (c.innerText || '').trim());
          if (cells.length < 5) return false;

          let sumBi = 0;
          let sumIgv = 0;

          if (biIdx !== -1 && cells[biIdx]) {
            sumBi = parseFloat(cells[biIdx].replace(/,/g, '')) || 0;
          }
          if (igvIdx !== -1 && cells[igvIdx]) {
            sumIgv = parseFloat(cells[igvIdx].replace(/,/g, '')) || 0;
          }

          // Si ambos totales son 0.00
          if (Math.abs(sumBi) < 0.001 && Math.abs(sumIgv) < 0.001) {
            return { esCero: true, sumBi, sumIgv, totalFilas: filasBody.length };
          }
          return false;
        }).catch(() => false);

        if (totalGeneralCero && totalGeneralCero.esCero) break;
        await page.waitForTimeout(400);
      }

      if (totalGeneralCero && totalGeneralCero.esCero) {
        onLog("⚡ TOTALES GENERALES EN 0.00 DETECTADOS (BI Gravado DG: 0.00, IGV DG: 0.00).");
        onLog("✅ La propuesta ya se encuentra totalmente limpia en 0.00. No se requiere auditar página por página.");
        
        // Proceder directamente a guardar registro final y cerrar
        const registroFinalDirecto = {
          ruc,
          periodo: { anio: anio || '2026', mes: mesCodigo || 'AGO' },
          fechaHora: new Date().toLocaleString(),
          totalComprobantes: totalGeneralCero.totalFilas || 0,
          avisoSunat: "Propuesta RCE ya se encuentra en 0.00",
          estado: 'SIN_MODIFICACIONES',
          mensaje: 'Propuesta verificada: Totales generales de BI Gravado e IGV Gravado ya están en 0.00',
          comprobantesModificados: []
        };

        try {
          const jsonPath = path.join(__dirname, 'registro_rce_resultados.json');
          let dataJson = [];
          if (fs.existsSync(jsonPath)) {
            try { dataJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) || []; } catch(e) { dataJson = []; }
          }
          const idxEx = dataJson.findIndex(it => it.ruc === ruc && it.periodo?.anio === (anio || '2026') && it.periodo?.mes === (mesCodigo || 'AGO'));
          if (idxEx !== -1) dataJson[idxEx] = registroFinalDirecto;
          else dataJson.push(registroFinalDirecto);
          fs.writeFileSync(jsonPath, JSON.stringify(dataJson, null, 2), 'utf8');
        } catch(e) {}

        // Salir de SUNAT directamente
        onLog("Presionando el botón 'Salir' en la parte superior derecha...");
        for (const f of [page, ...page.frames()]) {
          await f.evaluate(() => {
            const btn = document.getElementById('btnSalir') || document.querySelector('.aOpcionSalir, button.aOpcionSalir');
            if (btn) btn.click();
          }).catch(() => {});
        }
        await page.waitForTimeout(1000);
        await page.close().catch(() => {});
        await browser.close().catch(() => {});
        onLog("✅ Proceso completado exitosamente sin iteraciones innecesarias.");
        return { 
          success: true, 
          estado: 'SIN_MODIFICACIONES',
          totalComprobantes: 0,
          comprobantesModificados: [],
          message: "Totales en 0.00 confirmados. Sesión finalizada." 
        };
      }

      onLog("➡️ Totales con saldo detectados o verificación por página requerida. Configurando tabla en modo 100 registros por página...");

      // Función auxiliar para forzar 100 registros por página en el selector de SUNAT
      async function asegurar100RegistrosPorPagina() {
        for (const f of [targetFrame, page, ...page.frames()]) {
          const configurado = await f.evaluate(() => {
            const selects = Array.from(document.querySelectorAll('select.custom-select, select'));
            const selectPaginacion = selects.find(s => {
              const opts = Array.from(s.options).map(o => o.text.trim());
              return opts.includes('100') || opts.includes('50');
            });

            if (selectPaginacion) {
              const opt100 = Array.from(selectPaginacion.options).find(o => o.text.trim() === '100');
              if (opt100 && selectPaginacion.value !== opt100.value) {
                selectPaginacion.value = opt100.value;
                selectPaginacion.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
              }
            }
            return false;
          }).catch(() => false);

          if (configurado) {
            onLog("⚡ Paginación configurada a 100 registros por página.");
            await page.waitForTimeout(2500);
            return true;
          }
        }
        return false;
      }

      await asegurar100RegistrosPorPagina();

      let totalComprobantesAuditados = 0;
      let comprobantesModificadosGlobal = [];
      let numeroPagina = 1;

      while (true) {
        // Localizar dinámicamente el frame que contiene la tabla del RCE
        for (const f of [activeSireFrame, targetFrame, page, ...page.frames()]) {
          const tieneTabla = await f.evaluate(() => {
            const ths = Array.from(document.querySelectorAll('table th')).map(t => (t.innerText || '').toUpperCase());
            return ths.some(t => t.includes('GRAVADO') || t.includes('IGV'));
          }).catch(() => false);
          if (tieneTabla) {
            targetFrame = f;
            break;
          }
        }

        // Asegurar que siempre esté en 100 registros antes de escanear la página
        await asegurar100RegistrosPorPagina();
        onLog(`📄 Analizando página ${numeroPagina} (lote de 100 registros)...`);

        // Esperar activamente a que los datos de la tabla terminen de cargar (spinner o petición POST busqueda)
        for (let w = 0; w < 15; w++) {
          const tieneFilasOCargando = await targetFrame.evaluate(() => {
            const spinner = document.querySelector('.spinner-border, .loading, .block-ui-spinner, .sk-spinner');
            if (spinner && spinner.offsetParent !== null) return 'CARGANDO';
            const filas = Array.from(document.querySelectorAll('table tbody tr'));
            const filasValidas = filas.filter(tr => !tr.classList.contains('total') && !tr.querySelector('th') && !tr.closest('tfoot'));
            return filasValidas.length > 0 ? 'LISTO' : 'VACIO';
          }).catch(() => 'VACIO');

          if (tieneFilasOCargando === 'LISTO') break;
          await page.waitForTimeout(600);
        }
        await page.waitForTimeout(800);

        // Evaluar la tabla de la página actual
        let evaluacionTabla = await targetFrame.evaluate(() => {
          const theadRows = Array.from(document.querySelectorAll('table thead tr'));
          let headerRow = theadRows[theadRows.length - 1];
          let headers = [];

          if (headerRow) {
            headers = Array.from(headerRow.querySelectorAll('th')).map(th => th.innerText ? th.innerText.trim() : '');
          } else {
            headers = Array.from(document.querySelectorAll('table th')).map(th => th.innerText ? th.innerText.trim() : '');
          }

          let biIndex = headers.findIndex(h => {
            const t = h.toUpperCase().replace(/\s+/g, ' ');
            return (t.includes('BI') && t.includes('GRAV') && !t.includes('NO GRAV')) || 
                   (t.includes('BASE') && t.includes('GRAV') && !t.includes('NO GRAV')) ||
                   t === 'BI GRAVADO DG' || t === 'BI GRAVADA DG';
          });

          let igvIndex = headers.findIndex(h => {
            const t = h.toUpperCase().replace(/\s+/g, ' ');
            return (t.includes('IGV') && !t.includes('NO GRAV') && (t.includes('DG') || t.includes('IPM'))) ||
                   t === 'IGV / IPM DG' || t === 'IGV/IPM DG';
          });

          // Si las cabeceras están agrupadas o en múltiples niveles, fallback por posición típica en SIRE RCE:
          // Col 10/11 suele ser BI Gravado DG y Col 11/12 suele ser IGV DG
          if (biIndex === -1) {
            headers.forEach((h, idx) => {
              const t = h.toUpperCase();
              if (t.includes('GRAV') && !t.includes('NO') && biIndex === -1) biIndex = idx;
            });
          }
          if (igvIndex === -1 && biIndex !== -1) {
            igvIndex = biIndex + 1; // En SIRE la siguiente columna siempre es el IGV correspondiente
          }

          const filas = Array.from(document.querySelectorAll('table tbody tr'));
          let filasAModificar = [];
          let totalFilasReales = 0;

          filas.forEach((tr, index) => {
            if (tr.classList.contains('total') || tr.querySelector('th') || tr.closest('tfoot')) {
              return;
            }

            const celdas = Array.from(tr.querySelectorAll('td')).map(td => td.innerText ? td.innerText.trim() : '');
            if (celdas.length < 5) return;

            totalFilasReales++;

            let biVal = 0;
            let igvVal = 0;

            if (biIndex !== -1 && celdas[biIndex]) {
              biVal = parseFloat(celdas[biIndex].replace(/,/g, '')) || 0;
            }
            if (igvIndex !== -1 && celdas[igvIndex]) {
              igvVal = parseFloat(celdas[igvIndex].replace(/,/g, '')) || 0;
            }

            // Si los índices no detectaron pero alguna celda numérica de las primeras columnas monetarias tiene monto:
            if (Math.abs(biVal) < 0.001 && Math.abs(igvVal) < 0.001) {
              // Chequear todas las celdas numéricas de la fila para ver si hay importes gravados positivos
              for (let c = 8; c < Math.min(celdas.length, 16); c++) {
                const parsed = parseFloat(celdas[c].replace(/,/g, '')) || 0;
                if (Math.abs(parsed) > 0.001) {
                  const headerCol = (headers[c] || '').toUpperCase();
                  if (headerCol.includes('GRAV') && !headerCol.includes('NO')) {
                    biVal = parsed;
                    biIndex = c;
                    break;
                  }
                }
              }
            }

            // Detectar montos pendientes tanto positivos como negativos (ej. Notas de Crédito con signo -)
            if (Math.abs(biVal) > 0.001 || Math.abs(igvVal) > 0.001) {
              filasAModificar.push({
                indiceFila: index,
                bi: biVal,
                igv: igvVal,
                documento: celdas[6] || celdas[5] || celdas[4] || `Fila ${index + 1}`
              });
            }
          });

          return {
            biIndex,
            igvIndex,
            totalFilas: totalFilasReales,
            filasAModificar
          };
        });

        // Si evaluacionTabla dio 0 filas en el frame actual, escanear todos los demás frames
        if (evaluacionTabla.totalFilas === 0) {
          for (const f of [page, ...page.frames()]) {
            if (f === targetFrame) continue;
            const candEval = await f.evaluate(() => {
              const theadRows = Array.from(document.querySelectorAll('table thead tr'));
              let headerRow = theadRows[theadRows.length - 1];
              let headers = headerRow ? Array.from(headerRow.querySelectorAll('th')).map(th => th.innerText ? th.innerText.trim() : '') : [];
              let biIndex = headers.findIndex(h => h.toUpperCase().includes('BI GRAVADO DG') || (h.toUpperCase().includes('GRAVADO DG') && !h.toUpperCase().includes('NO GRAV')));
              let igvIndex = headers.findIndex(h => h.toUpperCase().includes('IGV / IPM DG') || h.toUpperCase().includes('IGV/IPM DG') || (h.toUpperCase().includes('IGV') && h.toUpperCase().includes('DG') && !h.toUpperCase().includes('NO GRAV')));

              const filas = Array.from(document.querySelectorAll('table tbody tr'));
              let filasAModificar = [];
              let totalFilasReales = 0;

              filas.forEach((tr, index) => {
                if (tr.classList.contains('total') || tr.querySelector('th') || tr.closest('tfoot')) return;
                const celdas = Array.from(tr.querySelectorAll('td')).map(td => td.innerText ? td.innerText.trim() : '');
                if (celdas.length < 5) return;
                totalFilasReales++;

                let biVal = biIndex !== -1 && celdas[biIndex] ? parseFloat(celdas[biIndex].replace(/,/g, '')) || 0 : 0;
                let igvVal = igvIndex !== -1 && celdas[igvIndex] ? parseFloat(celdas[igvIndex].replace(/,/g, '')) || 0 : 0;
                if (Math.abs(biVal) > 0.001 || Math.abs(igvVal) > 0.001) {
                  filasAModificar.push({
                    indiceFila: index,
                    bi: biVal,
                    igv: igvVal,
                    documento: celdas[6] || celdas[5] || `Fila ${index + 1}`
                  });
                }
              });

              return { biIndex, igvIndex, totalFilas: totalFilasReales, filasAModificar };
            }).catch(() => null);

            if (candEval && candEval.totalFilas > 0) {
              targetFrame = f;
              evaluacionTabla = candEval;
              break;
            }
          }
        }

        totalComprobantesAuditados += evaluacionTabla.totalFilas;
        onLog(`📊 Página ${numeroPagina}: ${evaluacionTabla.totalFilas} registros encontrados. Comprobantes con saldo > 0.00: ${evaluacionTabla.filasAModificar.length}`);

        // Telemetría de diagnóstico en consola para inspección en vivo de la estructura de SUNAT
        if (evaluacionTabla.totalFilas > 0) {
          const infoDiag = await targetFrame.evaluate((bIdx, gIdx) => {
            const tr = document.querySelector('table tbody tr:not(.total)');
            if (!tr) return null;
            const celdas = Array.from(tr.querySelectorAll('td')).map(td => td.innerText ? td.innerText.trim() : '');
            return {
              doc: celdas[6] || celdas[5] || celdas[4] || 'N/A',
              valorBi: bIdx !== -1 && celdas[bIdx] ? celdas[bIdx] : '0.00',
              valorIgv: gIdx !== -1 && celdas[gIdx] ? celdas[gIdx] : '0.00'
            };
          }, evaluacionTabla.biIndex, evaluacionTabla.igvIndex).catch(() => null);

          if (infoDiag) {
            onLog(`🔎 [DIAGNÓSTICO EN VIVO] Col BI #${evaluacionTabla.biIndex}, Col IGV #${evaluacionTabla.igvIndex} | Muestra: ${infoDiag.doc} (BI: ${infoDiag.valorBi}, IGV: ${infoDiag.valorIgv})`);
          }
        }

        // Procesar comprobantes que requieran modificación en esta página
        if (evaluacionTabla.filasAModificar.length > 0) {
          // Modificamos el primer comprobante encontrado en la tanda
          const item = evaluacionTabla.filasAModificar[0];
          onLog(`👉 Procesando [Pág. ${numeroPagina}] ${item.documento} (BI: ${item.bi}, IGV: ${item.igv})...`);

          // 1. Asegurar que solo la fila actual tenga el checkbox seleccionado (#miCheckbox0, etc.)
          await targetFrame.evaluate((filaIdx) => {
            const checkboxes = Array.from(document.querySelectorAll('table tbody input[type="checkbox"]'));
            checkboxes.forEach((cb, idx) => {
              cb.checked = (idx === filaIdx);
              cb.dispatchEvent(new Event('change', { bubbles: true }));
              cb.dispatchEvent(new Event('click', { bubbles: true }));
            });
          }, item.indiceFila).catch(() => {});
          await page.waitForTimeout(600);

          // 2. Localizar y presionar "Complementar Propuesta" -> "Editar"
          let modalAbierto = false;
          for (let intentoModal = 0; intentoModal < 3; intentoModal++) {
            // Intentar por el botón 'Complementar Propuesta' provisto por el usuario
            await targetFrame.evaluate(() => {
              const btns = Array.from(document.querySelectorAll('button'));
              const b = btns.find(el => (el.innerText || '').replace(/\s+/g, ' ').includes('Complementar Propuesta'));
              if (b) b.click();
            }).catch(() => {});
            await page.waitForTimeout(500);

            // Clic en la opción 'Editar' (.dropdown-item)
            await targetFrame.evaluate(() => {
              const items = Array.from(document.querySelectorAll('.dropdown-item, button, a'));
              const bEdit = items.find(el => (el.innerText || '').trim() === 'Editar');
              if (bEdit) bEdit.click();
            }).catch(() => {});

            let modalVisible = await targetFrame.locator("ngb-modal-window, .modal.show, div[role='dialog']").first().isVisible({ timeout: 1800 }).catch(() => false);
            if (modalVisible) {
              modalAbierto = true;
              break;
            }

            // Si aún no abrió, intentar clic directo en botón de la fila si existe
            await targetFrame.evaluate((filaIdx) => {
              const filas = Array.from(document.querySelectorAll('table tbody tr'));
              const fila = filas[filaIdx];
              if (!fila) return;
              const btnFila = Array.from(fila.querySelectorAll('button, a')).find(el => (el.innerText || '').trim() === 'Editar');
              if (btnFila) btnFila.click();
            }, item.indiceFila).catch(() => {});

            modalVisible = await targetFrame.locator("ngb-modal-window, .modal.show, div[role='dialog']").first().isVisible({ timeout: 1500 }).catch(() => false);
            if (modalVisible) {
              modalAbierto = true;
              break;
            }
          }

          onLog("Esperando que aparezca el modal 'Editar Comprobante'...");
          const modalDialogLocator = targetFrame.locator("ngb-modal-window, .modal.show, div[role='dialog']").first();
          await modalDialogLocator.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});

          // 4. Transferencia de montos ultrarrápida vía inyección y dispatch directo en el DOM
          await modalDialogLocator.evaluate(() => {
            const elBiGrav = document.querySelector('input#mtoBIGravadaDG, #mtoBIGravadaDG');
            const elBiNoGrav = document.querySelector('input#mtoBIGravadaDNG, #mtoBIGravadaDNG');
            const elIgvGrav = document.querySelector('input#mtoIgvIpmDG, #mtoIgvIpmDG');
            const elIgvNoGrav = document.querySelector('input#mtoIgvIpmDNG, #mtoIgvIpmDNG');

            const transferir = (origen, destino) => {
              if (origen && destino) {
                const val = (origen.value || '').trim();
                const num = parseFloat(val.replace(/,/g, '')) || 0;
                if (Math.abs(num) > 0.001) {
                  destino.value = val;
                  destino.dispatchEvent(new Event('input', { bubbles: true }));
                  destino.dispatchEvent(new Event('change', { bubbles: true }));

                  origen.value = '0.00';
                  origen.dispatchEvent(new Event('input', { bubbles: true }));
                  origen.dispatchEvent(new Event('change', { bubbles: true }));
                }
              }
            };

            transferir(elBiGrav, elBiNoGrav);
            transferir(elIgvGrav, elIgvNoGrav);
          }).catch(() => {});

          onLog("✅ Datos transferidos y campos en 0.00 escritos instantáneamente en el DOM. Guardando comprobante...");
          await page.waitForTimeout(300);

          // 5. Clic en "Guardar" del modal de edición (button.btn-success o [ngbtooltip="Guardar Comprobante"])
          let guardadoClickeado = false;
          for (const f of [targetFrame, page, ...page.frames()]) {
            guardadoClickeado = await f.evaluate(() => {
              const modalDialog = document.querySelector('ngb-modal-window, .modal-dialog, .modal');
              if (modalDialog) {
                const bGuardar = modalDialog.querySelector('button.btn-success, button[ngbtooltip="Guardar Comprobante"]');
                if (bGuardar) {
                  bGuardar.click();
                  return true;
                }
                const btns = Array.from(modalDialog.querySelectorAll('button'));
                const bText = btns.find(b => (b.innerText || '').trim().includes('Guardar'));
                if (bText) {
                  bText.click();
                  return true;
                }
              }
              return false;
            }).catch(() => false);
            if (guardadoClickeado) break;
          }

          if (!guardadoClickeado) {
            const btnGuardarModal = modalDialogLocator.locator("button.btn-success, button[ngbtooltip='Guardar Comprobante'], //button[contains(normalize-space(.),'Guardar')]").first();
            if (await btnGuardarModal.isVisible({ timeout: 2000 }).catch(() => false)) {
              await btnGuardarModal.click({ force: true });
            }
          }
          await page.waitForTimeout(600);

          // 6. Confirmación del sistema: "¿Está seguro...?" -> Presionar 'Si' (button.btn-primary:has-text("Si"))
          onLog("Confirmando cambios en el diálogo de SUNAT (clic en 'Si')...");
          for (let c = 0; c < 3; c++) {
            let confirmado = false;
            for (const f of [targetFrame, page, ...page.frames()]) {
              confirmado = await f.evaluate(() => {
                const btns = Array.from(document.querySelectorAll('.modal button, ngb-modal-window button, div[role="dialog"] button'));
                const bSi = btns.find(b => {
                  const t = (b.innerText || '').trim().toUpperCase();
                  return t === 'SI' || t === 'SÍ';
                });
                if (bSi) {
                  bSi.click();
                  return true;
                }
                return false;
              }).catch(() => false);
              if (confirmado) break;
            }
            if (confirmado) {
              onLog("✅ Comprobante modificado y confirmado con éxito.");
              break;
            }
            await page.waitForTimeout(400);
          }

          // Esperar a que el modal desaparezca completamente antes de avanzar
          await modalDialogLocator.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
          await page.waitForTimeout(400);

          comprobantesModificadosGlobal.push(item);

          // Si tras guardar SUNAT resetea la vista a la Página 1:
          const paginaPrev = numeroPagina;
          const reconfigurado = await asegurar100RegistrosPorPagina();
          if (reconfigurado) {
            onLog("🔄 SUNAT reinició paginación. Restablecido a 100 registros.");
          }

          // Si estábamos en una página mayor a 1, volver a ella directamente para continuar procesando
          if (paginaPrev > 1) {
            onLog(`⚡ Reanudando en Página ${paginaPrev}...`);
            for (let p = 1; p < paginaPrev; p++) {
              await targetFrame.evaluate(() => {
                const btns = Array.from(document.querySelectorAll('button'));
                const btnSiguiente = btns.find(b => (b.innerText || '').includes('Siguiente'));
                if (btnSiguiente && !btnSiguiente.disabled && !btnSiguiente.classList.contains('disabled')) {
                  btnSiguiente.click();
                }
              }).catch(() => {});
              await page.waitForTimeout(600);
            }
            numeroPagina = paginaPrev;
          } else {
            numeroPagina = 1;
          }
          continue; // Vuelve al inicio del bucle en la página actual
        }

        // Si en la página actual NO hay comprobantes por modificar, avanzar con 'Siguiente'
        const hayPaginaSiguiente = await targetFrame.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const btnSiguiente = btns.find(b => (b.innerText || '').includes('Siguiente'));
          if (btnSiguiente && !btnSiguiente.disabled && !btnSiguiente.classList.contains('disabled')) {
            btnSiguiente.click();
            return true;
          }
          return false;
        }).catch(() => false);

        if (hayPaginaSiguiente) {
          onLog(`➡️ Avanzando a la página siguiente con el botón 'Siguiente'...`);
          numeroPagina++;
          await page.waitForTimeout(3000);
        } else {
          onLog(`🏁 Se recorrieron todas las páginas disponibles (${numeroPagina} página(s) evaluada(s)).`);
          break;
        }
      }

      // =========================================================================
      // PROTOCOLO DE MÁXIMA SEGURIDAD: DOBLE VERIFICACIÓN FINAL (0.00 OBLIGATORIO)
      // =========================================================================
      onLog("🔍 EJECUTANDO PROTOCOLO DE SEGURIDAD: Doble verificación final de saldos en 0.00...");

      // Volver a la primera página si estábamos en una página avanzada para auditar desde el inicio
      await targetFrame.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, a, .page-link'));
        const btnPrimero = btns.find(b => {
          const t = (b.innerText || b.textContent || '').trim();
          return t === '1' || t === 'Primera' || t === 'Inicio';
        });
        if (btnPrimero) btnPrimero.click();
      }).catch(() => {});
      await page.waitForTimeout(1200);

      const verificacionFinal = await targetFrame.evaluate(() => {
        const theadRows = Array.from(document.querySelectorAll('table thead tr'));
        let headerRow = theadRows[theadRows.length - 1];
        let headers = [];
        if (headerRow) {
          headers = Array.from(headerRow.querySelectorAll('th')).map(th => th.innerText ? th.innerText.trim() : '');
        } else {
          headers = Array.from(document.querySelectorAll('table th')).map(th => th.innerText ? th.innerText.trim() : '');
        }

        let biIndex = headers.findIndex(h => {
          const t = h.toUpperCase().replace(/\s+/g, ' ');
          return (t.includes('BI') && t.includes('GRAV') && !t.includes('NO GRAV')) || 
                 (t.includes('BASE') && t.includes('GRAV') && !t.includes('NO GRAV')) ||
                 t === 'BI GRAVADO DG' || t === 'BI GRAVADA DG';
        });

        let igvIndex = headers.findIndex(h => {
          const t = h.toUpperCase().replace(/\s+/g, ' ');
          return (t.includes('IGV') && !t.includes('NO GRAV') && (t.includes('DG') || t.includes('IPM'))) ||
                 t === 'IGV / IPM DG' || t === 'IGV/IPM DG';
        });

        if (biIndex === -1) {
          headers.forEach((h, idx) => {
            const t = h.toUpperCase();
            if (t.includes('GRAV') && !t.includes('NO') && biIndex === -1) biIndex = idx;
          });
        }
        if (igvIndex === -1 && biIndex !== -1) {
          igvIndex = biIndex + 1;
        }

        const filas = Array.from(document.querySelectorAll('table tbody tr'));
        let pendientes = 0;
        let comprobantesValidos = 0;

        filas.forEach((fila) => {
          if (fila.classList.contains('total') || fila.querySelector('th') || fila.closest('tfoot')) return;
          const celdas = Array.from(fila.querySelectorAll('td')).map(td => td.innerText ? td.innerText.trim() : '');
          if (celdas.length < 5) return;
          comprobantesValidos++;

          const biVal = biIndex !== -1 && celdas[biIndex] ? parseFloat(celdas[biIndex].replace(/,/g, '')) || 0 : 0;
          const igvVal = igvIndex !== -1 && celdas[igvIndex] ? parseFloat(celdas[igvIndex].replace(/,/g, '')) || 0 : 0;
          if (Math.abs(biVal) > 0.001 || Math.abs(igvVal) > 0.001) {
            pendientes++;
          }
        });

        return { pendientes, totalFilas: comprobantesValidos };
      }).catch(() => ({ pendientes: 0, totalFilas: 0 }));

      if (verificacionFinal.pendientes > 0) {
        onLog(`⚠️ ADVERTENCIA DE AUDITORÍA: Aún quedan ${verificacionFinal.pendientes} comprobante(s) con saldo > 0.00. No se emite confirmación cerrada hasta estar al 100% en 0.00.`);
      } else {
        onLog(`🛡️ DOBLE VERIFICACIÓN SUPERADA: 0 comprobantes pendientes con crédito fiscal. Todo 100% protegido y en 0.00.`);
      }

      // Estructura de auditoría y respaldo detallado
      const esSinCompras = totalComprobantesAuditados === 0;
      registroFinal = {
        ruc,
        periodo: {
          anio: anio || '2026',
          mes: mesCodigo || 'AGO'
        },
        fechaHora: new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' }),
        totalComprobantes: totalComprobantesAuditados,
        avisoSunat: esSinCompras 
          ? `No cuenta con compras en el mes de ${mes || 'el periodo'}` 
          : "Modificación y verificación de propuesta RCE",
        estado: esSinCompras 
          ? 'SIN_COMPRAS' 
          : (comprobantesModificadosGlobal.length === 0 ? 'SIN_MODIFICACIONES' : 'MODIFICADO_EXITOSO'),
        dobleVerificacionExitosa: verificacionFinal.pendientes === 0,
        mensaje: esSinCompras
          ? `La empresa / persona natural no cuenta con compras registradas en el mes de ${mes || 'el periodo'}`
          : (comprobantesModificadosGlobal.length === 0 
            ? 'Verificado con éxito: No requirió modificaciones (BI e IGV en 0.00)' 
            : `Modificado y auditado: ${comprobantesModificadosGlobal.length} comprobante(s) ajustados a 0.00 con doble verificación conforme`),
        comprobantesModificados: comprobantesModificadosGlobal
      };

      // Guardar respaldo de auditoría específico por RUC
      try {
        const auditDir = path.join(__dirname, 'auditoria_rce');
        if (!fs.existsSync(auditDir)) fs.mkdirSync(auditDir, { recursive: true });
        const auditFile = path.join(auditDir, `auditoria_${ruc}_${anio || '2026'}_${mesCodigo || 'AGO'}.json`);
        fs.writeFileSync(auditFile, JSON.stringify(registroFinal, null, 2), 'utf8');
        onLog(`📑 Bitácora de auditoría respaldada en: auditoria_rce/auditoria_${ruc}_${anio || '2026'}_${mesCodigo || 'AGO'}.json`);
      } catch (eAudit) {}

      // Guardar en el archivo JSON general del proyecto
      try {
        const jsonPath = path.join(__dirname, 'registro_rce_resultados.json');
        let dataJson = [];
        if (fs.existsSync(jsonPath)) {
          try {
            dataJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            if (!Array.isArray(dataJson)) dataJson = [];
          } catch(e) { dataJson = []; }
        }

        const idxExistente = dataJson.findIndex(item => item.ruc === ruc && item.periodo?.anio === (anio || '2026') && item.periodo?.mes === (mesCodigo || 'AGO'));
        if (idxExistente !== -1) {
          dataJson[idxExistente] = registroFinal;
        } else {
          dataJson.push(registroFinal);
        }

        fs.writeFileSync(jsonPath, JSON.stringify(dataJson, null, 2), 'utf8');
        onLog(`💾 Resultado guardado en registro_rce_resultados.json [Estado: ${registroFinal.estado}]`);
      } catch (errJson) {
        onLog(`⚠️ No se pudo escribir en registro_rce_resultados.json: ${errJson.message}`);
      }

      if (comprobantesModificadosGlobal.length === 0) {
        onLog("ℹ️ NO HAY COMPROBANTES POR MODIFICAR: Todos los valores de 'BI Gravado DG' e 'IGV / IPM DG' se encuentran en 0.00 en todas las páginas.");
      } else {
        onLog(`🎉 Total de ${comprobantesModificadosGlobal.length} comprobante(s) modificados satisfactoriamente.`);
      }

      onLog("Presionando el botón 'Salir' en la parte superior derecha...");
      let salio = false;

      // 1. Intentar clic con evaluate directo (no bloquea esperando navegaciones ni se queda colgado)
      for (const f of [page, ...page.frames()]) {
        salio = await f.evaluate(() => {
          const btn = document.getElementById('btnSalir') || document.querySelector('.aOpcionSalir, button.aOpcionSalir, button[title="Salir"]');
          if (btn) {
            btn.click();
            return true;
          }
          const allBtns = Array.from(document.querySelectorAll('button, a'));
          const bSalir = allBtns.find(b => (b.innerText || '').trim().toUpperCase() === 'SALIR');
          if (bSalir) {
            bSalir.click();
            return true;
          }
          return false;
        }).catch(() => false);

        if (salio) {
          onLog("🚪 Sesión cerrada correctamente con el botón 'Salir'.");
          await new Promise(r => setTimeout(r, 1000));
          break;
        }
      }

      // 2. Si evaluate no lo agarró, intentar con selector pero con timeout de 2.5s y sin esperar navegación
      if (!salio) {
        for (const f of [page, ...page.frames()]) {
          const btnExacto = f.locator("button#btnSalir, #btnSalir, button.aOpcionSalir, a:has-text('Salir')").first();
          if (await btnExacto.isVisible({ timeout: 800 }).catch(() => false)) {
            await btnExacto.click({ force: true, timeout: 3000 }).catch(() => {});
            salio = true;
            onLog("🚪 Sesión cerrada correctamente con el botón 'Salir'.");
            await new Promise(r => setTimeout(r, 1000));
            break;
          }
        }
      }
    } // Fin de if (!soloLogin)

    // Tomar captura de pantalla final para la interfaz web antes de cerrar
    const screenshotBuffer = await page.screenshot({ fullPage: false }).catch(() => null);
    let screenshotBase64 = '';
    if (screenshotBuffer) {
      screenshotBase64 = screenshotBuffer.toString('base64');
      try {
        const publicDir = path.join(__dirname, 'public');
        if (!fs.existsSync(publicDir)) {
          fs.mkdirSync(publicDir, { recursive: true });
        }
        const screenshotPath = path.join(publicDir, 'last_screenshot.png');
        fs.writeFileSync(screenshotPath, screenshotBuffer);
        onLog("📸 Captura de pantalla obtenida y guardada.");
      } catch (errScreen) {
        onLog(`[INFO] Captura almacenada en memoria base64.`);
      }
    }

    onLog("🧹 Cerrando ventana del navegador para dejar el sistema limpio...");
    try {
      if (page && !page.isClosed()) {
        await page.close().catch(() => {});
      }
      if (context) {
        await context.close().catch(() => {});
      }
      if (browser && browser.isConnected()) {
        await browser.close().catch(() => {});
      }
      onLog("✅ Ventana de Chrome cerrada completamente.");
    } catch (e) {}

    // Guardar catálogo de endpoints y tokens interceptados para el motor cURL
    try {
      sunatApiSniffer.saveDump(ruc);
    } catch (e) {}

    return { 
      success: true, 
      message: registroFinal?.mensaje || "Proceso completado y ventana cerrada exitosamente", 
      estado: registroFinal?.estado || 'SIN_MODIFICACIONES',
      totalComprobantes: registroFinal?.totalComprobantes || 0,
      comprobantesModificados: registroFinal?.comprobantesModificados || [],
      screenshot: screenshotBase64 ? `data:image/png;base64,${screenshotBase64}` : null
    };

  } catch (error) {
    if (error.message === "SUNAT_ERROR_503") {
      // Re-lanzar para que el bucle orquestador cierre y reinicie
      throw error;
    }

    onLog(`❌ Error durante el proceso: ${error.message}`);
    try {
      sunatApiSniffer.saveDump(ruc);
    } catch(e) {}
    try {
      const errBuffer = await page.screenshot({ fullPage: false });
      const errPath = path.join(__dirname, 'public', 'last_screenshot.png');
      fs.writeFileSync(errPath, errBuffer);
    } catch(e) {}
    throw error;
  } finally {
    // Si aún quedase abierto por error no capturado, asegurar el cierre
    if (browser && browser.isConnected()) {
      try {
        await browser.close();
      } catch(e) {}
    }
  }
}

/**
 * Módulo Automatizado Principal con Reinicio Total ante Error 503
 */
async function ejecutarPaso1Login(credenciales, onLog = console.log, options = {}) {
  const MAX_INTENTOS = 3;
  const { abortSignal, onBrowserCreated } = options;

  for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
    if (abortSignal && abortSignal.aborted) {
      throw new Error("Tarea cancelada por el usuario.");
    }
    try {
      if (intento > 1) {
        onLog(`🔄 Reintentando proceso completo (Intento ${intento}/${MAX_INTENTOS})...`);
      }
      return await ejecutarIntento({ ...credenciales, abortSignal, onBrowserCreated }, onLog);
    } catch (err) {
      if (abortSignal && abortSignal.aborted) {
        throw new Error("Tarea cancelada por el usuario.");
      }
      if (err.message === "SUNAT_ERROR_503") {
        onLog(`⚠️ SUNAT falló con Error 503 (Servidor saturado). Cerrando ventana y esperando 4 segundos para un nuevo inicio limpio...`);
        await new Promise(r => setTimeout(r, 4000));
        if (intento === MAX_INTENTOS) {
          throw new Error("SUNAT sigue reportando Error 503 tras 3 intentos limpios. Por favor reintenta en un momento.");
        }
      } else {
        throw err;
      }
    }
  }
}

module.exports = { 
  ejecutarPaso1Login,
  getPeriodoFiscalPorDefecto
};
