'use client';

import React from 'react';
import { Calendar, Play } from 'lucide-react';

interface GlobalPeriodBarProps {
  selectedYear: string;
  selectedMonth: string;
  onChangeYear: (year: string) => void;
  onChangeMonth: (month: string) => void;
  onRunSelected: () => void;
  selectedCount: number;
  totalFiltered: number;
  isExecuting: boolean;
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const GlobalPeriodBar: React.FC<GlobalPeriodBarProps> = ({
  selectedYear,
  selectedMonth,
  onChangeYear,
  onChangeMonth,
  onRunSelected,
  selectedCount,
  totalFiltered,
  isExecuting,
}) => {
  const countToRun = selectedCount > 0 ? selectedCount : totalFiltered;

  return (
    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4 backdrop-blur">
      {/* Selector de Periodo */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-slate-300">
          <Calendar className="h-5 w-5 text-blue-400" />
          <span className="text-sm font-semibold">Periodo a Procesar:</span>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedYear}
            onChange={(e) => onChangeYear(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-sm font-medium text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="2026">2026</option>
            <option value="2025">2025</option>
            <option value="2024">2024</option>
          </select>

          <select
            value={selectedMonth}
            onChange={(e) => onChangeMonth(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-sm font-medium text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {MESES.map((m) => (
              <option key={m} value={m}>
                {m.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <span className="hidden sm:inline text-xs text-slate-400">
          (Aplica automáticamente a las empresas a procesar)
        </span>
      </div>

      {/* Botón de Ejecución Masiva */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={onRunSelected}
          disabled={isExecuting || countToRun === 0}
          className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:from-blue-500 hover:to-indigo-500 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
        >
          <Play className="h-4 w-4 fill-white" />
          <span>
            {isExecuting
              ? 'Procesando en Cola...'
              : selectedCount > 0
              ? `Ejecutar RCE (${selectedCount} seleccionada${selectedCount === 1 ? '' : 's'})`
              : `Ejecutar RCE (${countToRun} empresa${countToRun === 1 ? '' : 's'})`}
          </span>
        </button>
      </div>
    </div>
  );
};
