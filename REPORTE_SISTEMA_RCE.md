# 🚀 SUNAT SIRE RCE Automator - Sistema de Modificación Inteligente

## 📋 Resumen del Proyecto y Logros

Se ha desarrollado y perfeccionado un sistema integral de automatización contable para la modificación de libros de compras electrónicas (**RCE - SIRE**) de SUNAT para el periodo **2026 / Agosto**, integrando una arquitectura de alta velocidad con interfaz web moderna y ejecutor de consola directa.

---

## 💎 Características Principales Implementadas

### 1. 🎨 Frontend Ultra-Premium en Tarjetas (*Glassmorphism*)
- **Diseño por Tarjetas Empresariales:** Sustitución de tablas planas por una cuadrícula reactiva con marco de cristal oscuro, bordes con degradado tricolor (`cyan / blue / emerald`), sombras multicapa y elevación reactiva (*hover*).
- **Isotipo Oficial de SUNAT:** Integración de logotipo vectorial SVG en cada tarjeta con efecto dinámico al pasar el cursor.
- **Insignias de Estado en Tiempo Real:**
  - 🔵 **`Libros modificados anteriormente`**: cuando los montos ya se encuentran en `0.00`.
  - 🟢 **`Libros modificados exitosamente`**: cuando se detectaron comprobantes con saldo y se transfirieron a operaciones no gravadas.
  - ⚪ **`Pendiente de Procesar`**: para empresas pendientes de ejecución en el periodo seleccionado.
- **Popup Interactivo:** Modal central flotante de alta prioridad (`z-index: 999999`) con barra de progreso horizontal continua y terminal en vivo de eventos.

### 2. ⚡ Motor Automatizado de Modificación RCE (`login_automator.js`)
- **Técnica Humana de Data-Shifting:**
  1. Clic en `Base Imp Dest Grav` ➔ `Ctrl + A` ➔ `Ctrl + X` (corta el monto).
  2. Clic en `Base Imp Dest No Grav` ➔ `Ctrl + A` ➔ `Ctrl + V` (pega el monto exacto).
  3. Regreso a `Base Imp Dest Grav` ➔ Escritura manual de `"0.00"` carácter por carácter con pausas controladas (`delay: 60ms`) y disparo de eventos reactivos de Angular (`input` y `change`).
  4. Mismo procedimiento exacto para `IGV / IPM Dest Grav` hacia `IGV / IMP Dest No Grav`.
  5. Sincronización y confirmación con guardado dentro del modal del comprobante y aprobación del diálogo de confirmación (`SÍ / Aceptar`).
- **Aislamiento Estricto de Modales:** Eliminación total de interferencias con el botón verde *"Aceptar Propuesta"* (para evitar avisos de fechas de corte de presentación).
- **Cierre Proactivo de Popups de SUNAT:** Limpieza en bucle de avisos informativos (`RER / MYPE Tributario`, diálogos emergentes) sin bloquear la selección de periodo.

### 3. 📄 Sistema Inteligente de Paginación Multi-Página
- Recorre sistemáticamente todas las páginas de la propuesta del RCE utilizando el botón **`Siguiente`**.
- Modifica los comprobantes con saldo en cada página y avanza automáticamente hasta completar el 100% de los registros de la empresa.

### 4. 📊 Persistencia y Auditoría en JSON (`registro_rce_resultados.json`)
- Cada ejecución guarda y actualiza automáticamente los resultados por RUC, año, mes, total de comprobantes auditados, estado y detalle de comprobantes modificados.
- Botón directo en la barra superior para descargar el archivo JSON consolidado en cualquier momento.

---

## 🛠️ Modos de Ejecución Disponibles

| Modo | Comando / Archivo | Descripción |
| :--- | :--- | :--- |
| **Panel Web** | [`iniciar.bat`](file:///c:/Users/Sammir%20Contreras/Desktop/backend-facisac/iniciar.bat) | Servidor local en `http://localhost:3000` con vista de tarjetas, botones individuales y ejecución simultánea. |
| **Consola Directa** | [`iniciar_consola.bat`](file:///c:/Users/Sammir%20Contreras/Desktop/backend-facisac/iniciar_consola.bat) | Terminal interactivo para ejecutar empresas individuales o la cartera completa viendo Chrome en pantalla completa. |
