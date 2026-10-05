/**
 * whatsapp_service.js
 * Servicio de mensajería y vinculación WhatsApp Web usando Baileys.
 * Permite emparejar por código QR en pantalla web y despachar reportes y alertas a Grupos de WhatsApp.
 */

const pino = require('pino');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

// Variables para módulos dinámicos ESM de Baileys
let makeWASocket, useMultiFileAuthState, DisconnectReason;

const AUTH_DIR = path.join(__dirname, 'auth_whatsapp');
const CONFIG_FILE = path.join(__dirname, 'whatsapp_config.json');

class WhatsAppService {
  constructor() {
    this.sock = null;
    this.qrDataUrl = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.selectedGroupId = null;
    this.selectedGroupName = null;
    this.groups = [];
    this.loadConfig();
  }

  loadConfig() {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
        const data = JSON.parse(raw);
        this.selectedGroupId = data.selectedGroupId || null;
        this.selectedGroupName = data.selectedGroupName || null;
      }
    } catch (e) {
      console.warn('[WA] No se pudo leer la configuración previa:', e.message);
    }
  }

  saveConfig() {
    try {
      fs.writeFileSync(
        CONFIG_FILE,
        JSON.stringify(
          {
            selectedGroupId: this.selectedGroupId,
            selectedGroupName: this.selectedGroupName,
            updatedAt: new Date().toISOString()
          },
          null,
          2
        ),
        'utf8'
      );
    } catch (e) {
      console.warn('[WA] Error guardando config:', e.message);
    }
  }

  async init() {
    if (this.isConnecting || this.isConnected) return;
    this.isConnecting = true;

    try {
      // Import dinámico de Baileys (módulo ESM compatible en Linux/Docker)
      if (!makeWASocket) {
        const baileysModule = await import('@whiskeysockets/baileys');
        makeWASocket = baileysModule.default?.default || baileysModule.default || baileysModule.makeWASocket;
        useMultiFileAuthState = baileysModule.useMultiFileAuthState;
        DisconnectReason = baileysModule.DisconnectReason;
      }

      if (!fs.existsSync(AUTH_DIR)) {
        fs.mkdirSync(AUTH_DIR, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

      this.sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ['FACISAC SUNAT Bot', 'Chrome', '1.0.0']
      });

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            this.qrDataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
            console.log('[WA] Nuevo código QR de vinculación generado para el panel web.');
          } catch (err) {
            console.error('[WA] Error convirtiendo QR a imagen:', err);
          }
        }

        if (connection === 'close') {
          this.isConnected = false;
          this.isConnecting = false;
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          console.log(`[WA] Conexión cerrada (Motivo: ${statusCode}). ¿Reconectar?: ${shouldReconnect}`);

          if (shouldReconnect) {
            setTimeout(() => this.init(), 4000);
          } else {
            this.qrDataUrl = null;
            // Limpiar auth si fue desconectado permanentemente
            try {
              fs.rmSync(AUTH_DIR, { recursive: true, force: true });
            } catch (e) {}
          }
        } else if (connection === 'open') {
          this.isConnected = true;
          this.isConnecting = false;
          this.qrDataUrl = null;
          console.log('[WA] ¡Sesión WhatsApp vinculada y conectada con éxito!');
          await this.refreshGroups();
        }
      });
    } catch (err) {
      this.isConnecting = false;
      console.error('[WA] Error inicializando WhatsApp:', err);
    }
  }

  async refreshGroups() {
    if (!this.sock || !this.isConnected) return [];
    try {
      const chats = await this.sock.groupFetchAllParticipating();
      this.groups = Object.values(chats).map((g) => ({
        id: g.id,
        name: g.subject,
        creation: g.creation,
        owner: g.owner,
        size: g.size || (g.participants ? g.participants.length : 0)
      }));
      return this.groups;
    } catch (err) {
      console.error('[WA] Error listando grupos de WhatsApp:', err);
      return [];
    }
  }

  setSelectedGroup(groupId, groupName = '') {
    this.selectedGroupId = groupId;
    this.selectedGroupName = groupName;
    this.saveConfig();
  }

  /**
   * Envía un mensaje estructurado EXCLUSIVAMENTE al grupo de WhatsApp seleccionado
   */
  async sendGroupMessage(text) {
    if (!this.isConnected || !this.sock) {
      console.warn('[WA] No se puede enviar mensaje: WhatsApp no está conectado.');
      return { success: false, error: 'WHATSAPP_DISCONNECTED' };
    }

    if (!this.selectedGroupId) {
      console.warn('[WA] No se ha configurado ningún grupo de WhatsApp de destino.');
      return { success: false, error: 'NO_GROUP_CONFIGURED' };
    }

    try {
      await this.sock.sendMessage(this.selectedGroupId, { text });
      console.log(`[WA] Mensaje despachado exitosamente al grupo: ${this.selectedGroupName || this.selectedGroupId}`);
      return { success: true };
    } catch (err) {
      console.error('[WA] Fallo enviando mensaje al grupo:', err);
      return { success: false, error: err.message };
    }
  }

  async disconnect() {
    try {
      if (this.sock) {
        await this.sock.logout();
      }
      this.isConnected = false;
      this.qrDataUrl = null;
      try {
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      } catch (e) {}
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  getStatus() {
    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      qrDataUrl: this.qrDataUrl,
      selectedGroupId: this.selectedGroupId,
      selectedGroupName: this.selectedGroupName,
      totalGroups: this.groups.length
    };
  }
}

const whatsAppService = new WhatsAppService();

module.exports = {
  whatsAppService,
  WhatsAppService
};
