'use client';

import React from 'react';
import { X, History, FileSpreadsheet, Calendar, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { Cliente, RegistroResultado } from '@/types';

interface HistoryAuditorModalProps {
  cliente: Cliente | null;
  isOpen: boolean;
  onClose: () => void;
  resultados: RegistroResultado[];
}

export const HistoryAuditorModal: React.FC<HistoryAuditorModalProps> = ({
  cliente,
  isOpen,
  onClose,
  resultados,
}) => {
  if (!isOpen || !cliente) return null;

  // Filtrar todos los resultados registrados para este RUC
  const historialEmpresa = resultados.filter((r) => r.ruc === cliente.ruc);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-700/80 bg-[#0c1322] shadow-2xl">
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-slate-800 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/20 ring-1 ring-blue-500/30">
              <History className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-white">
                Historial de Modificaciones y Auditoría RCE
              </h3>
              <p className="text-xs text-slate-400">
                {cliente.razonSocial} (RUC: {cliente.ruc})
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

        {/* Cuerpo */}
        <div className="max-h-[70vh] overflow-y-auto p-5 space-y-4">
          {historialEmpresa.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-8 text-center text-slate-400 text-xs">
              <p>No se encontraron registros de auditoría anteriores para esta empresa.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {historialEmpresa.map((hist, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-blue-400" />
                      <span className="text-xs font-bold text-white">
                        Periodo: {hist.periodo?.anio || '2026'} - {hist.periodo?.mes || 'AGO'}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">{hist.fechaHora}</span>
                  </div>

                  <p className="text-xs text-slate-300">{hist.mensaje}</p>

                  {/* Tabla de comprobantes si hubo modificaciones */}
                  {hist.comprobantesModificados && hist.comprobantesModificados.length > 0 && (
                    <div className="overflow-x-auto rounded-lg border border-slate-800/80 bg-slate-900/60">
                      <table className="w-full text-left text-[11px] text-slate-300">
                        <thead className="bg-slate-800/80 text-[10px] uppercase text-slate-400 border-b border-slate-700/60">
                          <tr>
                            <th className="p-2">Documento / Serie</th>
                            <th className="p-2">BI Original (S/)</th>
                            <th className="p-2">IGV Original (S/)</th>
                            <th className="p-2">Nuevo Saldo Gravado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono">
                          {hist.comprobantesModificados.map((comp, cIdx) => (
                            <tr key={cIdx}>
                              <td className="p-2 font-bold text-blue-300">{comp.documento || '--'}</td>
                              <td className="p-2">{comp.bi || 0}</td>
                              <td className="p-2">{comp.igv || 0}</td>
                              <td className="p-2 text-emerald-400 font-semibold">0.00 (No Gravado)</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-slate-800 bg-slate-900/60 p-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-4 py-1.5 text-xs sm:text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
