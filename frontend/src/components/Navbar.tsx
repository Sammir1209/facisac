'use client';

import React from 'react';
import { ShieldCheck, Download, RefreshCw, AlertOctagon, MessageSquare, KeyRound } from 'lucide-react';

interface NavbarProps {
  onRefresh: () => void;
  onStopAll: () => void;
  onExportExcel: () => void;
  onOpenImportExcel: () => void;
  onOpenWhatsApp?: () => void;
  onFastCheckSol?: () => void;
  isValidatingSol?: boolean;
  isStoppingAll?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onRefresh,
  onStopAll,
  onExportExcel,
  onOpenImportExcel,
  onOpenWhatsApp,
  onFastCheckSol,
  isValidatingSol = false,
  isStoppingAll = false,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-[#090d16]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Brand & Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-lg shadow-blue-500/20 ring-1 ring-blue-400/30">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-white">FACISAC</span>
              <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-400 ring-1 ring-blue-500/30">
                SUNAT SIRE v2.0
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Gestor de Presentación y Modificación RCE
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Botón Pre-validación Rápida de Claves SOL */}
          {onFastCheckSol && (
            <button
              onClick={onFastCheckSol}
              disabled={isValidatingSol}
              className="flex items-center gap-1.5 rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-3 py-1.5 text-xs sm:text-sm font-medium text-indigo-300 transition-all hover:bg-indigo-500/20 active:scale-95 disabled:opacity-40"
              title="Valida las Claves SOL en 1 segundo directamente con el servidor de SUNAT"
            >
              <KeyRound className={`h-4 w-4 text-indigo-400 ${isValidatingSol ? 'animate-pulse' : ''}`} />
              <span className="hidden md:inline">
                {isValidatingSol ? 'Validando SOL...' : 'Test Claves SOL'}
              </span>
            </button>
          )}

          {/* Botón WhatsApp Notificaciones en Grupo */}
          {onOpenWhatsApp && (
            <button
              onClick={onOpenWhatsApp}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs sm:text-sm font-medium text-emerald-300 transition-all hover:bg-emerald-500/20 active:scale-95"
              title="Vincular WhatsApp para enviar reportes automáticos al grupo"
            >
              <MessageSquare className="h-4 w-4 text-emerald-400" />
              <span className="hidden md:inline">WhatsApp Grupo</span>
            </button>
          )}

          <button
            onClick={onOpenImportExcel}
            className="flex items-center gap-2 rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-xs sm:text-sm font-medium text-blue-400 transition-all hover:border-blue-500/70 hover:bg-blue-500/20 active:scale-95"
            title="Importar nuevas empresas desde archivo Excel"
          >
            <Download className="h-4 w-4 rotate-180 text-blue-400" />
            <span className="hidden sm:inline">Cargar Excel</span>
          </button>

          <button
            onClick={onRefresh}
            className="flex items-center gap-2 rounded-lg border border-slate-700/80 bg-slate-800/60 px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-200 transition-all hover:border-slate-600 hover:bg-slate-700/60 active:scale-95"
            title="Recargar listado de empresas desde el servidor"
          >
            <RefreshCw className="h-4 w-4 text-slate-400" />
            <span className="hidden sm:inline">Actualizar</span>
          </button>

          <button
            onClick={onExportExcel}
            className="flex items-center gap-2 rounded-lg border border-emerald-600/30 bg-emerald-500/10 px-3 py-1.5 text-xs sm:text-sm font-medium text-emerald-400 transition-all hover:border-emerald-500/50 hover:bg-emerald-500/20 active:scale-95"
            title="Descargar reporte consolidado en Excel"
          >
            <Download className="h-4 w-4 text-emerald-400" />
            <span className="hidden sm:inline">Exportar Excel</span>
          </button>

          <button
            onClick={onStopAll}
            disabled={isStoppingAll}
            className="flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs sm:text-sm font-medium text-rose-400 transition-all hover:border-rose-500/80 hover:bg-rose-500/20 active:scale-95 disabled:opacity-50"
            title="Detener todas las operaciones en curso inmediatamente"
          >
            <AlertOctagon className="h-4 w-4 text-rose-400" />
            <span>Detener Todo</span>
          </button>
        </div>
      </div>
    </header>
  );
};
