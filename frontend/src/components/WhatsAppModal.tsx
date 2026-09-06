'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  QrCode,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Send,
  Users,
  MessageSquare,
  LogOut,
  ShieldCheck,
  Smartphone
} from 'lucide-react';
import { API_BASE } from '@/lib/apiConfig';

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GroupInfo {
  id: string;
  name: string;
  size?: number;
}

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedGroupName, setSelectedGroupName] = useState<string | null>(null);
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [loadingGroups, setLoadingGroups] = useState<boolean>(false);
  const [sendingTest, setSendingTest] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Consultar estado de WhatsApp
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/status`);
      const json = await res.json();
      if (json.success && json.data) {
        setIsConnected(json.data.isConnected);
        setQrDataUrl(json.data.qrDataUrl);
        setSelectedGroupId(json.data.selectedGroupId);
        setSelectedGroupName(json.data.selectedGroupName);

        if (json.data.isConnected && groups.length === 0) {
          fetchGroups();
        }
      }
    } catch (e) {
      console.warn('Error al verificar estado de WhatsApp');
    } finally {
      setLoading(false);
    }
  }, [groups.length]);

  // Listar grupos disponibles
  const fetchGroups = async () => {
    setLoadingGroups(true);
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/groups`);
      const json = await res.json();
      if (json.success && Array.isArray(json.groups)) {
        setGroups(json.groups);
      }
    } catch (e) {
      console.warn('Error al cargar grupos');
    } finally {
      setLoadingGroups(false);
    }
  };

  // Seleccionar grupo destino
  const handleSelectGroup = async (group: GroupInfo) => {
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/select-group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: group.id, groupName: group.name })
      });
      const json = await res.json();
      if (json.success) {
        setSelectedGroupId(group.id);
        setSelectedGroupName(group.name);
      }
    } catch (e) {
      console.warn('Error seleccionando grupo', e);
    }
  };

  // Enviar mensaje de prueba al grupo
  const handleSendTestMessage = async () => {
    if (!selectedGroupId) return;
    setSendingTest(true);
    setTestResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/test-message`, {
        method: 'POST'
      });
      const json = await res.json();
      if (json.success) {
        setTestResult('Mensaje de prueba enviado exitosamente al grupo.');
      } else {
        setTestResult('Error: ' + (json.error || 'No se pudo enviar'));
      }
    } catch (e: any) {
      setTestResult('Error de conexión: ' + e.message);
    } finally {
      setSendingTest(false);
    }
  };

  // Desconectar sesión
  const handleDisconnect = async () => {
    if (!confirm('¿Deseas desvincular este WhatsApp del panel?')) return;
    try {
      await fetch(`${API_BASE}/api/whatsapp/disconnect`, { method: 'POST' });
      setIsConnected(false);
      setSelectedGroupId(null);
      setSelectedGroupName(null);
      setGroups([]);
      fetchStatus();
    } catch (e) {
      console.warn('Error desconectando WhatsApp', e);
    }
  };

  // Polling mientras el modal esté abierto para refrescar QR o estado de conexión
  useEffect(() => {
    if (!isOpen) return;
    fetchStatus();
    const timer = setInterval(() => {
      fetchStatus();
    }, 3000);
    return () => clearInterval(timer);
  }, [isOpen, fetchStatus]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-slate-800 bg-[#0c1322] shadow-2xl">
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-slate-800 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/20 ring-1 ring-emerald-500/30">
              <MessageSquare className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-white">
                Notificaciones y Alertas WhatsApp
              </h3>
              <p className="text-xs text-slate-400">
                Despacho exclusivo y transparente hacia un Grupo de WhatsApp
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="max-h-[75vh] overflow-y-auto p-5 space-y-5 text-xs text-slate-300">
          {loading ? (
            <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
              <RefreshCw className="h-6 w-6 animate-spin text-emerald-500" />
              <span>Conectando con el servicio de mensajería...</span>
            </div>
          ) : !isConnected ? (
            /* Pantalla de Escaneo QR */
            <div className="flex flex-col items-center text-center space-y-4 py-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 max-w-xs shadow-inner">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Escanear Código QR WhatsApp"
                    className="h-60 w-60 rounded-lg mx-auto bg-white p-2"
                  />
                ) : (
                  <div className="h-60 w-60 flex flex-col items-center justify-center text-slate-500 gap-2">
                    <QrCode className="h-10 w-10 animate-pulse text-emerald-400" />
                    <span>Generando código QR...</span>
                  </div>
                )}
              </div>

              <div className="max-w-md space-y-1">
                <p className="font-semibold text-white text-sm flex items-center justify-center gap-1.5">
                  <Smartphone className="h-4 w-4 text-emerald-400" />
                  <span>Escanea con tu WhatsApp personal</span>
                </p>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Abre WhatsApp en tu teléfono ➔ Ajustes o Menú ➔ <strong>Dispositivos vinculados</strong> ➔ <strong>Vincular un dispositivo</strong>.
                </p>
              </div>

              <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-[11px] text-blue-300 max-w-md text-left">
                <strong>Privacidad Garantizada:</strong> Tu número sólo servirá como emisor para publicar las alertas dentro del grupo que elijas. No se enviarán mensajes a números personales privados.
              </div>
            </div>
          ) : (
            /* Pantalla de Configuración de Grupo (Conectado) */
            <div className="space-y-4">
              {/* Estado Conectado */}
              <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-bold text-white text-sm">WhatsApp Vinculado</span>
                    <p className="text-[11px] text-emerald-300">Sesión activa y lista para emitir reportes.</p>
                  </div>
                </div>

                <button
                  onClick={handleDisconnect}
                  className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs text-slate-300 hover:bg-rose-950/40 hover:text-rose-300 hover:border-rose-500/40 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Desvincular</span>
                </button>
              </div>

              {/* Selector de Grupo de WhatsApp */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-emerald-400" />
                    <span>Selecciona el Grupo de Destino:</span>
                  </span>

                  <button
                    onClick={fetchGroups}
                    disabled={loadingGroups}
                    className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 font-medium"
                  >
                    <RefreshCw className={`h-3 w-3 ${loadingGroups ? 'animate-spin' : ''}`} />
                    <span>Actualizar grupos</span>
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/60 divide-y divide-slate-800/80">
                  {groups.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 text-xs">
                      {loadingGroups ? 'Cargando tus grupos de WhatsApp...' : 'No se detectaron grupos. Asegúrate de pertenecer al menos a un grupo.'}
                    </div>
                  ) : (
                    groups.map((g) => {
                      const isSelected = selectedGroupId === g.id;
                      return (
                        <div
                          key={g.id}
                          onClick={() => handleSelectGroup(g)}
                          className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-emerald-950/30 border-l-4 border-emerald-500'
                              : 'hover:bg-slate-900/60'
                          }`}
                        >
                          <div>
                            <p className="font-semibold text-white">{g.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">ID: {g.id}</p>
                          </div>

                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              isSelected
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {isSelected ? 'Grupo Activo' : 'Seleccionar'}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Botón de Envío de Mensaje de Prueba */}
              {selectedGroupId && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-slate-400">Grupo Configurado:</span>
                      <p className="font-bold text-white text-sm">{selectedGroupName || selectedGroupId}</p>
                    </div>

                    <button
                      onClick={handleSendTestMessage}
                      disabled={sendingTest}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-all active:scale-95 disabled:opacity-50"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>{sendingTest ? 'Enviando...' : 'Enviar Prueba al Grupo'}</span>
                    </button>
                  </div>

                  {testResult && (
                    <p className={`text-[11px] font-medium mt-1 ${testResult.includes('Error') ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {testResult}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-slate-800 bg-slate-900/60 p-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-4 py-1.5 text-xs sm:text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
