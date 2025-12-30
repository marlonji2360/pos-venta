-- database-schema.sql
-- Esquema completo de la base de datos para el Sistema POS de Abarrotes
-- PostgreSQL 15+

-- =====================================================
-- LIMPIAR TABLAS EXISTENTES (Usar con cuidado)
-- =====================================================
-- Descomenta estas líneas solo si quieres resetear la base de datos
-- DROP TABLE IF EXISTS notificaciones CASCADE;
-- DROP TABLE IF EXISTS detalle_pedidos CASCADE;
-- DROP TABLE IF EXISTS pedidos CASCADE;
-- DROP TABLE IF EXISTS detalle_cotizaciones CASCADE;
-- DROP TABLE IF EXISTS cotizaciones CASCADE;
-- DROP TABLE IF EXISTS detalle_ventas CASCADE;
-- DROP TABLE IF EXISTS ventas CASCADE;
-- DROP TABLE IF EXISTS movimientos_inventario CASCADE;
-- DROP TABLE IF EXISTS lotes_productos CASCADE;
-- DROP TABLE IF EXISTS productos CASCADE;
-- DROP TABLE IF EXISTS categorias CASCADE;
-- DROP TABLE IF EXISTS proveedores CASCADE;
-- DROP TABLE IF EXISTS clientes CASCADE;
-- DROP TABLE IF EXISTS usuarios CASCADE;
-- DROP TABLE IF EXISTS roles CASCADE;

-- =====================================================
-- 1. TABLA DE ROLES
-- =====================================================

CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE NOT NULL,
    descripcion TEXT,
    permisos JSONB DEFAULT '{}',
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE roles IS 'Roles de usuarios del sistema (Admin, Gerente, Vendedor, etc.)';
COMMENT ON COLUMN roles.permisos IS 'Permisos en formato JSON: {"ventas": true, "inventario": "read"}';

-- =====================================================
-- 2. TABLA DE USUARIOS
-- =====================================================

CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    telefono VARCHAR(20),
    rol_id INTEGER REFERENCES roles(id) ON DELETE SET NULL,
    activo BOOLEAN DEFAULT true,
    ultimo_acceso TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE usuarios IS 'Usuarios del sistema con sus credenciales y roles';
COMMENT ON COLUMN usuarios.password_hash IS 'Contraseña hasheada con bcrypt';

-- =====================================================
-- 3. TABLA DE CATEGORÍAS
-- =====================================================

