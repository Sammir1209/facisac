'use client';

import React, { useState, useRef } from 'react';
import { X, UploadCloud, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Cliente } from '@/types';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClientsImported: (newClients: Cliente[]) => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  onClientsImported,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileProcess = async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xlsm') && !file.name.endsWith('.xls')) {
      setError('Por favor selecciona un archivo con formato válido de Excel (.xlsx, .xlsm, .xls)');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessInfo(null);

    try {
      const buffer = await file.arrayBuffer();
      const res = await fetch('http://localhost:3000/api/excel/upload-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: buffer,
      });

      const data = await res.json();
      if (data.success && Array.isArray(data.clientes)) {
        setSuccessInfo(`Se validaron e importaron ${data.total} empresas exitosamente desde la hoja.`);
        setTimeout(() => {
          onClientsImported(data.clientes);
          onClose();
        }, 1200);
      } else {
        setError(data.error || 'No se pudieron extraer las columnas requeridas del Excel.');
      }
    } catch (err: any) {
      setError('Error al comunicar con el servidor backend: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-700/80 bg-[#0c1322] shadow-2xl">
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-slate-800 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/20 ring-1 ring-blue-500/30">
              <FileSpreadsheet className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                Importar Cartera desde Excel
              </h3>
              <p className="text-xs text-slate-400">
                Carga masiva de RUCs y Claves SOL con validación automática
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

        {/* Zona Drag & Drop */}
        <div className="p-6 space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-blue-500 bg-blue-950/30'
                : 'border-slate-700/80 bg-slate-950/40 hover:border-slate-600 hover:bg-slate-900/40'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xlsm,.xls"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileProcess(e.target.files[0]);
                }
              }}
            />

            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800/80 text-blue-400 mb-3">
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              ) : (
                <UploadCloud className="h-6 w-6" />
              )}
            </div>

            <p className="text-sm font-semibold text-white">
              {isLoading
                ? 'Validando estructura del archivo Excel...'
                : 'Haz clic o arrastra tu archivo Excel aquí'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Soporta archivos .xlsx y .xlsm con columnas [Razón Social], [RUC], [Usuario] y [Clave]
            </p>
          </div>

          {/* Mensajes de feedback */}
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successInfo && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>{successInfo}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-slate-800 bg-slate-900/60 p-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-4 py-1.5 text-xs sm:text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};
