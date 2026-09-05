import { VencimientoInfo } from '@/types';

export interface VencimientoDetallado extends VencimientoInfo {
  diaVencimiento: number;
  mesVencimiento: string;
  mesVencimientoNumero: number;
  anioVencimiento: number;
  ultimoDigito: string;
  nombreDia: string;
}

/**
 * Cronograma oficial SUNAT para presentación de Libros Electrónicos (RCE / SIRE).
 *
 * El último dígito del RUC determina el día exacto de vencimiento.
 * Para el periodo Agosto 2026 (declaración en Septiembre 2026):
 * - Dígito 0: 14 de Septiembre
 * - Dígito 1: 15 de Septiembre
 * - Dígito 2 y 3: 16 de Septiembre
 * - Dígito 4 y 5: 17 de Septiembre
 * - Dígito 6 y 7: 18 de Septiembre
 * - Dígito 8 y 9: 21 de Septiembre (ajustado por fin de semana)
 * - Buenos Contribuyentes: 22 de Septiembre
 */
const TABLA_CRONOGRAMA_SUNAT_AGOSTO_2026: Record<string, number> = {
  '0': 14,
  '1': 15,
  '2': 16,
  '3': 16,
  '4': 17,
  '5': 17,
  '6': 18,
  '7': 18,
  '8': 21,
  '9': 21,
};

export function calcularVencimientoSunat(
  ruc: string,
  regimen: string = 'GENERAL',
  anio: string = '2026',
  mes: string = 'Agosto'
): VencimientoDetallado {
  const ultimoDigito = ruc && ruc.length >= 1 ? ruc.slice(-1) : '0';

  let diaVencimiento = TABLA_CRONOGRAMA_SUNAT_AGOSTO_2026[ultimoDigito] || 15;

  const anioNum = parseInt(anio, 10) || 2026;
  const mesVencimientoNumero = 9; // Septiembre
  const mesVencimiento = 'Septiembre';

  const fechaLimiteObj = new Date(anioNum, mesVencimientoNumero - 1, diaVencimiento);
  
  // Ajustar si cae sábado (6) o domingo (0) al lunes siguiente
  if (fechaLimiteObj.getDay() === 6) {
    diaVencimiento += 2;
    fechaLimiteObj.setDate(diaVencimiento);
  } else if (fechaLimiteObj.getDay() === 0) {
    diaVencimiento += 1;
    fechaLimiteObj.setDate(diaVencimiento);
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const fechaLimiteObjSinHora = new Date(fechaLimiteObj);
  fechaLimiteObjSinHora.setHours(0, 0, 0, 0);

  const diffTime = fechaLimiteObjSinHora.getTime() - hoy.getTime();
  const diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const fechaLimite = `${diaVencimiento.toString().padStart(2, '0')}/${mesVencimientoNumero.toString().padStart(2, '0')}/${anioNum}`;

  const nombresDiasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const nombreDia = nombresDiasSemana[fechaLimiteObj.getDay()];

  let estadoAlerta: 'urgente' | 'proximo' | 'holgado' | 'vencido' = 'holgado';
  let textoAlerta = `Vence el ${fechaLimite}`;

  if (diasRestantes < 0) {
    estadoAlerta = 'vencido';
    textoAlerta = `Vencido hace ${Math.abs(diasRestantes)} días`;
  } else if (diasRestantes === 0) {
    estadoAlerta = 'urgente';
    textoAlerta = 'Vence Hoy';
  } else if (diasRestantes <= 3) {
    estadoAlerta = 'urgente';
    textoAlerta = `Vence en ${diasRestantes} días`;
  } else if (diasRestantes <= 7) {
    estadoAlerta = 'proximo';
    textoAlerta = `Vence en ${diasRestantes} días`;
  }

  return {
    fechaLimite,
    diasRestantes,
    estadoAlerta,
    textoAlerta,
    diaVencimiento,
    mesVencimiento,
    mesVencimientoNumero,
    anioVencimiento: anioNum,
    ultimoDigito,
    nombreDia
  };
}
