'use client';

import React from 'react';
import { RefreshCw, AlertOctagon, Activity, Wifi } from 'lucide-react';
import { DashboardSection } from '@/components/Sidebar';

interface TopbarProps {
  currentSection: DashboardSection;
  onRefresh: () => void;
  onStopAll: () => void;
  isExecuting?: boolean;
}

export const Topbar: React.FC<TopbarProps> = ({
  currentSection,
  onRefresh,
  onStopAll,
  isExecuting = false,
}) => {
  const getSectionTitle = () => {
    switch (currentSection) {
      case 'cartera':
        return {
          title: 'Panel General de Clientes',
          desc: 'Supervisión de empresas, regímenes tributarios y alertas de vencimiento'
        };
      case 'modificar_rce':
        return {
          title: 'Modificación de Libros RCE',
          desc: 'Gestión oficial de comprobantes SIRE para traslado a casillas no gravadas (0.00)'
        };
      case 'auditoria_segundo_plano':
        return {
          title: 'Auditor Preventivo en 2° Plano',
          desc: 'Diagnóstico en tiempo real: empresas en 0.00, sin compras o con saldo pendiente'
        };
      case 'calendario':
        return {
          title: 'Cronograma Tributario SUNAT',
          desc: 'Fechas límite de declaración ordenadas por último dígito de RUC'
        };
      case 'reportes':
        return {
          title: 'Reportes y Evidencias de Auditoría',
          desc: 'Descargas en Excel (.xlsx) y trazabilidad segura en archivos JSON locales'
        };
      default:
        return {
          title: 'FACISAC - SISTEMAS',
          desc: 'Auditor Automatizado RCE SUNAT 2026'
        };
    }
  };

  const sectionInfo = getSectionTitle();

  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-800/80 bg-[#090d16]/80 backdrop-blur-md px-6 py-3.5">
      <div className="flex items-center justify-between gap-4">
        {/* Título contextual limpio de la sección actual (sin duplicar logo) */}
        <div>
          <h1 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <span>{sectionInfo.title}</span>
            {isExecuting && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 text-[10px] font-bold text-blue-400 animate-pulse">
                <Activity className="h-3 w-3 animate-spin" />
                Motor Activo
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-400 font-medium">
            {sectionInfo.desc}
          </p>
        </div>

        {/* Acciones esenciales: Estado del Sistema, Actualizar y Detener de Emergencia */}
        <div className="flex items-center gap-2.5">
          <div className="hidden md:flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-400">
            <Wifi className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-slate-300 font-medium">Servicio Local OK</span>
          </div>

          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs font-semibold text-slate-300 transition-all hover:bg-slate-800 hover:text-white active:scale-95 shadow-sm"
            title="Recargar datos locales del sistema"
          >
            <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
            <span className="hidden sm:inline">Actualizar</span>
          </button>

          {isExecuting && (
            <button
              onClick={onStopAll}
              className="flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-xs font-bold text-rose-300 transition-all hover:bg-rose-500/25 active:scale-95 shadow-sm"
              title="Detener todas las operaciones en curso inmediatamente"
            >
              <AlertOctagon className="h-3.5 w-3.5 text-rose-400" />
              <span>Detener Todo</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
