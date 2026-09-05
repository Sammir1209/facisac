/**
 * ============================================================================
 * WORKFLOW: Sunat_RCE_Automation
 * Rol: Desarrollador Senior en Google Antigravity IDE
 * ============================================================================
 * 
 * Orquestación modular completa del proceso de reclasificación de adquisiciones
 * en el Registro de Compras Electrónico (RCE - SIRE) de la SUNAT.
 * 
 * GUÍA PARA BROWSER RECORDINGS Y AJUSTE DE SELECTORES:
 * ----------------------------------------------------------------------------
 * 1. Si SUNAT actualiza su portal web o los identificadores cambian, ejecuta
 *    una sesión interactiva con Browser Recording ("rce_recording_flow").
 * 2. Revisa el artifact de video WebP generado y el DOM snapshot.
 * 3. Modifica los XPath o selectores CSS en el diccionario SELECTORS de abajo.
 */

export const SELECTORS = {
  // --- FASE 1: Interceptores de Modales Asíncronos (Rules Multi-RUC) ---
  // Botones de postergación o descarte (Buzón, Datos de contacto, Campañas SUNAT)
  POPUP_DESCARTE_MULTI_RUC: `//div[contains(@class,'modal') or contains(@class,'dialog') or @role='dialog' or contains(@class,'swal')]//button[
    contains(translate(normalize-space(.), 'ÁÉÍÓÚABCDEFGHIJKLMNÑOPQRSTUVWXYZ', 'áéíóúabcdefghijklmnñopqrstuvwxyz'), 'ver más tarde') or
    contains(translate(normalize-space(.), 'ÁÉÍÓÚABCDEFGHIJKLMNÑOPQRSTUVWXYZ', 'áéíóúabcdefghijklmnñopqrstuvwxyz'), 'continuar más tarde') or
    contains(translate(normalize-space(.), 'ÁÉÍÓÚABCDEFGHIJKLMNÑOPQRSTUVWXYZ', 'áéíóúabcdefghijklmnñopqrstuvwxyz'), 'recordar más tarde') or
    contains(translate(normalize-space(.), 'ÁÉÍÓÚABCDEFGHIJKLMNÑOPQRSTUVWXYZ', 'áéíóúabcdefghijklmnñopqrstuvwxyz'), 'omitir') or
    contains(translate(normalize-space(.), 'ÁÉÍÓÚABCDEFGHIJKLMNÑOPQRSTUVWXYZ', 'áéíóúabcdefghijklmnñopqrstuvwxyz'), 'continuar sin')
  ]`,
  
  // Botones de confirmación / cierre rápido (Comunicados, Informativos SIRE, Avisos)
  POPUP_CONFIRMACION_MULTI_RUC: `//div[contains(@class,'modal') or contains(@class,'dialog') or @role='dialog' or contains(@class,'swal')]//button[
    normalize-space(.)='Aceptar' or
    normalize-space(.)='Continuar' or
    normalize-space(.)='Entendido' or
    normalize-space(.)='Cerrar'
  ]`,
  
  // Botón de cierre 'X' o dismiss
  POPUP_BTN_CLOSE_CSS: ".modal.show button.close, .modal.show [data-dismiss='modal'], .ui-dialog-titlebar-close, .swal2-close, button[aria-label='Close']",

  // --- FASE 2: Navegación de Menú y Periodos (Skill) ---
  MENU_EMPRESAS: "//a[normalize-space()='Empresas']",
  MENU_SIRE: "//a[contains(text(), 'Sistema Integrado de Registros Electrónicos')]",
  MENU_RCE: "//a[contains(text(), 'Registro de Compras Electrónico')]",
  MENU_GESTION_COMPRAS: "//a[contains(text(), 'Gestión de Compras')]",
  
  DROPDOWN_ANIO: "//select[@id='cboAnio' or contains(@name, 'anio')]",
  DROPDOWN_MES: "//select[@id='cboMes' or contains(@name, 'mes')]",
  BTN_ACEPTAR_FILTRO: "//button[normalize-space()='Aceptar']",
  TAB_PROPUESTA_RCE: "//li[contains(@class,'nav-item')]//a[contains(normalize-space(), 'Propuesta del RCE')]",

  // --- FASE 3: Lógica de Negocio y Formulario (Subagent RCE_Data_Shifter) ---
  TABLA_FILAS: "//table[contains(@class, 'table') or @id='tblPropuestaRce']//tbody/tr",
  BTN_COMPLEMENTAR_PROPUESTA: "//button[contains(., 'Complementar Propuesta')]",
  BTN_EDITAR: "//button[contains(., 'Editar')] | //a[contains(., 'Editar')]",
  MODAL_EDITAR_TITULO: "//h5[contains(., 'Editar Comprobante de Pago')] | //div[contains(@class, 'modal-title') and contains(., 'Editar')]",

  // Inputs del formulario modal de edición
  INPUT_BI_DEST_GRAV: "//label[contains(text(), 'Base Imp Dest Grav')]/following::input[1]",
  INPUT_BI_DEST_NO_GRAV: "//label[contains(text(), 'Base Imp Dest No Grav')]/following::input[1]",
  INPUT_IGV_DEST_GRAV: "//label[contains(text(), 'IGV / IPM Dest Grav')]/following::input[1]",
  INPUT_IGV_DEST_NO_GRAV: "//label[contains(text(), 'IGV / IMP Dest No Grav')]/following::input[1]",

  // Botones de acción final
  BTN_GUARDAR_EDICION: "//button[contains(@class, 'btn-success') or contains(@class, 'btn-primary')][contains(., 'Guardar')]",
  MODAL_CONFIRMACION_SI: "//div[contains(@class, 'modal')]//button[normalize-space()='SI' or normalize-space()='Sí']"
};

