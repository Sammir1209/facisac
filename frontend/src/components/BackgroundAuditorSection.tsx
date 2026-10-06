'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  SearchCheck, 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ShieldCheck, 
  RefreshCw, 
  FileText, 
  Sliders,
  Check,
  Eye,
  Zap,
  TrendingUp,
  FileCheck2
} from 'lucide-react';
import { Cliente, RegistroResultado } from '@/types';

interface BackgroundAuditorSectionProps {
  clientes: Cliente[];
  resultados: Map<string, RegistroResultado>;
  selectedYear: string;
  selectedMonth: string;
  onExecuteAuditScan: (clientes: Cliente[]) => void;
  isScanning: boolean;
  onOpenDetail: (cliente: Cliente) => void;
}

export const BackgroundAuditorSection: React.FC<BackgroundAuditorSectionProps> = ({
  clientes,
  resultados,
  selectedYear,
  selectedMonth,
  onExecuteAuditScan,
  isScanning,
  onOpenDetail,
}) => {
  const [filterState, setFilterState] = useState<'todos' | 'en_cero' | 'con_compras' | 'sin_compras' | 'sin_verificar'>('todos');

  // Clasificación de auditoría en base a los registros locales y SUNAT
  const auditAnalysis = React.useMemo(() => {
    let enCero = 0;
    let conComprasPendientes = 0;
    let sinCompras = 0;
    let sinVerificar = 0;

    const items = clientes
      .filter(c => !c.esRojo)
      .map(c => {
        const res = resultados.get(c.ruc);
        let estadoAuditoria: 'EN_CERO' | 'CON_COMPRAS' | 'SIN_COMPRAS' | 'SIN_VERIFICAR' = 'SIN_VERIFICAR';
        let detalle = 'Pendiente de escaneo en SUNAT';

        if (res) {
          if (res.estado === 'SIN_COMPRAS') {
            estadoAuditoria = 'SIN_COMPRAS';
            detalle = 'Sin comprobantes de compra en el periodo';
            sinCompras++;
          } else if (
            res.estado === 'SIN_MODIFICACIONES' ||
            res.estado === 'EN_CERO' ||
            res.estado === 'MODIFICADO_EXITOSO' ||
            (res.comprobantesModificados && res.comprobantesModificados.length === 0 && (res.totalComprobantes ?? 0) > 0)
          ) {
            estadoAuditoria = 'EN_CERO';
            detalle = `Propuesta en 0.00 confirmada (${res.totalComprobantes || 0} comprobantes)`;
            enCero++;
          } else if (res.estado === 'PENDIENTE_MODIFICAR' || (res.comprobantesModificados && res.comprobantesModificados.length > 0)) {
            estadoAuditoria = 'CON_COMPRAS';
            detalle = `Requiere traslado a 0.00 (${res.totalComprobantes || 1} comprobantes detectados)`;
            conComprasPendientes++;
          } else {
            estadoAuditoria = 'EN_CERO';
            enCero++;
          }
        } else {
          sinVerificar++;
        }

        return {
          cliente: c,
          resultado: res,
          estadoAuditoria,
          detalle
        };
      });

    return {
      items,
      stats: {
        total: items.length,
        enCero,
        conComprasPendientes,
        sinCompras,
        sinVerificar
      }
    };
  }, [clientes, resultados]);

  const itemsFiltrados = React.useMemo(() => {
    switch (filterState) {
      case 'en_cero':
        return auditAnalysis.items.filter(i => i.estadoAuditoria === 'EN_CERO');
      case 'con_compras':
        return auditAnalysis.items.filter(i => i.estadoAuditoria === 'CON_COMPRAS');
      case 'sin_compras':
        return auditAnalysis.items.filter(i => i.estadoAuditoria === 'SIN_COMPRAS');
      case 'sin_verificar':
        return auditAnalysis.items.filter(i => i.estadoAuditoria === 'SIN_VERIFICAR');
      default:
        return auditAnalysis.items;
    }
  }, [filterState, auditAnalysis]);

  // Escanear todas las que NO estén verificadas aún en el periodo actual
  const handleStartFullScan = () => {
    // Si ya tienen resultado verificado en 0.00 o sin compras, omitirlas para continuar desde donde se quedó
    const pendientesDeAuditoria = clientes
      .filter(c => !c.esRojo)
      .filter(c => {
        const r = resultados.get(c.ruc);
        const yaVerificado = r && (r.estado === 'EN_CERO' || r.estado === 'SIN_MODIFICACIONES' || r.estado === 'SIN_COMPRAS' || r.estado === 'MODIFICADO_EXITOSO');
        return !yaVerificado;
      })
      .map(c => ({
        ...c,
        anio: selectedYear,
        mes: selectedMonth,
        soloAuditar: true,
      }));

    if (pendientesDeAuditoria.length === 0) {
      alert('¡Todas las empresas de tu cartera ya han sido escaneadas y verificadas!');
      return;
    }

    onExecuteAuditScan(pendientesDeAuditoria);
  };

  const handleScanPendientesOnly = () => {
    const pendientes = auditAnalysis.items
      .filter(i => i.estadoAuditoria === 'SIN_VERIFICAR' || i.estadoAuditoria === 'CON_COMPRAS')
      .map(i => ({
        ...i.cliente,
        anio: selectedYear,
        mes: selectedMonth,
        soloAuditar: true,
      }));

    if (pendientes.length === 0) {
      alert('No hay empresas pendientes de verificación.');
      return;
    }

    onExecuteAuditScan(pendientes);
  };

  return (
    <div className="space-y-6">
      {/* Banner Principal del Auditor */}
      <div className="relative overflow-hidden rounded-3xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/40 via-slate-900/80 to-[#090d16] p-6 shadow-xl backdrop-blur-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300">
              <SearchCheck className="h-3.5 w-3.5 text-indigo-400" />
              <span>Inspector de RUCs en 2° Plano</span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
              Auditoría Preventiva de Propuestas RCE
            </h2>
            <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
              Escanea silenciosamente cada empresa en SUNAT para comprobar si <strong>ya se encuentra en 0.00</strong>, si <strong>no tiene comprobantes en el periodo</strong>, o si tiene <strong>compras pendientes por modificar</strong>, permitiéndote saber exactamente cuáles faltan antes de iniciar el lote.
            </p>
          </div>

          {/* Botones de Acción de Escaneo */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <button
              onClick={handleStartFullScan}
              disabled={isScanning || auditAnalysis.stats.sinVerificar === 0}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-95 disabled:opacity-40"
            >
              <Play className="h-4 w-4 fill-white" />
              <span>
                {isScanning 
                  ? 'Escaneando RUCs en SUNAT...' 
                  : auditAnalysis.stats.sinVerificar < auditAnalysis.stats.total && auditAnalysis.stats.sinVerificar > 0
                  ? `Continuar Escaneo (${auditAnalysis.stats.sinVerificar} restantes)`
                  : `Escanear Todas (${auditAnalysis.stats.total})`}
              </span>
            </button>
          </div>
        </div>

        {/* Tarjetas Resumen de Estado */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Verificadas en 0.00</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-emerald-400">{auditAnalysis.stats.enCero}</p>
            <span className="text-[10px] text-emerald-500/80 font-medium">No requieren acción</span>
          </div>

          <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Con Saldo / Por Modificar</span>
              <AlertCircle className="h-4 w-4 text-amber-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-amber-400">{auditAnalysis.stats.conComprasPendientes}</p>
            <span className="text-[10px] text-amber-500/80 font-medium">Requieren llevar a 0.00</span>
          </div>

          <div className="rounded-2xl border border-sky-500/30 bg-sky-950/20 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Sin Compras en Mes</span>
              <FileCheck2 className="h-4 w-4 text-sky-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-sky-400">{auditAnalysis.stats.sinCompras}</p>
            <span className="text-[10px] text-sky-500/80 font-medium">Propuesta vacía en SUNAT</span>
          </div>

          <div className="rounded-2xl border border-slate-700/60 bg-slate-900/40 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Pendientes de Revisar</span>
              <Clock className="h-4 w-4 text-slate-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-slate-300">{auditAnalysis.stats.sinVerificar}</p>
            <span className="text-[10px] text-slate-500 font-medium">Falta escanear en SUNAT</span>
          </div>
        </div>
      </div>

      {/* Barra de Filtro de Estados */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-1.5 rounded-2xl bg-slate-900/80 border border-slate-800">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilterState('todos')}
            className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
              filterState === 'todos' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Todas ({auditAnalysis.stats.total})
          </button>
          <button
            onClick={() => setFilterState('con_compras')}
            className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
              filterState === 'con_compras' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Por Modificar ({auditAnalysis.stats.conComprasPendientes})
          </button>
          <button
            onClick={() => setFilterState('en_cero')}
            className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
              filterState === 'en_cero' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Ya en 0.00 ({auditAnalysis.stats.enCero})
          </button>
          <button
            onClick={() => setFilterState('sin_compras')}
            className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
              filterState === 'sin_compras' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Sin Compras ({auditAnalysis.stats.sinCompras})
          </button>
          <button
            onClick={() => setFilterState('sin_verificar')}
            className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
              filterState === 'sin_verificar' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Por Escanear ({auditAnalysis.stats.sinVerificar})
          </button>
        </div>

        <span className="text-xs text-slate-400 px-3 font-medium">
          Mostrando {itemsFiltrados.length} empresa(s)
        </span>
      </div>

      {/* Tabla Elegante de Resultados del Auditor */}
      <div className="overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-900/60 shadow-xl backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-900/90 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-4">Empresa / Razón Social</th>
                <th className="px-5 py-4">RUC</th>
                <th className="px-5 py-4">Régimen</th>
                <th className="px-5 py-4">Estado RCE SUNAT</th>
                <th className="px-5 py-4">Diagnóstico</th>
                <th className="px-5 py-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {itemsFiltrados.map(({ cliente, resultado, estadoAuditoria, detalle }) => (
                <tr 
                  key={cliente.id}
                  className="hover:bg-slate-800/40 transition-colors"
                >
                  <td className="px-5 py-4">
                    <div className="font-bold text-white max-w-xs truncate">{cliente.razonSocial}</div>
                    <span className="text-[11px] text-slate-400">Usuario SOL: {cliente.usuario}</span>
                  </td>
                  <td className="px-5 py-4 font-mono font-semibold text-slate-300">
                    {cliente.ruc}
                  </td>
                  <td className="px-5 py-4 text-slate-400">
                    {cliente.regimenTributario || 'GENERAL'}
                  </td>
                  <td className="px-5 py-4">
                    {estadoAuditoria === 'EN_CERO' && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Confirmado en 0.00</span>
                      </span>
                    )}
                    {estadoAuditoria === 'CON_COMPRAS' && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-bold text-amber-400">
                        <AlertCircle className="h-3 w-3" />
                        <span>Falta Modificar</span>
                      </span>
                    )}
                    {estadoAuditoria === 'SIN_COMPRAS' && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-[11px] font-bold text-sky-400">
                        <FileCheck2 className="h-3 w-3" />
                        <span>Sin Compras</span>
                      </span>
                    )}
                    {estadoAuditoria === 'SIN_VERIFICAR' && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/60 px-3 py-1 text-[11px] font-semibold text-slate-400">
                        <Clock className="h-3 w-3" />
                        <span>No Escaneado</span>
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-slate-300 max-w-xs truncate">
                    {detalle}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => onOpenDetail(cliente)}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-700/80 transition-all"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Ficha</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