CREATE TABLE IF NOT EXISTS categorias (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE categorias IS 'Categorías de productos (Abarrotes, Lácteos, Bebidas, etc.)';

-- =====================================================
-- 4. TABLA DE PRODUCTOS
-- =====================================================

CREATE TABLE IF NOT EXISTS productos (
    id SERIAL PRIMARY KEY,
    codigo_barras VARCHAR(50) UNIQUE,
    sku VARCHAR(50) UNIQUE,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
    precio_compra DECIMAL(10,2) NOT NULL CHECK (precio_compra >= 0),
    precio_venta DECIMAL(10,2) NOT NULL CHECK (precio_venta >= 0),
    stock_actual INTEGER DEFAULT 0 CHECK (stock_actual >= 0),
    stock_minimo INTEGER DEFAULT 10 CHECK (stock_minimo >= 0),
    stock_maximo INTEGER DEFAULT 1000,
    unidad_medida VARCHAR(20) DEFAULT 'pieza',
    requiere_vencimiento BOOLEAN DEFAULT false,
    dias_alerta_vencimiento INTEGER DEFAULT 30,
    imagen_url TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE productos IS 'Catálogo de productos de la tienda';
COMMENT ON COLUMN productos.requiere_vencimiento IS 'TRUE si el producto tiene fecha de caducidad';
COMMENT ON COLUMN productos.dias_alerta_vencimiento IS 'Días antes del vencimiento para generar alerta';

-- =====================================================
-- 5. TABLA DE PROVEEDORES
-- =====================================================

CREATE TABLE IF NOT EXISTS proveedores (
    id SERIAL PRIMARY KEY,
    codigo_proveedor VARCHAR(20) UNIQUE,
    nombre VARCHAR(200) NOT NULL,
    rfc VARCHAR(13),
    email VARCHAR(100),
    telefono VARCHAR(20),
    direccion TEXT,
    ciudad VARCHAR(100),
    estado VARCHAR(100),
    codigo_postal VARCHAR(10),
    contacto_nombre VARCHAR(100),
    contacto_telefono VARCHAR(20),
    contacto_email VARCHAR(100),
    dias_credito INTEGER DEFAULT 0,
    activo BOOLEAN DEFAULT true,
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE proveedores IS 'Proveedores de productos';
COMMENT ON COLUMN proveedores.dias_credito IS 'Días de crédito otorgados por el proveedor';

-- =====================================================
-- 6. TABLA DE LOTES DE PRODUCTOS
-- =====================================================

CREATE TABLE IF NOT EXISTS lotes_productos (
    id SERIAL PRIMARY KEY,
    producto_id INTEGER REFERENCES productos(id) ON DELETE CASCADE,
    numero_lote VARCHAR(50) NOT NULL,
    cantidad INTEGER NOT NULL CHECK (cantidad >= 0),
    fecha_ingreso DATE DEFAULT CURRENT_DATE,
    fecha_vencimiento DATE,
    precio_compra DECIMAL(10,2),
    proveedor_id INTEGER REFERENCES proveedores(id) ON DELETE SET NULL,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT lote_unico UNIQUE(producto_id, numero_lote)
);

COMMENT ON TABLE lotes_productos IS 'Control de lotes de productos con fecha de vencimiento';
COMMENT ON COLUMN lotes_productos.fecha_vencimiento IS 'Fecha de caducidad del lote';

-- =====================================================
-- 7. TABLA DE MOVIMIENTOS DE INVENTARIO
-- =====================================================

CREATE TABLE IF NOT EXISTS movimientos_inventario (
    id SERIAL PRIMARY KEY,
    producto_id INTEGER REFERENCES productos(id) ON DELETE CASCADE,
    tipo_movimiento VARCHAR(20) NOT NULL CHECK (tipo_movimiento IN ('entrada', 'salida', 'ajuste', 'merma', 'devolucion')),
    cantidad INTEGER NOT NULL,
    cantidad_anterior INTEGER,
    cantidad_nueva INTEGER,
    motivo TEXT,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    referencia VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE movimientos_inventario IS 'Historial de todos los movimientos de inventario';
COMMENT ON COLUMN movimientos_inventario.tipo_movimiento IS 'entrada, salida, ajuste, merma, devolucion';

-- =====================================================
-- 8. TABLA DE CLIENTES
-- =====================================================

CREATE TABLE IF NOT EXISTS clientes (
    id SERIAL PRIMARY KEY,
    codigo_cliente VARCHAR(20) UNIQUE,
    nombre VARCHAR(200) NOT NULL,
    rfc VARCHAR(13),
    email VARCHAR(100),
    telefono VARCHAR(20),
    celular VARCHAR(20),
    direccion TEXT,
    ciudad VARCHAR(100),
    estado VARCHAR(100),
    codigo_postal VARCHAR(10),
    limite_credito DECIMAL(10,2) DEFAULT 0 CHECK (limite_credito >= 0),
    saldo_pendiente DECIMAL(10,2) DEFAULT 0 CHECK (saldo_pendiente >= 0),
    descuento_porcentaje DECIMAL(5,2) DEFAULT 0 CHECK (descuento_porcentaje >= 0 AND descuento_porcentaje <= 100),
    activo BOOLEAN DEFAULT true,
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE clientes IS 'Clientes de la tienda';
COMMENT ON COLUMN clientes.limite_credito IS 'Límite de crédito autorizado';
COMMENT ON COLUMN clientes.saldo_pendiente IS 'Saldo actual pendiente de pago';

-- =====================================================
-- 9. TABLA DE VENTAS
-- =====================================================

CREATE TABLE IF NOT EXISTS ventas (
    id SERIAL PRIMARY KEY,
    folio VARCHAR(50) UNIQUE NOT NULL,
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    fecha_venta TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    subtotal DECIMAL(10,2) NOT NULL CHECK (subtotal >= 0),
    descuento DECIMAL(10,2) DEFAULT 0 CHECK (descuento >= 0),
    iva DECIMAL(10,2) DEFAULT 0 CHECK (iva >= 0),
    total DECIMAL(10,2) NOT NULL CHECK (total >= 0),
    metodo_pago VARCHAR(50) CHECK (metodo_pago IN ('efectivo', 'tarjeta', 'transferencia', 'credito', 'multiple')),
    estado VARCHAR(20) DEFAULT 'completada' CHECK (estado IN ('completada', 'cancelada', 'pendiente')),
    monto_efectivo DECIMAL(10,2),
    monto_tarjeta DECIMAL(10,2),
    monto_transferencia DECIMAL(10,2),
    cambio DECIMAL(10,2) DEFAULT 0,
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE ventas IS 'Registro de todas las ventas realizadas';
COMMENT ON COLUMN ventas.folio IS 'Folio único de la venta';
COMMENT ON COLUMN ventas.estado IS 'completada, cancelada, pendiente';

-- =====================================================
-- 10. TABLA DE DETALLE DE VENTAS
-- =====================================================

CREATE TABLE IF NOT EXISTS detalle_ventas (
    id SERIAL PRIMARY KEY,
    venta_id INTEGER REFERENCES ventas(id) ON DELETE CASCADE,
    producto_id INTEGER REFERENCES productos(id) ON DELETE RESTRICT,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario DECIMAL(10,2) NOT NULL CHECK (precio_unitario >= 0),
    descuento DECIMAL(10,2) DEFAULT 0 CHECK (descuento >= 0),
    subtotal DECIMAL(10,2) NOT NULL CHECK (subtotal >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE detalle_ventas IS 'Detalle de productos vendidos en cada venta';

-- =====================================================
-- 11. TABLA DE COTIZACIONES
-- =====================================================

CREATE TABLE IF NOT EXISTS cotizaciones (
    id SERIAL PRIMARY KEY,
    folio VARCHAR(50) UNIQUE NOT NULL,
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    fecha_cotizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_vencimiento DATE,
    subtotal DECIMAL(10,2) NOT NULL CHECK (subtotal >= 0),
    descuento DECIMAL(10,2) DEFAULT 0 CHECK (descuento >= 0),
    iva DECIMAL(10,2) DEFAULT 0 CHECK (iva >= 0),
    total DECIMAL(10,2) NOT NULL CHECK (total >= 0),
    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'rechazada', 'vencida', 'convertida')),
    venta_id INTEGER REFERENCES ventas(id) ON DELETE SET NULL,
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE cotizaciones IS 'Cotizaciones generadas para clientes';
COMMENT ON COLUMN cotizaciones.estado IS 'pendiente, aprobada, rechazada, vencida, convertida';
COMMENT ON COLUMN cotizaciones.venta_id IS 'ID de la venta si la cotización se convirtió en venta';

-- =====================================================
-- 12. TABLA DE DETALLE DE COTIZACIONES
-- =====================================================

CREATE TABLE IF NOT EXISTS detalle_cotizaciones (
    id SERIAL PRIMARY KEY,
    cotizacion_id INTEGER REFERENCES cotizaciones(id) ON DELETE CASCADE,
    producto_id INTEGER REFERENCES productos(id) ON DELETE RESTRICT,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario DECIMAL(10,2) NOT NULL CHECK (precio_unitario >= 0),
    descuento DECIMAL(10,2) DEFAULT 0 CHECK (descuento >= 0),
    subtotal DECIMAL(10,2) NOT NULL CHECK (subtotal >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE detalle_cotizaciones IS 'Detalle de productos en cada cotización';

-- =====================================================
-- 13. TABLA DE PEDIDOS (Vendedores Externos)
-- =====================================================

CREATE TABLE IF NOT EXISTS pedidos (
    id SERIAL PRIMARY KEY,
    folio VARCHAR(50) UNIQUE NOT NULL,
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
    vendedor_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    fecha_pedido TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_entrega_estimada DATE,
    fecha_entrega_real TIMESTAMP,
    subtotal DECIMAL(10,2) NOT NULL CHECK (subtotal >= 0),
    descuento DECIMAL(10,2) DEFAULT 0 CHECK (descuento >= 0),
    iva DECIMAL(10,2) DEFAULT 0 CHECK (iva >= 0),
    total DECIMAL(10,2) NOT NULL CHECK (total >= 0),
    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'procesando', 'listo', 'entregado', 'cancelado')),
    ubicacion_latitud DECIMAL(10,8),
    ubicacion_longitud DECIMAL(11,8),
    direccion_entrega TEXT,
    venta_id INTEGER REFERENCES ventas(id) ON DELETE SET NULL,
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE pedidos IS 'Pedidos tomados por vendedores externos desde dispositivos móviles';
COMMENT ON COLUMN pedidos.estado IS 'pendiente, procesando, listo, entregado, cancelado';
COMMENT ON COLUMN pedidos.venta_id IS 'ID de la venta cuando el pedido se factura';

-- =====================================================
-- 14. TABLA DE DETALLE DE PEDIDOS
-- =====================================================

CREATE TABLE IF NOT EXISTS detalle_pedidos (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER REFERENCES pedidos(id) ON DELETE CASCADE,
    producto_id INTEGER REFERENCES productos(id) ON DELETE RESTRICT,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario DECIMAL(10,2) NOT NULL CHECK (precio_unitario >= 0),
    descuento DECIMAL(10,2) DEFAULT 0 CHECK (descuento >= 0),
    subtotal DECIMAL(10,2) NOT NULL CHECK (subtotal >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE detalle_pedidos IS 'Detalle de productos en cada pedido';

-- =====================================================
-- 15. TABLA DE NOTIFICACIONES
-- =====================================================

CREATE TABLE IF NOT EXISTS notificaciones (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('vencimiento', 'stock_bajo', 'nuevo_pedido', 'pago_pendiente', 'sistema', 'alerta')),
    prioridad VARCHAR(20) DEFAULT 'normal' CHECK (prioridad IN ('baja', 'normal', 'alta', 'urgente')),
    titulo VARCHAR(200) NOT NULL,
    mensaje TEXT NOT NULL,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    leida BOOLEAN DEFAULT false,
    fecha_leida TIMESTAMP,
    datos_extra JSONB,
    url_accion VARCHAR(200),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE notificaciones IS 'Sistema de notificaciones y alertas para usuarios';
COMMENT ON COLUMN notificaciones.datos_extra IS 'Información adicional en formato JSON';

-- =====================================================
-- 16. ÍNDICES PARA MEJORAR RENDIMIENTO
-- =====================================================

-- Índices para productos
CREATE INDEX IF NOT EXISTS idx_productos_codigo ON productos(codigo_barras);
CREATE INDEX IF NOT EXISTS idx_productos_sku ON productos(sku);
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_productos_nombre ON productos(nombre);
CREATE INDEX IF NOT EXISTS idx_productos_activo ON productos(activo);

-- Índices para ventas
CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha_venta DESC);
CREATE INDEX IF NOT EXISTS idx_ventas_cliente ON ventas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ventas_usuario ON ventas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_ventas_estado ON ventas(estado);
CREATE INDEX IF NOT EXISTS idx_ventas_folio ON ventas(folio);

-- Índices para pedidos
CREATE INDEX IF NOT EXISTS idx_pedidos_vendedor ON pedidos(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_fecha ON pedidos(fecha_pedido DESC);
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente ON pedidos(cliente_id);

-- Índices para notificaciones
CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario ON notificaciones(usuario_id, leida);
CREATE INDEX IF NOT EXISTS idx_notificaciones_tipo ON notificaciones(tipo);
CREATE INDEX IF NOT EXISTS idx_notificaciones_fecha ON notificaciones(created_at DESC);

-- Índices para lotes y vencimientos
CREATE INDEX IF NOT EXISTS idx_lotes_vencimiento ON lotes_productos(fecha_vencimiento) WHERE activo = true;
CREATE INDEX IF NOT EXISTS idx_lotes_producto ON lotes_productos(producto_id);

-- Índices para clientes
CREATE INDEX IF NOT EXISTS idx_clientes_nombre ON clientes(nombre);
CREATE INDEX IF NOT EXISTS idx_clientes_activo ON clientes(activo);

-- Índices para movimientos
CREATE INDEX IF NOT EXISTS idx_movimientos_producto ON movimientos_inventario(producto_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos_inventario(created_at DESC);

-- =====================================================
-- 17. DATOS INICIALES
-- =====================================================

-- Insertar roles por defecto
INSERT INTO roles (nombre, descripcion, permisos) VALUES
('Administrador', 'Acceso completo al sistema', '{"all": true}'),
('Gerente', 'Gestión de tienda y reportes', '{"ventas": true, "inventario": true, "reportes": true, "clientes": true, "proveedores": true}'),
('Vendedor', 'Realizar ventas y consultar inventario', '{"ventas": true, "inventario": "read", "clientes": "read"}'),
('Vendedor Externo', 'Tomar pedidos desde dispositivos móviles', '{"pedidos": true, "clientes": "read", "productos": "read"}')
ON CONFLICT (nombre) DO NOTHING;

-- Insertar categorías por defecto
INSERT INTO categorias (nombre, descripcion) VALUES
('Abarrotes', 'Productos secos y enlatados'),
('Lácteos', 'Leche, quesos y derivados'),
('Carnes y Embutidos', 'Carnes frescas y embutidos'),
('Bebidas', 'Refrescos, jugos y agua'),
('Limpieza', 'Productos de limpieza del hogar'),
('Panadería', 'Pan y productos de panadería'),
('Frutas y Verduras', 'Productos frescos'),
('Snacks y Dulces', 'Botanas, dulces y chocolates'),
('Congelados', 'Productos congelados'),
('Higiene Personal', 'Productos de cuidado personal')
ON CONFLICT DO NOTHING;

-- Usuario administrador por defecto
-- Contraseña: admin123 (hasheado con bcrypt)
INSERT INTO usuarios (nombre, email, password_hash, rol_id) 
SELECT 'Administrador', 'admin@tienda.com', '$2a$10$8ZLvxhLfVJgKqp5K5Z5h5OKxXzJZjZJZjZjZjZjZjZjZjZjZjZjZ', id
FROM roles WHERE nombre = 'Administrador'
ON CONFLICT (email) DO NOTHING;

-- =====================================================
-- 18. VISTAS ÚTILES
-- =====================================================

-- Vista de productos con stock bajo
CREATE OR REPLACE VIEW vista_stock_bajo AS
SELECT 
    p.id,
    p.codigo_barras,
    p.nombre,
    c.nombre as categoria,
    p.stock_actual,
    p.stock_minimo,
    (p.stock_minimo - p.stock_actual) as faltante,
    p.precio_venta,
    p.updated_at
FROM productos p
LEFT JOIN categorias c ON p.categoria_id = c.id
WHERE p.stock_actual <= p.stock_minimo 
    AND p.activo = true
ORDER BY (p.stock_minimo - p.stock_actual) DESC;

-- Vista de productos próximos a vencer
CREATE OR REPLACE VIEW vista_productos_por_vencer AS
SELECT 
    p.id as producto_id,
    p.nombre as producto,
    p.codigo_barras,
    l.numero_lote,
    l.cantidad,
    l.fecha_vencimiento,
    (l.fecha_vencimiento - CURRENT_DATE) as dias_restantes,
    CASE 
        WHEN (l.fecha_vencimiento - CURRENT_DATE) < 0 THEN 'vencido'
        WHEN (l.fecha_vencimiento - CURRENT_DATE) <= 7 THEN 'urgente'
        WHEN (l.fecha_vencimiento - CURRENT_DATE) <= 15 THEN 'proximo'
        ELSE 'normal'
    END as estado_vencimiento
FROM lotes_productos l
JOIN productos p ON l.producto_id = p.id
WHERE l.fecha_vencimiento IS NOT NULL
    AND l.activo = true
    AND l.cantidad > 0
    AND l.fecha_vencimiento <= CURRENT_DATE + INTERVAL '30 days'
ORDER BY l.fecha_vencimiento ASC;

-- Vista de resumen de ventas diarias
CREATE OR REPLACE VIEW vista_ventas_diarias AS
SELECT 
    DATE(fecha_venta) as fecha,
    COUNT(*) as total_ventas,
    SUM(total) as monto_total,
    AVG(total) as ticket_promedio,
    SUM(CASE WHEN metodo_pago = 'efectivo' THEN total ELSE 0 END) as efectivo,
    SUM(CASE WHEN metodo_pago = 'tarjeta' THEN total ELSE 0 END) as tarjeta,
    SUM(CASE WHEN metodo_pago = 'credito' THEN total ELSE 0 END) as credito
FROM ventas
WHERE estado = 'completada'
GROUP BY DATE(fecha_venta)
ORDER BY fecha DESC;

-- Vista de productos más vendidos
CREATE OR REPLACE VIEW vista_productos_mas_vendidos AS
SELECT 
    p.id,
    p.nombre,
    p.codigo_barras,
    c.nombre as categoria,
    COUNT(dv.id) as veces_vendido,
    SUM(dv.cantidad) as cantidad_total_vendida,
    SUM(dv.subtotal) as ingresos_totales,
    p.stock_actual,
    p.precio_venta
FROM productos p
JOIN detalle_ventas dv ON p.id = dv.producto_id
JOIN ventas v ON dv.venta_id = v.id
LEFT JOIN categorias c ON p.categoria_id = c.id
WHERE v.estado = 'completada'
    AND v.fecha_venta >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY p.id, p.nombre, p.codigo_barras, c.nombre, p.stock_actual, p.precio_venta
ORDER BY cantidad_total_vendida DESC
LIMIT 20;

-- Vista de clientes frecuentes
CREATE OR REPLACE VIEW vista_clientes_frecuentes AS
SELECT 
    c.id,
    c.nombre,
    c.telefono,
    c.email,
    COUNT(v.id) as total_compras,
    SUM(v.total) as monto_total_comprado,
    AVG(v.total) as ticket_promedio,
    MAX(v.fecha_venta) as ultima_compra,
    c.saldo_pendiente
FROM clientes c
JOIN ventas v ON c.id = v.cliente_id
WHERE v.estado = 'completada'
    AND v.fecha_venta >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY c.id, c.nombre, c.telefono, c.email, c.saldo_pendiente
ORDER BY total_compras DESC, monto_total_comprado DESC
LIMIT 20;

-- =====================================================
-- 19. VERIFICACIÓN FINAL
-- =====================================================

-- Mostrar resumen de tablas creadas
DO $$ 
DECLARE
    tabla_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO tabla_count
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE';
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Base de datos inicializada correctamente';
    RAISE NOTICE 'Total de tablas creadas: %', tabla_count;
    RAISE NOTICE '========================================';
END $$;

-- Listar todas las tablas
SELECT table_name as "Tablas Creadas"
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;
