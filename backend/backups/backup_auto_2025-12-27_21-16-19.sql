--
-- PostgreSQL database dump
--

\restrict 57Yua242lEw3lRLcatoTGdR9NYOTLWHNiYcU9VaaTSQzo56PxhbxmUkXTLirN0O

-- Dumped from database version 15.15 (Homebrew)
-- Dumped by pg_dump version 15.15 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: registrar_cambio_precio(); Type: FUNCTION; Schema: public; Owner: marlonjimenez
--

CREATE FUNCTION public.registrar_cambio_precio() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Registrar cambio de precio de compra
    IF OLD.precio_compra IS DISTINCT FROM NEW.precio_compra THEN
        INSERT INTO historial_precios (
            producto_id, 
            precio_anterior, 
            precio_nuevo, 
            tipo_precio,
            motivo
        ) VALUES (
            NEW.id,
            OLD.precio_compra,
            NEW.precio_compra,
            'compra',
            'Actualización de producto'
        );
    END IF;
    
    -- Registrar cambio de precio de venta
    IF OLD.precio_venta IS DISTINCT FROM NEW.precio_venta THEN
        INSERT INTO historial_precios (
            producto_id,
            precio_anterior,
            precio_nuevo,
            tipo_precio,
            motivo
        ) VALUES (
            NEW.id,
            OLD.precio_venta,
            NEW.precio_venta,
            'venta',
            'Actualización de producto'
        );
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.registrar_cambio_precio() OWNER TO marlonjimenez;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: categorias; Type: TABLE; Schema: public; Owner: marlonjimenez
--

CREATE TABLE public.categorias (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    descripcion text,
    activo boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.categorias OWNER TO marlonjimenez;

--
-- Name: TABLE categorias; Type: COMMENT; Schema: public; Owner: marlonjimenez
--

COMMENT ON TABLE public.categorias IS 'Categorías de productos (Abarrotes, Lácteos, Bebidas, etc.)';


--
-- Name: categorias_id_seq; Type: SEQUENCE; Schema: public; Owner: marlonjimenez
--

CREATE SEQUENCE public.categorias_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.categorias_id_seq OWNER TO marlonjimenez;

--
-- Name: categorias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: marlonjimenez
--

ALTER SEQUENCE public.categorias_id_seq OWNED BY public.categorias.id;


--
-- Name: clientes; Type: TABLE; Schema: public; Owner: marlonjimenez
--

CREATE TABLE public.clientes (
    id integer NOT NULL,
    codigo_cliente character varying(20),
    nombre character varying(200) NOT NULL,
    rfc character varying(13),
    email character varying(100),
    telefono character varying(20),
    celular character varying(20),
    direccion text,
    ciudad character varying(100),
    estado character varying(100),
    codigo_postal character varying(10),
    limite_credito numeric(10,2) DEFAULT 0,
    saldo_pendiente numeric(10,2) DEFAULT 0,
    descuento_porcentaje numeric(5,2) DEFAULT 0,
    activo boolean DEFAULT true,
    notas text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    nit character varying(20),
    CONSTRAINT clientes_descuento_porcentaje_check CHECK (((descuento_porcentaje >= (0)::numeric) AND (descuento_porcentaje <= (100)::numeric))),
    CONSTRAINT clientes_limite_credito_check CHECK ((limite_credito >= (0)::numeric)),
    CONSTRAINT clientes_saldo_pendiente_check CHECK ((saldo_pendiente >= (0)::numeric))
);


ALTER TABLE public.clientes OWNER TO marlonjimenez;

--
-- Name: TABLE clientes; Type: COMMENT; Schema: public; Owner: marlonjimenez
--

COMMENT ON TABLE public.clientes IS 'Clientes de la tienda';


--
-- Name: COLUMN clientes.limite_credito; Type: COMMENT; Schema: public; Owner: marlonjimenez
--

COMMENT ON COLUMN public.clientes.limite_credito IS 'Límite de crédito autorizado';


--
-- Name: COLUMN clientes.saldo_pendiente; Type: COMMENT; Schema: public; Owner: marlonjimenez
--

COMMENT ON COLUMN public.clientes.saldo_pendiente IS 'Saldo actual pendiente de pago';


--
-- Name: clientes_id_seq; Type: SEQUENCE; Schema: public; Owner: marlonjimenez
--

CREATE SEQUENCE public.clientes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.clientes_id_seq OWNER TO marlonjimenez;

--
-- Name: clientes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: marlonjimenez
--

ALTER SEQUENCE public.clientes_id_seq OWNED BY public.clientes.id;


--
-- Name: configuracion; Type: TABLE; Schema: public; Owner: marlonjimenez
--

CREATE TABLE public.configuracion (
    id integer NOT NULL,
    clave character varying(100) NOT NULL,
    valor text,
    descripcion text,
    tipo character varying(20) DEFAULT 'texto'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT configuracion_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['texto'::character varying, 'numero'::character varying, 'booleano'::character varying, 'json'::character varying])::text[])))
);


ALTER TABLE public.configuracion OWNER TO marlonjimenez;

--
-- Name: configuracion_id_seq; Type: SEQUENCE; Schema: public; Owner: marlonjimenez
--

CREATE SEQUENCE public.configuracion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.configuracion_id_seq OWNER TO marlonjimenez;

--
-- Name: configuracion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: marlonjimenez
--

ALTER SEQUENCE public.configuracion_id_seq OWNED BY public.configuracion.id;


--
-- Name: cotizaciones; Type: TABLE; Schema: public; Owner: marlonjimenez
--

CREATE TABLE public.cotizaciones (
    id integer NOT NULL,
    folio character varying(50) NOT NULL,
    cliente_id integer,
    usuario_id integer,
    fecha_cotizacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    fecha_vencimiento date,
    subtotal numeric(10,2) NOT NULL,
    descuento numeric(10,2) DEFAULT 0,
    iva numeric(10,2) DEFAULT 0,
    total numeric(10,2) NOT NULL,
    estado character varying(20) DEFAULT 'pendiente'::character varying,
    venta_id integer,
    notas text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT cotizaciones_descuento_check CHECK ((descuento >= (0)::numeric)),
    CONSTRAINT cotizaciones_estado_check CHECK (((estado)::text = ANY ((ARRAY['pendiente'::character varying, 'aprobada'::character varying, 'rechazada'::character varying, 'vencida'::character varying, 'convertida'::character varying])::text[]))),
    CONSTRAINT cotizaciones_iva_check CHECK ((iva >= (0)::numeric)),
    CONSTRAINT cotizaciones_subtotal_check CHECK ((subtotal >= (0)::numeric)),
    CONSTRAINT cotizaciones_total_check CHECK ((total >= (0)::numeric))
);


ALTER TABLE public.cotizaciones OWNER TO marlonjimenez;

--
-- Name: TABLE cotizaciones; Type: COMMENT; Schema: public; Owner: marlonjimenez
--

COMMENT ON TABLE public.cotizaciones IS 'Cotizaciones generadas para clientes';


--
-- Name: COLUMN cotizaciones.estado; Type: COMMENT; Schema: public; Owner: marlonjimenez
--

COMMENT ON COLUMN public.cotizaciones.estado IS 'pendiente, aprobada, rechazada, vencida, convertida';


--
-- Name: COLUMN cotizaciones.venta_id; Type: COMMENT; Schema: public; Owner: marlonjimenez
--

COMMENT ON COLUMN public.cotizaciones.venta_id IS 'ID de la venta si la cotización se convirtió en venta';


--
-- Name: cotizaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: marlonjimenez
--

CREATE SEQUENCE public.cotizaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.cotizaciones_id_seq OWNER TO marlonjimenez;

--
-- Name: cotizaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: marlonjimenez
--

ALTER SEQUENCE public.cotizaciones_id_seq OWNED BY public.cotizaciones.id;


--
-- Name: detalle_cotizaciones; Type: TABLE; Schema: public; Owner: marlonjimenez
--

CREATE TABLE public.detalle_cotizaciones (
    id integer NOT NULL,
    cotizacion_id integer,
    producto_id integer,
    cantidad integer NOT NULL,
    precio_unitario numeric(10,2) NOT NULL,
    descuento numeric(10,2) DEFAULT 0,
    subtotal numeric(10,2) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT detalle_cotizaciones_cantidad_check CHECK ((cantidad > 0)),
    CONSTRAINT detalle_cotizaciones_descuento_check CHECK ((descuento >= (0)::numeric)),
    CONSTRAINT detalle_cotizaciones_precio_unitario_check CHECK ((precio_unitario >= (0)::numeric)),
    CONSTRAINT detalle_cotizaciones_subtotal_check CHECK ((subtotal >= (0)::numeric))
);


ALTER TABLE public.detalle_cotizaciones OWNER TO marlonjimenez;

--
-- Name: TABLE detalle_cotizaciones; Type: COMMENT; Schema: public; Owner: marlonjimenez
--

COMMENT ON TABLE public.detalle_cotizaciones IS 'Detalle de productos en cada cotización';


--
-- Name: detalle_cotizaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: marlonjimenez
--

CREATE SEQUENCE public.detalle_cotizaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.detalle_cotizaciones_id_seq OWNER TO marlonjimenez;

--
-- Name: detalle_cotizaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: marlonjimenez
--

ALTER SEQUENCE public.detalle_cotizaciones_id_seq OWNED BY public.detalle_cotizaciones.id;


--
-- Name: detalle_pedidos; Type: TABLE; Schema: public; Owner: marlonjimenez
--

