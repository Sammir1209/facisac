const { chromium } = require('playwright');

async function testValidLogin() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('https://api-seguridad.sunat.gob.pe/v1/clientessol/4f3b88b3-d9d6-402a-b85d-6a0bc857746a/oauth2/loginMenuSol?lang=es-PE&showDni=true&showLanguages=false&originalUrl=https://e-menu.sunat.gob.pe/cl-ti-itmenu/AutenticaMenuInternet.htm&state=test');
  
  page.on('response', async (res) => {
    if (res.url().includes('j_security_check') || res.status() === 302) {
      console.log('Interceptado:', res.url(), 'Status:', res.status(), 'Location:', res.headers()['location']);
    }
  });

  await page.locator('input#txtRuc').fill('20602118640');
  await page.locator('input#txtUsuario').fill('SSENECES');
  await page.locator('input#txtContrasena').fill('SUPERMARKe10');
  await page.locator('button#btnAceptar').click();
  
  await page.waitForTimeout(3500);
  console.log('URL Final tras login valido:', page.url());

  await browser.close();
}

testValidLogin();
