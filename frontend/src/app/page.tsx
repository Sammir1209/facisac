'use client';

import React, { useState, useMemo } from 'react';
import { Navbar } from '@/components/Navbar';
import { KpiMetrics } from '@/components/KpiMetrics';
import { AlertsBanner } from '@/components/AlertsBanner';
import { GlobalPeriodBar } from '@/components/GlobalPeriodBar';
import { FilterTabs } from '@/components/FilterTabs';
import { CompanyCard } from '@/components/CompanyCard';
import { CompanyDetailModal } from '@/components/CompanyDetailModal';
import { ExecutionModal } from '@/components/ExecutionModal';
import { CalendarView } from '@/components/CalendarView';
import { HistoryAuditorModal } from '@/components/HistoryAuditorModal';
import { ExcelImportModal } from '@/components/ExcelImportModal';
import { WhatsAppModal } from '@/components/WhatsAppModal';
import { useClients } from '@/hooks/useClients';
import { useRceExecution } from '@/hooks/useRceExecution';
import { calcularVencimientoSunat } from '@/lib/sunatSchedule';
import { Cliente } from '@/types';
import { Loader2, AlertCircle, LayoutGrid, Calendar as CalendarIcon } from 'lucide-react';

export default function DashboardPage() {
  // Estado de clientes y backend
  const {
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
  } = useClients();

  // Estado de ejecución Playwright RCE
  const {
    activeJobId,
    activeClientName,
    fase,
    progreso,
    estado,
    logs,
    screenshot,
    isModalOpen,
    isExecuting,
    setIsModalOpen,
    executeSingle,
    executeBatch,
    cancelActiveJob,
    stopAllQueue,
  } = useRceExecution();

  // Estados locales de filtrado y navegación
  const [activeView, setActiveView] = useState<'grid' | 'calendar'>('grid');
  const [currentTab, setCurrentTab] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [selectedMonth, setSelectedMonth] = useState<string>('Agosto');
  
  // Modales adicionales
  const [activeDetailClient, setActiveDetailClient] = useState<Cliente | null>(null);
  const [historyClient, setHistoryClient] = useState<Cliente | null>(null);
  const [isExcelImportOpen, setIsExcelImportOpen] = useState<boolean>(false);
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState<boolean>(false);
  const [isValidatingSol, setIsValidatingSol] = useState<boolean>(false);
  const [solCheckResults, setSolCheckResults] = useState<Map<string, any>>(new Map());

  // Función para testear rápidamente Claves SOL con SUNAT
  const handleFastCheckSol = async () => {
    if (clientes.length === 0 || isValidatingSol) return;
    setIsValidatingSol(true);
    try {
      const payload = clientes.map(c => ({
        ruc: c.ruc,
        usuarioSol: c.usuario,
        claveSol: c.clave
      }));

      const res = await fetch('http://localhost:3000/api/sunat/fast-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientes: payload })
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.resultados)) {
        const map = new Map();
        data.resultados.forEach((r: any) => map.set(r.ruc, r));
        setSolCheckResults(map);

        const invalidas = data.resultados.filter((r: any) => !r.valido).length;
        if (invalidas > 0) {
          alert(`Test completado: Se detectaron ${invalidas} empresas con Clave SOL incorrecta o no válida ante SUNAT.`);
        } else {
          alert('¡Test completado! Todas las Claves SOL consultadas son válidas y operativas.');
        }
      }
    } catch (e: any) {
      alert('Error ejecutando test de Claves SOL: ' + e.message);
    } finally {
      setIsValidatingSol(false);
    }
  };

  // Filtrado reactivo de clientes
  const filteredClientes = useMemo(() => {
    return clientes.filter((c) => {
      // Filtro por término de búsqueda
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchRuc = c.ruc.toLowerCase().includes(query);
        const matchRazon = c.razonSocial.toLowerCase().includes(query);
        if (!matchRuc && !matchRazon) return false;
      }

      // Filtro por pestañas
      if (currentTab === 'auditados') {
        return resultados.has(c.ruc);
      }

      if (currentTab === 'pendientes') {
        return !resultados.has(c.ruc) && !c.esRojo;
      }

      if (currentTab === 'vence_pronto') {
        const v = calcularVencimientoSunat(c.ruc, c.regimenTributario, selectedYear, selectedMonth);
        return v.estadoAlerta === 'urgente' || v.estadoAlerta === 'proximo' || v.estadoAlerta === 'vencido';
      }

      if (currentTab === 'mype') {
        return (c.regimenTributario || '').toUpperCase().includes('MYPE');
      }

      if (currentTab === 'rer') {
        return (c.regimenTributario || '').toUpperCase().includes('ESPECIAL') || (c.regimenTributario || '').toUpperCase().includes('RER');
      }

      if (currentTab === 'general') {
        return (c.regimenTributario || '').toUpperCase().includes('GENERAL') || !c.regimenTributario;
      }

      if (currentTab === 'excluidos') {
        return !!c.esRojo;
      }

      return true;
    });
  }, [clientes, searchTerm, currentTab, selectedYear, selectedMonth, resultados]);

  // Métricas para KpiMetrics
  const kpiData = useMemo(() => {
    const total = clientes.length;
    let completadas = 0;
    let enCero = 0;
    let excluidas = 0;

    clientes.forEach((c) => {
      if (c.esRojo) excluidas++;
      const res = resultados.get(c.ruc);
      if (res) {
        if (
          res.estado === 'COMPLETADO' ||
          res.estado === 'MODIFICADO_EXITOSO' ||
          res.estado === 'SIN_MODIFICACIONES'
        ) {
          completadas++;
        }
        if (
          res.estado === 'SIN_MODIFICACIONES' ||
          res.estado === 'EN_CERO' ||
          res.estado === 'MODIFICADO_EXITOSO' ||
          (res.comprobantesModificados && res.comprobantesModificados.length === 0)
        ) {
          enCero++;
        }
      }
    });

    const pendientes = Math.max(0, total - completadas - excluidas);

    return { total, pendientes, completadas, enCero, excluidas };
  }, [clientes, resultados]);

  // Selección masiva de la lista filtrada
  const allSelected = useMemo(() => {
    if (filteredClientes.length === 0) return false;
    return filteredClientes.every((c) => selectedIds.has(c.id));
  }, [filteredClientes, selectedIds]);

  const handleToggleSelectAll = () => {
    if (allSelected) {
      deselectAll();
    } else {
      selectAll(filteredClientes.map((c) => c.id));
    }
  };

  // Descarga del reporte Excel
  const handleExportExcel = () => {
    window.open('http://localhost:3000/api/rce/export-excel', '_blank');
  };

  // Disparar ejecución para los clientes seleccionados o filtrados
  const handleRunBatch = () => {
    const listado = selectedIds.size > 0
      ? clientes.filter((c) => selectedIds.has(c.id))
      : filteredClientes;

    const clientesAProcesar = listado.map((c) => ({
      ...c,
      anio: selectedYear,
      mes: selectedMonth,
    }));

    if (clientesAProcesar.length === 0) return;

    executeBatch(clientesAProcesar, () => {
      fetchResultados();
    });
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      {/* 1. Barra de Navegación Global */}
      <Navbar
        onRefresh={() => {
          fetchClientes();
          fetchResultados();
        }}
        onStopAll={stopAllQueue}
        onExportExcel={handleExportExcel}
        onOpenImportExcel={() => setIsExcelImportOpen(true)}
        onOpenWhatsApp={() => setIsWhatsAppOpen(true)}
        onFastCheckSol={handleFastCheckSol}
        isValidatingSol={isValidatingSol}
        isStoppingAll={isExecuting}
      />

      {/* Contenedor Principal */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* 2. Banner de Alertas de Vencimiento SUNAT */}
        <AlertsBanner
          clientes={clientes}
          onFilterVencePronto={() => setCurrentTab('vence_pronto')}
        />

        {/* 3. Tarjetas Métricas KPI */}
        <KpiMetrics
          total={kpiData.total}
          pendientes={kpiData.pendientes}
          completadas={kpiData.completadas}
          enCero={kpiData.enCero}
          excluidas={kpiData.excluidas}
        />

        {/* 4. Barra de Periodo Global & Botón de Ejecución */}
        <GlobalPeriodBar
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          onChangeYear={setSelectedYear}
          onChangeMonth={setSelectedMonth}
          onRunSelected={handleRunBatch}
          selectedCount={selectedIds.size}
          totalFiltered={filteredClientes.length}
          isExecuting={isExecuting}
        />

        {/* 5. Filtros por Régimen, Buscador y Conmutador de Vistas */}
        <div className="space-y-3">
          <div className="flex items-center justify-end">
            <div className="inline-flex rounded-xl bg-slate-900/80 border border-slate-800 p-1">
              <button
                onClick={() => setActiveView('grid')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  activeView === 'grid'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Vista Cartera</span>
              </button>
              <button
                onClick={() => setActiveView('calendar')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  activeView === 'calendar'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                <span>Vista Calendario SUNAT</span>
              </button>
            </div>
          </div>

          {activeView === 'grid' && (
            <FilterTabs
              currentTab={currentTab}
              onSelectTab={setCurrentTab}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              totalFiltered={filteredClientes.length}
              onSelectAll={handleToggleSelectAll}
              allSelected={allSelected}
            />
          )}
        </div>

        {/* 6. Vista Activa: Calendario o Grilla */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-3" />
            <p className="text-sm font-medium">Sincronizando empresas con el servidor...</p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-center text-rose-300">
            <AlertCircle className="h-8 w-8 mx-auto text-rose-400 mb-2" />
            <p className="font-semibold">{error}</p>
            <button
              onClick={fetchClientes}
              className="mt-3 rounded-lg bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 transition-colors"
            >
              Reintentar Conexión
            </button>
          </div>
        ) : activeView === 'calendar' ? (
          <CalendarView
            clientes={clientes}
            resultados={resultados}
            onSelectClient={(c) => setActiveDetailClient(c)}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
          />
        ) : filteredClientes.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 py-16 text-center text-slate-400">
            <p className="text-sm font-medium">No se encontraron empresas con los filtros aplicados.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClientes.map((cliente) => (
              <CompanyCard
                key={cliente.id}
                cliente={{
                  ...cliente,
                  anio: selectedYear,
                  mes: selectedMonth,
                }}
                isSelected={selectedIds.has(cliente.id)}
                onToggleSelect={() => toggleSelect(cliente.id)}
                onOpenDetail={() => setActiveDetailClient(cliente)}
                onExecuteSingle={() => {
                  executeSingle(
                    {
                      ...cliente,
                      anio: selectedYear,
                      mes: selectedMonth,
                    },
                    () => {
                      fetchResultados();
                    }
                  );
                }}
                isExecutingThis={isExecuting && activeClientName.includes(cliente.razonSocial)}
                resultado={resultados.get(cliente.ruc)}
                solStatus={solCheckResults.get(cliente.ruc)}
              />
            ))}
          </div>
        )}
      </main>

      {/* 7. Modal de Ficha Individual de Empresa */}
      <CompanyDetailModal
        cliente={activeDetailClient}
        isOpen={!!activeDetailClient}
        onClose={() => setActiveDetailClient(null)}
        onExecute={(c) => {
          executeSingle(
            {
              ...c,
              anio: selectedYear,
              mes: selectedMonth,
            },
            () => {
              fetchResultados();
            }
          );
        }}
        onOpenHistory={(c) => setHistoryClient(c)}
        isExecuting={isExecuting}
        resultado={activeDetailClient ? resultados.get(activeDetailClient.ruc) : undefined}
      />

      {/* 8. Modal de Historial Multimes */}
      <HistoryAuditorModal
        cliente={historyClient}
        isOpen={!!historyClient}
        onClose={() => setHistoryClient(null)}
        resultados={resultadosList}
      />

      {/* 10. Modal de Importación Excel Drag & Drop */}
      <ExcelImportModal
        isOpen={isExcelImportOpen}
        onClose={() => setIsExcelImportOpen(false)}
        onClientsImported={(nuevos) => {
          addImportedClients(nuevos);
          fetchResultados();
        }}
      />

      {/* 11. Modal de Ejecución Playwright RCE en Vivo */}
      <ExecutionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCancelJob={cancelActiveJob}
        jobId={activeJobId}
        fase={fase}
        progreso={progreso}
        estado={estado}
        logs={logs}
        screenshot={screenshot}
        empresaNombre={activeClientName}
      />

      {/* 12. Modal de Configuración y Enlace de WhatsApp Web */}
      <WhatsAppModal
        isOpen={isWhatsAppOpen}
        onClose={() => setIsWhatsAppOpen(false)}
      />
    </div>
  );
}
