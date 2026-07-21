import { pool } from './pool'
import dotenv from 'dotenv'

dotenv.config()

const schema = `
-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- Roles de usuario (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('admin', 'odontologo', 'paciente');
  END IF;
END$$;

-- Especialidades (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'especialidad') THEN
    CREATE TYPE especialidad AS ENUM (
      'general', 'ortodoncia', 'endodoncia', 'cirugia', 'blanqueamiento', 'pediatrica'
    );
  END IF;
END$$;

-- Estado de citas (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_cita') THEN
    CREATE TYPE estado_cita AS ENUM (
      'pendiente', 'confirmada', 'completada', 'cancelada', 'reprogramada'
    );
  END IF;
END$$;

-- Estado de facturas (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_factura') THEN
    CREATE TYPE estado_factura AS ENUM ('pendiente', 'pagada', 'vencida', 'anulada');
  END IF;
END$$;

-- Estado de insumos (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_insumo') THEN
    CREATE TYPE estado_insumo AS ENUM ('normal', 'stock_bajo', 'por_vencer', 'vencido');
  END IF;
END$$;

-- =====================
-- TABLA: usuarios
-- =====================
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cedula VARCHAR(20) UNIQUE NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  telefono VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  rol user_role NOT NULL DEFAULT 'paciente',
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- TABLA: odontologos
-- =====================
CREATE TABLE IF NOT EXISTS odontologos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  especialidad especialidad NOT NULL DEFAULT 'general',
  registro_profesional VARCHAR(50),
  bio TEXT,
  color VARCHAR(7) DEFAULT '#C17A5A',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- TABLA: pacientes
-- =====================
CREATE TABLE IF NOT EXISTS pacientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  fecha_nacimiento DATE,
  grupo_sanguineo VARCHAR(5),
  eps VARCHAR(100),
  alergias TEXT[],
  enfermedades TEXT[],
  medicamentos TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- TABLA: tratamientos
-- =====================
CREATE TABLE IF NOT EXISTS tratamientos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  duracion_minutos INTEGER NOT NULL DEFAULT 45,
  tarifa DECIMAL(12, 2) NOT NULL,
  especialidad especialidad DEFAULT 'general',
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- TABLA: citas
-- =====================
CREATE TABLE IF NOT EXISTS citas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paciente_id UUID REFERENCES pacientes(id) ON DELETE CASCADE,
  odontologo_id UUID REFERENCES odontologos(id),
  tratamiento_id UUID REFERENCES tratamientos(id),
  fecha_hora TIMESTAMPTZ NOT NULL,
  duracion_minutos INTEGER DEFAULT 45,
  estado estado_cita DEFAULT 'pendiente',
  motivo TEXT,
  notas_clinicas TEXT,
  motivo_cancelacion TEXT,
  token_confirmacion VARCHAR(100),
  confirmado_en TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- TABLA: historia_clinica
-- =====================
CREATE TABLE IF NOT EXISTS historia_clinica (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paciente_id UUID REFERENCES pacientes(id) ON DELETE CASCADE,
  cita_id UUID REFERENCES citas(id),
  odontologo_id UUID REFERENCES odontologos(id),
  fecha TIMESTAMPTZ DEFAULT NOW(),
  tratamiento_realizado VARCHAR(200),
  hallazgos TEXT,
  notas TEXT,
  recomendaciones TEXT,
  materiales_usados TEXT,
  duracion_real INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- TABLA: odontograma
-- =====================
CREATE TABLE IF NOT EXISTS odontograma (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paciente_id UUID REFERENCES pacientes(id) ON DELETE CASCADE,
  numero_diente INTEGER NOT NULL,
  estado VARCHAR(30) DEFAULT 'normal',
  notas TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(paciente_id, numero_diente)
);

-- =====================
-- TABLA: facturas
-- =====================
CREATE TABLE IF NOT EXISTS facturas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero VARCHAR(20) UNIQUE NOT NULL,
  cita_id UUID REFERENCES citas(id),
  paciente_id UUID REFERENCES pacientes(id),
  subtotal DECIMAL(12, 2) NOT NULL,
  descuento DECIMAL(12, 2) DEFAULT 0,
  total DECIMAL(12, 2) NOT NULL,
  estado estado_factura DEFAULT 'pendiente',
  fecha_emision TIMESTAMPTZ DEFAULT NOW(),
  fecha_pago TIMESTAMPTZ,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- TABLA: insumos
-- =====================
CREATE TABLE IF NOT EXISTS insumos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(150) NOT NULL,
  categoria VARCHAR(50) NOT NULL,
  stock_actual INTEGER NOT NULL DEFAULT 0,
  stock_minimo INTEGER NOT NULL DEFAULT 0,
  unidad VARCHAR(30) DEFAULT 'unidad',
  proveedor VARCHAR(100),
  precio_unitario DECIMAL(10, 2),
  fecha_vencimiento DATE,
  estado estado_insumo DEFAULT 'normal',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- TABLA: inventario_movimientos
-- =====================
CREATE TABLE IF NOT EXISTS inventario_movimientos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  insumo_id UUID REFERENCES insumos(id) ON DELETE SET NULL,
  cita_id UUID REFERENCES citas(id) ON DELETE SET NULL,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  tipo VARCHAR(30) NOT NULL,
  cantidad INTEGER NOT NULL,
  stock_anterior INTEGER,
  stock_nuevo INTEGER,
  motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- TABLA: notificaciones
-- =====================
CREATE TABLE IF NOT EXISTS notificaciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID REFERENCES usuarios(id),
  cita_id UUID REFERENCES citas(id),
  tipo VARCHAR(50) NOT NULL,
  titulo VARCHAR(200) NOT NULL,
  mensaje TEXT,
  canal VARCHAR(20) DEFAULT 'sistema',
  leido BOOLEAN DEFAULT false,
  enviado_en TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- TABLA: configuracion_general
-- =====================
CREATE TABLE IF NOT EXISTS configuracion_general (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  nombre_clinica VARCHAR(150) NOT NULL DEFAULT 'Clinica Sonrisas',
  nit VARCHAR(50),
  telefono VARCHAR(30),
  email VARCHAR(150),
  direccion TEXT,
  ciudad VARCHAR(100),
  horarios JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- TABLA: auditoria
-- =====================
CREATE TABLE IF NOT EXISTS auditoria (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  modulo VARCHAR(60) NOT NULL,
  accion VARCHAR(60) NOT NULL,
  entidad VARCHAR(60),
  entidad_id UUID,
  detalle JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- TABLAS: chatbot WhatsApp
-- =====================
CREATE TABLE IF NOT EXISTS whatsapp_conversaciones (
  telefono VARCHAR(30) PRIMARY KEY,
  contexto JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS whatsapp_mensajes_procesados (
  mensaje_id VARCHAR(120) PRIMARY KEY,
  telefono VARCHAR(30),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS whatsapp_eventos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  telefono VARCHAR(30) NOT NULL,
  rol VARCHAR(20) DEFAULT 'desconocido',
  tipo VARCHAR(50) NOT NULL,
  detalle JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO configuracion_general (
  id, nombre_clinica, nit, telefono, email, direccion, ciudad, horarios
) VALUES (
  true,
  'Clinica Sonrisas',
  '900.123.456-7',
  '605 345 6789',
  'info@clinicasonrisas.co',
  'Cra 54 #72-33, Barranquilla',
  'Barranquilla, Atlantico',
  '[
    {"dia":"Lunes a Viernes","desde":"08:00","hasta":"18:00","activo":true},
    {"dia":"Sabados","desde":"08:00","hasta":"13:00","activo":true},
    {"dia":"Domingos","desde":"","hasta":"","activo":false}
  ]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Preferencias de notificaciones e integraciones (configuracion ampliada)
ALTER TABLE configuracion_general
  ADD COLUMN IF NOT EXISTS notificaciones JSONB NOT NULL DEFAULT '{
    "recordatorios_activos": true,
    "horas_anticipacion": 24,
    "canal_email": true,
    "canal_sms": false,
    "canal_whatsapp": false,
    "resumen_diario": true
  }'::jsonb;

ALTER TABLE configuracion_general
  ADD COLUMN IF NOT EXISTS integraciones JSONB NOT NULL DEFAULT '{
    "email_remitente": "",
    "smtp_host": "",
    "whatsapp_numero": "",
    "pasarela_pago": "ninguna"
  }'::jsonb;

-- =====================
-- LIMPIEZA DE PERFILES DUPLICADOS
-- =====================
-- El seed puede ejecutarse varias veces en Docker. Antes de imponer unicidad
-- por usuario, conservamos el perfil más antiguo y movemos las referencias.
WITH ranked AS (
  SELECT
    id,
    FIRST_VALUE(id) OVER (PARTITION BY usuario_id ORDER BY created_at ASC, id ASC) AS keep_id
  FROM odontologos
  WHERE usuario_id IS NOT NULL
),
duplicados AS (
  SELECT id, keep_id FROM ranked WHERE id <> keep_id
)
UPDATE citas c
SET odontologo_id = d.keep_id
FROM duplicados d
WHERE c.odontologo_id = d.id;

WITH ranked AS (
  SELECT
    id,
    FIRST_VALUE(id) OVER (PARTITION BY usuario_id ORDER BY created_at ASC, id ASC) AS keep_id
  FROM odontologos
  WHERE usuario_id IS NOT NULL
),
duplicados AS (
  SELECT id, keep_id FROM ranked WHERE id <> keep_id
)
UPDATE historia_clinica h
SET odontologo_id = d.keep_id
FROM duplicados d
WHERE h.odontologo_id = d.id;

WITH ranked AS (
  SELECT
    id,
    FIRST_VALUE(id) OVER (PARTITION BY usuario_id ORDER BY created_at ASC, id ASC) AS keep_id
  FROM odontologos
  WHERE usuario_id IS NOT NULL
),
duplicados AS (
  SELECT id, keep_id FROM ranked WHERE id <> keep_id
)
DELETE FROM odontologos od
USING duplicados d
WHERE od.id = d.id;

WITH ranked AS (
  SELECT
    id,
    FIRST_VALUE(id) OVER (PARTITION BY usuario_id ORDER BY created_at ASC, id ASC) AS keep_id
  FROM pacientes
  WHERE usuario_id IS NOT NULL
),
duplicados AS (
  SELECT id, keep_id FROM ranked WHERE id <> keep_id
)
UPDATE citas c
SET paciente_id = d.keep_id
FROM duplicados d
WHERE c.paciente_id = d.id;

WITH ranked AS (
  SELECT
    id,
    FIRST_VALUE(id) OVER (PARTITION BY usuario_id ORDER BY created_at ASC, id ASC) AS keep_id
  FROM pacientes
  WHERE usuario_id IS NOT NULL
),
duplicados AS (
  SELECT id, keep_id FROM ranked WHERE id <> keep_id
)
UPDATE historia_clinica h
SET paciente_id = d.keep_id
FROM duplicados d
WHERE h.paciente_id = d.id;

WITH ranked AS (
  SELECT
    id,
    FIRST_VALUE(id) OVER (PARTITION BY usuario_id ORDER BY created_at ASC, id ASC) AS keep_id
  FROM pacientes
  WHERE usuario_id IS NOT NULL
),
duplicados AS (
  SELECT id, keep_id FROM ranked WHERE id <> keep_id
)
UPDATE facturas f
SET paciente_id = d.keep_id
FROM duplicados d
WHERE f.paciente_id = d.id;

WITH ranked AS (
  SELECT
    id,
    FIRST_VALUE(id) OVER (PARTITION BY usuario_id ORDER BY created_at ASC, id ASC) AS keep_id
  FROM pacientes
  WHERE usuario_id IS NOT NULL
),
duplicados AS (
  SELECT id, keep_id FROM ranked WHERE id <> keep_id
)
DELETE FROM odontograma o
USING duplicados d
WHERE o.paciente_id = d.id
  AND EXISTS (
    SELECT 1
    FROM odontograma keep_o
    WHERE keep_o.paciente_id = d.keep_id
      AND keep_o.numero_diente = o.numero_diente
  );

WITH ranked AS (
  SELECT
    id,
    FIRST_VALUE(id) OVER (PARTITION BY usuario_id ORDER BY created_at ASC, id ASC) AS keep_id
  FROM pacientes
  WHERE usuario_id IS NOT NULL
),
duplicados AS (
  SELECT id, keep_id FROM ranked WHERE id <> keep_id
)
UPDATE odontograma o
SET paciente_id = d.keep_id
FROM duplicados d
WHERE o.paciente_id = d.id;

WITH ranked AS (
  SELECT
    id,
    FIRST_VALUE(id) OVER (PARTITION BY usuario_id ORDER BY created_at ASC, id ASC) AS keep_id
  FROM pacientes
  WHERE usuario_id IS NOT NULL
),
duplicados AS (
  SELECT id, keep_id FROM ranked WHERE id <> keep_id
)
DELETE FROM pacientes p
USING duplicados d
WHERE p.id = d.id;

-- =====================
-- LIMPIEZA DE TRATAMIENTOS DUPLICADOS
-- =====================
-- El seed insertaba los tratamientos en cada arranque (el ON CONFLICT no tenía
-- una restricción de unicidad que aplicar). Conservamos uno por nombre
-- (preferimos uno activo y el más antiguo) y repuntamos las citas.
WITH ranked AS (
  SELECT
    id,
    FIRST_VALUE(id) OVER (PARTITION BY nombre ORDER BY activo DESC, created_at ASC, id ASC) AS keep_id
  FROM tratamientos
),
duplicados AS (
  SELECT id, keep_id FROM ranked WHERE id <> keep_id
)
UPDATE citas c
SET tratamiento_id = d.keep_id
FROM duplicados d
WHERE c.tratamiento_id = d.id;

WITH ranked AS (
  SELECT
    id,
    FIRST_VALUE(id) OVER (PARTITION BY nombre ORDER BY activo DESC, created_at ASC, id ASC) AS keep_id
  FROM tratamientos
),
duplicados AS (
  SELECT id, keep_id FROM ranked WHERE id <> keep_id
)
DELETE FROM tratamientos t
USING duplicados d
WHERE t.id = d.id;

-- Evita que se vuelvan a duplicar por nombre.
CREATE UNIQUE INDEX IF NOT EXISTS uq_tratamientos_nombre ON tratamientos (nombre);
CREATE UNIQUE INDEX IF NOT EXISTS insumos_nombre_key ON insumos (nombre);

-- =====================
-- TABLA: factura_secuencia (numeración consecutiva por año)
-- =====================
CREATE TABLE IF NOT EXISTS factura_secuencia (
  anio INTEGER PRIMARY KEY,
  ultimo INTEGER NOT NULL DEFAULT 0
);

-- Inicializa la secuencia con el mayor consecutivo ya existente por año, para que
-- los números nuevos no colisionen con facturas previas (índice único de numero).
INSERT INTO factura_secuencia (anio, ultimo)
SELECT split_part(numero, '-', 2)::int AS anio,
       MAX(split_part(numero, '-', 3)::int) AS ultimo
FROM facturas
WHERE numero ~ '^FAC-[0-9]{4}-[0-9]+$'
GROUP BY split_part(numero, '-', 2)::int
ON CONFLICT (anio) DO UPDATE SET ultimo = GREATEST(factura_secuencia.ultimo, EXCLUDED.ultimo);

-- =====================
-- TOKEN DE CONFIRMACIÓN DE CITAS
-- =====================
-- Cada cita tiene un token aleatorio para enlaces públicos seguros, así no se
-- puede confirmar/cancelar ni ver una cita conociendo solo el id.
ALTER TABLE citas ALTER COLUMN token_confirmacion SET DEFAULT gen_random_uuid()::text;
UPDATE citas SET token_confirmacion = gen_random_uuid()::text WHERE token_confirmacion IS NULL;

-- =====================
-- SOPORTE FISCAL INTERNO PARA FACTURAS
-- =====================
ALTER TABLE facturas
  ADD COLUMN IF NOT EXISTS metodo_pago VARCHAR(40),
  ADD COLUMN IF NOT EXISTS referencia_pago VARCHAR(100),
  ADD COLUMN IF NOT EXISTS cufe VARCHAR(120),
  ADD COLUMN IF NOT EXISTS qr_data TEXT,
  ADD COLUMN IF NOT EXISTS resolucion_dian VARCHAR(120);

UPDATE facturas
SET cufe = encode(sha256((id::text || numero || COALESCE(total::text, '') || fecha_emision::text)::bytea), 'hex')
WHERE cufe IS NULL;

UPDATE facturas
SET qr_data = concat('Factura ', numero, ' | Total ', total, ' | CUFE ', cufe)
WHERE qr_data IS NULL;

-- =====================
-- ÍNDICES
-- =====================
CREATE UNIQUE INDEX IF NOT EXISTS idx_citas_token ON citas(token_confirmacion);
CREATE INDEX IF NOT EXISTS idx_citas_fecha ON citas(fecha_hora);
CREATE INDEX IF NOT EXISTS idx_citas_paciente ON citas(paciente_id);
CREATE INDEX IF NOT EXISTS idx_citas_odontologo ON citas(odontologo_id);
CREATE INDEX IF NOT EXISTS idx_citas_estado ON citas(estado);
CREATE INDEX IF NOT EXISTS idx_facturas_paciente ON facturas(paciente_id);
CREATE INDEX IF NOT EXISTS idx_historia_paciente ON historia_clinica(paciente_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario ON notificaciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_inventario_movimientos_insumo ON inventario_movimientos(insumo_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_modulo ON auditoria(modulo, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usuarios_cedula ON usuarios(cedula);
CREATE UNIQUE INDEX IF NOT EXISTS idx_odontologos_usuario_unique ON odontologos(usuario_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pacientes_usuario_unique ON pacientes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversaciones_expires ON whatsapp_conversaciones(expires_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_mensajes_created ON whatsapp_mensajes_procesados(created_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_eventos_created ON whatsapp_eventos(created_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_eventos_tipo ON whatsapp_eventos(tipo);
CREATE INDEX IF NOT EXISTS idx_whatsapp_eventos_telefono ON whatsapp_eventos(telefono);
`

async function migrate() {
  const client = await pool.connect()
  try {
    console.log('🔄 Ejecutando migraciones...')
    await client.query(schema)
    console.log('✅ Migraciones completadas')
  } catch (error) {
    console.error('❌ Error en migración:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