CREATE TABLE public.detalle_pedidos (
    id integer NOT NULL,
    pedido_id integer,
    producto_id integer,
    cantidad integer NOT NULL,
    precio_unitario numeric(10,2) NOT NULL,
    descuento numeric(10,2) DEFAULT 0,
    subtotal numeric(10,2) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT detalle_pedidos_cantidad_check CHECK ((cantidad > 0)),
    CONSTRAINT detalle_pedidos_descuento_check CHECK ((descuento >= (0)::numeric)),
    CONSTRAINT detalle_pedidos_precio_unitario_check CHECK ((precio_unitario >= (0)::numeric)),
    CONSTRAINT detalle_pedidos_subtotal_check CHECK ((subtotal >= (0)::numeric))
);


ALTER TABLE public.detalle_pedidos OWNER TO marlonjimenez;

--
-- Name: TABLE detalle_pedidos; Type: COMMENT; Schema: public; Owner: marlonjimenez
--

COMMENT ON TABLE public.detalle_pedidos IS 'Detalle de productos en cada pedido';


--
-- Name: detalle_pedidos_id_seq; Type: SEQUENCE; Schema: public; Owner: marlonjimenez
--

CREATE SEQUENCE public.detalle_pedidos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.detalle_pedidos_id_seq OWNER TO marlonjimenez;

--
-- Name: detalle_pedidos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: marlonjimenez
--

ALTER SEQUENCE public.detalle_pedidos_id_seq OWNED BY public.detalle_pedidos.id;


--
-- Name: detalle_ventas; Type: TABLE; Schema: public; Owner: marlonjimenez
--

CREATE TABLE public.detalle_ventas (
    id integer NOT NULL,
    venta_id integer,
    producto_id integer,
    cantidad integer NOT NULL,
    precio_unitario numeric(10,2) NOT NULL,
    descuento numeric(10,2) DEFAULT 0,
    subtotal numeric(10,2) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT detalle_ventas_cantidad_check CHECK ((cantidad > 0)),
    CONSTRAINT detalle_ventas_descuento_check CHECK ((descuento >= (0)::numeric)),
    CONSTRAINT detalle_ventas_precio_unitario_check CHECK ((precio_unitario >= (0)::numeric)),
    CONSTRAINT detalle_ventas_subtotal_check CHECK ((subtotal >= (0)::numeric))
);


ALTER TABLE public.detalle_ventas OWNER TO marlonjimenez;

--
-- Name: TABLE detalle_ventas; Type: COMMENT; Schema: public; Owner: marlonjimenez
--

COMMENT ON TABLE public.detalle_ventas IS 'Detalle de productos vendidos en cada venta';


--
-- Name: detalle_ventas_id_seq; Type: SEQUENCE; Schema: public; Owner: marlonjimenez
--

CREATE SEQUENCE public.detalle_ventas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.detalle_ventas_id_seq OWNER TO marlonjimenez;

--
-- Name: detalle_ventas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: marlonjimenez
--

ALTER SEQUENCE public.detalle_ventas_id_seq OWNED BY public.detalle_ventas.id;


--
-- Name: historial_precios; Type: TABLE; Schema: public; Owner: marlonjimenez
--

CREATE TABLE public.historial_precios (
    id integer NOT NULL,
    producto_id integer NOT NULL,
    precio_anterior numeric(10,2) NOT NULL,
    precio_nuevo numeric(10,2) NOT NULL,
    tipo_precio character varying(20) NOT NULL,
    usuario_id integer,
    motivo text,
    fecha_cambio timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT historial_precios_tipo_precio_check CHECK (((tipo_precio)::text = ANY ((ARRAY['compra'::character varying, 'venta'::character varying])::text[])))
);


ALTER TABLE public.historial_precios OWNER TO marlonjimenez;

--
-- Name: historial_precios_id_seq; Type: SEQUENCE; Schema: public; Owner: marlonjimenez
--

CREATE SEQUENCE public.historial_precios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.historial_precios_id_seq OWNER TO marlonjimenez;

--
-- Name: historial_precios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: marlonjimenez
--

ALTER SEQUENCE public.historial_precios_id_seq OWNED BY public.historial_precios.id;


--
-- Name: logs_sistema; Type: TABLE; Schema: public; Owner: marlonjimenez
--

CREATE TABLE public.logs_sistema (
    id integer NOT NULL,
    tipo character varying(50) NOT NULL,
    descripcion text,
    usuario_id integer,
    datos jsonb,
    ip_address character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.logs_sistema OWNER TO marlonjimenez;

--
-- Name: logs_sistema_id_seq; Type: SEQUENCE; Schema: public; Owner: marlonjimenez
--

CREATE SEQUENCE public.logs_sistema_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.logs_sistema_id_seq OWNER TO marlonjimenez;

--
-- Name: logs_sistema_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: marlonjimenez
--

ALTER SEQUENCE public.logs_sistema_id_seq OWNED BY public.logs_sistema.id;


--
-- Name: lotes_productos; Type: TABLE; Schema: public; Owner: marlonjimenez
--

CREATE TABLE public.lotes_productos (
    id integer NOT NULL,
    producto_id integer,
    numero_lote character varying(50) NOT NULL,
    cantidad integer NOT NULL,
    fecha_ingreso date DEFAULT CURRENT_DATE,
    fecha_vencimiento date,
    precio_compra numeric(10,2),
    proveedor_id integer,
    activo boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT lotes_productos_cantidad_check CHECK ((cantidad >= 0))
);


ALTER TABLE public.lotes_productos OWNER TO marlonjimenez;

--
-- Name: TABLE lotes_productos; Type: COMMENT; Schema: public; Owner: marlonjimenez
--

COMMENT ON TABLE public.lotes_productos IS 'Control de lotes de productos con fecha de vencimiento';


--
-- Name: COLUMN lotes_productos.fecha_vencimiento; Type: COMMENT; Schema: public; Owner: marlonjimenez
--

COMMENT ON COLUMN public.lotes_productos.fecha_vencimiento IS 'Fecha de caducidad del lote';


--
-- Name: lotes_productos_id_seq; Type: SEQUENCE; Schema: public; Owner: marlonjimenez
--

CREATE SEQUENCE public.lotes_productos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.lotes_productos_id_seq OWNER TO marlonjimenez;

--
-- Name: lotes_productos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: marlonjimenez
--

ALTER SEQUENCE public.lotes_productos_id_seq OWNED BY public.lotes_productos.id;


--
-- Name: movimientos_inventario; Type: TABLE; Schema: public; Owner: marlonjimenez
--

CREATE TABLE public.movimientos_inventario (
    id integer NOT NULL,
    producto_id integer,
    tipo_movimiento character varying(20) NOT NULL,
    cantidad integer NOT NULL,
    cantidad_anterior integer,
    cantidad_nueva integer,
    motivo text,
    usuario_id integer,
    referencia character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT movimientos_inventario_tipo_movimiento_check CHECK (((tipo_movimiento)::text = ANY ((ARRAY['entrada'::character varying, 'salida'::character varying, 'ajuste'::character varying, 'merma'::character varying, 'devolucion'::character varying])::text[])))
);


ALTER TABLE public.movimientos_inventario OWNER TO marlonjimenez;

--
-- Name: TABLE movimientos_inventario; Type: COMMENT; Schema: public; Owner: marlonjimenez
--

COMMENT ON TABLE public.movimientos_inventario IS 'Historial de todos los movimientos de inventario';


--
-- Name: COLUMN movimientos_inventario.tipo_movimiento; Type: COMMENT; Schema: public; Owner: marlonjimenez
--

COMMENT ON COLUMN public.movimientos_inventario.tipo_movimiento IS 'entrada, salida, ajuste, merma, devolucion';


--
-- Name: movimientos_inventario_id_seq; Type: SEQUENCE; Schema: public; Owner: marlonjimenez
--

CREATE SEQUENCE public.movimientos_inventario_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.movimientos_inventario_id_seq OWNER TO marlonjimenez;

--
-- Name: movimientos_inventario_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: marlonjimenez
--

ALTER SEQUENCE public.movimientos_inventario_id_seq OWNED BY public.movimientos_inventario.id;


--
-- Name: notificaciones; Type: TABLE; Schema: public; Owner: marlonjimenez
--

CREATE TABLE public.notificaciones (
    id integer NOT NULL,
    tipo character varying(50) NOT NULL,
    prioridad character varying(20) DEFAULT 'normal'::character varying,
    titulo character varying(200) NOT NULL,
    mensaje text NOT NULL,
    usuario_id integer,
    leida boolean DEFAULT false,
    fecha_leida timestamp without time zone,
    datos_extra jsonb,
    url_accion character varying(200),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT notificaciones_prioridad_check CHECK (((prioridad)::text = ANY ((ARRAY['baja'::character varying, 'normal'::character varying, 'alta'::character varying, 'urgente'::character varying])::text[]))),
    CONSTRAINT notificaciones_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['vencimiento'::character varying, 'stock_bajo'::character varying, 'nuevo_pedido'::character varying, 'pago_pendiente'::character varying, 'sistema'::character varying, 'alerta'::character varying])::text[])))
);


ALTER TABLE public.notificaciones OWNER TO marlonjimenez;

--
-- Name: TABLE notificaciones; Type: COMMENT; Schema: public; Owner: marlonjimenez
--

COMMENT ON TABLE public.notificaciones IS 'Sistema de notificaciones y alertas para usuarios';


