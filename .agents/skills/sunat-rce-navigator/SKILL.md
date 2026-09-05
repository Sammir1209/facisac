---
name: sunat-rce-navigator
description: Navega la estructura de menús de SUNAT SOL hasta la pestaña 'Propuesta del RCE' para el periodo 2026 - AGO.
---

# Skill: Navegación a la Propuesta del RCE (SUNAT SIRE)

Este skill define el trayecto paso a paso a través de los menús dinámicos del portal SUNAT Operaciones en Línea.

## Parámetros por Defecto
- **Año:** `2026`
- **Mes:** `AGO` (Agosto / `08`)

## Procedimiento de Navegación

1. **Ingreso a Empresas:**
   - Hacer clic en la pestaña superior **"Empresas"**:
     `//a[normalize-space()='Empresas']`

2. **Despliegue del Árbol de Opciones:**
   - Clic en **"Sistema Integrado de Registros Electrónicos"**:
     `//a[contains(., 'Sistema Integrado de Registros Electrónicos')]`
   - Clic en **"Registro de Compras Electrónico"**:
     `//a[contains(., 'Registro de Compras Electrónico')]`
   - Clic en **"Gestión de Compras"**:
     `//a[contains(., 'Gestión de Compras')]`

3. **Intercepción de Mensajes Informativos:**
   - La regla activa `rule_sire_info_modal` cerrará automáticamente cualquier diálogo informativo que aparezca al cargar este módulo.

4. **Selección de Periodo:**
   - Seleccionar el año en el desplegable:
     - Elemento: `//select[@id='cboAnio' or contains(@name, 'anio')]`
     - Valor: `"2026"`
   - Seleccionar el mes en el desplegable:
     - Elemento: `//select[@id='cboMes' or contains(@name, 'mes')]`
     - Valor: `"AGO"` (o seleccionar la opción que corresponda a Agosto)
   - Hacer clic en el botón **"Aceptar"**:
     `//button[normalize-space()='Aceptar']`

5. **Acceso a la Propuesta:**
   - Esperar a que rendericen las pestañas del periodo consultado.
   - Hacer clic en la pestaña **"Propuesta del RCE"**:
     `//li[contains(@class,'nav-item')]//a[contains(normalize-space(),'Propuesta del RCE')]`
   - Esperar a que la tabla cargue sus registros (`//table[contains(@class,'table')]//tbody/tr`).
