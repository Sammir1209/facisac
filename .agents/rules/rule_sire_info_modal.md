---
name: rule_sire_info_modal
description: Intercepta el modal 'Mensaje informativo' al acceder al módulo RCE y hace clic en 'Aceptar'.
always_on: true
trigger: dom_mutation
---

# Regla Global: Intercepción de Mensaje Informativo SIRE RCE

## Condición de Activación
Al entrar al módulo de Registro de Compras Electrónico (RCE), si el DOM presenta un diálogo emergente con título o texto:
`"Mensaje informativo"` o `"Estimado contribuyente, se le informa..."`.

## Acción Automatizada
1. Localizar el botón con texto `"Aceptar"`.
2. Realizar clic sobre el botón.
3. Verificar que el diálogo se cierre y la pantalla de compras quede interactiva.

## Selectores Configurables (XPath / CSS)
- **XPath Principal:**
  `//div[contains(@class, 'modal') or contains(@class, 'dialog') or @role='dialog']//button[normalize-space(text())='Aceptar']`
- **CSS Alternativo:**
  `div.modal-dialog button.btn-primary, button#btnAceptarMensajeInfo`
