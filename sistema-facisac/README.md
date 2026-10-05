# SISTEMA-FACISAC: Arquitectura Todo-en-Uno

Esta carpeta contiene todo el sistema empaquetado y listo para correr de forma autónoma.

## 🚀 Cómo Ejecutar

### Opción 1: Con un solo comando en terminal
```bash
node run.js
```

### Opción 2: Doble clic en Windows
Haz doble clic sobre el archivo:
- `ejecutar_sistema.bat`

---

## 📦 Contenido de la Carpeta

1. **`run.js`**:
   - Servidor HTTP REST API integrado.
   - Panel Web reactivo embebido (HTML5/CSS Glassmorphism/JS) que se abre automáticamente en `http://localhost:3000`.
   - Lógica de encolado, control de estados y monitoreo en tiempo real.
2. **`login_automator.js`**: Motor Playwright que abre Chrome, navega en SUNAT SIRE RCE y ajusta a 0.00.
3. **`CLAVE SOL - CLIENTES - ACTUALIZADO JULIO - 2026.xlsm`**: Base de datos de clientes con sus Claves SOL.
4. **`whatsapp_service.js`**: Integración WhatsApp Web con código QR en pantalla y notificaciones a grupos.
5. **`sunat_fast_checker.js`**: Pre-validación ultrarrápida de claves SOL sin abrir navegador.
6. **`circuit_breaker.js`**: Resiliencia ante caídas de servidores SUNAT (Error 503).
7. **`audit_exporter.js`**: Registro de constancias y auditorías.
