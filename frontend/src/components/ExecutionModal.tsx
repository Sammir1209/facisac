'use client';

import React, { useRef, useEffect } from 'react';
import { X, Play, AlertCircle, CheckCircle2, Terminal, StopCircle, Eye } from 'lucide-react';

interface ExecutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCancelJob: () => void;
  jobId: string | null;
  fase: string;
  progreso: number;
  estado: string;
  logs: string[];
  screenshot: string | null;
  empresaNombre?: string;
}

export const ExecutionModal: React.FC<ExecutionModalProps> = ({
  isOpen,
  onClose,
  onCancelJob,
  jobId,
  fase,
  progreso,
  estado,
  logs,
  screenshot,
  empresaNombre,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);

  // Auto-scroll en logs del terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  if (!isOpen) return null;

  const isTerminado = estado === 'COMPLETADO' || estado === 'ERROR' || estado === 'CANCELADO';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-700/80 bg-[#0b1120] shadow-2xl">
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between border-b border-slate-800 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${
                estado === 'PROCESANDO'
                  ? 'bg-blue-600/20 text-blue-400 ring-blue-500/40 animate-pulse'
                  : estado === 'COMPLETADO'
                  ? 'bg-emerald-600/20 text-emerald-400 ring-emerald-500/40'
                  : estado === 'CANCELADO'
                  ? 'bg-amber-600/20 text-amber-400 ring-amber-500/40'
                  : 'bg-rose-600/20 text-rose-400 ring-rose-500/40'
              }`}
            >
              {estado === 'COMPLETADO' ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <Terminal className="h-5 w-5" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-white">
                Auditoría RCE en Vivo: {empresaNombre || 'SUNAT SOL'}
              </h3>
              <p className="text-xs text-slate-400">
                Fase actual: <strong className="text-blue-400">{fase || 'Iniciando'}</strong>
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

        {/* Barra de Progreso Dinámica */}
        <div className="w-full bg-slate-800/80 h-2 relative">
          <div
            className={`h-full transition-all duration-300 ${
              estado === 'ERROR'
                ? 'bg-rose-500'
                : estado === 'CANCELADO'
                ? 'bg-amber-500'
                : estado === 'COMPLETADO'
                ? 'bg-emerald-500'
                : 'bg-gradient-to-r from-blue-500 to-indigo-500'
            }`}
            style={{ width: `${Math.max(5, progreso)}%` }}
          />
        </div>

        {/* Cuerpo: Terminal & Captura de Pantalla SUNAT */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 sm:p-5 overflow-y-auto">
          {/* Columna Izquierda: Terminal de Logs */}
          <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-950 p-3 h-72 sm:h-96">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-2 text-xs text-slate-400">
              <span className="font-mono flex items-center gap-1.5">
                <Terminal className="h-3.5 w-3.5 text-blue-400" />
                Consola Playwright Turbo
              </span>
              <span className="text-[11px] font-semibold text-slate-400">
                {logs.length} líneas
              </span>
            </div>

            <div
              ref={terminalRef}
              className="flex-1 overflow-y-auto font-mono text-[11px] sm:text-xs text-slate-300 space-y-1 pr-1"
            >
              {logs.map((log, index) => (
                <div
                  key={index}
                  className={`${
                    log.includes('ERROR') || log.includes('[ERROR]')
                      ? 'text-rose-400 font-semibold'
                      : log.includes('OK') || log.includes('Éxito') || log.includes('satisfactoriamente')
                      ? 'text-emerald-400'
                      : log.includes('CANCELADO')
                      ? 'text-amber-400'
                      : 'text-slate-300'
                  }`}
                >
                  {log}
                </div>
              ))}
              {logs.length === 0 && (
                <p className="text-slate-500 italic">Esperando inicio de navegación...</p>
              )}
            </div>
          </div>

          {/* Columna Derecha: Captura de Pantalla SUNAT en Vivo */}
          <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-950 p-3 h-72 sm:h-96">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-2 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-indigo-400" />
                Vista previa SUNAT SOL
              </span>
              {screenshot && (
                <span className="text-[10px] text-emerald-400 font-semibold">Captura viva</span>
              )}
            </div>

            <div className="flex-1 flex items-center justify-center overflow-hidden rounded-lg bg-slate-900/60 border border-slate-800/60">
              {screenshot ? (
                <img
                  src={screenshot.startsWith('data:') ? screenshot : `data:image/jpeg;base64,${screenshot}`}
                  alt="Captura SUNAT"
                  className="w-full h-full object-contain rounded"
                />
              ) : (
                <div className="text-center p-4">
                  <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-slate-500">
                    <Eye className="h-5 w-5" />
                  </div>
                  <p className="text-xs text-slate-400">
                    {estado === 'PROCESANDO'
                      ? 'Generando captura en caliente...'
                      : 'No hay captura disponible'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer con controles */}
        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                estado === 'PROCESANDO'
                  ? 'bg-blue-500 animate-ping'
                  : estado === 'COMPLETADO'
                  ? 'bg-emerald-500'
                  : estado === 'CANCELADO'
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
              }`}
            />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              {estado}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {!isTerminado && (
              <button
                onClick={onCancelJob}
                className="flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 active:scale-95 transition-all"
              >
                <StopCircle className="h-4 w-4" />
                <span>Cancelar Tarea</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="rounded-lg border border-slate-700 px-4 py-1.5 text-xs sm:text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
