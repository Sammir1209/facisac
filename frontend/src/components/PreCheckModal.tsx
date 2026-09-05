'use client';

import React, { useState } from 'react';
import {
  X,
  FileCheck,
  ShieldCheck,
  AlertTriangle,
  Printer,
  CheckCircle2,
  AlertCircle,
  Building2,
  Calculator,
  Download
} from 'lucide-react';
import { Cliente, RegistroResultado } from '@/types';
import { calcularVencimientoSunat } from '@/lib/sunatSchedule';

interface PreCheckModalProps {
  cliente: Cliente | null;
  isOpen: boolean;
  onClose: () => void;
  resultado?: RegistroResultado;
}

export const PreCheckModal: React.FC<PreCheckModalProps> = ({
  cliente,
  isOpen,
  onClose,
  resultado,
}) => {
  const [ventasEnCero, setVentasEnCero] = useState(true);
  const [sinComprasPendientes, setSinComprasPendientes] = useState(true);

  if (!isOpen || !cliente) return null;

  const vencimiento = calcularVencimientoSunat(cliente.ruc, cliente.regimenTributario, cliente.anio, cliente.mes);
  const tieneAuditoria = !!resultado;
  const esEnCero = tieneAuditoria && (resultado.estado === 'SIN_MODIFICACIONES' || resultado.estado === 'MODIFICADO_EXITOSO');

  // Checklist
  const checks = [
    {
      label: 'Comprobantes con saldo gravado en Propuesta RCE',
      status: esEnCero ? 'ok' : 'warning',
      detail: esEnCero ? 'Todos los comprobantes gravados han sido verificados en 0.00' : 'Aún no se ha completado la auditoría Playwright en SUNAT'
    },
    {
      label: 'Base Imponible Gravada (BI DG)',
      status: esEnCero ? 'ok' : 'warning',
      detail: esEnCero ? 'BI DG = S/ 0.00 conforme' : 'Pendiente de confirmación'
    },
    {
      label: 'Impuesto General a las Ventas (IGV / IPM DG)',
      status: esEnCero ? 'ok' : 'warning',
      detail: esEnCero ? 'IGV DG = S/ 0.00 conforme' : 'Pendiente de confirmación'
    },
    {
      label: 'Condición del Contribuyente ante SUNAT',
      status: cliente.esRojo ? 'error' : 'ok',
      detail: cliente.esRojo ? 'Empresa marcada con observación o exclusión' : 'Contribuyente Activo y Habido para declaración'
    },
    {
      label: 'Plazo de Vencimiento de Libros Electrónicos',
      status: vencimiento.estadoAlerta === 'urgente' || vencimiento.estadoAlerta === 'vencido' ? 'warning' : 'ok',
      detail: `Fecha Límite Oficial: ${vencimiento.fechaLimite} (${vencimiento.textoAlerta})`
    }
  ];

  const handlePrintTicket = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-700/80 bg-[#0c1322] shadow-2xl">
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-slate-800 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/20 ring-1 ring-emerald-500/30">
              <FileCheck className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-white">
                Simulación y Pre-Check Contable de Presentación
              </h3>
              <p className="text-xs text-slate-400">
                Auditoría preventiva antes de generar la declaración formal en SUNAT
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

        {/* Cuerpo / Checklist */}
        <div className="max-h-[75vh] overflow-y-auto p-5 space-y-5">
          {/* Ficha básica */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <span className="text-slate-400 font-medium">Empresa:</span>
              <h4 className="text-sm font-bold text-white mt-0.5">{cliente.razonSocial}</h4>
              <div className="flex items-center gap-2 text-slate-400 mt-1">
                <span className="font-mono text-slate-300">RUC: {cliente.ruc}</span>
                <span>•</span>
                <span>Régimen: {cliente.regimenTributario || 'GENERAL'}</span>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-slate-400 font-medium">Periodo a Presentar:</span>
              <p className="text-sm font-bold text-blue-400 mt-0.5">{cliente.anio || '2026'} - {cliente.mes || 'Agosto'}</p>
              <span className="text-slate-400">Vencimiento: {vencimiento.fechaLimite}</span>
            </div>
          </div>

          {/* Checklist de Validación */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Validaciones de Integridad RCE
            </h4>

            <div className="space-y-2">
              {checks.map((chk, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between gap-3 rounded-xl border border-slate-800/80 bg-slate-900/40 p-3 text-xs"
                >
                  <div className="flex items-start gap-2.5">
                    {chk.status === 'ok' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : chk.status === 'warning' ? (
                      <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-semibold text-white">{chk.label}</p>
                      <p className="text-slate-400 mt-0.5">{chk.detail}</p>
                    </div>
                  </div>

                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-semibold shrink-0 ${
                      chk.status === 'ok'
                        ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                        : chk.status === 'warning'
                        ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                        : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {chk.status === 'ok' ? 'Conforme' : chk.status === 'warning' ? 'Revisar' : 'Observado'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Preguntas de Control para el Contador */}
          <div className="rounded-xl border border-blue-500/30 bg-blue-950/20 p-4 space-y-3 text-xs">
            <h4 className="font-semibold text-blue-200 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-400" />
              <span>Confirmación de Control Interno (Uso del Contador)</span>
            </h4>

            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={sinComprasPendientes}
                onChange={(e) => setSinComprasPendientes(e.target.checked)}
                className="rounded text-blue-500 accent-blue-600"
              />
              <span>Se confirma que no existen facturas ni notas de crédito pendientes por añadir manualmente.</span>
            </label>

            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={ventasEnCero}
                onChange={(e) => setVentasEnCero(e.target.checked)}
                className="rounded text-blue-500 accent-blue-600"
              />
              <span>Se conciliará el Registro de Ventas e Ingresos (RVIE) en conjunto con este RCE.</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900/60 p-4">
          <button
            onClick={handlePrintTicket}
            className="flex items-center gap-2 rounded-lg border border-slate-700/80 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors"
          >
            <Printer className="h-4 w-4 text-slate-400" />
            <span>Imprimir Hoja de Control</span>
          </button>

          <div className="flex items-center gap-3">
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