/**
 * Especificación de la Tarea del Subagente: RCE_Data_Shifter
 */
export const RCE_DATA_SHIFTER_SUBAGENT = {
  TaskName: "RCE Data Shifter",
  TaskSummary: "Escanear filas con BI Gravado DG > 0.00, complementar propuesta y reclasificar a Destino No Gravado.",
  RecordingName: "rce_data_shifter_run",
  Task: `
Eres el subagente 'RCE_Data_Shifter' en Antigravity IDE. Tu objetivo es realizar la lectura analítica y transferencia de valores (Data Shifting) en la Propuesta del RCE.

Sigue rigurosamente estos pasos:
1. LECTURA Y ESCANEO:
   - Inspecciona los encabezados (th) de la tabla cargada para localizar la columna 'BI Gravado DG'.
   - Recorre las filas (tr) del tbody y evalúa el valor numérico de dicha columna.
   - Encuentra la primera fila donde (parseFloat(valor) > 0.00).
   - Si ninguna fila cumple la condición, concluye informando: 'No existen filas con BI Gravado DG > 0.00'.

2. SELECCIÓN:
   - En la fila detectada, haz clic en el checkbox de la columna de inclusión ('Inc.') correspondiente a esa fila.

3. APERTURA:
   - Haz clic en el botón 'Complementar Propuesta'.
   - Haz clic en el botón u opción 'Editar'.
   - Espera de forma explícita hasta que el modal 'Editar Comprobante de Pago' esté completamente visible en el DOM.

4. TRANSFERENCIA DE VALORES (DATA SHIFTING):
   - Lee el valor numérico actual del input 'Base Imp Dest Grav' (ejemplo: 100.85).
   - Escribe exactamente ese valor en el input 'Base Imp Dest No Grav'.
   - Sobrescribe y deja en 0 o 0.00 el input 'Base Imp Dest Grav'.
   - Lee el valor actual del input 'IGV / IPM Dest Grav' (ejemplo: 18.15).
   - Escribe exactamente ese valor en el input 'IGV / IMP Dest No Grav'.
   - Sobrescribe y deja en 0 o 0.00 el input 'IGV / IPM Dest Grav'.

5. GUARDADO Y CONFIRMACIÓN:
   - Haz clic en el botón 'Guardar' (botón verde).
   - Intercepta la aparición del modal de confirmación ('¿Está seguro de modificar comprobante?').
   - Haz clic en el botón 'SI'.
   - Espera a que el modal se cierre y la tabla del RCE confirme la actualización.
   - Retorna un resumen con el comprobante editado y los montos reasignados.
`
};

/**
 * Función orquestadora del Workflow Sunat_RCE_Automation
 */
export async function Sunat_RCE_Automation(antigravityContext: any) {
  const { logger, browserAgent } = antigravityContext;
  logger.info("Iniciando Workflow: Sunat_RCE_Automation");

  // Fase 1: Las Rules (rule_buzon_notificaciones y rule_sire_info_modal) están activas
  // automáticamente vía .agents/rules con trigger dom_mutation.

  // Fase 2: Navegación guiada por el Skill sunat-rce-navigator
  logger.info("Ejecutando Fase 2: Navegación a Empresas > SIRE > RCE > 2026 / AGO");
  await browserAgent.runSkill("sunat-rce-navigator", {
    anio: "2026",
    mes: "AGO"
  });

  // Fase 3: Delegación al Subagent matemático
  logger.info("Ejecutando Fase 3: Invocando Subagent RCE_Data_Shifter");
  const result = await browserAgent.runSubagent(RCE_DATA_SHIFTER_SUBAGENT);

  logger.info("Workflow completado exitosamente", result);
  return result;
}
