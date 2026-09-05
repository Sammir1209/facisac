'use client';

import React from 'react';
import { Play, Eye, Clock, Building2, Calendar, CheckCircle2 } from 'lucide-react';
import { Cliente, RegistroResultado } from '@/types';
import { calcularVencimientoSunat } from '@/lib/sunatSchedule';
import { RucStatusBadge } from '@/components/RucStatusBadge';

interface CompanyCardProps {
  cliente: Cliente;
  isSelected: boolean;
  onToggleSelect: () => void;
  onOpenDetail: () => void;
  onExecuteSingle: () => void;
  isExecutingThis: boolean;
  resultado?: RegistroResultado;
  solStatus?: { valido: boolean; estado: string; mensaje: string };
}

export const CompanyCard: React.FC<CompanyCardProps> = ({
  cliente,
  isSelected,
  onToggleSelect,
  onOpenDetail,
  onExecuteSingle,
  isExecutingThis,
  resultado,
  solStatus,
}) => {
  const vencimiento = calcularVencimientoSunat(
    cliente.ruc,
    cliente.regimenTributario,
    cliente.anio,
    cliente.mes
  );

  const getVencimientoBadgeClass = () => {
    switch (vencimiento.estadoAlerta) {
      case 'vencido':
      case 'urgente':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'proximo':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700/60';
    }
  };

  const isExcluida = !!cliente.esRojo;

  return (
    <div
      className={`group relative flex flex-col justify-between rounded-xl border p-4 backdrop-blur transition-all duration-200 ${
        isSelected
          ? 'border-blue-500/80 bg-blue-950/20 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/30'
          : isExcluida
          ? 'border-rose-900/40 bg-rose-950/10 opacity-75 hover:opacity-100'
          : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900/80 hover:shadow-md'
      }`}
    >
      {/* Cabecera de la Tarjeta */}
      <div>
        <div className="flex items-start justify-between gap-3">
          {/* Checkbox de Selección */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect();
            }}
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500 border-slate-700 bg-slate-800/80 hover:border-slate-500"
            aria-label="Seleccionar empresa para lote"
          >
            {isSelected && (
              <div className="h-2.5 w-2.5 rounded-sm bg-blue-500" />
            )}
          </button>

          {/* Razón Social y RUC */}
          <div
            onClick={onOpenDetail}
            className="flex-1 cursor-pointer select-none"
            title="Haz clic para ver toda la ficha y credenciales"
          >
            <h3 className="font-semibold text-sm leading-tight text-white group-hover:text-blue-400 transition-colors line-clamp-2">
              {cliente.razonSocial}
            </h3>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
              <span className="font-mono text-slate-300 font-medium">
                RUC: {cliente.ruc}
              </span>
              <span>•</span>
              <span className="truncate max-w-[120px]">
                {cliente.regimenTributario || 'GENERAL'}
              </span>
              <span>•</span>
              <RucStatusBadge ruc={cliente.ruc} esRojo={cliente.esRojo} />
              {solStatus && (
                <>
                  <span>•</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold border ${
                      solStatus.valido
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    }`}
                  >
                    {solStatus.valido ? 'SOL OK' : 'SOL ERROR'}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Badge Excluida si aplica */}
          {isExcluida && (
            <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-400 border border-rose-500/30">
              EXCLUIDA
            </span>
          )}
        </div>

        {/* Notificación de Vencimiento de Libros SUNAT */}
        <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Clock className="h-3.5 w-3.5" />
            <span>Vence:</span>
            <span className="font-medium text-slate-200">{vencimiento.fechaLimite}</span>
          </div>

          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${getVencimientoBadgeClass()}`}
          >
            {vencimiento.textoAlerta}
          </span>
        </div>

        {/* Estado del RCE si ya se procesó */}
        {resultado && (
          <div className="mt-2 rounded-lg bg-slate-950/60 p-2 text-xs border border-slate-800/80">
            <div className="flex items-center justify-between font-medium">
              <span className="text-slate-400">Estado RCE:</span>
              <span
                className={
                  resultado.estado === 'MODIFICADO_EXITOSO'
                    ? 'text-emerald-400 font-semibold flex items-center gap-1'
                    : resultado.estado === 'SIN_MODIFICACIONES' || resultado.estado === 'COMPLETADO' || resultado.estado === 'EN_CERO'
                    ? 'text-emerald-400 font-semibold flex items-center gap-1'
                    : 'text-amber-400'
                }
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>
                  {resultado.estado === 'SIN_MODIFICACIONES'
                    ? 'En 0.00 (Correcto)'
                    : resultado.estado === 'MODIFICADO_EXITOSO'
                    ? 'Modificado a 0.00'
                    : resultado.estado}
                </span>
              </span>
            </div>
            {resultado.comprobantesModificados && resultado.comprobantesModificados.length > 0 ? (
              <p className="mt-1 text-[11px] text-slate-400">
                Ajustados a 0.00: <strong className="text-emerald-300">{resultado.comprobantesModificados.length}</strong> comprobantes.
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-slate-400">
                Propuesta ya conforme sin montos gravados pendientes.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Botones de Acción de la Tarjeta */}
      <div className="mt-4 flex items-center gap-2 border-t border-slate-800/80 pt-3">
        <button
          onClick={onOpenDetail}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-800/50 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-600 hover:bg-slate-700/50 transition-all active:scale-95"
        >
          <Eye className="h-3.5 w-3.5" />
          <span>Ver Ficha</span>
        </button>

        <button
          onClick={onExecuteSingle}
          disabled={isExecutingThis}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-blue-600/20 border border-blue-500/30 py-1.5 text-xs font-medium text-blue-400 hover:bg-blue-600/30 hover:border-blue-500/50 transition-all active:scale-95 disabled:opacity-40"
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          <span>{isExecutingThis ? 'Procesando...' : 'Revisar RCE'}</span>
        </button>
      </div>
    </div>
  );
};