--
-- Name: COLUMN notificaciones.datos_extra; Type: COMMENT; Schema: public; Owner: marlonjimenez
--

COMMENT ON COLUMN public.notificaciones.datos_extra IS 'Información adicional en formato JSON';


--
-- Name: notificaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: marlonjimenez
--

CREATE SEQUENCE public.notificaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.notificaciones_id_seq OWNER TO marlonjimenez;

--
-- Name: notificaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: marlonjimenez
--

ALTER SEQUENCE public.notificaciones_id_seq OWNED BY public.notificaciones.id;


--
-- Name: pedidos; Type: TABLE; Schema: public; Owner: marlonjimenez
--

CREATE TABLE public.pedidos (
    id integer NOT NULL,
    folio character varying(50) NOT NULL,
    cliente_id integer,
    vendedor_id integer,
    fecha_pedido timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    fecha_entrega_estimada date,
    fecha_entrega_real timestamp without time zone,
    subtotal numeric(10,2) NOT NULL,
    descuento numeric(10,2) DEFAULT 0,
    iva numeric(10,2) DEFAULT 0,
    total numeric(10,2) NOT NULL,
    estado character varying(20) DEFAULT 'pendiente'::character varying,
    ubicacion_latitud numeric(10,8),
    ubicacion_longitud numeric(11,8),
    direccion_entrega text,
    venta_id integer,
    notas text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pedidos_descuento_check CHECK ((descuento >= (0)::numeric)),
    CONSTRAINT pedidos_estado_check CHECK (((estado)::text = ANY ((ARRAY['pendiente'::character varying, 'procesando'::character varying, 'listo'::character varying, 'entregado'::character varying, 'cancelado'::character varying])::text[]))),
    CONSTRAINT pedidos_iva_check CHECK ((iva >= (0)::numeric)),
    CONSTRAINT pedidos_subtotal_check CHECK ((subtotal >= (0)::numeric)),
    CONSTRAINT pedidos_total_check CHECK ((total >= (0)::numeric))
);


ALTER TABLE public.pedidos OWNER TO marlonjimenez;

--
-- Name: TABLE pedidos; Type: COMMENT; Schema: public; Owner: marlonjimenez
--

COMMENT ON TABLE public.pedidos IS 'Pedidos tomados por vendedores externos desde dispositivos móviles';


--
-- Name: COLUMN pedidos.estado; Type: COMMENT; Schema: public; Owner: marlonjimenez
--

COMMENT ON COLUMN public.pedidos.estado IS 'pendiente, procesando, listo, entregado, cancelado';


--
-- Name: COLUMN pedidos.venta_id; Type: COMMENT; Schema: public; Owner: marlonjimenez
--

COMMENT ON COLUMN public.pedidos.venta_id IS 'ID de la venta cuando el pedido se factura';


--
-- Name: pedidos_id_seq; Type: SEQUENCE; Schema: public; Owner: marlonjimenez
--

CREATE SEQUENCE public.pedidos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.pedidos_id_seq OWNER TO marlonjimenez;

--
-- Name: pedidos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: marlonjimenez
--

ALTER SEQUENCE public.pedidos_id_seq OWNED BY public.pedidos.id;


--
-- Name: pedidos_proveedores; Type: TABLE; Schema: public; Owner: marlonjimenez
--

CREATE TABLE public.pedidos_proveedores (
    id integer NOT NULL,
    folio character varying(20) NOT NULL,
    proveedor_id integer NOT NULL,
    usuario_id integer NOT NULL,
    fecha_pedido timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fecha_recepcion timestamp without time zone,
    total numeric(10,2) NOT NULL,
    estado character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    notas text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pedidos_proveedores_estado_check CHECK (((estado)::text = ANY ((ARRAY['pendiente'::character varying, 'recibido'::character varying, 'cancelado'::character varying])::text[])))
);


ALTER TABLE public.pedidos_proveedores OWNER TO marlonjimenez;

--
-- Name: TABLE pedidos_proveedores; Type: COMMENT; Schema: public; Owner: marlonjimenez
--

COMMENT ON TABLE public.pedidos_proveedores IS 'Tabla de pedidos realizados a proveedores';


--
-- Name: COLUMN pedidos_proveedores.estado; Type: COMMENT; Schema: public; Owner: marlonjimenez
--

COMMENT ON COLUMN public.pedidos_proveedores.estado IS 'Estados: pendiente, recibido, cancelado';


--
-- Name: pedidos_proveedores_id_seq; Type: SEQUENCE; Schema: public; Owner: marlonjimenez
--

CREATE SEQUENCE public.pedidos_proveedores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.pedidos_proveedores_id_seq OWNER TO marlonjimenez;

--
-- Name: pedidos_proveedores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: marlonjimenez
--

ALTER SEQUENCE public.pedidos_proveedores_id_seq OWNED BY public.pedidos_proveedores.id;


--
-- Name: productos; Type: TABLE; Schema: public; Owner: marlonjimenez
--

CREATE TABLE public.productos (
    id integer NOT NULL,
    codigo_barras character varying(50),
    sku character varying(50),
    nombre character varying(200) NOT NULL,
    descripcion text,
    categoria_id integer,
    precio_compra numeric(10,2) NOT NULL,
    precio_venta numeric(10,2) NOT NULL,
    stock_actual integer DEFAULT 0,
    stock_minimo integer DEFAULT 10,
    stock_maximo integer DEFAULT 1000,
    unidad_medida character varying(20) DEFAULT 'pieza'::character varying,
    requiere_vencimiento boolean DEFAULT false,
    dias_alerta_vencimiento integer DEFAULT 30,
    imagen_url text,
    activo boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT productos_precio_compra_check CHECK ((precio_compra >= (0)::numeric)),
    CONSTRAINT productos_precio_venta_check CHECK ((precio_venta >= (0)::numeric)),
    CONSTRAINT productos_stock_actual_check CHECK ((stock_actual >= 0)),
    CONSTRAINT productos_stock_minimo_check CHECK ((stock_minimo >= 0))
);


ALTER TABLE public.productos OWNER TO marlonjimenez;

--
-- Name: TABLE productos; Type: COMMENT; Schema: public; Owner: marlonjimenez
--

COMMENT ON TABLE public.productos IS 'Catálogo de productos de la tienda';


--
-- Name: COLUMN productos.requiere_vencimiento; Type: COMMENT; Schema: public; Owner: marlonjimenez
--

COMMENT ON COLUMN public.productos.requiere_vencimiento IS 'TRUE si el producto tiene fecha de caducidad';


--
-- Name: COLUMN productos.dias_alerta_vencimiento; Type: COMMENT; Schema: public; Owner: marlonjimenez
--

COMMENT ON COLUMN public.productos.dias_alerta_vencimiento IS 'Días antes del vencimiento para generar alerta';


--
-- Name: productos_id_seq; Type: SEQUENCE; Schema: public; Owner: marlonjimenez
--

CREATE SEQUENCE public.productos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.productos_id_seq OWNER TO marlonjimenez;

--
-- Name: productos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: marlonjimenez
--

ALTER SEQUENCE public.productos_id_seq OWNED BY public.productos.id;


--
-- Name: proveedores; Type: TABLE; Schema: public; Owner: marlonjimenez
--

CREATE TABLE public.proveedores (
    id integer NOT NULL,
    codigo_proveedor character varying(20),
    nombre character varying(200) NOT NULL,
    rfc character varying(13),
    email character varying(100),
    telefono character varying(20),
    direccion text,
    ciudad character varying(100),
    estado character varying(100),
    codigo_postal character varying(10),
    contacto_nombre character varying(100),
    contacto_telefono character varying(20),
    contacto_email character varying(100),
    dias_credito integer DEFAULT 0,
    activo boolean DEFAULT true,
    notas text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    contacto character varying(100),
    nit character varying(20)
);


ALTER TABLE public.proveedores OWNER TO marlonjimenez;

--
-- Name: TABLE proveedores; Type: COMMENT; Schema: public; Owner: marlonjimenez
--

COMMENT ON TABLE public.proveedores IS 'Proveedores de productos';


--
-- Name: COLUMN proveedores.dias_credito; Type: COMMENT; Schema: public; Owner: marlonjimenez
--

COMMENT ON COLUMN public.proveedores.dias_credito IS 'Días de crédito otorgados por el proveedor';


--
-- Name: proveedores_id_seq; Type: SEQUENCE; Schema: public; Owner: marlonjimenez
--

CREATE SEQUENCE public.proveedores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.proveedores_id_seq OWNER TO marlonjimenez;

--
-- Name: proveedores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: marlonjimenez
--

ALTER SEQUENCE public.proveedores_id_seq OWNED BY public.proveedores.id;


--
-- Name: roles; Type: TABLE; Schema: public; Owner: marlonjimenez
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    nombre character varying(50) NOT NULL,
    descripcion text,
    permisos jsonb DEFAULT '{}'::jsonb,
    activo boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.roles OWNER TO marlonjimenez;

--
-- Name: TABLE roles; Type: COMMENT; Schema: public; Owner: marlonjimenez
--

COMMENT ON TABLE public.roles IS 'Roles de usuarios del sistema (Admin, Gerente, Vendedor, etc.)';


--
-- Name: COLUMN roles.permisos; Type: COMMENT; Schema: public; Owner: marlonjimenez
--

COMMENT ON COLUMN public.roles.permisos IS 'Permisos en formato JSON: {"ventas": true, "inventario": "read"}';


--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: marlonjimenez
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.roles_id_seq OWNER TO marlonjimenez;

