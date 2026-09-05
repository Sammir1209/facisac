export interface Cliente {
  id: string;
  razonSocial: string;
  ruc: string;
  regimenTributario?: string;
  usuario: string;
  clave: string;
  anio: string;
  mes: string;
  esRojo?: boolean;
}

export interface ComprobanteModificado {
  indiceFila?: number;
  documento?: string;
  bi?: number;
  igv?: number;
  nuevoSaldo?: number;
}

export interface RegistroResultado {
  ruc: string;
  periodo?: {
    anio?: string;
    mes?: string;
  };
  estado: string;
  totalComprobantes?: number;
  comprobantesModificados?: ComprobanteModificado[];
  fechaHora?: string;
  mensaje?: string;
}

export interface QueueStatus {
  enCola: number;
  enEjecucion: number;
  maxConcurrency: number;
}

export interface VencimientoInfo {
  fechaLimite: string; // Formato YYYY-MM-DD
  diasRestantes: number;
  estadoAlerta: 'urgente' | 'proximo' | 'holgado' | 'vencido';
  textoAlerta: string;
}
