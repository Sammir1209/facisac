'use client';

import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Building2,
  Search,
  Filter,
  ArrowRight,
  ShieldCheck,
  Hash
} from 'lucide-react';
import { Cliente, RegistroResultado } from '@/types';
import { calcularVencimientoSunat } from '@/lib/sunatSchedule';

interface CalendarViewProps {
  clientes: Cliente[];
  resultados: Map<string, RegistroResultado>;
  onSelectClient: (cliente: Cliente) => void;
  selectedYear: string;
  selectedMonth: string;
}

// Fechas oficiales SUNAT para cada dígito de RUC (Periodo Agosto -> Vence en Septiembre)
const GRUPOS_DIGITOS_SUNAT = [
  { digitos: ['0'], dia: 14, diaSemana: 'Lunes 14' },
  { digitos: ['1'], dia: 15, diaSemana: 'Martes 15' },
  { digitos: ['2', '3'], dia: 16, diaSemana: 'Miércoles 16' },
  { digitos: ['4', '5'], dia: 17, diaSemana: 'Jueves 17' },
  { digitos: ['6', '7'], dia: 18, diaSemana: 'Viernes 18' },
  { digitos: ['8', '9'], dia: 21, diaSemana: 'Lunes 21' },
];

export const CalendarView: React.FC<CalendarViewProps> = ({
  clientes,
  resultados,
  onSelectClient,
  selectedYear,
  selectedMonth,
}) => {
  const [selectedDigitFilter, setSelectedDigitFilter] = useState<string>('TODOS');
  const [filtroTexto, setFiltroTexto] = useState<string>('');
  const [diaSeleccionado, setDiaSeleccionado] = useState<number>(14);

  // Mapear y ordenar empresas por fecha oficial de vencimiento y último dígito
  const empresasConVencimiento = useMemo(() => {
    return clientes.map((c) => {
      const v = calcularVencimientoSunat(c.ruc, c.regimenTributario, selectedYear, selectedMonth);
      const resultado = resultados.get(c.ruc);
      return {
        cliente: c,
        vencimiento: v,
        resultado,
        ultimoDigito: v.ultimoDigito
      };
    });
  }, [clientes, resultados, selectedYear, selectedMonth]);

  // Agrupar empresas por día de vencimiento
  const empresasPorDia = useMemo(() => {
    const mapa = new Map<number, typeof empresasConVencimiento>();
    GRUPOS_DIGITOS_SUNAT.forEach((g) => {
      mapa.set(g.dia, []);
    });

    empresasConVencimiento.forEach((item) => {
      const dia = item.vencimiento.diaVencimiento;
      if (mapa.has(dia)) {
        mapa.get(dia)!.push(item);
      } else {
        // En caso de ajuste
        mapa.set(dia, [item]);
      }
    });

    return mapa;
  }, [empresasConVencimiento]);

  // Empresas filtradas para la lista lateral de detalle
  const empresasDelDiaSeleccionado = useMemo(() => {
    let lista = empresasPorDia.get(diaSeleccionado) || [];

    if (selectedDigitFilter !== 'TODOS') {
      lista = lista.filter((item) => item.ultimoDigito === selectedDigitFilter);
    }

    if (filtroTexto.trim()) {
      const q = filtroTexto.toLowerCase();
      lista = lista.filter(
        (item) =>
          item.cliente.razonSocial.toLowerCase().includes(q) ||
          item.cliente.ruc.toLowerCase().includes(q)
      );
    }

    return lista;
  }, [empresasPorDia, diaSeleccionado, selectedDigitFilter, filtroTexto]);

  return (
    <div className="space-y-5">
      {/* Cabecera Explicativa con Énfasis en el Rol del Último Dígito */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 backdrop-blur">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600/20 ring-1 ring-blue-500/30">
              <CalendarIcon className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Cronograma Oficial SUNAT por Último Dígito de RUC
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Periodo Declarado: <strong className="text-blue-400">{selectedMonth} {selectedYear}</strong> • Vencimientos en: <strong className="text-white">Septiembre {selectedYear}</strong>
              </p>
            </div>
          </div>

          {/* Filtro Rápido por Dígito de RUC (0 al 9) */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
              <Hash className="h-3.5 w-3.5 text-blue-400" />
              Dígito RUC:
            </span>
            <div className="flex gap-1 p-1 rounded-xl bg-slate-950 border border-slate-800">
              <button
                onClick={() => setSelectedDigitFilter('TODOS')}
                className={`px-2 py-1 text-xs font-bold rounded-lg transition-all ${
                  selectedDigitFilter === 'TODOS'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Todos
              </button>
              {['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                <button
                  key={d}
                  onClick={() => setSelectedDigitFilter(d)}
                  className={`w-7 h-6 text-xs font-mono font-bold rounded-lg transition-all ${
                    selectedDigitFilter === d
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Grid de Columnas por Día Oficial de Vencimiento */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {GRUPOS_DIGITOS_SUNAT.map((grupo) => {
          const empresasGrupo = empresasPorDia.get(grupo.dia) || [];
          const isSelected = diaSeleccionado === grupo.dia;
          const totalAuditadas = empresasGrupo.filter((e) => !!e.resultado).length;

          // Semáforo de alerta para el día
          const tieneUrgentes = empresasGrupo.some(
            (e) => e.vencimiento.estadoAlerta === 'urgente' || e.vencimiento.estadoAlerta === 'vencido'
          );

          return (
            <div
              key={grupo.dia}
              onClick={() => setDiaSeleccionado(grupo.dia)}
              className={`cursor-pointer rounded-2xl border p-4 transition-all duration-200 flex flex-col justify-between ${
                isSelected
                  ? 'border-blue-500 bg-blue-950/30 shadow-lg shadow-blue-500/10 ring-2 ring-blue-500/40'
                  : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900/90'
              }`}
            >
              <div>
                {/* Cabecera del día */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {grupo.diaSemana}
                  </span>
                  <span
                    className={`h-2 w-2 rounded-full ${
                      tieneUrgentes ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'
                    }`}
                  />
                </div>

                {/* Dígitos correspondientes */}
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-xs text-slate-400">Dígito(s):</span>
                  <div className="flex gap-1">
                    {grupo.digitos.map((d) => (
                      <span
                        key={d}
                        className="rounded bg-blue-500/20 px-1.5 py-0.5 font-mono text-xs font-bold text-blue-300 border border-blue-500/30"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Conteo de empresas */}
                <div className="mt-3">
                  <span className="text-2xl font-extrabold text-white">
                    {empresasGrupo.length}
                  </span>
                  <span className="text-xs text-slate-400 ml-1">empresas</span>
                </div>
              </div>

              {/* Progreso de auditoría */}
              <div className="mt-3 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Auditadas:</span>
                <span className="font-semibold text-emerald-400">
                  {totalAuditadas} / {empresasGrupo.length}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detalle Ordenado y Limpio de las Empresas del Día Seleccionado */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-400" />
            <h4 className="font-bold text-base text-white">
              Empresas con Vencimiento SUNAT el día {diaSeleccionado} de Septiembre
            </h4>
            <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-400 border border-blue-500/30">
              {empresasDelDiaSeleccionado.length} registradas
            </span>
          </div>

          {/* Buscador interno */}
          <div className="relative min-w-[240px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Filtrar por RUC o Nombre..."
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              className="w-full rounded-lg border border-slate-700/80 bg-slate-950 py-1.5 pl-9 pr-3 text-xs text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Tabla Ordenada por RUC y Razón Social */}
        {empresasDelDiaSeleccionado.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400">
            No hay empresas que coincidan con los filtros para este día de vencimiento.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-[11px] font-semibold uppercase text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3">Último Dígito</th>
                  <th className="p-3">RUC</th>
                  <th className="p-3">Razón Social / Cliente</th>
                  <th className="p-3">Régimen Tributario</th>
                  <th className="p-3">Estado RCE</th>
                  <th className="p-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 bg-slate-900/40">
                {empresasDelDiaSeleccionado.map(({ cliente, vencimiento, resultado, ultimoDigito }) => (
                  <tr
                    key={cliente.id}
                    onClick={() => onSelectClient(cliente)}
                    className="cursor-pointer hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="p-3">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600/20 font-mono font-bold text-blue-300 border border-blue-500/30">
                        {ultimoDigito}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-bold text-white">
                      {cliente.ruc}
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-white">{cliente.razonSocial}</div>
                    </td>
                    <td className="p-3">
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">
                        {cliente.regimenTributario || 'GENERAL'}
                      </span>
                    </td>
                    <td className="p-3">
                      {resultado ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[11px]">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>En 0.00 (Verificado)</span>
                        </span>
                      ) : (
                        <span className="text-amber-400/90 text-[11px] flex items-center gap-1 font-medium">
                          <Clock className="h-3 w-3" />
                          <span>Pendiente de auditar</span>
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectClient(cliente);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:border-slate-600 transition-colors"
                      >
                        <span>Ver Ficha</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
