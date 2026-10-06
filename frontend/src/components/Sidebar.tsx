'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  FileEdit, 
  SearchCheck, 
  CalendarDays, 
  FileSpreadsheet, 
  MessageSquare, 
  ShieldCheck, 
  Pin, 
  PinOff, 
  ChevronLeft, 
  ChevronRight,
  LogOut,
  Layers,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

export type DashboardSection = 
  | 'cartera' 
  | 'modificar_rce' 
  | 'auditoria_segundo_plano' 
  | 'calendario' 
  | 'reportes' 
  | 'whatsapp';

interface SidebarProps {
  currentSection: DashboardSection;
  onSelectSection: (section: DashboardSection) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isPinned: boolean;
  onTogglePin: () => void;
  currentUser: { name: string; username: string } | null;
  onLogout: () => void;
  pendingCount?: number;
  inZeroCount?: number;
  isInspectingBackground?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentSection,
  onSelectSection,
  isCollapsed,
  onToggleCollapse,
  isPinned,
  onTogglePin,
  currentUser,
  onLogout,
  pendingCount = 0,
  inZeroCount = 0,
  isInspectingBackground = false,
}) => {
  const menuItems: {
    id: DashboardSection;
    label: string;
    sublabel: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string | number;
    badgeColor?: string;
  }[] = [
    {
      id: 'cartera',
      label: 'Panel General',
      sublabel: 'Vista de Clientes y KPIs',
      icon: LayoutDashboard,
    },
    {
      id: 'modificar_rce',
      label: 'Modificar RCE SIRE',
      sublabel: 'Flujo Oficial SUNAT a 0.00',
      icon: FileEdit,
      badge: pendingCount > 0 ? `${pendingCount}` : undefined,
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    },
    {
      id: 'auditoria_segundo_plano',
      label: 'Auditor en 2° Plano',
      sublabel: 'Escanear Estado de Todos',
      icon: SearchCheck,
      badge: isInspectingBackground ? 'ACTIVO' : 'AUTO',
      badgeColor: isInspectingBackground 
        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 animate-pulse' 
        : 'bg-blue-500/10 text-blue-300 border-blue-500/20',
    },
    {
      id: 'calendario',
      label: 'Calendario Tributario',
      sublabel: 'Vencimientos según RUC',
      icon: CalendarDays,
    },
    {
      id: 'reportes',
      label: 'Reportes y Evidencias',
      sublabel: 'Archivos JSON y Excel',
      icon: FileSpreadsheet,
      badge: inZeroCount > 0 ? `${inZeroCount} OK` : undefined,
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    },
    {
      id: 'whatsapp',
      label: 'Notificaciones WhatsApp',
      sublabel: 'Alertas a Grupos y Confirmación',
      icon: MessageSquare,
    },
  ];

  return (
    <motion.aside
      initial={false}
      animate={{
        width: isCollapsed ? 80 : 280,
      }}
      transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
      className={`relative z-40 flex flex-col shrink-0 border-r border-slate-800/80 bg-[#090d16]/95 backdrop-blur-xl h-screen select-none`}
    >
      {/* Cabecera / Marca Limpia */}
      <div className="flex h-18 items-center px-4 border-b border-slate-800/60 py-4.5">
        <div className="flex items-center gap-3 overflow-hidden w-full">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 shadow-md shadow-blue-500/25 ring-1 ring-blue-400/30">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>

          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col whitespace-nowrap overflow-hidden flex-1"
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-base tracking-tight text-white">
                    FACISAC
                  </span>
                  <span className="rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-bold text-blue-400 border border-blue-500/20">
                    SISTEMAS
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-medium tracking-wide">
                  Auditor RCE SUNAT 2026
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Botón Flotante para Colapsar/Expandir en la línea del borde derecho */}
      <button
        onClick={onToggleCollapse}
        title={isCollapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'}
        className="absolute -right-3.5 top-1/2 -translate-y-1/2 z-50 flex h-7 w-7 items-center justify-center rounded-full border border-slate-700/80 bg-slate-900 text-slate-300 shadow-lg shadow-black/40 hover:border-blue-500 hover:bg-blue-600 hover:text-white transition-all active:scale-90"
      >
        {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </button>

      {/* Navegación por Secciones */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 custom-scrollbar">
        {!isCollapsed && (
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Navegación del Sistema
          </div>
        )}

        {menuItems.map((item) => {
          const isActive = currentSection === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => onSelectSection(item.id)}
              title={isCollapsed ? item.label : undefined}
              className={`group relative w-full flex items-center rounded-2xl transition-all text-left ${
                isCollapsed ? 'justify-center p-3' : 'gap-3 px-3.5 py-3'
              } ${
                isActive
                  ? 'bg-gradient-to-r from-blue-600/20 via-indigo-600/15 to-transparent text-white border border-blue-500/40 shadow-lg shadow-blue-500/5'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 border border-transparent'
              }`}
            >
              {/* Barra indicadora izquierda activa */}
              {isActive && (
                <motion.div
                  layoutId="sidebarActiveIndicator"
                  className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-blue-500 shadow-md shadow-blue-500/50"
                />
              )}

              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-1 ring-blue-400/40'
                    : 'bg-slate-800/80 text-slate-400 group-hover:bg-slate-800 group-hover:text-slate-200'
                }`}
              >
                <Icon className="h-4.5 w-4.5" />
              </div>

              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="font-semibold text-xs text-slate-200 truncate group-hover:text-white">
                      {item.label}
                    </span>
                    {item.badge && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                          item.badgeColor || 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 truncate block mt-0.5">
                    {item.sublabel}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Tarjeta de Usuario y Sesión */}
      <div className="p-3 border-t border-slate-800/70 bg-slate-900/40">
        {!isCollapsed ? (
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/80 p-3 shadow-inner">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 font-bold text-white text-xs shadow-md shadow-indigo-500/20">
                  {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white truncate leading-tight">
                    {currentUser?.name || 'Usuario Autorizado'}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">
                    @{currentUser?.username || 'facisac'} • Operador
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={onTogglePin}
                  title={isPinned ? 'Desanclar barra lateral' : 'Anclar barra lateral fija'}
                  className={`p-1.5 rounded-lg border transition-all ${
                    isPinned
                      ? 'border-blue-500/40 bg-blue-500/15 text-blue-400'
                      : 'border-slate-800 bg-slate-800/80 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {isPinned ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={onLogout}
                  title="Cerrar Sesión Segura"
                  className="p-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div
              title={`${currentUser?.name} (@${currentUser?.username})`}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 font-bold text-white text-xs"
            >
              {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <button
              onClick={onLogout}
              title="Cerrar Sesión"
              className="p-2 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </motion.aside>
  );
};