--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: marlonjimenez
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: marlonjimenez
--

CREATE TABLE public.usuarios (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    email character varying(100) NOT NULL,
    password_hash character varying(255) NOT NULL,
    telefono character varying(20),
    rol_id integer,
    activo boolean DEFAULT true,
    ultimo_acceso timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.usuarios OWNER TO marlonjimenez;

--
-- Name: TABLE usuarios; Type: COMMENT; Schema: public; Owner: marlonjimenez
--

COMMENT ON TABLE public.usuarios IS 'Usuarios del sistema con sus credenciales y roles';


--
-- Name: COLUMN usuarios.password_hash; Type: COMMENT; Schema: public; Owner: marlonjimenez
--

COMMENT ON COLUMN public.usuarios.password_hash IS 'Contraseña hasheada con bcrypt';


--
-- Name: usuarios_id_seq; Type: SEQUENCE; Schema: public; Owner: marlonjimenez
--

CREATE SEQUENCE public.usuarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.usuarios_id_seq OWNER TO marlonjimenez;

--
-- Name: usuarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: marlonjimenez
--

ALTER SEQUENCE public.usuarios_id_seq OWNED BY public.usuarios.id;


--
-- Name: ventas; Type: TABLE; Schema: public; Owner: marlonjimenez
--

CREATE TABLE public.ventas (
    id integer NOT NULL,
    folio character varying(50) NOT NULL,
    cliente_id integer,
    usuario_id integer,
    fecha_venta timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    subtotal numeric(10,2) NOT NULL,
    descuento numeric(10,2) DEFAULT 0,
    iva numeric(10,2) DEFAULT 0,
    total numeric(10,2) NOT NULL,
    metodo_pago character varying(50),
    estado character varying(20) DEFAULT 'completada'::character varying,
    monto_efectivo numeric(10,2),
    monto_tarjeta numeric(10,2),
    monto_transferencia numeric(10,2),
    cambio numeric(10,2) DEFAULT 0,
    notas text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ventas_descuento_check CHECK ((descuento >= (0)::numeric)),
    CONSTRAINT ventas_estado_check CHECK (((estado)::text = ANY ((ARRAY['completada'::character varying, 'cancelada'::character varying, 'pendiente'::character varying])::text[]))),
    CONSTRAINT ventas_iva_check CHECK ((iva >= (0)::numeric)),
    CONSTRAINT ventas_metodo_pago_check CHECK (((metodo_pago)::text = ANY ((ARRAY['efectivo'::character varying, 'tarjeta'::character varying, 'transferencia'::character varying, 'credito'::character varying, 'multiple'::character varying])::text[]))),
    CONSTRAINT ventas_subtotal_check CHECK ((subtotal >= (0)::numeric)),
    CONSTRAINT ventas_total_check CHECK ((total >= (0)::numeric))
);


ALTER TABLE public.ventas OWNER TO marlonjimenez;

--
-- Name: TABLE ventas; Type: COMMENT; Schema: public; Owner: marlonjimenez
--

COMMENT ON TABLE public.ventas IS 'Registro de todas las ventas realizadas';


--
-- Name: COLUMN ventas.folio; Type: COMMENT; Schema: public; Owner: marlonjimenez
--

COMMENT ON COLUMN public.ventas.folio IS 'Folio único de la venta';


--
-- Name: COLUMN ventas.estado; Type: COMMENT; Schema: public; Owner: marlonjimenez
--

COMMENT ON COLUMN public.ventas.estado IS 'completada, cancelada, pendiente';


--
-- Name: ventas_id_seq; Type: SEQUENCE; Schema: public; Owner: marlonjimenez
--

CREATE SEQUENCE public.ventas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.ventas_id_seq OWNER TO marlonjimenez;

--
-- Name: ventas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: marlonjimenez
--

ALTER SEQUENCE public.ventas_id_seq OWNED BY public.ventas.id;


--
-- Name: vista_clientes_frecuentes; Type: VIEW; Schema: public; Owner: marlonjimenez
--

CREATE VIEW public.vista_clientes_frecuentes AS
 SELECT c.id,
    c.nombre,
    c.telefono,
    c.email,
    count(v.id) AS total_compras,
    sum(v.total) AS monto_total_comprado,
    avg(v.total) AS ticket_promedio,
    max(v.fecha_venta) AS ultima_compra,
    c.saldo_pendiente
   FROM (public.clientes c
     JOIN public.ventas v ON ((c.id = v.cliente_id)))
  WHERE (((v.estado)::text = 'completada'::text) AND (v.fecha_venta >= (CURRENT_DATE - '90 days'::interval)))
  GROUP BY c.id, c.nombre, c.telefono, c.email, c.saldo_pendiente
  ORDER BY (count(v.id)) DESC, (sum(v.total)) DESC
 LIMIT 20;


ALTER TABLE public.vista_clientes_frecuentes OWNER TO marlonjimenez;

--
-- Name: vista_productos_mas_vendidos; Type: VIEW; Schema: public; Owner: marlonjimenez
--

CREATE VIEW public.vista_productos_mas_vendidos AS
 SELECT p.id,
    p.nombre,
    p.codigo_barras,
    c.nombre AS categoria,
    count(dv.id) AS veces_vendido,
    sum(dv.cantidad) AS cantidad_total_vendida,
    sum(dv.subtotal) AS ingresos_totales,
    p.stock_actual,
    p.precio_venta
   FROM (((public.productos p
     JOIN public.detalle_ventas dv ON ((p.id = dv.producto_id)))
     JOIN public.ventas v ON ((dv.venta_id = v.id)))
     LEFT JOIN public.categorias c ON ((p.categoria_id = c.id)))
  WHERE (((v.estado)::text = 'completada'::text) AND (v.fecha_venta >= (CURRENT_DATE - '30 days'::interval)))
  GROUP BY p.id, p.nombre, p.codigo_barras, c.nombre, p.stock_actual, p.precio_venta
  ORDER BY (sum(dv.cantidad)) DESC
 LIMIT 20;


ALTER TABLE public.vista_productos_mas_vendidos OWNER TO marlonjimenez;

--
-- Name: vista_productos_por_vencer; Type: VIEW; Schema: public; Owner: marlonjimenez
--

CREATE VIEW public.vista_productos_por_vencer AS
 SELECT p.id AS producto_id,
    p.nombre AS producto,
    p.codigo_barras,
    l.numero_lote,
    l.cantidad,
    l.fecha_vencimiento,
    (l.fecha_vencimiento - CURRENT_DATE) AS dias_restantes,
        CASE
            WHEN ((l.fecha_vencimiento - CURRENT_DATE) < 0) THEN 'vencido'::text
            WHEN ((l.fecha_vencimiento - CURRENT_DATE) <= 7) THEN 'urgente'::text
            WHEN ((l.fecha_vencimiento - CURRENT_DATE) <= 15) THEN 'proximo'::text
            ELSE 'normal'::text
        END AS estado_vencimiento
   FROM (public.lotes_productos l
     JOIN public.productos p ON ((l.producto_id = p.id)))
  WHERE ((l.fecha_vencimiento IS NOT NULL) AND (l.activo = true) AND (l.cantidad > 0) AND (l.fecha_vencimiento <= (CURRENT_DATE + '30 days'::interval)))
  ORDER BY l.fecha_vencimiento;


ALTER TABLE public.vista_productos_por_vencer OWNER TO marlonjimenez;

--
-- Name: vista_stock_bajo; Type: VIEW; Schema: public; Owner: marlonjimenez
--

CREATE VIEW public.vista_stock_bajo AS
 SELECT p.id,
    p.codigo_barras,
    p.nombre,
    c.nombre AS categoria,
    p.stock_actual,
    p.stock_minimo,
    (p.stock_minimo - p.stock_actual) AS faltante,
    p.precio_venta,
    p.updated_at
   FROM (public.productos p
     LEFT JOIN public.categorias c ON ((p.categoria_id = c.id)))
  WHERE ((p.stock_actual <= p.stock_minimo) AND (p.activo = true))
  ORDER BY (p.stock_minimo - p.stock_actual) DESC;


ALTER TABLE public.vista_stock_bajo OWNER TO marlonjimenez;

--
-- Name: vista_ventas_diarias; Type: VIEW; Schema: public; Owner: marlonjimenez
--

CREATE VIEW public.vista_ventas_diarias AS
 SELECT date(ventas.fecha_venta) AS fecha,
    count(*) AS total_ventas,
    sum(ventas.total) AS monto_total,
    avg(ventas.total) AS ticket_promedio,
    sum(
        CASE
            WHEN ((ventas.metodo_pago)::text = 'efectivo'::text) THEN ventas.total
            ELSE (0)::numeric
        END) AS efectivo,
    sum(
        CASE
            WHEN ((ventas.metodo_pago)::text = 'tarjeta'::text) THEN ventas.total
            ELSE (0)::numeric
        END) AS tarjeta,
    sum(
        CASE
            WHEN ((ventas.metodo_pago)::text = 'credito'::text) THEN ventas.total
            ELSE (0)::numeric
        END) AS credito
   FROM public.ventas
  WHERE ((ventas.estado)::text = 'completada'::text)
  GROUP BY (date(ventas.fecha_venta))
  ORDER BY (date(ventas.fecha_venta)) DESC;


ALTER TABLE public.vista_ventas_diarias OWNER TO marlonjimenez;

--
-- Name: categorias id; Type: DEFAULT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.categorias ALTER COLUMN id SET DEFAULT nextval('public.categorias_id_seq'::regclass);


--
-- Name: clientes id; Type: DEFAULT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.clientes ALTER COLUMN id SET DEFAULT nextval('public.clientes_id_seq'::regclass);


--
-- Name: configuracion id; Type: DEFAULT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.configuracion ALTER COLUMN id SET DEFAULT nextval('public.configuracion_id_seq'::regclass);


--
-- Name: cotizaciones id; Type: DEFAULT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.cotizaciones ALTER COLUMN id SET DEFAULT nextval('public.cotizaciones_id_seq'::regclass);


--
-- Name: detalle_cotizaciones id; Type: DEFAULT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.detalle_cotizaciones ALTER COLUMN id SET DEFAULT nextval('public.detalle_cotizaciones_id_seq'::regclass);


--
-- Name: detalle_pedidos id; Type: DEFAULT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.detalle_pedidos ALTER COLUMN id SET DEFAULT nextval('public.detalle_pedidos_id_seq'::regclass);


--
-- Name: detalle_ventas id; Type: DEFAULT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.detalle_ventas ALTER COLUMN id SET DEFAULT nextval('public.detalle_ventas_id_seq'::regclass);


--
-- Name: historial_precios id; Type: DEFAULT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.historial_precios ALTER COLUMN id SET DEFAULT nextval('public.historial_precios_id_seq'::regclass);


--
-- Name: logs_sistema id; Type: DEFAULT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.logs_sistema ALTER COLUMN id SET DEFAULT nextval('public.logs_sistema_id_seq'::regclass);


--
-- Name: lotes_productos id; Type: DEFAULT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.lotes_productos ALTER COLUMN id SET DEFAULT nextval('public.lotes_productos_id_seq'::regclass);


--
-- Name: movimientos_inventario id; Type: DEFAULT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.movimientos_inventario ALTER COLUMN id SET DEFAULT nextval('public.movimientos_inventario_id_seq'::regclass);


--
-- Name: notificaciones id; Type: DEFAULT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.notificaciones ALTER COLUMN id SET DEFAULT nextval('public.notificaciones_id_seq'::regclass);


--
-- Name: pedidos id; Type: DEFAULT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.pedidos ALTER COLUMN id SET DEFAULT nextval('public.pedidos_id_seq'::regclass);


--
-- Name: pedidos_proveedores id; Type: DEFAULT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.pedidos_proveedores ALTER COLUMN id SET DEFAULT nextval('public.pedidos_proveedores_id_seq'::regclass);


--
-- Name: productos id; Type: DEFAULT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.productos ALTER COLUMN id SET DEFAULT nextval('public.productos_id_seq'::regclass);


--
-- Name: proveedores id; Type: DEFAULT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.proveedores ALTER COLUMN id SET DEFAULT nextval('public.proveedores_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: usuarios id; Type: DEFAULT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.usuarios ALTER COLUMN id SET DEFAULT nextval('public.usuarios_id_seq'::regclass);


--
-- Name: ventas id; Type: DEFAULT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.ventas ALTER COLUMN id SET DEFAULT nextval('public.ventas_id_seq'::regclass);


--
-- Data for Name: categorias; Type: TABLE DATA; Schema: public; Owner: marlonjimenez
--

COPY public.categorias (id, nombre, descripcion, activo, created_at, updated_at) FROM stdin;
1	Abarrotes	Productos secos y enlatados	t	2025-12-16 23:38:46.340456	2025-12-16 23:38:46.340456
2	Lácteos	Leche, quesos y derivados	t	2025-12-16 23:38:46.340456	2025-12-16 23:38:46.340456
3	Carnes y Embutidos	Carnes frescas y embutidos	t	2025-12-16 23:38:46.340456	2025-12-16 23:38:46.340456
4	Bebidas	Refrescos, jugos y agua	t	2025-12-16 23:38:46.340456	2025-12-16 23:38:46.340456
5	Limpieza	Productos de limpieza del hogar	t	2025-12-16 23:38:46.340456	2025-12-16 23:38:46.340456
6	Panadería	Pan y productos de panadería	t	2025-12-16 23:38:46.340456	2025-12-16 23:38:46.340456
7	Frutas y Verduras	Productos frescos	t	2025-12-16 23:38:46.340456	2025-12-16 23:38:46.340456
8	Snacks y Dulces	Botanas, dulces y chocolates	t	2025-12-16 23:38:46.340456	2025-12-16 23:38:46.340456
9	Congelados	Productos congelados	t	2025-12-16 23:38:46.340456	2025-12-16 23:38:46.340456
10	Higiene Personal	Productos de cuidado personal	t	2025-12-16 23:38:46.340456	2025-12-16 23:38:46.340456
\.


--
-- Data for Name: clientes; Type: TABLE DATA; Schema: public; Owner: marlonjimenez
--

COPY public.clientes (id, codigo_cliente, nombre, rfc, email, telefono, celular, direccion, ciudad, estado, codigo_postal, limite_credito, saldo_pendiente, descuento_porcentaje, activo, notas, created_at, updated_at, nit) FROM stdin;
2	\N	Yenny Hernandez	\N	yennyjhr2010@hotmail.com	56711243	\N	Villa Lobos	\N	\N	\N	0.00	0.00	0.00	t	\N	2025-12-24 11:39:39.191092	2025-12-24 11:39:39.191092	\N
3	\N	Adryan Gomez	\N	adryan@gmail.com	21232134	\N	dfadsfdsfsa	\N	\N	\N	0.00	0.00	0.00	t	fasfsdafaf	2025-12-26 16:28:54.753223	2025-12-26 16:28:54.753223	888997
1	\N	Marlon Jimenez	\N	marlonji2360@gmail.com	35340463	\N	25 Avenida 4-00 casa A11 condominio Luminela Zona 10 San Miguel Petapa	\N	\N	\N	0.00	0.00	0.00	t	\N	2025-12-24 11:37:42.101589	2025-12-26 16:29:13.14935	123456
\.


--
-- Data for Name: configuracion; Type: TABLE DATA; Schema: public; Owner: marlonjimenez
--

COPY public.configuracion (id, clave, valor, descripcion, tipo, created_at, updated_at) FROM stdin;
2	direccion	Ciudad de Guatemala, Guatemala	Dirección del negocio	texto	2025-12-27 17:44:19.426209	2025-12-27 17:57:49.554183
4	email	info@posabarrotes.com	Email de contacto	texto	2025-12-27 17:44:19.426209	2025-12-27 17:57:49.55556
8	iva	12	Porcentaje de IVA	numero	2025-12-27 17:44:19.426209	2025-12-27 17:57:49.556182
6	moneda	Q	Símbolo de moneda	texto	2025-12-27 17:44:19.426209	2025-12-27 17:57:49.55679
5	nit	CF	NIT del negocio	texto	2025-12-27 17:44:19.426209	2025-12-27 17:57:49.55734
1	nombre_negocio	El Águila	Nombre del negocio	texto	2025-12-27 17:44:19.426209	2025-12-27 17:57:49.557927
3	telefono	(502) 1234-5678	Teléfono de contacto	texto	2025-12-27 17:44:19.426209	2025-12-27 17:57:49.558441
9	ticket_mensaje	¡Gracias por su compra!	Mensaje en tickets	texto	2025-12-27 17:44:19.426209	2025-12-27 17:57:49.558923
10	ticket_pie	Vuelva pronto	Pie de página en tickets	texto	2025-12-27 17:44:19.426209	2025-12-27 17:57:49.55942
7	timezone	America/Guatemala	Zona horaria	texto	2025-12-27 17:44:19.426209	2025-12-27 17:57:49.559949
\.


--
-- Data for Name: cotizaciones; Type: TABLE DATA; Schema: public; Owner: marlonjimenez
--

COPY public.cotizaciones (id, folio, cliente_id, usuario_id, fecha_cotizacion, fecha_vencimiento, subtotal, descuento, iva, total, estado, venta_id, notas, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: detalle_cotizaciones; Type: TABLE DATA; Schema: public; Owner: marlonjimenez
--

COPY public.detalle_cotizaciones (id, cotizacion_id, producto_id, cantidad, precio_unitario, descuento, subtotal, created_at) FROM stdin;
\.


--
-- Data for Name: detalle_pedidos; Type: TABLE DATA; Schema: public; Owner: marlonjimenez
--

COPY public.detalle_pedidos (id, pedido_id, producto_id, cantidad, precio_unitario, descuento, subtotal, created_at) FROM stdin;
3	3	7	2	200.00	0.00	400.00	2025-12-26 17:03:13.515205
4	4	7	6	200.00	0.00	1200.00	2025-12-26 17:15:29.540296
5	5	7	4	200.00	0.00	800.00	2025-12-26 19:18:40.623583
\.


--
-- Data for Name: detalle_ventas; Type: TABLE DATA; Schema: public; Owner: marlonjimenez
--

COPY public.detalle_ventas (id, venta_id, producto_id, cantidad, precio_unitario, descuento, subtotal, created_at) FROM stdin;
1	4	5	1	1000.00	0.00	1000.00	2025-12-23 21:45:03.695195
2	4	4	2	200.00	0.00	400.00	2025-12-23 21:45:03.695195
3	5	5	2	1000.00	0.00	2000.00	2025-12-23 21:49:57.240517
4	5	4	1	200.00	0.00	200.00	2025-12-23 21:49:57.240517
5	6	4	3	200.00	0.00	600.00	2025-12-23 21:50:55.125866
6	6	5	2	1000.00	0.00	2000.00	2025-12-23 21:50:55.125866
7	7	5	1	1000.00	0.00	1000.00	2025-12-23 21:52:06.853466
8	8	6	2	201.00	0.00	402.00	2025-12-23 22:17:14.221569
9	9	7	2	300.00	0.00	600.00	2025-12-24 22:57:07.603787
10	9	6	1	201.00	0.00	201.00	2025-12-24 22:57:07.603787
11	10	7	1	300.00	0.00	300.00	2025-12-26 16:09:36.986092
\.


--
-- Data for Name: historial_precios; Type: TABLE DATA; Schema: public; Owner: marlonjimenez
--

COPY public.historial_precios (id, producto_id, precio_anterior, precio_nuevo, tipo_precio, usuario_id, motivo, fecha_cambio) FROM stdin;
\.


--
-- Data for Name: logs_sistema; Type: TABLE DATA; Schema: public; Owner: marlonjimenez
--

COPY public.logs_sistema (id, tipo, descripcion, usuario_id, datos, ip_address, created_at) FROM stdin;
\.


--
-- Data for Name: lotes_productos; Type: TABLE DATA; Schema: public; Owner: marlonjimenez
--

COPY public.lotes_productos (id, producto_id, numero_lote, cantidad, fecha_ingreso, fecha_vencimiento, precio_compra, proveedor_id, activo, created_at) FROM stdin;
1	3	LOTE-1766461280631	20	2025-12-22	2025-12-23	200.00	\N	t	2025-12-22 21:41:33.289783
2	4	LOTE-1766462175155	1	2025-12-22	2025-12-24	100.00	\N	t	2025-12-22 21:56:27.939469
3	5	LOTE-1766462659160	2	2025-12-22	2025-12-23	100.00	\N	t	2025-12-22 22:04:36.925463
4	7	LOTE-1766638383956	5	2025-12-24	2025-12-27	200.00	\N	t	2025-12-24 22:53:35.269628
\.


--
-- Data for Name: movimientos_inventario; Type: TABLE DATA; Schema: public; Owner: marlonjimenez
--

COPY public.movimientos_inventario (id, producto_id, tipo_movimiento, cantidad, cantidad_anterior, cantidad_nueva, motivo, usuario_id, referencia, created_at) FROM stdin;
1	5	salida	1	\N	\N	Venta	3	Venta VTA-000001	2025-12-23 21:45:03.695195
2	4	salida	2	\N	\N	Venta	3	Venta VTA-000001	2025-12-23 21:45:03.695195
3	5	salida	2	\N	\N	Venta	3	Venta VTA-000002	2025-12-23 21:49:57.240517
4	4	salida	1	\N	\N	Venta	3	Venta VTA-000002	2025-12-23 21:49:57.240517
5	4	salida	3	\N	\N	Venta	3	Venta VTA-000003	2025-12-23 21:50:55.125866
6	5	salida	2	\N	\N	Venta	3	Venta VTA-000003	2025-12-23 21:50:55.125866
7	5	salida	1	\N	\N	Venta	3	Venta VTA-000004	2025-12-23 21:52:06.853466
8	6	salida	2	\N	\N	Venta	3	Venta VTA-000005	2025-12-23 22:17:14.221569
9	7	salida	2	\N	\N	Venta	3	Venta VTA-000006	2025-12-24 22:57:07.603787
10	6	salida	1	\N	\N	Venta	3	Venta VTA-000006	2025-12-24 22:57:07.603787
11	7	salida	1	\N	\N	Venta	3	Venta VTA-000007	2025-12-26 16:09:36.986092
12	7	entrada	2	\N	\N	Pedido recibido	3	Pedido PED-000001	2025-12-26 17:14:59.957043
13	7	entrada	4	\N	\N	Pedido recibido	3	Pedido PED-000003	2025-12-26 19:19:43.570875
\.


--
-- Data for Name: notificaciones; Type: TABLE DATA; Schema: public; Owner: marlonjimenez
--

COPY public.notificaciones (id, tipo, prioridad, titulo, mensaje, usuario_id, leida, fecha_leida, datos_extra, url_accion, created_at) FROM stdin;
\.


--
-- Data for Name: pedidos; Type: TABLE DATA; Schema: public; Owner: marlonjimenez
--

COPY public.pedidos (id, folio, cliente_id, vendedor_id, fecha_pedido, fecha_entrega_estimada, fecha_entrega_real, subtotal, descuento, iva, total, estado, ubicacion_latitud, ubicacion_longitud, direccion_entrega, venta_id, notas, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: pedidos_proveedores; Type: TABLE DATA; Schema: public; Owner: marlonjimenez
--

COPY public.pedidos_proveedores (id, folio, proveedor_id, usuario_id, fecha_pedido, fecha_recepcion, total, estado, notas, created_at, updated_at) FROM stdin;
3	PED-000001	1	3	2025-12-26 17:03:13.515205	2025-12-26 17:14:59.957043	400.00	recibido	entrega viernes 3	2025-12-26 17:03:13.515205	2025-12-26 17:03:13.515205
4	PED-000002	1	3	2025-12-26 17:15:29.540296	\N	1200.00	cancelado		2025-12-26 17:15:29.540296	2025-12-26 17:15:29.540296
5	PED-000003	1	3	2025-12-26 19:18:40.623583	2025-12-26 19:19:43.570875	800.00	recibido		2025-12-26 19:18:40.623583	2025-12-26 19:18:40.623583
\.


--
-- Data for Name: productos; Type: TABLE DATA; Schema: public; Owner: marlonjimenez
--

COPY public.productos (id, codigo_barras, sku, nombre, descripcion, categoria_id, precio_compra, precio_venta, stock_actual, stock_minimo, stock_maximo, unidad_medida, requiere_vencimiento, dias_alerta_vencimiento, imagen_url, activo, created_at, updated_at) FROM stdin;
2	1112	\N	galletas picnic	galletas picnic fresa	1	30.00	50.00	100	10	1000	Caja	f	30	\N	f	2025-12-22 21:29:39.802753	2025-12-22 21:47:25.335919
1	1111	\N	galletas	galletas can can	1	12.00	15.00	20	10	1000	pieza	f	30	\N	f	2025-12-22 21:26:28.246612	2025-12-22 21:49:09.643543
3	1113	\N	leche foremost	test de test	4	100.00	105.00	30	30	1000	pieza	t	2	\N	f	2025-12-22 21:40:37.546659	2025-12-22 21:50:06.794828
5	11100	\N	galletas	khjhkjhkjh	4	800.00	1000.00	1	10	1000	pieza	t	5	\N	t	2025-12-22 22:03:52.145925	2025-12-22 22:03:52.145925
4	1114	\N	leche foremost	hdjsahdjashda	1	100.00	200.00	0	10	1000	caja	t	5	\N	t	2025-12-22 21:55:44.691414	2025-12-23 22:12:01.476269
6	111000	\N	galletas picnic	galletas	5	99.00	201.00	197	100	1000	pieza	f	30	\N	t	2025-12-23 22:13:03.553068	2025-12-23 22:16:15.999343
7	34354354	\N	Coca cola chowi	355 ml	4	200.00	300.00	58	50	1000	caja	t	30	\N	t	2025-12-24 22:51:28.377696	2025-12-24 22:51:28.377696
\.


--
-- Data for Name: proveedores; Type: TABLE DATA; Schema: public; Owner: marlonjimenez
--

COPY public.proveedores (id, codigo_proveedor, nombre, rfc, email, telefono, direccion, ciudad, estado, codigo_postal, contacto_nombre, contacto_telefono, contacto_email, dias_credito, activo, notas, created_at, updated_at, contacto, nit) FROM stdin;
1	\N	Coca Cola	\N	oscar@cocacola.com	23124322	Ciudad	\N	\N	\N	\N	\N	\N	0	t	dfadfasdf	2025-12-26 16:38:19.832854	2025-12-26 16:38:49.432702	Oscar Martinez	3242344
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: marlonjimenez
--

COPY public.roles (id, nombre, descripcion, permisos, activo, created_at, updated_at) FROM stdin;
1	Administrador	Acceso completo al sistema	{"all": true}	t	2025-12-16 23:38:46.338959	2025-12-16 23:38:46.338959
2	Gerente	Gestión de tienda y reportes	{"ventas": true, "clientes": true, "reportes": true, "inventario": true, "proveedores": true}	t	2025-12-16 23:38:46.338959	2025-12-16 23:38:46.338959
3	Vendedor	Realizar ventas y consultar inventario	{"ventas": true, "clientes": "read", "inventario": "read"}	t	2025-12-16 23:38:46.338959	2025-12-16 23:38:46.338959
4	Vendedor Externo	Tomar pedidos desde dispositivos móviles	{"pedidos": true, "clientes": "read", "productos": "read"}	t	2025-12-16 23:38:46.338959	2025-12-16 23:38:46.338959
\.


--
-- Data for Name: usuarios; Type: TABLE DATA; Schema: public; Owner: marlonjimenez
--

COPY public.usuarios (id, nombre, email, password_hash, telefono, rol_id, activo, ultimo_acceso, created_at, updated_at) FROM stdin;
4	Marlon	marlonji2360@gmail.com	$2b$10$kw7f6AFdBJO9/J4B32.W3uiQXBCAxCWoEVsm/jPO1YToHmeNrbUtK	35340463	3	t	2025-12-27 14:50:02.228681	2025-12-27 14:48:31.605955	2025-12-27 14:49:19.447492
3	Administrador	admin@tienda.com	$2b$10$gRDs5vywgnB/KtFKgIMhJOy518Yzyhuo9ViBXWvXnFWTH5do2lLHy	\N	1	t	2025-12-27 17:57:56.757515	2025-12-22 16:55:36.955027	2025-12-22 16:55:36.955027
\.


--
-- Data for Name: ventas; Type: TABLE DATA; Schema: public; Owner: marlonjimenez
--

COPY public.ventas (id, folio, cliente_id, usuario_id, fecha_venta, subtotal, descuento, iva, total, metodo_pago, estado, monto_efectivo, monto_tarjeta, monto_transferencia, cambio, notas, created_at, updated_at) FROM stdin;
4	VTA-000001	\N	3	2025-12-23 21:45:03.695195	1400.00	0.00	0.00	1400.00	efectivo	completada	\N	\N	\N	0.00	\N	2025-12-23 21:45:03.695195	2025-12-23 21:45:03.695195
5	VTA-000002	\N	3	2025-12-23 21:49:57.240517	2200.00	0.00	0.00	2200.00	transferencia	completada	\N	\N	\N	0.00	\N	2025-12-23 21:49:57.240517	2025-12-23 21:49:57.240517
6	VTA-000003	\N	3	2025-12-23 21:50:55.125866	2600.00	0.00	0.00	2600.00	efectivo	completada	\N	\N	\N	0.00	\N	2025-12-23 21:50:55.125866	2025-12-23 21:50:55.125866
7	VTA-000004	\N	3	2025-12-23 21:52:06.853466	1000.00	0.00	0.00	1000.00	transferencia	completada	\N	\N	\N	0.00	\N	2025-12-23 21:52:06.853466	2025-12-23 21:52:06.853466
8	VTA-000005	\N	3	2025-12-23 22:17:14.221569	402.00	0.00	0.00	402.00	efectivo	completada	\N	\N	\N	0.00	\N	2025-12-23 22:17:14.221569	2025-12-23 22:17:14.221569
9	VTA-000006	\N	3	2025-12-24 22:57:07.603787	801.00	0.00	0.00	801.00	efectivo	completada	\N	\N	\N	0.00	\N	2025-12-24 22:57:07.603787	2025-12-24 22:57:07.603787
10	VTA-000007	\N	3	2025-12-26 16:09:36.986092	300.00	0.00	0.00	300.00	efectivo	completada	\N	\N	\N	0.00	\N	2025-12-26 16:09:36.986092	2025-12-26 16:09:36.986092
\.


--
-- Name: categorias_id_seq; Type: SEQUENCE SET; Schema: public; Owner: marlonjimenez
--

SELECT pg_catalog.setval('public.categorias_id_seq', 10, true);


--
-- Name: clientes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: marlonjimenez
--

SELECT pg_catalog.setval('public.clientes_id_seq', 3, true);


--
-- Name: configuracion_id_seq; Type: SEQUENCE SET; Schema: public; Owner: marlonjimenez
--

SELECT pg_catalog.setval('public.configuracion_id_seq', 30, true);


--
-- Name: cotizaciones_id_seq; Type: SEQUENCE SET; Schema: public; Owner: marlonjimenez
--

SELECT pg_catalog.setval('public.cotizaciones_id_seq', 1, false);


--
-- Name: detalle_cotizaciones_id_seq; Type: SEQUENCE SET; Schema: public; Owner: marlonjimenez
--

SELECT pg_catalog.setval('public.detalle_cotizaciones_id_seq', 1, false);


--
-- Name: detalle_pedidos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: marlonjimenez
--

SELECT pg_catalog.setval('public.detalle_pedidos_id_seq', 5, true);


--
-- Name: detalle_ventas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: marlonjimenez
--

SELECT pg_catalog.setval('public.detalle_ventas_id_seq', 11, true);


--
-- Name: historial_precios_id_seq; Type: SEQUENCE SET; Schema: public; Owner: marlonjimenez
--

SELECT pg_catalog.setval('public.historial_precios_id_seq', 1, false);


--
-- Name: logs_sistema_id_seq; Type: SEQUENCE SET; Schema: public; Owner: marlonjimenez
--

SELECT pg_catalog.setval('public.logs_sistema_id_seq', 1, false);


--
-- Name: lotes_productos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: marlonjimenez
--

SELECT pg_catalog.setval('public.lotes_productos_id_seq', 4, true);


--
-- Name: movimientos_inventario_id_seq; Type: SEQUENCE SET; Schema: public; Owner: marlonjimenez
--

SELECT pg_catalog.setval('public.movimientos_inventario_id_seq', 13, true);


--
-- Name: notificaciones_id_seq; Type: SEQUENCE SET; Schema: public; Owner: marlonjimenez
--

SELECT pg_catalog.setval('public.notificaciones_id_seq', 1, false);


--
-- Name: pedidos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: marlonjimenez
--

SELECT pg_catalog.setval('public.pedidos_id_seq', 1, false);


--
-- Name: pedidos_proveedores_id_seq; Type: SEQUENCE SET; Schema: public; Owner: marlonjimenez
--

SELECT pg_catalog.setval('public.pedidos_proveedores_id_seq', 5, true);


--
-- Name: productos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: marlonjimenez
--

SELECT pg_catalog.setval('public.productos_id_seq', 7, true);


--
-- Name: proveedores_id_seq; Type: SEQUENCE SET; Schema: public; Owner: marlonjimenez
--

SELECT pg_catalog.setval('public.proveedores_id_seq', 1, true);


--
-- Name: roles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: marlonjimenez
--

SELECT pg_catalog.setval('public.roles_id_seq', 4, true);


--
-- Name: usuarios_id_seq; Type: SEQUENCE SET; Schema: public; Owner: marlonjimenez
--

SELECT pg_catalog.setval('public.usuarios_id_seq', 4, true);


--
-- Name: ventas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: marlonjimenez
--

SELECT pg_catalog.setval('public.ventas_id_seq', 10, true);


--
-- Name: categorias categorias_pkey; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_pkey PRIMARY KEY (id);


--
-- Name: clientes clientes_codigo_cliente_key; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_codigo_cliente_key UNIQUE (codigo_cliente);


--
-- Name: clientes clientes_pkey; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_pkey PRIMARY KEY (id);


--
-- Name: configuracion configuracion_clave_key; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.configuracion
    ADD CONSTRAINT configuracion_clave_key UNIQUE (clave);


--
-- Name: configuracion configuracion_pkey; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.configuracion
    ADD CONSTRAINT configuracion_pkey PRIMARY KEY (id);


--
-- Name: cotizaciones cotizaciones_folio_key; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.cotizaciones
    ADD CONSTRAINT cotizaciones_folio_key UNIQUE (folio);


--
-- Name: cotizaciones cotizaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.cotizaciones
    ADD CONSTRAINT cotizaciones_pkey PRIMARY KEY (id);


--
-- Name: detalle_cotizaciones detalle_cotizaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.detalle_cotizaciones
    ADD CONSTRAINT detalle_cotizaciones_pkey PRIMARY KEY (id);


--
-- Name: detalle_pedidos detalle_pedidos_pkey; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.detalle_pedidos
    ADD CONSTRAINT detalle_pedidos_pkey PRIMARY KEY (id);


--
-- Name: detalle_ventas detalle_ventas_pkey; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.detalle_ventas
    ADD CONSTRAINT detalle_ventas_pkey PRIMARY KEY (id);


--
-- Name: historial_precios historial_precios_pkey; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.historial_precios
    ADD CONSTRAINT historial_precios_pkey PRIMARY KEY (id);


--
-- Name: logs_sistema logs_sistema_pkey; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.logs_sistema
    ADD CONSTRAINT logs_sistema_pkey PRIMARY KEY (id);


--
-- Name: lotes_productos lote_unico; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.lotes_productos
    ADD CONSTRAINT lote_unico UNIQUE (producto_id, numero_lote);


--
-- Name: lotes_productos lotes_productos_pkey; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.lotes_productos
    ADD CONSTRAINT lotes_productos_pkey PRIMARY KEY (id);


--
-- Name: movimientos_inventario movimientos_inventario_pkey; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.movimientos_inventario
    ADD CONSTRAINT movimientos_inventario_pkey PRIMARY KEY (id);


--
-- Name: notificaciones notificaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.notificaciones
    ADD CONSTRAINT notificaciones_pkey PRIMARY KEY (id);


--
-- Name: pedidos pedidos_folio_key; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.pedidos
    ADD CONSTRAINT pedidos_folio_key UNIQUE (folio);


--
-- Name: pedidos pedidos_pkey; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.pedidos
    ADD CONSTRAINT pedidos_pkey PRIMARY KEY (id);


--
-- Name: pedidos_proveedores pedidos_proveedores_folio_key; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.pedidos_proveedores
    ADD CONSTRAINT pedidos_proveedores_folio_key UNIQUE (folio);


--
-- Name: pedidos_proveedores pedidos_proveedores_pkey; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.pedidos_proveedores
    ADD CONSTRAINT pedidos_proveedores_pkey PRIMARY KEY (id);


--
-- Name: productos productos_codigo_barras_key; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_codigo_barras_key UNIQUE (codigo_barras);


--
-- Name: productos productos_pkey; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_pkey PRIMARY KEY (id);


--
-- Name: productos productos_sku_key; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_sku_key UNIQUE (sku);


--
-- Name: proveedores proveedores_codigo_proveedor_key; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.proveedores
    ADD CONSTRAINT proveedores_codigo_proveedor_key UNIQUE (codigo_proveedor);


--
-- Name: proveedores proveedores_pkey; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.proveedores
    ADD CONSTRAINT proveedores_pkey PRIMARY KEY (id);


--
-- Name: roles roles_nombre_key; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_key UNIQUE (nombre);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: usuarios usuarios_email_key; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key UNIQUE (email);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: ventas ventas_folio_key; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_folio_key UNIQUE (folio);


--
-- Name: ventas ventas_pkey; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_pkey PRIMARY KEY (id);


--
-- Name: idx_clientes_activo; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_clientes_activo ON public.clientes USING btree (activo);


--
-- Name: idx_clientes_nit; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_clientes_nit ON public.clientes USING btree (nit);


--
-- Name: idx_clientes_nombre; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_clientes_nombre ON public.clientes USING btree (nombre);


--
-- Name: idx_configuracion_clave; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_configuracion_clave ON public.configuracion USING btree (clave);


--
-- Name: idx_detalle_pedidos_pedido; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_detalle_pedidos_pedido ON public.detalle_pedidos USING btree (pedido_id);


--
-- Name: idx_detalle_pedidos_producto; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_detalle_pedidos_producto ON public.detalle_pedidos USING btree (producto_id);


--
-- Name: idx_historial_precios_fecha; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_historial_precios_fecha ON public.historial_precios USING btree (fecha_cambio);


--
-- Name: idx_historial_precios_producto; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_historial_precios_producto ON public.historial_precios USING btree (producto_id);


--
-- Name: idx_historial_precios_usuario; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_historial_precios_usuario ON public.historial_precios USING btree (usuario_id);


--
-- Name: idx_logs_fecha; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_logs_fecha ON public.logs_sistema USING btree (created_at);


--
-- Name: idx_logs_tipo; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_logs_tipo ON public.logs_sistema USING btree (tipo);


--
-- Name: idx_logs_usuario; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_logs_usuario ON public.logs_sistema USING btree (usuario_id);


--
-- Name: idx_lotes_producto; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_lotes_producto ON public.lotes_productos USING btree (producto_id);


--
-- Name: idx_lotes_vencimiento; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_lotes_vencimiento ON public.lotes_productos USING btree (fecha_vencimiento) WHERE (activo = true);


--
-- Name: idx_movimientos_fecha; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_movimientos_fecha ON public.movimientos_inventario USING btree (created_at DESC);


--
-- Name: idx_movimientos_producto; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_movimientos_producto ON public.movimientos_inventario USING btree (producto_id);


--
-- Name: idx_notificaciones_fecha; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_notificaciones_fecha ON public.notificaciones USING btree (created_at DESC);


--
-- Name: idx_notificaciones_tipo; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_notificaciones_tipo ON public.notificaciones USING btree (tipo);


--
-- Name: idx_notificaciones_usuario; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_notificaciones_usuario ON public.notificaciones USING btree (usuario_id, leida);


--
-- Name: idx_pedidos_cliente; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_pedidos_cliente ON public.pedidos USING btree (cliente_id);


--
-- Name: idx_pedidos_estado; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_pedidos_estado ON public.pedidos USING btree (estado);


--
-- Name: idx_pedidos_fecha; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_pedidos_fecha ON public.pedidos USING btree (fecha_pedido DESC);


--
-- Name: idx_pedidos_proveedor; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_pedidos_proveedor ON public.pedidos_proveedores USING btree (proveedor_id);


--
-- Name: idx_pedidos_usuario; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_pedidos_usuario ON public.pedidos_proveedores USING btree (usuario_id);


--
-- Name: idx_pedidos_vendedor; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_pedidos_vendedor ON public.pedidos USING btree (vendedor_id);


--
-- Name: idx_productos_activo; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_productos_activo ON public.productos USING btree (activo);


--
-- Name: idx_productos_categoria; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_productos_categoria ON public.productos USING btree (categoria_id);


--
-- Name: idx_productos_codigo; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_productos_codigo ON public.productos USING btree (codigo_barras);


--
-- Name: idx_productos_nombre; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_productos_nombre ON public.productos USING btree (nombre);


--
-- Name: idx_productos_sku; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_productos_sku ON public.productos USING btree (sku);


--
-- Name: idx_proveedores_contacto; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_proveedores_contacto ON public.proveedores USING btree (contacto);


--
-- Name: idx_proveedores_nit; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_proveedores_nit ON public.proveedores USING btree (nit);


--
-- Name: idx_ventas_cliente; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_ventas_cliente ON public.ventas USING btree (cliente_id);


--
-- Name: idx_ventas_estado; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_ventas_estado ON public.ventas USING btree (estado);


--
-- Name: idx_ventas_fecha; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_ventas_fecha ON public.ventas USING btree (fecha_venta DESC);


--
-- Name: idx_ventas_folio; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_ventas_folio ON public.ventas USING btree (folio);


--
-- Name: idx_ventas_usuario; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_ventas_usuario ON public.ventas USING btree (usuario_id);


--
-- Name: productos trigger_historial_precios; Type: TRIGGER; Schema: public; Owner: marlonjimenez
--

CREATE TRIGGER trigger_historial_precios AFTER UPDATE ON public.productos FOR EACH ROW WHEN (((old.precio_compra IS DISTINCT FROM new.precio_compra) OR (old.precio_venta IS DISTINCT FROM new.precio_venta))) EXECUTE FUNCTION public.registrar_cambio_precio();


--
-- Name: cotizaciones cotizaciones_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.cotizaciones
    ADD CONSTRAINT cotizaciones_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE SET NULL;


--
-- Name: cotizaciones cotizaciones_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.cotizaciones
    ADD CONSTRAINT cotizaciones_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: cotizaciones cotizaciones_venta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.cotizaciones
    ADD CONSTRAINT cotizaciones_venta_id_fkey FOREIGN KEY (venta_id) REFERENCES public.ventas(id) ON DELETE SET NULL;


--
-- Name: detalle_cotizaciones detalle_cotizaciones_cotizacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.detalle_cotizaciones
    ADD CONSTRAINT detalle_cotizaciones_cotizacion_id_fkey FOREIGN KEY (cotizacion_id) REFERENCES public.cotizaciones(id) ON DELETE CASCADE;


--
-- Name: detalle_cotizaciones detalle_cotizaciones_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.detalle_cotizaciones
    ADD CONSTRAINT detalle_cotizaciones_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE RESTRICT;


--
-- Name: detalle_pedidos detalle_pedidos_pedido_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.detalle_pedidos
    ADD CONSTRAINT detalle_pedidos_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES public.pedidos_proveedores(id) ON DELETE CASCADE;


--
-- Name: detalle_pedidos detalle_pedidos_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.detalle_pedidos
    ADD CONSTRAINT detalle_pedidos_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE RESTRICT;


--
-- Name: detalle_ventas detalle_ventas_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.detalle_ventas
    ADD CONSTRAINT detalle_ventas_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE RESTRICT;


--
-- Name: detalle_ventas detalle_ventas_venta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.detalle_ventas
    ADD CONSTRAINT detalle_ventas_venta_id_fkey FOREIGN KEY (venta_id) REFERENCES public.ventas(id) ON DELETE CASCADE;


--
-- Name: historial_precios historial_precios_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.historial_precios
    ADD CONSTRAINT historial_precios_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE CASCADE;


--
-- Name: historial_precios historial_precios_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.historial_precios
    ADD CONSTRAINT historial_precios_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: logs_sistema logs_sistema_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.logs_sistema
    ADD CONSTRAINT logs_sistema_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: lotes_productos lotes_productos_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.lotes_productos
    ADD CONSTRAINT lotes_productos_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE CASCADE;


--
-- Name: lotes_productos lotes_productos_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.lotes_productos
    ADD CONSTRAINT lotes_productos_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id) ON DELETE SET NULL;


--
-- Name: movimientos_inventario movimientos_inventario_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.movimientos_inventario
    ADD CONSTRAINT movimientos_inventario_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE CASCADE;


--
-- Name: movimientos_inventario movimientos_inventario_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.movimientos_inventario
    ADD CONSTRAINT movimientos_inventario_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: notificaciones notificaciones_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.notificaciones
    ADD CONSTRAINT notificaciones_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: pedidos pedidos_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.pedidos
    ADD CONSTRAINT pedidos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE SET NULL;


--
-- Name: pedidos_proveedores pedidos_proveedores_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.pedidos_proveedores
    ADD CONSTRAINT pedidos_proveedores_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id);


--
-- Name: pedidos_proveedores pedidos_proveedores_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.pedidos_proveedores
    ADD CONSTRAINT pedidos_proveedores_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: pedidos pedidos_vendedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.pedidos
    ADD CONSTRAINT pedidos_vendedor_id_fkey FOREIGN KEY (vendedor_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: pedidos pedidos_venta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.pedidos
    ADD CONSTRAINT pedidos_venta_id_fkey FOREIGN KEY (venta_id) REFERENCES public.ventas(id) ON DELETE SET NULL;


--
-- Name: productos productos_categoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias(id) ON DELETE SET NULL;


--
-- Name: usuarios usuarios_rol_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_rol_id_fkey FOREIGN KEY (rol_id) REFERENCES public.roles(id) ON DELETE SET NULL;


--
-- Name: ventas ventas_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE SET NULL;


--
-- Name: ventas ventas_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict 57Yua242lEw3lRLcatoTGdR9NYOTLWHNiYcU9VaaTSQzo56PxhbxmUkXTLirN0O

