'use client';

import React from 'react';
import { BellRing, CalendarClock, ArrowRight } from 'lucide-react';
import { Cliente } from '@/types';
import { calcularVencimientoSunat } from '@/lib/sunatSchedule';

interface AlertsBannerProps {
  clientes: Cliente[];
  onFilterVencePronto: () => void;
}

export const AlertsBanner: React.FC<AlertsBannerProps> = ({
  clientes,
  onFilterVencePronto,
}) => {
  // Encontrar cuántas empresas están en urgencia (vencen en <= 3 días)
  const empresasUrgentes = clientes.filter((c) => {
    const v = calcularVencimientoSunat(c.ruc, c.regimenTributario, c.anio, c.mes);
    return v.estadoAlerta === 'urgente' || v.estadoAlerta === 'vencido';
  });

  const empresasProximas = clientes.filter((c) => {
    const v = calcularVencimientoSunat(c.ruc, c.regimenTributario, c.anio, c.mes);
    return v.estadoAlerta === 'proximo';
  });

  if (empresasUrgentes.length === 0 && empresasProximas.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-300">
        <CalendarClock className="h-5 w-5 text-emerald-400 shrink-0" />
        <span>
          <strong>Cronograma al día:</strong> Todas las empresas registradas tienen holgura en sus plazos de presentación SUNAT para este periodo.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 backdrop-blur">
      <div className="flex items-start sm:items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/20 ring-1 ring-amber-500/40 shrink-0">
          <BellRing className="h-5 w-5 text-amber-400" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-amber-200">
            Alerta de Vencimiento de Libros SUNAT (Periodo Agosto 2026)
          </h4>
          <p className="text-xs text-amber-300/80 mt-0.5">
            {empresasUrgentes.length > 0 ? (
              <span className="font-semibold text-rose-300">
                {empresasUrgentes.length} empresa(s) con plazo crítico (vence en &le; 3 días o vencido).{' '}
              </span>
            ) : null}
            {empresasProximas.length > 0 && (
              <span>
                {empresasProximas.length} empresa(s) vencen en los próximos 7 días según su último dígito de RUC y régimen tributario.
              </span>
            )}
          </p>
        </div>
      </div>

      <button
        onClick={onFilterVencePronto}
        className="flex items-center gap-1.5 self-end sm:self-auto rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 transition-all active:scale-95"
      >
        <span>Ver Afectadas</span>
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
