'use client';

import { useState, useEffect, useCallback } from 'react';
import { Cliente, RegistroResultado } from '@/types';
import { supabase } from '@/lib/supabase';
import { API_BASE } from '@/lib/apiConfig';

export function useClients() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [resultados, setResultados] = useState<Map<string, RegistroResultado>>(new Map());

  const [resultadosList, setResultadosList] = useState<RegistroResultado[]>([]);

  // Cargar clientes: Primero intenta Supabase, si no hay conexión hace fallback al backend local
  const fetchClientes = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Intento directo a Supabase
      const { data: supaClientes, error: supaErr } = await supabase
        .from('clientes')
        .select('*')
        .order('razon_social', { ascending: true });

      if (!supaErr && supaClientes && supaClientes.length > 0) {
        const mapeados: Cliente[] = supaClientes.map(c => ({
          id: c.id,
          ruc: c.ruc,
          razonSocial: c.razon_social,
          regimenTributario: c.regimen_tributario,
          usuario: c.usuario_sol,
          clave: c.clave_sol,
          esRojo: !!c.es_rojo,
          anio: c.anio_periodo || '2026',
          mes: c.mes_periodo || 'Agosto'
        }));
        setClientes(mapeados);
        setLoading(false);
        return;
      }
    } catch (e) {}

    // 2. Fallback al servidor local
    try {
      const res = await fetch(`${API_BASE}/api/excel/import-clients`);
      const data = await res.json();
      if (data.success && Array.isArray(data.clientes)) {
        setClientes(data.clientes);
      } else {
        setError(data.error || 'Error al cargar clientes');
      }
    } catch (err: any) {
      setError('No se pudo sincronizar clientes ni con Supabase ni con el servidor local.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Cargar historial de resultados RCE desde Supabase o backend
  const fetchResultados = useCallback(async () => {
    try {
      // 1. Intento directo a Supabase
      const { data: supaAudit, error: supaErr } = await supabase
        .from('auditorias_rce')
        .select('*')
        .order('created_at', { ascending: false });

      if (!supaErr && supaAudit && supaAudit.length > 0) {
        const list: RegistroResultado[] = supaAudit.map(a => ({
          ruc: a.ruc,
          periodo: { anio: a.anio, mes: a.mes },
          estado: a.estado,
          totalComprobantes: a.total_comprobantes,
          comprobantesModificados: a.comprobantes_modificados || [],
          mensaje: a.mensaje,
          fechaHora: a.fecha_hora
        }));
        setResultadosList(list);
        const map = new Map<string, RegistroResultado>();
        list.forEach(r => map.set(r.ruc, r));
        setResultados(map);
        return;
      }
    } catch (e) {}

    // 2. Fallback a archivo JSON del backend
    try {
      const res = await fetch(`${API_BASE}/api/rce/results`);
      const data = await res.json();
      if (data.success && Array.isArray(data.registros)) {
        setResultadosList(data.registros);
        const map = new Map<string, RegistroResultado>();
        data.registros.forEach((r: RegistroResultado) => {
          map.set(r.ruc, r);
        });
        setResultados(map);
      }
    } catch (e) {
      console.warn('No se pudo sincronizar el historial de resultados RCE');
    }
  }, []);

  const addImportedClients = useCallback((newClients: Cliente[]) => {
    setClientes((prev) => {
      const rucMap = new Map(prev.map(c => [c.ruc, c]));
      newClients.forEach(c => rucMap.set(c.ruc, c));
      return Array.from(rucMap.values());
    });
  }, []);

  useEffect(() => {
    fetchClientes();
    fetchResultados();
  }, [fetchClientes, fetchResultados]);

  // Selección individual
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Selección masiva
  const selectAll = (ids: string[]) => {
    setSelectedIds(new Set(ids));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  return {
    clientes,
    loading,
    error,
    selectedIds,
    resultados,
    resultadosList,
    toggleSelect,
    selectAll,
    deselectAll,
    fetchClientes,
    fetchResultados,
    addImportedClients,
  };
}
