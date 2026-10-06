'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  FileEdit, 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Clock, 
  ShieldCheck, 
  Sparkles,
  Layers,
  Sliders,
  Filter
} from 'lucide-react';
import { Cliente, RegistroResultado } from '@/types';
import { CompanyCard } from '@/components/CompanyCard';

interface RceModifierSectionProps {
  clientes: Cliente[];
  resultados: Map<string, RegistroResultado>;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onExecuteBatch: () => void;
  onExecuteSingle: (cliente: Cliente) => void;
  onOpenDetail: (cliente: Cliente) => void;
  activeJobId: string | null;
  isExecuting: boolean;
  selectedYear: string;
  selectedMonth: string;
  onChangeYear: (year: string) => void;
  onChangeMonth: (month: string) => void;
}

export const RceModifierSection: React.FC<RceModifierSectionProps> = ({
  clientes,
  resultados,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  onExecuteBatch,
  onExecuteSingle,
  onOpenDetail,
  activeJobId,
  isExecuting,
  selectedYear,
  selectedMonth,
  onChangeYear,
  onChangeMonth,
}) => {
  const [filterMode, setFilterMode] = React.useState<'pendientes' | 'modificados' | 'sin_compras' | 'todos'>('pendientes');

  // Clasificación precisa según lo que maneja SUNAT
  const categorias = React.useMemo(() => {
    const pendientes: Cliente[] = [];
    const enCeroOModificados: Cliente[] = [];
    const sinCompras: Cliente[] = [];
    const excluidos: Cliente[] = [];

    clientes.forEach(c => {
      if (c.esRojo) {
        excluidos.push(c);
        return;
      }
      const res = resultados.get(c.ruc);
      if (!res) {
        pendientes.push(c);
      } else if (res.estado === 'SIN_COMPRAS') {
        sinCompras.push(c);
      } else if (
        res.estado === 'SIN_MODIFICACIONES' || 
        res.estado === 'EN_CERO' || 
        res.estado === 'COMPLETADO' || 
        res.estado === 'MODIFICADO_EXITOSO'
      ) {
        enCeroOModificados.push(c);
      } else {
        pendientes.push(c);
      }
    });

    return { pendientes, enCeroOModificados, sinCompras, excluidos };
  }, [clientes, resultados]);

  const listaFiltrada = React.useMemo(() => {
    switch (filterMode) {
      case 'pendientes':
        return categorias.pendientes;
      case 'modificados':
        return categorias.enCeroOModificados;
      case 'sin_compras':
        return categorias.sinCompras;
      default:
        return clientes.filter(c => !c.esRojo);
    }
  }, [filterMode, categorias, clientes]);

  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  return (
    <div className="space-y-6">
      {/* Banner Explicativo del Flujo SUNAT */}
      <div className="relative overflow-hidden rounded-3xl border border-blue-500/30 bg-gradient-to-br from-blue-950/40 via-slate-900/80 to-[#090d16] p-6 shadow-xl backdrop-blur-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300">
              <Sparkles className="h-3.5 w-3.5 text-blue-400" />
              <span>Módulo Oficial • SIRE RCE SUNAT</span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
              Modificación de Propuesta RCE a Saldo 0.00
            </h2>
            <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
              El motor automatizado ingresa a SOL, ubica la <strong>Gestión de Compras</strong>, abre la <strong>Propuesta del RCE</strong>, selecciona cada comprobante gravado y traslada automáticamente el monto de <code className="text-blue-300 bg-blue-950/60 px-1 py-0.5 rounded">BIGravadoDG</code> a <code className="text-emerald-300 bg-emerald-950/60 px-1 py-0.5 rounded">BINoGravadoDG</code>, dejando el saldo con crédito fiscal en cero exacto.
            </p>
          </div>

          {/* Selector de Periodo y Botón de Ejecución Primario */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-700/80 bg-slate-900/90 p-1.5 shadow-inner">
              <select
                value={selectedYear}
                onChange={(e) => onChangeYear(e.target.value)}
                className="bg-transparent px-2.5 py-1 text-xs font-bold text-white focus:outline-none"
              >
                {['2024', '2025', '2026', '2027'].map(y => (
                  <option key={y} value={y} className="bg-slate-900 text-white">{y}</option>
                ))}
              </select>
              <div className="h-4 w-px bg-slate-700" />
              <select
                value={selectedMonth}
                onChange={(e) => onChangeMonth(e.target.value)}
                className="bg-transparent px-2.5 py-1 text-xs font-bold text-white focus:outline-none"
              >
                {meses.map(m => (
                  <option key={m} value={m} className="bg-slate-900 text-white">{m}</option>
                ))}
              </select>
            </div>

            <button
              onClick={onExecuteBatch}
              disabled={isExecuting || listaFiltrada.length === 0}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-500/25 transition-all hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-95 disabled:opacity-40"
            >
              <Play className="h-4 w-4 fill-white" />
              <span>{isExecuting ? 'Procesando en SUNAT...' : `Modificar Seleccionadas (${selectedIds.size > 0 ? selectedIds.size : listaFiltrada.length})`}</span>
            </button>
          </div>
        </div>

        {/* Resumen de Pasos del Flujo SUNAT */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-900/50 border border-slate-800/60">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400 font-bold">1</div>
            <span className="text-slate-300">Login Clave SOL y descarte de avisos</span>
          </div>
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-900/50 border border-slate-800/60">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400 font-bold">2</div>
            <span className="text-slate-300">Acceso a Gestión Compras RCE</span>
          </div>
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-900/50 border border-slate-800/60">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400 font-bold">3</div>
            <span className="text-slate-300">Traslado de montos a casillas No Gravadas</span>
          </div>
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-900/50 border border-slate-800/60">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 font-bold">4</div>
            <span className="text-slate-300">Guardado, totales 0.00 y evidencia local</span>
          </div>
        </div>
      </div>

      {/* Tabs de Filtro de Clasificación */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-1.5 rounded-2xl bg-slate-900/80 border border-slate-800">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilterMode('pendientes')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              filterMode === 'pendientes'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Pendientes por Modificar ({categorias.pendientes.length})</span>
          </button>

          <button
            onClick={() => setFilterMode('modificados')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              filterMode === 'modificados'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Ya Modificados / En 0.00 ({categorias.enCeroOModificados.length})</span>
          </button>

          <button
            onClick={() => setFilterMode('sin_compras')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              filterMode === 'sin_compras'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <AlertCircle className="h-3.5 w-3.5" />
            <span>Sin Compras en Periodo ({categorias.sinCompras.length})</span>
          </button>

          <button
            onClick={() => setFilterMode('todos')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              filterMode === 'todos'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Todas las Activas ({clientes.filter(c => !c.esRojo).length})</span>
          </button>
        </div>

        {/* Acciones de Selección Masiva */}
        <div className="flex items-center gap-2 px-2 text-xs text-slate-400">
          <button
            onClick={selectedIds.size === listaFiltrada.length ? onDeselectAll : onSelectAll}
            className="text-blue-400 hover:text-blue-300 font-semibold transition-colors"
          >
            {selectedIds.size === listaFiltrada.length ? 'Deseleccionar todas' : 'Seleccionar todas'}
          </button>
          <span>•</span>
          <span>{selectedIds.size} seleccionada(s)</span>
        </div>
      </div>

      {/* Grilla de Tarjetas */}
      {listaFiltrada.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-800 bg-slate-900/30 p-12 text-center text-slate-400">
          <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-3 opacity-60" />
          <h3 className="text-base font-bold text-white">No hay empresas en este estado</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {filterMode === 'pendientes'
              ? '¡Excelente! Todas las empresas de tu archivo ya han sido modificadas o están en cero.'
              : 'Selecciona otra pestaña para revisar las demás empresas.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {listaFiltrada.map(cliente => (
            <CompanyCard
              key={cliente.id}
              cliente={cliente}
              isSelected={selectedIds.has(cliente.id)}
              onToggleSelect={() => onToggleSelect(cliente.id)}
              onOpenDetail={() => onOpenDetail(cliente)}
              onExecuteSingle={() => onExecuteSingle(cliente)}
              isExecutingThis={activeJobId !== null && isExecuting}
              resultado={resultados.get(cliente.ruc)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
