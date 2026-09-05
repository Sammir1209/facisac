-- ==========================================================
-- ESQUEMA DE BASE DE DATOS SUPABASE: FACISAC RCE SUNAT
-- Ejecuta este script en el SQL Editor de tu Dashboard de Supabase
-- https://supabase.com/dashboard/project/vkfdjqiogngpdvxmtqbh/sql
-- ==========================================================

-- 1. Tabla de Empresas / Clientes
CREATE TABLE IF NOT EXISTS public.clientes (
    id TEXT PRIMARY KEY,
    ruc VARCHAR(11) NOT NULL UNIQUE,
    razon_social TEXT NOT NULL,
    regimen_tributario TEXT DEFAULT 'GENERAL',
    usuario_sol TEXT NOT NULL,
    clave_sol TEXT NOT NULL,
    es_rojo BOOLEAN DEFAULT FALSE,
    anio_periodo VARCHAR(4) DEFAULT '2026',
    mes_periodo VARCHAR(15) DEFAULT 'Agosto',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabla de Historial y Resultados de Auditoría RCE
CREATE TABLE IF NOT EXISTS public.auditorias_rce (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ruc VARCHAR(11) NOT NULL REFERENCES public.clientes(ruc) ON DELETE CASCADE,
    razon_social TEXT,
    anio VARCHAR(4) NOT NULL,
    mes VARCHAR(15) NOT NULL,
    estado TEXT NOT NULL, -- 'SIN_MODIFICACIONES', 'MODIFICADO_EXITOSO', 'ERROR', 'EN_CERO'
    total_comprobantes INT DEFAULT 0,
    comprobantes_modificados JSONB DEFAULT '[]'::jsonb,
    aviso_sunat TEXT,
    mensaje TEXT,
    doble_verificacion BOOLEAN DEFAULT TRUE,
    fecha_hora TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_ruc_periodo UNIQUE(ruc, anio, mes)
);

-- 3. Tabla de Trabajos / Cola de Ejecución Playwright
CREATE TABLE IF NOT EXISTS public.jobs_cola (
    id TEXT PRIMARY KEY,
    ruc VARCHAR(11) NOT NULL REFERENCES public.clientes(ruc) ON DELETE CASCADE,
    estado TEXT NOT NULL DEFAULT 'EN_COLA', -- 'EN_COLA', 'PROCESANDO', 'COMPLETADO', 'ERROR', 'CANCELADO'
    fase TEXT DEFAULT 'En Cola',
    progreso INT DEFAULT 0,
    logs JSONB DEFAULT '[]'::jsonb,
    screenshot TEXT,
    resultado JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar Row Level Security (RLS) pero permitir lectura/escritura mediante políticas para la plataforma
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditorias_rce ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs_cola ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas para uso operativo con tu API Key
CREATE POLICY "Permitir todo a clientes" ON public.clientes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a auditorias_rce" ON public.auditorias_rce FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a jobs_cola" ON public.jobs_cola FOR ALL USING (true) WITH CHECK (true);

-- Índices para consultas de alta velocidad
CREATE INDEX IF NOT EXISTS idx_clientes_ruc ON public.clientes(ruc);
CREATE INDEX IF NOT EXISTS idx_auditorias_ruc ON public.auditorias_rce(ruc);
CREATE INDEX IF NOT EXISTS idx_auditorias_periodo ON public.auditorias_rce(anio, mes);
