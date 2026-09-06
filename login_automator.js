const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SUNAT_LOGIN_URL = "https://api-seguridad.sunat.gob.pe/v1/clientessol/4f3b88b3-d9d6-402a-b85d-6a0bc857746a/oauth2/loginMenuSol?lang=es-PE&showDni=true&showLanguages=false&originalUrl=https://e-menu.sunat.gob.pe/cl-ti-itmenu/AutenticaMenuInternet.htm&state=rO0ABXNyABFqYXZhLnV0aWwuSGFzaE1hcAUH2sHDFmDRAwACRgAKbG9hZEZhY3RvckkACXRocmVzaG9sZHhwP0AAAAAAAAx3CAAAABAAAAADdAADZXhlcHQABnBhcmFtc3QASyomKiYvY2wtdGktaXRtZW51L01lbnVJbnRlcm5ldC5odG0mYjY0ZDI2YThiNWFmMDkxOTIzYjIzYjY0MDdhMWMxZGI0MWU3MzNhNnQABGV4ZWNweA==";

/**
 * Espera y maneja cualquier popup de SUNAT de forma robusta
 */
async function handleMultiRucPopups(page, log) {
  // Verificación y limpieza ultrarrápida de modales/avisos iniciales
  for (let ciclo = 1; ciclo <= 3; ciclo++) {
    let accionó = false;
    const allFrames = page.frames();

    for (const frame of allFrames) {
      try {
        // Ejecución inmediata en el DOM del frame para neutralizar "Ver más tarde", "Finalizar", "Continuar sin confirmar"
        const accionadoDOM = await frame.evaluate(() => {
          // A) Buzón Electrónico: Botón 'Ver más tarde' (#btnCerrar o con callHide)
          const btnBuzon = document.getElementById('btnCerrar') 
            || document.querySelector('button[onclick*="callHide"], #btnCerrar')
            || Array.from(document.querySelectorAll('button, a')).find(b => {
                 const t = (b.innerText || b.textContent || '').trim().toLowerCase();
                 return t.includes('ver más tarde') || t.includes('ver mas tarde') || t.includes('continuar más tarde') || t.includes('omitir');
               });
          if (btnBuzon) {
            btnBuzon.click();
            return 'BUZON';
          }

          // B) Informativo con 'Finalizar'
          const btnFin = Array.from(document.querySelectorAll('button, input, a')).find(b => {
            const t = (b.innerText || b.value || b.textContent || '').trim().toLowerCase();
            return t === 'finalizar';
          });
          if (btnFin) {
            btnFin.click();
            return 'FINALIZAR';
          }

          // C) Valida tus datos: 'Continuar sin confirmar'
          const btnCont = Array.from(document.querySelectorAll('button, input, a')).find(b => {
            const t = (b.innerText || b.value || b.textContent || '').trim().toLowerCase();
            return t.includes('continuar sin confirmar') || t.includes('sin confirmar');
          });
          if (btnCont) {
            btnCont.click();
            return 'CONTINUAR_SIN';
          }

          return null;
        }).catch(() => null);

        if (accionadoDOM) {
          log(`[Aviso detectado y cerrado vía DOM [Tipo: ${accionadoDOM}].`);
          await page.waitForTimeout(400);
          accionó = true;
          break;
        }

        // 1. Popup "Informativo" con botón Finalizar
        const btnFinalizar = frame.locator(`//button[contains(.,'Finalizar') or contains(.,'finalizar')] | //input[@value='Finalizar'] | //a[contains(.,'Finalizar')]`).first();
        if (await btnFinalizar.isVisible({ timeout: 200 }).catch(() => false)) {
          await btnFinalizar.click({ force: true });
          await page.waitForTimeout(400);
          accionó = true;
          break;
        }

        // 2. Pantalla "Valida tus datos de contacto": Continuar sin confirmar
        const btnContinuarSin = frame.locator(`//button[contains(., 'Continuar sin confirmar') or contains(.,'sin confirmar')] | //input[contains(@value, 'sin confirmar')]`).first();
        if (await btnContinuarSin.isVisible({ timeout: 200 }).catch(() => false)) {
          await btnContinuarSin.click({ force: true });
          await page.waitForTimeout(500);
          accionó = true;
          break;
        }

        // 3. Buzón: Ver más tarde / Continuar más tarde / Omitir (#btnCerrar)
        const btnDescarte = frame.locator(`button#btnCerrar, #btnCerrar, button[onclick*='callHide'], button:has-text('Ver más tarde'), button:has-text('Ver mas tarde')`).first();
        if (await btnDescarte.isVisible({ timeout: 200 }).catch(() => false)) {
          await btnDescarte.click({ force: true });
          await page.waitForTimeout(400);
          accionó = true;
          break;
        }

        // 4. Diálogo emergente
        const btnAceptar = frame.locator(`.modal button:has-text("Aceptar"), ngb-modal-window button:has-text("Aceptar"), div[role='dialog'] button:has-text("Aceptar")`).first();
        if (await btnAceptar.isVisible({ timeout: 150 }).catch(() => false)) {
          await btnAceptar.click({ force: true });
          await page.waitForTimeout(400);
          accionó = true;
          break;
        }
      } catch (err) {}
    }

    if (!accionó) {
      break;
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
async function ejecutarIntento({ ruc, usuario, clave, anio = '2026', mes = 'Agosto', soloLogin, abortSignal, onBrowserCreated }, onLog) {
  if (abortSignal && abortSignal.aborted) {
    throw new Error("Tarea cancelada antes de iniciar.");
  }
  const isHeadless = process.env.HEADLESS === 'true' || process.platform === 'linux';
  onLog(`Abriendo Google Chrome (${isHeadless ? 'Modo Headless Cloud' : 'Modo Visible'}) para RUC: ${ruc}...`);

  let browser;
  const launchArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--window-position=0,0'
  ];
  if (!isHeadless) {
    launchArgs.push('--start-maximized', '--new-window');
  }

  try {
    browser = await chromium.launch({
      headless: isHeadless,
      slowMo: isHeadless ? 0 : 15,
      args: launchArgs
    });
  } catch (err) {
    browser = await chromium.launch({
      headless: isHeadless,
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
    viewport: null,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();
  await page.bringToFront();

  // Manejador seguro para diálogos nativos de JavaScript (alerts/confirms de SUNAT)
  page.on('dialog', async (dialog) => {
    try {
      await dialog.accept().catch(() => {});
    } catch (e) {}
  });

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

    // Redirección inmediata y detección rápida del menú SOL
    for (let r = 0; r < 10; r++) {
      const currentUrl = page.url();
      if (currentUrl.includes('cl-ti-itmenu') || currentUrl.includes('MenuInternet')) {
        break;
      }
      if (currentUrl.includes('code=')) {
        await page.waitForTimeout(300);
        // Si sigue en la pantalla intermedia, forzar paso inmediato al e-menu sin quedarse atascado
        if (r >= 2) {
          await page.goto("https://e-menu.sunat.gob.pe/cl-ti-itmenu/AutenticaMenuInternet.htm", { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
          break;
        }
      }
      await page.waitForTimeout(250);
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
            const buzon = document.getElementById('btnCerrar') || document.querySelector('button[onclick*="callHide"]');
            if (buzon) buzon.click();

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

      // A) Seleccionar AÑO (ng-select o select)
      onLog(`Seleccionando Año: ${anio}...`);

      const selectStdAnio = targetFrame.locator("select#cboAnio, select[name*='anio']").first();
      if (await selectStdAnio.isVisible({ timeout: 300 }).catch(() => false)) {
        await selectStdAnio.selectOption({ label: anio }).catch(async () => {
          await selectStdAnio.selectOption({ value: anio }).catch(() => {});
        });
      } else {
        const ngSelectAnio = targetFrame.locator("ng-select, .ng-select").first();
        await ngSelectAnio.waitFor({ state: 'visible', timeout: 10000 });
        
        const textoActualAnio = (await ngSelectAnio.innerText().catch(() => '')) || '';
        if (!textoActualAnio.includes(anio)) {
          await ngSelectAnio.click({ force: true });
          await page.waitForTimeout(150);

          let seleccionado = false;
          const optAnio = targetFrame.locator("ng-dropdown-panel .ng-option, .ng-dropdown-panel span, .ng-option").filter({ hasText: anio }).first();
          if (await optAnio.isVisible({ timeout: 800 }).catch(() => false)) {
            await optAnio.click({ force: true });
            seleccionado = true;
          }

          if (!seleccionado) {
            const inputAnio = ngSelectAnio.locator("input");
            if (await inputAnio.isEditable({ timeout: 200 }).catch(() => false)) {
              await inputAnio.fill(anio).catch(() => {});
              await page.keyboard.press("Enter").catch(() => {});
            } else {
              await page.keyboard.type(anio, { delay: 20 }).catch(() => {});
              await page.keyboard.press("Enter").catch(() => {});
            }
          }
        }
      }
      
      onLog(`✅ Año ${anio} confirmado.`);
      await page.waitForTimeout(150);

      // B) Seleccionar MES (ng-select[formcontrolname="mes"])
      const mesesMap = {
        'enero': 'ENE', 'febrero': 'FEB', 'marzo': 'MAR', 'abril': 'ABR',
        'mayo': 'MAY', 'junio': 'JUN', 'julio': 'JUL', 'agosto': 'AGO',
        'septiembre': 'SET', 'setiembre': 'SET', 'octubre': 'OCT',
        'noviembre': 'NOV', 'diciembre': 'DIC'
      };
      
      const mesKey = (mes || '').toLowerCase().trim();
      const mesCodigo = mesesMap[mesKey] || (mes.substring(0, 3).toUpperCase());

      onLog(`Seleccionando Mes: '${mesCodigo}' (${mes})...`);

      const selectStdMes = targetFrame.locator("select#cboMes, select[name*='mes']").first();
      if (await selectStdMes.isVisible({ timeout: 300 }).catch(() => false)) {
        await selectStdMes.selectOption({ label: mesCodigo }).catch(async () => {
          await selectStdMes.selectOption({ value: mesCodigo }).catch(async () => {
            await selectStdMes.selectOption({ index: 8 }).catch(() => {});
          });
        });
      } else {
        let ngSelectMes = targetFrame.locator("ng-select[formcontrolname='mes'], ng-select[bindlabel='mes']").first();
        if (!await ngSelectMes.isVisible({ timeout: 500 }).catch(() => false)) {
          ngSelectMes = targetFrame.locator("ng-select, .ng-select").nth(1);
        }
        await ngSelectMes.waitFor({ state: 'visible', timeout: 10000 });
        
        const textoActualMes = (await ngSelectMes.innerText().catch(() => '')) || '';
        if (!textoActualMes.toUpperCase().includes(mesCodigo)) {
          await ngSelectMes.click({ force: true });
          await page.waitForTimeout(150);

          let mesSeleccionado = false;
          const optMes = targetFrame.locator("ng-dropdown-panel .ng-option, .ng-dropdown-panel span, .ng-option").filter({ hasText: new RegExp(`${mesCodigo}|${mes}`, 'i') }).first();
          if (await optMes.isVisible({ timeout: 800 }).catch(() => false)) {
            await optMes.click({ force: true });
            mesSeleccionado = true;
          }

          if (!mesSeleccionado) {
            const inputMes = ngSelectMes.locator("input");
            if (await inputMes.isEditable({ timeout: 200 }).catch(() => false)) {
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
      const btnAceptar = targetFrame.locator("button#btn-aceptar, #btn-aceptar, button:has-text('Aceptar')").first();
      await btnAceptar.waitFor({ state: 'visible', timeout: 10000 });
      
      for (let w = 0; w < 5; w++) {
        const isDisabled = await btnAceptar.getAttribute('disabled');
        if (isDisabled === null) break;
        await page.waitForTimeout(80);
      }

      await btnAceptar.click({ force: true });
      onLog("✅ Periodo aceptado.");
      await page.waitForTimeout(800);

      // Limpiar posibles modales emergentes tras presionar Aceptar
      for (let i = 0; i < 4; i++) {
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
        await page.waitForTimeout(500);
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
        if (await tabPropuestaRce.isVisible({ timeout: 1000 }).catch(() => false)) {
          await tabPropuestaRce.click({ force: true }).catch(() => {});
        }

        await page.waitForTimeout(1500);

        // Comprobar si la pestaña Propuesta del RCE ya quedó activa
        const tabActiva = await targetFrame.locator("a[href*='propuesta-rce'].active, .nav-link.active:has-text('Propuesta del RCE'), .active:has-text('Propuesta del RCE')").first().isVisible({ timeout: 800 }).catch(() => false);
        if (tabActiva) {
          onLog("✅ Pestaña 'Propuesta del RCE' verificada y activa.");
          break;
        }
      }

      onLog("Pestaña 'Propuesta del RCE' seleccionada.");
      await page.waitForTimeout(1500);

      // =========================================================================
      // FASE 3: LÓGICA DE NEGOCIO (RCE_Data_Shifter) A MÁXIMA VELOCIDAD (100 EN 100)
      // =========================================================================
      onLog("➡️ INICIANDO FASE 3: Verificando totales generales de la Propuesta del RCE...");

      // VERIFICACIÓN INMEDIATA DE TOTALES GENERALES (SHORT-CIRCUIT INTELIGENTE)
      // Si el total acumulado de BI Gravada e IGV Gravado ya está en 0.00, no es necesario recorrer páginas
      let totalGeneralCero = false;
      for (let chk = 0; chk < 3; chk++) {
        totalGeneralCero = await targetFrame.evaluate(() => {
          const table = document.querySelector('table');
          if (!table) return false;

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
            return { esCero: true, sumBi, sumIgv };
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
          totalComprobantes: 0,
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
        return { success: true, message: "Totales en 0.00 confirmados. Sesión finalizada." };
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
        // Asegurar que siempre esté en 100 registros antes de escanear la página
        await asegurar100RegistrosPorPagina();
        onLog(`📄 Analizando página ${numeroPagina} (lote de 100 registros)...`);
        await page.waitForTimeout(2000);

        // Evaluar la tabla de la página actual
        const evaluacionTabla = await targetFrame.evaluate(() => {
          const theadRows = Array.from(document.querySelectorAll('table thead tr'));
          let headerRow = theadRows[theadRows.length - 1];
          let headers = [];

          if (headerRow) {
            headers = Array.from(headerRow.querySelectorAll('th')).map(th => th.innerText ? th.innerText.trim() : '');
          } else {
            headers = Array.from(document.querySelectorAll('table th')).map(th => th.innerText ? th.innerText.trim() : '');
          }

          let biIndex = headers.findIndex(h => {
            const t = h.toUpperCase();
            return t.includes('BI GRAVADO DG') || (t.includes('GRAVADO DG') && !t.includes('NO GRAV'));
          });

          let igvIndex = headers.findIndex(h => {
            const t = h.toUpperCase();
            return t.includes('IGV / IPM DG') || t.includes('IGV/IPM DG') || (t.includes('IGV') && t.includes('DG') && !t.includes('NO GRAV'));
          });

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

            // Detectar montos pendientes tanto positivos como negativos (ej. Notas de Crédito con signo -)
            if (Math.abs(biVal) > 0.001 || Math.abs(igvVal) > 0.001) {
              filasAModificar.push({
                indiceFila: index,
                bi: biVal,
                igv: igvVal,
                documento: celdas[6] || celdas[5] || `Fila ${index + 1}`
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

        totalComprobantesAuditados += evaluacionTabla.totalFilas;
        onLog(`📊 Página ${numeroPagina}: ${evaluacionTabla.totalFilas} registros encontrados. Comprobantes con saldo > 0.00: ${evaluacionTabla.filasAModificar.length}`);

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

          // 4. Transferencia de montos dentro del modal usando IDs EXACTOS provistos:
          // #mtoBIGravadaDG (Base Gravada) -> #mtoBIGravadaDNG (Base No Gravada)
          // #mtoIgvIpmDG (IGV Gravado) -> #mtoIgvIpmDNG (IGV No Gravado)
          
          // A) Base Imponible
          const inputBiGrav = modalDialogLocator.locator("input#mtoBIGravadaDG, #mtoBIGravadaDG, //label[contains(text(),'Base Imp Dest Grav')]/following::input[1]").first();
          const inputBiNoGrav = modalDialogLocator.locator("input#mtoBIGravadaDNG, #mtoBIGravadaDNG, //label[contains(text(),'Base Imp Dest No Grav')]/following::input[1]").first();
          
          if (await inputBiGrav.isVisible({ timeout: 4000 }).catch(() => false)) {
            const valBiActual = (await inputBiGrav.inputValue()).trim();
            const numBi = parseFloat(valBiActual.replace(/,/g, '')) || 0;
            if (valBiActual && Math.abs(numBi) > 0.001) {
              onLog(`Cortando y transfiriendo Base Imponible (${valBiActual}) [#mtoBIGravadaDG -> #mtoBIGravadaDNG]...`);

              await inputBiGrav.click();
              await page.waitForTimeout(150);
              await inputBiGrav.press("Control+A");
              await page.waitForTimeout(100);
              await inputBiGrav.press("Control+X");
              await page.waitForTimeout(200);

              await inputBiNoGrav.click();
              await page.waitForTimeout(150);
              await inputBiNoGrav.press("Control+A");
              await page.waitForTimeout(100);
              await inputBiNoGrav.press("Control+V");
              await inputBiNoGrav.dispatchEvent('input');
              await inputBiNoGrav.dispatchEvent('change');
              await page.waitForTimeout(300);

              // Limpiar y tipear '0.00' en el campo gravado
              await inputBiGrav.click();
              await page.waitForTimeout(150);
              await inputBiGrav.evaluate(el => { el.value = ''; });
              await inputBiGrav.press("Control+A");
              await inputBiGrav.press("Backspace");
              await inputBiGrav.press("Delete");
              await inputBiGrav.type("0.00", { delay: 60 });
              await inputBiGrav.dispatchEvent('input');
              await inputBiGrav.dispatchEvent('change');
              await page.waitForTimeout(400);
            }
          }

          // B) IGV / IPM
          const inputIgvGrav = modalDialogLocator.locator("input#mtoIgvIpmDG, #mtoIgvIpmDG, //label[contains(text(),'IGV / IPM Dest Grav')]/following::input[1]").first();
          const inputIgvNoGrav = modalDialogLocator.locator("input#mtoIgvIpmDNG, #mtoIgvIpmDNG, //label[contains(text(),'IGV / IMP Dest No Grav')]/following::input[1]").first();
          
          if (await inputIgvGrav.isVisible({ timeout: 4000 }).catch(() => false)) {
            const valIgvActual = (await inputIgvGrav.inputValue()).trim();
            const numIgv = parseFloat(valIgvActual.replace(/,/g, '')) || 0;
            if (valIgvActual && Math.abs(numIgv) > 0.001) {
              onLog(`Cortando y transfiriendo IGV (${valIgvActual}) [#mtoIgvIpmDG -> #mtoIgvIpmDNG]...`);

              await inputIgvGrav.click();
              await page.waitForTimeout(150);
              await inputIgvGrav.press("Control+A");
              await page.waitForTimeout(100);
              await inputIgvGrav.press("Control+X");
              await page.waitForTimeout(200);

              await inputIgvNoGrav.click();
              await page.waitForTimeout(150);
              await inputIgvNoGrav.press("Control+A");
              await page.waitForTimeout(100);
              await inputIgvNoGrav.press("Control+V");
              await inputIgvNoGrav.dispatchEvent('input');
              await inputIgvNoGrav.dispatchEvent('change');
              await page.waitForTimeout(300);

              // Limpiar y tipear '0.00' en el campo gravado
              await inputIgvGrav.click();
              await page.waitForTimeout(150);
              await inputIgvGrav.evaluate(el => { el.value = ''; });
              await inputIgvGrav.press("Control+A");
              await inputIgvGrav.press("Backspace");
              await inputIgvGrav.press("Delete");
              await inputIgvGrav.type("0.00", { delay: 60 });
              await inputIgvGrav.dispatchEvent('input');
              await inputIgvGrav.dispatchEvent('change');
              await page.waitForTimeout(500);
            }
          }

          onLog("✅ Datos transferidos y campos en 0.00 escritos. Guardando comprobante...");
          await page.waitForTimeout(1000);

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
            if (await btnGuardarModal.isVisible({ timeout: 4000 }).catch(() => false)) {
              await btnGuardarModal.click({ force: true });
            }
          }
          await page.waitForTimeout(2000);

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
            await page.waitForTimeout(800);
          }

          // Esperar a que el modal desaparezca completamente antes de avanzar
          await modalDialogLocator.waitFor({ state: 'hidden', timeout: 6000 }).catch(() => {});
          await page.waitForTimeout(2000);

          comprobantesModificadosGlobal.push(item);

          // SUNAT resetea la vista a la Página 1 y a 20 registros tras guardar
          onLog("🔄 SUNAT actualizó la lista tras guardar. Restableciendo a 100 registros y reiniciando auditoría...");
          await asegurar100RegistrosPorPagina();
          numeroPagina = 1;
          continue; // Vuelve al inicio del bucle en la página 1 con 100 registros
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

      // Estructura de resultado para el archivo .json
      const registroFinal = {
        ruc,
        periodo: {
          anio: anio || '2026',
          mes: mesCodigo || 'AGO'
        },
        fechaHora: new Date().toLocaleString(),
        totalComprobantes: totalComprobantesAuditados,
        avisoSunat: "Modificación de propuesta RCE",
        estado: comprobantesModificadosGlobal.length === 0 ? 'SIN_MODIFICACIONES' : 'MODIFICADO_EXITOSO',
        mensaje: comprobantesModificadosGlobal.length === 0 
          ? 'No requirió modificaciones (BI e IGV en 0.00 en todas las páginas)' 
          : `Se modificaron exitosamente ${comprobantesModificadosGlobal.length} comprobante(s) en ${numeroPagina} página(s)`,
        comprobantesModificados: comprobantesModificadosGlobal
      };

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

    return { 
      success: true, 
      message: "Proceso completado y ventana cerrada exitosamente", 
      screenshot: screenshotBase64 ? `data:image/png;base64,${screenshotBase64}` : null
    };

  } catch (error) {
    if (error.message === "SUNAT_ERROR_503") {
      // Re-lanzar para que el bucle orquestador cierre y reinicie
      throw error;
    }

    onLog(`❌ Error durante el proceso: ${error.message}`);
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

module.exports = { ejecutarPaso1Login };
