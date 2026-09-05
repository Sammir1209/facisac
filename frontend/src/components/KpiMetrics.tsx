'use client';

import React from 'react';
import { Users, Clock, CheckCircle2, FileX2, Ban } from 'lucide-react';

interface KpiMetricsProps {
  total: number;
  pendientes: number;
  completadas: number;
  enCero: number;
  excluidas: number;
}

export const KpiMetrics: React.FC<KpiMetricsProps> = ({
  total,
  pendientes,
  completadas,
  enCero,
  excluidas,
}) => {
  const cards = [
    {
      label: 'Empresas Registradas',
      value: total,
      subtext: 'Cartera activa',
      icon: Users,
      color: 'blue',
      border: 'border-blue-500/20',
      bg: 'from-blue-500/10 to-transparent',
      textColor: 'text-blue-400',
    },
    {
      label: 'Pendientes por Revisar',
      value: pendientes,
      subtext: 'Falta ejecutar RCE',
      icon: Clock,
      color: 'amber',
      border: 'border-amber-500/20',
      bg: 'from-amber-500/10 to-transparent',
      textColor: 'text-amber-400',
    },
    {
      label: 'Procesadas con Éxito',
      value: completadas,
      subtext: 'Verificadas en SUNAT',
      icon: CheckCircle2,
      color: 'emerald',
      border: 'border-emerald-500/20',
      bg: 'from-emerald-500/10 to-transparent',
      textColor: 'text-emerald-400',
    },
    {
      label: 'Propuesta en Cero (0.00)',
      value: enCero,
      subtext: 'Sin compras gravadas',
      icon: FileX2,
      color: 'indigo',
      border: 'border-indigo-500/20',
      bg: 'from-indigo-500/10 to-transparent',
      textColor: 'text-indigo-400',
    },
    {
      label: 'Excluidas / En Rojo',
      value: excluidas,
      subtext: 'Marcadas en Excel',
      icon: Ban,
      color: 'rose',
      border: 'border-rose-500/20',
      bg: 'from-rose-500/10 to-transparent',
      textColor: 'text-rose-400',
    },
  ];

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <div
            key={i}
            className={`relative overflow-hidden rounded-xl border ${card.border} bg-gradient-to-b ${card.bg} bg-slate-900/60 p-4 backdrop-blur transition-all duration-200 hover:border-slate-700 hover:shadow-lg`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {card.label}
              </span>
              <Icon className={`h-4 w-4 ${card.textColor}`} />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                {card.value}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">{card.subtext}</p>
          </div>
        );
      })}
    </section>
  );
};
