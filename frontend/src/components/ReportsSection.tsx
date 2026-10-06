'use client';

import React from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  ExternalLink, 
  CheckCircle2, 
  Clock, 
  FileText, 
  Layers, 
  FolderCheck,
  ShieldCheck,
  Database
} from 'lucide-react';
import { Cliente, RegistroResultado } from '@/types';
import { API_BASE } from '@/lib/apiConfig';

interface ReportsSectionProps {
  clientes: Cliente[];
  resultados: RegistroResultado[];
  onExportExcel: () => void;
  onRefresh: () => void;
}

export const ReportsSection: React.FC<ReportsSectionProps> = ({
  clientes,
  resultados,
  onExportExcel,
  onRefresh,
}) => {
  return (
    <div className="space-y-6">
      {/* Banner de Evidencias y Exportación */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-slate-900/80 to-[#090d16] p-6 shadow-xl backdrop-blur-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              <FolderCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>Persistencia y Respaldos Locales</span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
              Reportes Ejecutivos y Evidencias de Auditoría
            </h2>
            <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
              Todos los procesos completados generan su respaldo formal en disco en formato JSON en la carpeta <code className="text-emerald-300 bg-emerald-950/60 px-1 py-0.5 rounded">auditoria_rce/</code> y en <code className="text-blue-300 bg-blue-950/60 px-1 py-0.5 rounded">registro_rce_resultados.json</code>. Puedes generar y descargar el Reporte Ejecutivo oficial en formato Excel (.xlsx) con un solo clic.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={onExportExcel}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 px-6 py-3 text-xs font-bold text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-95"
            >
              <Download className="h-4 w-4" />
              <span>Descargar Reporte Excel (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Resumen de Datos Locales */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
              <Database className="h-4 w-4 text-emerald-400" />
              <span>Historial Registrado</span>
            </div>
            <p className="mt-2 text-2xl font-black text-white">{resultados.length} auditorías</p>
            <span className="text-[10px] text-slate-500">Guardado en disco local</span>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
              <CheckCircle2 className="h-4 w-4 text-blue-400" />
              <span>Cartera de Clientes</span>
            </div>
            <p className="mt-2 text-2xl font-black text-white">{clientes.length} empresas</p>
            <span className="text-[10px] text-slate-500">Importadas desde Excel</span>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
              <ShieldCheck className="h-4 w-4 text-purple-400" />
              <span>Integridad de Respaldos</span>
            </div>
            <p className="mt-2 text-2xl font-black text-emerald-400">100% Seguro</p>
            <span className="text-[10px] text-slate-500">Sin dependencia de servidores externos</span>
          </div>
        </div>
      </div>

      {/* Tabla de Evidencias Recientes */}
      <div className="overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-900/60 shadow-xl backdrop-blur-xl">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
            <h3 className="font-bold text-sm text-white">Registro de Auditorías y Comprobantes Modificados</h3>
          </div>
          <span className="text-xs text-slate-400 font-medium">{resultados.length} registro(s)</span>
        </div>

        {resultados.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <FileText className="h-10 w-10 text-slate-600 mx-auto mb-3" />
            <p className="font-bold text-white text-sm">Aún no hay auditorías registradas</p>
            <p className="text-xs text-slate-500 mt-1">Inicia la modificación o inspección de RCE para ver las evidencias aquí.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-900/90 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-4">RUC / Contribuyente</th>
                  <th className="px-5 py-4">Periodo Fiscal</th>
                  <th className="px-5 py-4">Estado SUNAT</th>
                  <th className="px-5 py-4">Comprobantes Modificados</th>
                  <th className="px-5 py-4">Fecha y Hora</th>
                  <th className="px-5 py-4">Detalle / Diagnóstico</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {resultados.map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-4 font-mono font-bold text-white">
                      {r.ruc}
                    </td>
                    <td className="px-5 py-4 text-slate-300">
                      {r.periodo?.anio || '2026'} - {r.periodo?.mes || 'AGO'}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                        r.estado === 'SIN_COMPRAS'
                          ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                          : r.estado === 'SIN_MODIFICACIONES' || r.estado === 'EN_CERO'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      }`}>
                        {r.estado}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-200">
                      {Array.isArray(r.comprobantesModificados) ? r.comprobantesModificados.length : 0} comprobante(s)
                    </td>
                    <td className="px-5 py-4 text-slate-400 text-[11px]">
                      {r.fechaHora || 'N/A'}
                    </td>
                    <td className="px-5 py-4 text-slate-300 max-w-xs truncate">
                      {r.mensaje || r.avisoSunat || 'Proceso finalizado correctamente'}
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
