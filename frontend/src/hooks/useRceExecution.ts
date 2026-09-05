'use client';

import { useState, useRef, useCallback } from 'react';
import { Cliente } from '@/types';

const API_BASE = 'http://localhost:3000';

export function useRceExecution() {
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeClientName, setActiveClientName] = useState<string>('');
  const [fase, setFase] = useState<string>('Iniciando');
  const [progreso, setProgreso] = useState<number>(0);
  const [estado, setEstado] = useState<string>('EN_COLA');
  const [logs, setLogs] = useState<string[]>([]);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  // Consultar estado en tiempo real
  const pollStatus = useCallback((jobId: string, onFinish?: () => void) => {
    stopPolling();

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/job/status/${jobId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.success) {
          setFase(data.fase || '');
          setProgreso(data.progreso || 0);
          setEstado(data.estado || '');
          if (Array.isArray(data.logs)) {
            setLogs(data.logs);
          }
          if (data.screenshot) {
            setScreenshot(data.screenshot);
          }

          if (
            data.estado === 'COMPLETADO' ||
            data.estado === 'ERROR' ||
            data.estado === 'CANCELADO'
          ) {
            stopPolling();
            setIsExecuting(false);
            if (onFinish) onFinish();
          }
        }
      } catch (err) {
        console.warn('Error durante polling del job', err);
      }
    }, 1200);
  }, []);

  // Encolar y ejecutar un cliente
  const executeSingle = useCallback(
    async (cliente: Cliente, onFinish?: () => void) => {
      setIsExecuting(true);
      setActiveClientName(cliente.razonSocial);
      setFase('Encolando Tarea');
      setProgreso(5);
      setEstado('EN_COLA');
      setLogs([`[${new Date().toLocaleTimeString()}] Encolando ${cliente.razonSocial}...`]);
      setScreenshot(null);
      setIsModalOpen(true);

      try {
        const res = await fetch(`${API_BASE}/api/sire/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cliente),
        });
        const data = await res.json();
        if (data.success && data.jobId) {
          setActiveJobId(data.jobId);
          pollStatus(data.jobId, onFinish);
        } else {
          setEstado('ERROR');
          setFase('Fallo al encolar');
          setLogs((prev) => [...prev, `[ERROR] ${data.error || 'No se pudo iniciar'}`]);
          setIsExecuting(false);
        }
      } catch (err: any) {
        setEstado('ERROR');
        setFase('Error de red');
        setLogs((prev) => [...prev, `[ERROR] Error al conectar con el backend: ${err.message}`]);
        setIsExecuting(false);
      }
    },
    [pollStatus]
  );

  // Ejecución por lotes (secuencial en cola del backend)
  const executeBatch = useCallback(
    async (clientesParaEjecutar: Cliente[], onFinishAll?: () => void) => {
      if (clientesParaEjecutar.length === 0) return;

      setIsExecuting(true);
      setIsModalOpen(true);

      for (let i = 0; i < clientesParaEjecutar.length; i++) {
        const cliente = clientesParaEjecutar[i];
        setActiveClientName(`${cliente.razonSocial} (${i + 1}/${clientesParaEjecutar.length})`);
        
        await new Promise<void>((resolve) => {
          executeSingle(cliente, () => {
            resolve();
          });
        });
      }

      setIsExecuting(false);
      if (onFinishAll) onFinishAll();
    },
    [executeSingle]
  );

  // Cancelar tarea activa
  const cancelActiveJob = useCallback(async () => {
    if (!activeJobId) return;
    try {
      await fetch(`${API_BASE}/api/job/cancel/${activeJobId}`, { method: 'POST' });
      setEstado('CANCELADO');
      setFase('Cancelado por el usuario');
      stopPolling();
      setIsExecuting(false);
    } catch (e) {
      console.warn('Error cancelando tarea', e);
    }
  }, [activeJobId]);

  // Detener toda la cola
  const stopAllQueue = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/api/queue/stop-all`, { method: 'POST' });
      stopPolling();
      setIsExecuting(false);
      setEstado('CANCELADO');
      setFase('Parada global solicitada');
    } catch (e) {
      console.warn('Error al detener toda la cola', e);
    }
  }, []);

  return {
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
  };
}
