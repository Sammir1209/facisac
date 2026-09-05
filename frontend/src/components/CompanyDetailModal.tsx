'use client';

import React, { useState } from 'react';
import {
  X,
  Building2,
  KeyRound,
  User,
  ShieldCheck,
  Calendar,
  AlertTriangle,
  Play,
  History,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Copy,
  Check
} from 'lucide-react';
import { Cliente, RegistroResultado } from '@/types';
import { calcularVencimientoSunat } from '@/lib/sunatSchedule';
import { RucStatusBadge } from '@/components/RucStatusBadge';

interface CompanyDetailModalProps {
  cliente: Cliente | null;
  isOpen: boolean;
  onClose: () => void;
  onExecute: (cliente: Cliente) => void;
  onOpenHistory: (cliente: Cliente) => void;
  isExecuting: boolean;
  resultado?: RegistroResultado;
}

export const CompanyDetailModal: React.FC<CompanyDetailModalProps> = ({
  cliente,
  isOpen,
  onClose,
  onExecute,
  onOpenHistory,
  isExecuting,
  resultado,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen || !cliente) return null;

  const vencimiento = calcularVencimientoSunat(
    cliente.ruc,
    cliente.regimenTributario,
    cliente.anio,
    cliente.mes
  );

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-700/80 bg-[#0d1527] shadow-2xl">
        {/* Cabecera del Modal */}
        <div className="flex items-start justify-between border-b border-slate-800 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600/20 ring-1 ring-blue-500/30">
              <Building2 className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white leading-snug">
                {cliente.razonSocial}
              </h2>
              <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                <span className="font-mono text-slate-300 font-semibold">RUC: {cliente.ruc}</span>
                <span>•</span>
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">
                  {cliente.regimenTributario || 'RÉGIMEN GENERAL'}
                </span>
                <span>•</span>
                <RucStatusBadge ruc={cliente.ruc} esRojo={cliente.esRojo} />
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Contenido / Ficha Detallada */}
        <div className="max-h-[75vh] overflow-y-auto p-5 space-y-5">
          {/* Tarjeta de Cronograma & Vencimiento SUNAT */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Calendar className="h-4 w-4 text-amber-400" />
                <span>Cronograma y Vencimiento Tributario</span>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  vencimiento.estadoAlerta === 'urgente' || vencimiento.estadoAlerta === 'vencido'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : vencimiento.estadoAlerta === 'proximo'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                {vencimiento.textoAlerta}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg bg-slate-950/60 p-2.5 border border-slate-800/80">
                <span className="text-slate-400">Fecha Límite de Presentación:</span>
                <p className="text-sm font-bold text-white mt-0.5">{vencimiento.fechaLimite}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Según último dígito ({cliente.ruc.slice(-1)})
                </p>
              </div>
              <div className="rounded-lg bg-slate-950/60 p-2.5 border border-slate-800/80">
                <span className="text-slate-400">Régimen Asignado:</span>
                <p className="text-sm font-bold text-white mt-0.5">
                  {cliente.regimenTributario || 'GENERAL'}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Periodo: {cliente.anio || '2026'} - {cliente.mes || 'Agosto'}
                </p>
              </div>
            </div>
          </div>

          {/* Credenciales SOL (Usuario y Clave con toggle y copiado) */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <KeyRound className="h-4 w-4 text-blue-400" />
              <span>Credenciales Clave SOL SUNAT</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Usuario SOL */}
              <div className="rounded-lg bg-slate-950/60 p-3 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-slate-400">Usuario SOL:</span>
                  <p className="text-sm font-mono font-bold text-slate-200 mt-0.5">
                    {cliente.usuario || 'NO CONFIGURADO'}
                  </p>
                </div>
                {cliente.usuario && (
                  <button
                    onClick={() => copyToClipboard(cliente.usuario, 'usuario')}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    title="Copiar Usuario"
                  >
                    {copiedKey === 'usuario' ? (
                      <Check className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>

              {/* Clave SOL */}
              <div className="rounded-lg bg-slate-950/60 p-3 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-slate-400">Contraseña SOL:</span>
                  <p className="text-sm font-mono font-bold text-slate-200 mt-0.5">
                    {showPassword ? cliente.clave || 'SIN CLAVE' : '••••••••••••'}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  {cliente.clave && (
                    <button
                      onClick={() => copyToClipboard(cliente.clave, 'clave')}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                      title="Copiar Clave"
                    >
                      {copiedKey === 'clave' ? (
                        <Check className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Historial de Auditoría RCE si existe */}
          {resultado ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                  <span>Resultado Auditoría RCE</span>
                </div>
                <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>
                    {resultado.estado === 'SIN_MODIFICACIONES'
                      ? 'En 0.00 (Correcto)'
                      : resultado.estado === 'MODIFICADO_EXITOSO'
                      ? 'Modificado a 0.00'
                      : resultado.estado}
                  </span>
                </span>
              </div>

              <div className="rounded-lg bg-slate-950/60 p-3 border border-slate-800/80 text-xs space-y-2">
                <p className="text-slate-300">{resultado.mensaje || 'Proceso finalizado.'}</p>
                <div className="flex items-center justify-between text-slate-400 border-t border-slate-800/80 pt-2">
                  <span>Comprobantes ajustados a 0.00:</span>
                  <span className="font-bold text-white">
                    {resultado.comprobantesModificados ? resultado.comprobantesModificados.length : 0}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Fecha de ejecución:</span>
                  <span className="text-slate-300">{resultado.fechaHora || 'Hoy'}</span>
                </div>
              </div>
            </div>
          ) : null}

          {/* Aviso sobre Exclusión */}
          {cliente.esRojo && (
            <div className="flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
              <span>
                <strong>Empresa Marcada en Rojo:</strong> Esta empresa figura marcada en el archivo Excel principal de Claves SOL (generalmente por suspensión o baja de RUC).
              </span>
            </div>
          )}
        </div>

        {/* Footer con Acciones */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenHistory(cliente)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 transition-colors"
              title="Ver historial de auditoría de periodos anteriores"
            >
              <History className="h-3.5 w-3.5 text-slate-400" />
              <span>Historial RCE</span>
            </button>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Cerrar
            </button>
            <button
              onClick={() => {
                onClose();
                onExecute(cliente);
              }}
              disabled={isExecuting}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-1.5 text-xs sm:text-sm font-semibold text-white hover:bg-blue-500 shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50"
            >
              <Play className="h-4 w-4 fill-white" />
              <span>Ejecutar RCE</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
