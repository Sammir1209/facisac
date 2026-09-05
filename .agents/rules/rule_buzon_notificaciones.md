---
name: rule_buzon_notificaciones
description: Detecta e intercepta asíncronamente cualquier popup, alerta o notificación intrusiva post-login en SUNAT SOL (Buzón, Datos de Contacto, Encuestas, Comunicados, etc.) que varían según el RUC.
always_on: true
trigger: dom_mutation
---

# Regla Global: Intercepción Universal de Popups y Modales SUNAT Post-Login

## Contexto Multi-RUC
En SUNAT SOL, distintos RUCs reciben diferentes tipos de pantallas o modales obstructivos al iniciar sesión o navegar, tales como:
1. **Notificaciones de Buzón Electrónico:** *"Tiene notificaciones pendientes..."*, *"Estimado contribuyente..."*.
2. **Validación / Actualización de Datos de Contacto:** *"Confirme su correo electrónico o teléfono celular"*, *"Actualización de ficha RUC"*.
3. **Comunicados Tributarios / Avisos Informativos:** *"Importante"*, *"Comunicado"*, *"Vencimiento de obligaciones"*.
4. **Encuestas o Campañas SUNAT:** *"Encuesta de satisfacción"*, *"Invitación a charla/webinar"*.
5. **Avisos de Clave SOL o Seguridad:** Recordatorios periódicos de cambio de credenciales.

## Condición de Activación
Se activa si se detecta en el DOM cualquier overlay o modal activo (`.modal.show`, `div[role="dialog"]`, `div.ui-dialog`, `.swal2-container`, etc.) que contenga textos asociados a notificaciones o recordatorios:
- `notificaciones pendientes`
- `buzón electrónico`
- `confirme` o `actualice` sus datos
- `comunicado`
- `recordatorio`
- `estimado contribuyente`

## Estrategia de Acción Automatizada (Resolución en Cascada)
El agente intentará cerrar los diálogos en el siguiente orden de prioridad de botones:

1. **Popups de Notificaciones de Contacto Encadenados:**
   - Diálogo modal *"Informativo"* con botón **`"Finalizar"`** (o `✔Finalizar`).
   - Pantalla de *"Valida tus datos de contacto"* con botón **`"Continuar sin confirmar"`**.

2. **Botones de postergación o descarte (Buzón / Avisos):**
   - `"Ver más tarde"` / `"Continuar más tarde"`
   - `"Recordar más tarde"` / `"Posponer"`
   - `"Omitir"` / `"Continuar sin validar"`

3. **Botones de confirmación / lectura rápida:**
   - `"Continuar"` / `"Aceptar"` / `"Entendido"`
   - `"Cerrar"` / `"Cancelar"`

3. **Controles de cierre visual (X / Icono de cierre):**
   - Botón `close` (`aria-label="Close"`, `.close`, `button[data-dismiss="modal"]`, `.ui-dialog-titlebar-close`).

4. **Validación post-clic:**
   - Esperar a que el modal y el backdrop (`.modal-backdrop`, `.ui-widget-overlay`, `swal2-backdrop-show`) desaparezcan y el `body` recupere el scroll (`overflow: auto` o sin clase modal-open).

## Selectores Unificados Configurables (XPath / CSS)

### 1. Botones de Postergación / Descarte (XPath):
```xpath
//div[contains(@class,'modal') or contains(@class,'dialog') or @role='dialog' or contains(@class,'swal')]//button[
  contains(translate(normalize-space(.), 'ÁÉÍÓÚABCDEFGHIJKLMNÑOPQRSTUVWXYZ', 'áéíóúabcdefghijklmnñopqrstuvwxyz'), 'ver más tarde') or
  contains(translate(normalize-space(.), 'ÁÉÍÓÚABCDEFGHIJKLMNÑOPQRSTUVWXYZ', 'áéíóúabcdefghijklmnñopqrstuvwxyz'), 'continuar más tarde') or
  contains(translate(normalize-space(.), 'ÁÉÍÓÚABCDEFGHIJKLMNÑOPQRSTUVWXYZ', 'áéíóúabcdefghijklmnñopqrstuvwxyz'), 'recordar más tarde') or
  contains(translate(normalize-space(.), 'ÁÉÍÓÚABCDEFGHIJKLMNÑOPQRSTUVWXYZ', 'áéíóúabcdefghijklmnñopqrstuvwxyz'), 'omitir') or
  contains(translate(normalize-space(.), 'ÁÉÍÓÚABCDEFGHIJKLMNÑOPQRSTUVWXYZ', 'áéíóúabcdefghijklmnñopqrstuvwxyz'), 'continuar sin')
]
```

### 2. Botones de Aceptación / Cierre Secundarios (XPath):
```xpath
//div[contains(@class,'modal') or contains(@class,'dialog') or @role='dialog' or contains(@class,'swal')]//button[
  normalize-space(.)='Aceptar' or
  normalize-space(.)='Continuar' or
  normalize-space(.)='Entendido' or
  normalize-space(.)='Cerrar'
]
```

### 3. Botones de Cierre 'X' (CSS):
```css
.modal.show button.close,
.modal.show [data-dismiss="modal"],
.ui-dialog-titlebar-close,
.swal2-close,
button[aria-label="Close"]
```

