'use client';

import React from 'react';
import { ExternalLink, CheckCircle2, AlertCircle, Ban } from 'lucide-react';

interface RucStatusBadgeProps {
  ruc: string;
  esRojo?: boolean;
}

export const RucStatusBadge: React.FC<RucStatusBadgeProps> = ({ ruc, esRojo }) => {
  const consultarSunat = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`https://e-consultaruc.sunat.gob.pe/cl-ti-itmrconsruc/jcrS00Alias?accion=consPorRuc&nroRuc=${ruc}`, '_blank');
  };

  if (esRojo) {
    return (
      <button
        onClick={consultarSunat}
        className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-300 hover:bg-rose-500/20 transition-all"
        title="Ver estado de este RUC en Consulta RUC SUNAT"
      >
        <Ban className="h-3 w-3 text-rose-400" />
        <span>RUC Excluido / Baja</span>
        <ExternalLink className="h-2.5 w-2.5 opacity-60" />
      </button>
    );
  }

  return (
    <button
      onClick={consultarSunat}
      className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/20 transition-all"
      title="Verificar condición de Habido y Activo en Consulta RUC SUNAT"
    >
      <CheckCircle2 className="h-3 w-3 text-emerald-400" />
      <span>Activo / Habido</span>
      <ExternalLink className="h-2.5 w-2.5 opacity-60" />
    </button>
  );
};
