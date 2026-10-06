'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, User, Lock, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';

interface AuthModalProps {
  onSuccess: (user: { name: string; username: string }) => void;
}

// 3 Usuarios autorizados por FACISAC - SISTEMAS
const AUTHORIZED_USERS = [
  { username: 'Sammir', pass: '@Sammir_1409', name: 'Sammir Contreras' },
  { username: 'Danilo', pass: 'DANILOpiano1.1', name: 'Danilo' },
  { username: 'Lenar', pass: 'Servidor100', name: 'Lenar' },
];

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [authenticatedUser, setAuthenticatedUser] = useState<{ name: string; username: string } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    setTimeout(() => {
      const match = AUTHORIZED_USERS.find(
        (u) =>
          u.username.toLowerCase() === username.trim().toLowerCase() &&
          u.pass === password.trim()
      );

      if (match) {
        setAuthenticatedUser({ name: match.name, username: match.username });
        setTimeout(() => {
          onSuccess({ name: match.name, username: match.username });
        }, 1600);
      } else {
        setError('Usuario o contraseña no autorizados en FACISAC.');
        setIsLoading(false);
      }
    }, 450);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#060911]/90 backdrop-blur-xl p-4">
      <AnimatePresence mode="wait">
        {!authenticatedUser ? (
          <motion.div
            key="login-form"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-700/60 bg-gradient-to-b from-slate-900/90 via-[#0d1424]/95 to-[#090d16] p-8 shadow-2xl shadow-blue-950/40"
          >
            {/* Header del Login con Logo FACISAC */}
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 shadow-xl shadow-blue-500/25 ring-2 ring-blue-400/40">
                <ShieldCheck className="h-9 w-9 text-white" />
                <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-400">
                  <span className="h-2 w-2 rounded-full bg-slate-950" />
                </div>
              </div>

              <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold tracking-wide text-blue-400">
                <Sparkles className="h-3 w-3" />
                <span>FACISAC - SISTEMAS</span>
              </div>

              <h2 className="mt-3 text-2xl font-bold tracking-tight text-white">
                Acceso al Sistema RCE
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Ingresa tus credenciales oficiales para continuar
              </p>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit} className="mt-7 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Usuario
                </label>
                <div className="relative mt-1.5 flex items-center">
                  <User className="absolute left-3.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    placeholder="Ej. Sammir, Danilo o Lenar"
                    className="w-full rounded-xl border border-slate-700/80 bg-slate-950/60 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 transition-all focus:border-blue-500 focus:bg-slate-900/90 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Contraseña
                </label>
                <div className="relative mt-1.5 flex items-center">
                  <Lock className="absolute left-3.5 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••••••"
                    className="w-full rounded-xl border border-slate-700/80 bg-slate-950/60 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 transition-all focus:border-blue-500 focus:bg-slate-900/90 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-center text-xs font-medium text-rose-300"
                >
                  {error}
                </motion.div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
              >
                <span>{isLoading ? 'Verificando...' : 'Iniciar Sesión'}</span>
                {!isLoading && (
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                )}
              </button>
            </form>

            <div className="mt-6 border-t border-slate-800/80 pt-4 text-center">
              <p className="text-xs text-slate-500">
                Ejecutable Nativo para Windows • Auditoría SUNAT RCE 2026
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="welcome-banner"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ type: 'spring', damping: 20, stiffness: 220 }}
            className="flex flex-col items-center rounded-3xl border border-emerald-500/40 bg-gradient-to-b from-slate-900 via-[#0a181e] to-[#071318] p-10 text-center shadow-2xl shadow-emerald-950/50"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.15, type: 'spring', stiffness: 240 }}
              className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 ring-4 ring-emerald-500/40 shadow-xl shadow-emerald-500/20"
            >
              <CheckCircle2 className="h-10 w-10" />
            </motion.div>

            <motion.h3
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-5 text-2xl font-bold tracking-tight text-white"
            >
              ¡Bienvenido, {authenticatedUser.name}!
            </motion.h3>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-1 text-sm text-emerald-300 font-medium"
            >
              Sesión autorizada exitosamente en FACISAC - SISTEMAS
            </motion.p>

            <motion.div
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ delay: 0.5, duration: 1 }}
              className="mt-6 h-1 w-48 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
