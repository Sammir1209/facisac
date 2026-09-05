'use client';

import React from 'react';
import { Search } from 'lucide-react';

interface FilterTabsProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  totalFiltered: number;
  onSelectAll?: () => void;
  allSelected?: boolean;
}

export const FilterTabs: React.FC<FilterTabsProps> = ({
  currentTab,
  onSelectTab,
  searchTerm,
  onSearchChange,
  totalFiltered,
  onSelectAll,
  allSelected,
}) => {
  const tabs = [
    { id: 'todos', label: 'Todos' },
    { id: 'auditados', label: 'Verificadas (En 0.00)' },
    { id: 'pendientes', label: 'Pendientes' },
    { id: 'vence_pronto', label: 'Vencen Pronto' },
    { id: 'mype', label: 'Régimen MYPE' },
    { id: 'rer', label: 'Régimen Especial (RER)' },
    { id: 'general', label: 'Régimen General' },
    { id: 'excluidos', label: 'Excluidos (Rojo)' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Pestañas de Filtro */}
        <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-slate-900/80 border border-slate-800">
          {tabs.map((t) => {
            const isActive = currentTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onSelectTab(t.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Buscador Rápido */}
        <div className="relative min-w-[260px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por RUC o Razón Social..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-lg border border-slate-700/80 bg-slate-900/80 py-1.5 pl-9 pr-4 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Barra de conteo de clientes filtrados y selección masiva */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        {onSelectAll && (
          <button
            onClick={onSelectAll}
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
          >
            <span>{allSelected ? 'Deseleccionar todas' : 'Seleccionar todas las mostradas'}</span>
          </button>
        )}
        <span>
          Mostrando <strong className="text-white">{totalFiltered}</strong> empresa(s)
        </span>
      </div>
    </div>
  );
};
