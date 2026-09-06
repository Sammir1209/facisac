/**
 * URL base dinámica para el backend API.
 * Prioridad:
 * 1. NEXT_PUBLIC_API_URL configurada en Vercel (cuando el backend está en Render).
 * 2. Si no está configurada y se ejecuta en localhost, usa http://localhost:3000.
 * 3. Fallback seguro.
 */
export const API_BASE = 
  process.env.NEXT_PUBLIC_API_URL || 
  (typeof window !== 'undefined' && window.location.hostname === 'localhost' 
    ? 'http://localhost:3000' 
    : 'http://localhost:3000');
