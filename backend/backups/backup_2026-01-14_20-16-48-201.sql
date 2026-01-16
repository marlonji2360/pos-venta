--
-- PostgreSQL database dump
--

\restrict KWFIRr5sDynJwY6Ay9hhutMwoih2Eb9PerRdBQLQw521Cefkkwhre5EfRHLBKvD

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: actualizar_cuenta_tras_pago(); Type: FUNCTION; Schema: public; Owner: marlonjimenez
--

CREATE FUNCTION public.actualizar_cuenta_tras_pago() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Actualizar monto pagado en la cuenta
    UPDATE cuentas_por_pagar
    SET monto_pagado = monto_pagado + NEW.monto
    WHERE id = NEW.cuenta_por_pagar_id;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.actualizar_cuenta_tras_pago() OWNER TO marlonjimenez;

--
-- Name: actualizar_descuento_volumen_updated_at(); Type: FUNCTION; Schema: public; Owner: marlonjimenez
--

CREATE FUNCTION public.actualizar_descuento_volumen_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.actualizar_descuento_volumen_updated_at() OWNER TO marlonjimenez;

--
-- Name: actualizar_envios_updated_at(); Type: FUNCTION; Schema: public; Owner: marlonjimenez
--

CREATE FUNCTION public.actualizar_envios_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.actualizar_envios_updated_at() OWNER TO marlonjimenez;

--
-- Name: actualizar_estado_cuenta_pagar(); Type: FUNCTION; Schema: public; Owner: marlonjimenez
--

CREATE FUNCTION public.actualizar_estado_cuenta_pagar() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Actualizar saldo pendiente
    NEW.saldo_pendiente := NEW.monto_total - NEW.monto_pagado;
    
    -- Actualizar estado
    IF NEW.saldo_pendiente <= 0 THEN
        NEW.estado := 'pagado';
    ELSIF NEW.monto_pagado > 0 AND NEW.monto_pagado < NEW.monto_total THEN
        NEW.estado := 'parcial';
    ELSIF NEW.fecha_vencimiento < CURRENT_DATE AND NEW.saldo_pendiente > 0 THEN
        NEW.estado := 'vencido';
    ELSE
        NEW.estado := 'pendiente';
    END IF;
    
    NEW.updated_at := CURRENT_TIMESTAMP;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.actualizar_estado_cuenta_pagar() OWNER TO marlonjimenez;

--
-- Name: actualizar_gastos_updated_at(); Type: FUNCTION; Schema: public; Owner: marlonjimenez
--

CREATE FUNCTION public.actualizar_gastos_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.actualizar_gastos_updated_at() OWNER TO marlonjimenez;

--
-- Name: asignar_piloto_automatico(); Type: FUNCTION; Schema: public; Owner: marlonjimenez
--

CREATE FUNCTION public.asignar_piloto_automatico() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    piloto_id_result INTEGER;
BEGIN
    SELECT u.id INTO piloto_id_result
    FROM usuarios u
    LEFT JOIN (
        SELECT piloto_id, COUNT(*) as envios_activos
        FROM envios
        WHERE estado IN ('asignado', 'preparando', 'cargado', 'en_ruta')
        GROUP BY piloto_id
    ) e ON u.id = e.piloto_id
    JOIN roles r ON u.rol_id = r.id
    WHERE r.nombre = 'Piloto'
    AND u.activo = true
    ORDER BY COALESCE(e.envios_activos, 0) ASC
    LIMIT 1;
    
    RETURN piloto_id_result;
END;
$$;


ALTER FUNCTION public.asignar_piloto_automatico() OWNER TO marlonjimenez;

--
-- Name: generar_proximos_pagos_gastos(); Type: FUNCTION; Schema: public; Owner: marlonjimenez
--

CREATE FUNCTION public.generar_proximos_pagos_gastos() RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    gasto RECORD;
    proxima_fecha DATE;
    dias_interval INTEGER;
BEGIN
    FOR gasto IN SELECT * FROM gastos_fijos WHERE activo = true LOOP
        
        -- Calcular próxima fecha según frecuencia
        CASE gasto.frecuencia
            WHEN 'mensual' THEN dias_interval := 30;
            WHEN 'bimensual' THEN dias_interval := 60;
            WHEN 'trimestral' THEN dias_interval := 90;
            WHEN 'semestral' THEN dias_interval := 180;
            WHEN 'anual' THEN dias_interval := 365;
        END CASE;
        
        -- Calcular próxima fecha de vencimiento
        proxima_fecha := DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day';
        proxima_fecha := DATE_TRUNC('month', proxima_fecha) + (gasto.dia_vencimiento - 1) * INTERVAL '1 day';
        
        -- Si la fecha ya pasó, usar el siguiente mes
        IF proxima_fecha < CURRENT_DATE THEN
            proxima_fecha := proxima_fecha + dias_interval * INTERVAL '1 day';
        END IF;
        
        -- Crear pago si no existe uno pendiente para esta fecha
        IF NOT EXISTS (
            SELECT 1 FROM pagos_gastos 
            WHERE gasto_fijo_id = gasto.id 
            AND fecha_vencimiento = proxima_fecha
            AND estado IN ('pendiente', 'pagado')
        ) THEN
            INSERT INTO pagos_gastos (
                gasto_fijo_id,
                fecha_vencimiento,
                monto_pagado,
                estado
            ) VALUES (
                gasto.id,
                proxima_fecha,
                gasto.monto,
                'pendiente'
            );
        END IF;
        
    END LOOP;
END;
$$;


ALTER FUNCTION public.generar_proximos_pagos_gastos() OWNER TO marlonjimenez;

--
-- Name: registrar_cambio_estado_envio(); Type: FUNCTION; Schema: public; Owner: marlonjimenez
--

CREATE FUNCTION public.registrar_cambio_estado_envio() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Solo registrar si el estado cambió
    IF OLD.estado IS DISTINCT FROM NEW.estado THEN
        INSERT INTO historial_envios (
            envio_id,
            estado_anterior,
            estado_nuevo
        ) VALUES (
            NEW.id,
            OLD.estado,
            NEW.estado
        );
        
        -- Actualizar fechas según el estado
        IF NEW.estado = 'asignado' THEN
            NEW.fecha_asignacion = CURRENT_TIMESTAMP;
        ELSIF NEW.estado = 'cargado' THEN
            NEW.fecha_cargado = CURRENT_TIMESTAMP;
        ELSIF NEW.estado = 'en_ruta' THEN
            NEW.fecha_en_ruta = CURRENT_TIMESTAMP;
        ELSIF NEW.estado = 'entregado' THEN
            NEW.fecha_entrega = CURRENT_TIMESTAMP;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.registrar_cambio_estado_envio() OWNER TO marlonjimenez;

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
-- Name: ajustes_recepcion; Type: TABLE; Schema: public; Owner: marlonjimenez
--

CREATE TABLE public.ajustes_recepcion (
    id integer NOT NULL,
    pedido_id integer NOT NULL,
    producto_id integer NOT NULL,
    cantidad_pedida integer NOT NULL,
    cantidad_recibida integer NOT NULL,
    diferencia integer NOT NULL,
    tipo_ajuste character varying(20),
    motivo text,
    usuario_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ajustes_recepcion_tipo_ajuste_check CHECK (((tipo_ajuste)::text = ANY (ARRAY[('faltante'::character varying)::text, ('sobrante'::character varying)::text, ('correcto'::character varying)::text])))
);


ALTER TABLE public.ajustes_recepcion OWNER TO marlonjimenez;

--
-- Name: ajustes_recepcion_id_seq; Type: SEQUENCE; Schema: public; Owner: marlonjimenez
--

CREATE SEQUENCE public.ajustes_recepcion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ajustes_recepcion_id_seq OWNER TO marlonjimenez;

--
-- Name: ajustes_recepcion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: marlonjimenez
--

ALTER SEQUENCE public.ajustes_recepcion_id_seq OWNED BY public.ajustes_recepcion.id;


--
-- Name: autorizaciones_descuento; Type: TABLE; Schema: public; Owner: marlonjimenez
--

CREATE TABLE public.autorizaciones_descuento (
    id integer NOT NULL,
    venta_id integer,
    monto_descuento numeric(10,2) NOT NULL,
    porcentaje_descuento numeric(5,2),
    motivo text,
    solicitado_por integer,
    autorizado_por integer,
    estado character varying(20) DEFAULT 'pendiente'::character varying,
    fecha_solicitud timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    fecha_respuesta timestamp without time zone,
    notas_autorizacion text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT autorizaciones_descuento_estado_check CHECK (((estado)::text = ANY (ARRAY[('pendiente'::character varying)::text, ('aprobado'::character varying)::text, ('rechazado'::character varying)::text])))
);


ALTER TABLE public.autorizaciones_descuento OWNER TO marlonjimenez;

--
-- Name: autorizaciones_descuento_id_seq; Type: SEQUENCE; Schema: public; Owner: marlonjimenez
--

CREATE SEQUENCE public.autorizaciones_descuento_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.autorizaciones_descuento_id_seq OWNER TO marlonjimenez;

--
-- Name: autorizaciones_descuento_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: marlonjimenez
--

ALTER SEQUENCE public.autorizaciones_descuento_id_seq OWNED BY public.autorizaciones_descuento.id;


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
-- Name: categorias_gastos; Type: TABLE; Schema: public; Owner: marlonjimenez
--

CREATE TABLE public.categorias_gastos (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    descripcion text,
    icono character varying(50),
    color character varying(20),
    activo boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.categorias_gastos OWNER TO marlonjimenez;

--
-- Name: categorias_gastos_id_seq; Type: SEQUENCE; Schema: public; Owner: marlonjimenez
--

CREATE SEQUENCE public.categorias_gastos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.categorias_gastos_id_seq OWNER TO marlonjimenez;

--
-- Name: categorias_gastos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: marlonjimenez
--

ALTER SEQUENCE public.categorias_gastos_id_seq OWNED BY public.categorias_gastos.id;


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


ALTER SEQUENCE public.categorias_id_seq OWNER TO marlonjimenez;

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


ALTER SEQUENCE public.clientes_id_seq OWNER TO marlonjimenez;

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
    CONSTRAINT configuracion_tipo_check CHECK (((tipo)::text = ANY (ARRAY[('texto'::character varying)::text, ('numero'::character varying)::text, ('booleano'::character varying)::text, ('json'::character varying)::text])))
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


ALTER SEQUENCE public.configuracion_id_seq OWNER TO marlonjimenez;

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
    CONSTRAINT cotizaciones_estado_check CHECK (((estado)::text = ANY (ARRAY[('pendiente'::character varying)::text, ('aprobada'::character varying)::text, ('rechazada'::character varying)::text, ('vencida'::character varying)::text, ('convertida'::character varying)::text]))),
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


ALTER SEQUENCE public.cotizaciones_id_seq OWNER TO marlonjimenez;

--
-- Name: cotizaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: marlonjimenez
--

ALTER SEQUENCE public.cotizaciones_id_seq OWNED BY public.cotizaciones.id;


--
-- Name: cuentas_por_pagar; Type: TABLE; Schema: public; Owner: marlonjimenez
--

CREATE TABLE public.cuentas_por_pagar (
    id integer NOT NULL,
    proveedor_id integer NOT NULL,
    pedido_id integer,
    folio character varying(50) NOT NULL,
    fecha_emision date DEFAULT CURRENT_DATE NOT NULL,
    fecha_vencimiento date NOT NULL,
    monto_total numeric(10,2) NOT NULL,
    monto_pagado numeric(10,2) DEFAULT 0,
    saldo_pendiente numeric(10,2) NOT NULL,
    estado character varying(20) DEFAULT 'pendiente'::character varying,
    dias_credito integer NOT NULL,
    concepto text,
    notas text,
    usuario_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT cuentas_por_pagar_estado_check CHECK (((estado)::text = ANY (ARRAY[('pendiente'::character varying)::text, ('parcial'::character varying)::text, ('pagado'::character varying)::text, ('vencido'::character varying)::text])))
);


ALTER TABLE public.cuentas_por_pagar OWNER TO marlonjimenez;

--
-- Name: cuentas_por_pagar_id_seq; Type: SEQUENCE; Schema: public; Owner: marlonjimenez
--

CREATE SEQUENCE public.cuentas_por_pagar_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cuentas_por_pagar_id_seq OWNER TO marlonjimenez;

--
-- Name: cuentas_por_pagar_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: marlonjimenez
--

ALTER SEQUENCE public.cuentas_por_pagar_id_seq OWNED BY public.cuentas_por_pagar.id;


--
-- Name: descuentos_volumen; Type: TABLE; Schema: public; Owner: marlonjimenez
--

CREATE TABLE public.descuentos_volumen (
    id integer NOT NULL,
    producto_id integer NOT NULL,
    cantidad_minima integer NOT NULL,
    porcentaje_descuento numeric(5,2) NOT NULL,
    activo boolean DEFAULT true,
    fecha_inicio date,
    fecha_fin date,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT descuentos_volumen_porcentaje_descuento_check CHECK (((porcentaje_descuento > (0)::numeric) AND (porcentaje_descuento <= (100)::numeric)))
);


ALTER TABLE public.descuentos_volumen OWNER TO marlonjimenez;

--
-- Name: descuentos_volumen_id_seq; Type: SEQUENCE; Schema: public; Owner: marlonjimenez
--

CREATE SEQUENCE public.descuentos_volumen_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.descuentos_volumen_id_seq OWNER TO marlonjimenez;

--
-- Name: descuentos_volumen_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: marlonjimenez
--

ALTER SEQUENCE public.descuentos_volumen_id_seq OWNED BY public.descuentos_volumen.id;


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


ALTER SEQUENCE public.detalle_cotizaciones_id_seq OWNER TO marlonjimenez;

--
-- Name: detalle_cotizaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: marlonjimenez
--

ALTER SEQUENCE public.detalle_cotizaciones_id_seq OWNED BY public.detalle_cotizaciones.id;


--
-- Name: detalle_devoluciones_clientes; Type: TABLE; Schema: public; Owner: marlonjimenez
--

CREATE TABLE public.detalle_devoluciones_clientes (
    id integer NOT NULL,
    devolucion_id integer NOT NULL,
    producto_id integer NOT NULL,
    cantidad integer NOT NULL,
    precio_unitario numeric(10,2),
    subtotal numeric(10,2),
    afecta_inventario boolean DEFAULT true,
    motivo_producto text,
    producto_cambio_id integer,
    cantidad_cambio integer,
    precio_cambio numeric(10,2),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.detalle_devoluciones_clientes OWNER TO marlonjimenez;

--
-- Name: detalle_devoluciones_clientes_id_seq; Type: SEQUENCE; Schema: public; Owner: marlonjimenez
--

CREATE SEQUENCE public.detalle_devoluciones_clientes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.detalle_devoluciones_clientes_id_seq OWNER TO marlonjimenez;

--
-- Name: detalle_devoluciones_clientes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: marlonjimenez
--

ALTER SEQUENCE public.detalle_devoluciones_clientes_id_seq OWNED BY public.detalle_devoluciones_clientes.id;


--
-- Name: detalle_devoluciones_proveedores; Type: TABLE; Schema: public; Owner: marlonjimenez
--

CREATE TABLE public.detalle_devoluciones_proveedores (
    id integer NOT NULL,
    devolucion_id integer NOT NULL,
    producto_id integer NOT NULL,
    cantidad integer NOT NULL,
    precio_unitario numeric(10,2),
    subtotal numeric(10,2),
    afecta_inventario boolean DEFAULT true,
    motivo_producto text,
    producto_cambio_id integer,
    cantidad_cambio integer,
    precio_cambio numeric(10,2),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.detalle_devoluciones_proveedores OWNER TO marlonjimenez;

--
-- Name: detalle_devoluciones_proveedores_id_seq; Type: SEQUENCE; Schema: public; Owner: marlonjimenez
--

CREATE SEQUENCE public.detalle_devoluciones_proveedores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.detalle_devoluciones_proveedores_id_seq OWNER TO marlonjimenez;

--
-- Name: detalle_devoluciones_proveedores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: marlonjimenez
--

ALTER SEQUENCE public.detalle_devoluciones_proveedores_id_seq OWNED BY public.detalle_devoluciones_proveedores.id;


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


ALTER SEQUENCE public.detalle_pedidos_id_seq OWNER TO marlonjimenez;

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
    descuento_aplicado numeric(10,2) DEFAULT 0,
    porcentaje_descuento numeric(5,2) DEFAULT 0,
    precio_con_descuento numeric(10,2),
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


ALTER SEQUENCE public.detalle_ventas_id_seq OWNER TO marlonjimenez;

--
-- Name: detalle_ventas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: marlonjimenez
--

ALTER SEQUENCE public.detalle_ventas_id_seq OWNED BY public.detalle_ventas.id;


--
-- Name: devoluciones_clientes; Type: TABLE; Schema: public; Owner: marlonjimenez
--

CREATE TABLE public.devoluciones_clientes (
    id integer NOT NULL,
    folio character varying(50) NOT NULL,
    venta_id integer,
    cliente_id integer,
    tipo character varying(20),
    fecha_devolucion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    monto_devuelto numeric(10,2) DEFAULT 0,
    estado character varying(20) DEFAULT 'procesada'::character varying,
    motivo text,
    notas text,
    usuario_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT devoluciones_clientes_estado_check CHECK (((estado)::text = ANY (ARRAY[('procesada'::character varying)::text, ('pendiente'::character varying)::text, ('rechazada'::character varying)::text]))),
    CONSTRAINT devoluciones_clientes_tipo_check CHECK (((tipo)::text = ANY (ARRAY[('devolucion'::character varying)::text, ('cambio'::character varying)::text])))
);


ALTER TABLE public.devoluciones_clientes OWNER TO marlonjimenez;

--
-- Name: devoluciones_clientes_id_seq; Type: SEQUENCE; Schema: public; Owner: marlonjimenez
--

CREATE SEQUENCE public.devoluciones_clientes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.devoluciones_clientes_id_seq OWNER TO marlonjimenez;

--
-- Name: devoluciones_clientes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: marlonjimenez
--

ALTER SEQUENCE public.devoluciones_clientes_id_seq OWNED BY public.devoluciones_clientes.id;


--
-- Name: devoluciones_proveedores; Type: TABLE; Schema: public; Owner: marlonjimenez
--

CREATE TABLE public.devoluciones_proveedores (
    id integer NOT NULL,
    folio character varying(50) NOT NULL,
    pedido_id integer,
    proveedor_id integer NOT NULL,
    tipo character varying(20),
    fecha_devolucion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    monto_devuelto numeric(10,2) DEFAULT 0,
    estado character varying(20) DEFAULT 'pendiente'::character varying,
    motivo text,
    notas text,
    usuario_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT devoluciones_proveedores_estado_check CHECK (((estado)::text = ANY (ARRAY[('pendiente'::character varying)::text, ('aprobada'::character varying)::text, ('rechazada'::character varying)::text, ('completada'::character varying)::text]))),
    CONSTRAINT devoluciones_proveedores_tipo_check CHECK (((tipo)::text = ANY (ARRAY[('devolucion'::character varying)::text, ('cambio'::character varying)::text])))
);


ALTER TABLE public.devoluciones_proveedores OWNER TO marlonjimenez;

--
-- Name: devoluciones_proveedores_id_seq; Type: SEQUENCE; Schema: public; Owner: marlonjimenez
--

CREATE SEQUENCE public.devoluciones_proveedores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.devoluciones_proveedores_id_seq OWNER TO marlonjimenez;

--
-- Name: devoluciones_proveedores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: marlonjimenez
--

ALTER SEQUENCE public.devoluciones_proveedores_id_seq OWNED BY public.devoluciones_proveedores.id;


--
-- Name: envios; Type: TABLE; Schema: public; Owner: marlonjimenez
--

CREATE TABLE public.envios (
    id integer NOT NULL,
    venta_id integer NOT NULL,
    piloto_id integer,
    direccion_entrega text NOT NULL,
    referencia_direccion text,
    telefono_contacto character varying(20),
    nombre_contacto character varying(255),
    estado character varying(20) DEFAULT 'pendiente'::character varying,
    fecha_pedido timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    fecha_asignacion timestamp without time zone,
    fecha_cargado timestamp without time zone,
    fecha_en_ruta timestamp without time zone,
    fecha_entrega timestamp without time zone,
    costo_envio numeric(10,2) DEFAULT 0,
    distancia_km numeric(10,2),
    tiempo_estimado_minutos integer,
    notas_cliente text,
    notas_piloto text,
    motivo_cancelacion text,
    requiere_cobro boolean DEFAULT false,
    monto_cobrado numeric(10,2),
    foto_entrega text,
    firma_cliente text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT envios_estado_check CHECK (((estado)::text = ANY (ARRAY[('pendiente'::character varying)::text, ('asignado'::character varying)::text, ('preparando'::character varying)::text, ('cargado'::character varying)::text, ('en_ruta'::character varying)::text, ('entregado'::character varying)::text, ('cancelado'::character varying)::text, ('fallido'::character varying)::text])))
);


ALTER TABLE public.envios OWNER TO marlonjimenez;

--
-- Name: envios_id_seq; Type: SEQUENCE; Schema: public; Owner: marlonjimenez
--

CREATE SEQUENCE public.envios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.envios_id_seq OWNER TO marlonjimenez;

--
-- Name: envios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: marlonjimenez
--

ALTER SEQUENCE public.envios_id_seq OWNED BY public.envios.id;


--
-- Name: gastos_fijos; Type: TABLE; Schema: public; Owner: marlonjimenez
--

CREATE TABLE public.gastos_fijos (
    id integer NOT NULL,
    nombre character varying(255) NOT NULL,
    categoria_id integer,
    monto numeric(10,2) NOT NULL,
    frecuencia character varying(20) NOT NULL,
    dia_vencimiento integer,
    proveedor character varying(255),
    numero_cuenta character varying(100),
    notas text,
    dias_recordatorio integer DEFAULT 3,
    activo boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT gastos_fijos_dia_vencimiento_check CHECK (((dia_vencimiento >= 1) AND (dia_vencimiento <= 31))),
    CONSTRAINT gastos_fijos_frecuencia_check CHECK (((frecuencia)::text = ANY (ARRAY[('mensual'::character varying)::text, ('bimensual'::character varying)::text, ('trimestral'::character varying)::text, ('semestral'::character varying)::text, ('anual'::character varying)::text])))
);


ALTER TABLE public.gastos_fijos OWNER TO marlonjimenez;

--
-- Name: gastos_fijos_id_seq; Type: SEQUENCE; Schema: public; Owner: marlonjimenez
--

CREATE SEQUENCE public.gastos_fijos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.gastos_fijos_id_seq OWNER TO marlonjimenez;

--
-- Name: gastos_fijos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: marlonjimenez
--

ALTER SEQUENCE public.gastos_fijos_id_seq OWNED BY public.gastos_fijos.id;


--
-- Name: historial_envios; Type: TABLE; Schema: public; Owner: marlonjimenez
--

CREATE TABLE public.historial_envios (
    id integer NOT NULL,
    envio_id integer NOT NULL,
    estado_anterior character varying(20),
    estado_nuevo character varying(20) NOT NULL,
    usuario_id integer,
    comentario text,
    latitud numeric(10,8),
    longitud numeric(11,8),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.historial_envios OWNER TO marlonjimenez;

--
-- Name: historial_envios_id_seq; Type: SEQUENCE; Schema: public; Owner: marlonjimenez
--

CREATE SEQUENCE public.historial_envios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.historial_envios_id_seq OWNER TO marlonjimenez;

--
-- Name: historial_envios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: marlonjimenez
--

ALTER SEQUENCE public.historial_envios_id_seq OWNED BY public.historial_envios.id;


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
    CONSTRAINT historial_precios_tipo_precio_check CHECK (((tipo_precio)::text = ANY (ARRAY[('compra'::character varying)::text, ('venta'::character varying)::text])))
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


ALTER SEQUENCE public.historial_precios_id_seq OWNER TO marlonjimenez;

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


ALTER SEQUENCE public.logs_sistema_id_seq OWNER TO marlonjimenez;

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


ALTER SEQUENCE public.lotes_productos_id_seq OWNER TO marlonjimenez;

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
    CONSTRAINT movimientos_inventario_tipo_movimiento_check CHECK (((tipo_movimiento)::text = ANY (ARRAY[('entrada'::character varying)::text, ('salida'::character varying)::text, ('ajuste'::character varying)::text, ('merma'::character varying)::text, ('devolucion'::character varying)::text])))
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


ALTER SEQUENCE public.movimientos_inventario_id_seq OWNER TO marlonjimenez;

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
    titulo character varying(255) NOT NULL,
    mensaje text NOT NULL,
    prioridad character varying(20) DEFAULT 'media'::character varying,
    leida boolean DEFAULT false,
    datos jsonb,
    fecha timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    fecha_leida timestamp without time zone,
    CONSTRAINT notificaciones_prioridad_check CHECK (((prioridad)::text = ANY (ARRAY[('baja'::character varying)::text, ('media'::character varying)::text, ('alta'::character varying)::text])))
);


ALTER TABLE public.notificaciones OWNER TO marlonjimenez;

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


ALTER SEQUENCE public.notificaciones_id_seq OWNER TO marlonjimenez;

--
-- Name: notificaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: marlonjimenez
--

ALTER SEQUENCE public.notificaciones_id_seq OWNED BY public.notificaciones.id;


--
-- Name: pagos_gastos; Type: TABLE; Schema: public; Owner: marlonjimenez
--

CREATE TABLE public.pagos_gastos (
    id integer NOT NULL,
    gasto_fijo_id integer,
    fecha_vencimiento date NOT NULL,
    fecha_pago date,
    monto_pagado numeric(10,2),
    metodo_pago character varying(50),
    referencia character varying(100),
    estado character varying(20) DEFAULT 'pendiente'::character varying,
    notas text,
    usuario_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pagos_gastos_estado_check CHECK (((estado)::text = ANY (ARRAY[('pendiente'::character varying)::text, ('pagado'::character varying)::text, ('vencido'::character varying)::text, ('cancelado'::character varying)::text])))
);


ALTER TABLE public.pagos_gastos OWNER TO marlonjimenez;

--
-- Name: pagos_gastos_id_seq; Type: SEQUENCE; Schema: public; Owner: marlonjimenez
--

CREATE SEQUENCE public.pagos_gastos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pagos_gastos_id_seq OWNER TO marlonjimenez;

--
-- Name: pagos_gastos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: marlonjimenez
--

ALTER SEQUENCE public.pagos_gastos_id_seq OWNED BY public.pagos_gastos.id;


--
-- Name: pagos_proveedores; Type: TABLE; Schema: public; Owner: marlonjimenez
--

CREATE TABLE public.pagos_proveedores (
    id integer NOT NULL,
    cuenta_por_pagar_id integer NOT NULL,
    fecha_pago timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    monto numeric(10,2) NOT NULL,
    metodo_pago character varying(50) DEFAULT 'efectivo'::character varying,
    referencia character varying(100),
    notas text,
    usuario_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pagos_proveedores_metodo_pago_check CHECK (((metodo_pago)::text = ANY (ARRAY[('efectivo'::character varying)::text, ('transferencia'::character varying)::text, ('cheque'::character varying)::text, ('tarjeta'::character varying)::text])))
);


ALTER TABLE public.pagos_proveedores OWNER TO marlonjimenez;

--
-- Name: pagos_proveedores_id_seq; Type: SEQUENCE; Schema: public; Owner: marlonjimenez
--

CREATE SEQUENCE public.pagos_proveedores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pagos_proveedores_id_seq OWNER TO marlonjimenez;

--
-- Name: pagos_proveedores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: marlonjimenez
--

ALTER SEQUENCE public.pagos_proveedores_id_seq OWNED BY public.pagos_proveedores.id;


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
    CONSTRAINT pedidos_estado_check CHECK (((estado)::text = ANY (ARRAY[('pendiente'::character varying)::text, ('procesando'::character varying)::text, ('listo'::character varying)::text, ('entregado'::character varying)::text, ('cancelado'::character varying)::text]))),
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


ALTER SEQUENCE public.pedidos_id_seq OWNER TO marlonjimenez;

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
    forma_pago character varying(20) DEFAULT 'contado'::character varying,
    dias_credito integer DEFAULT 0,
    tiene_ajustes boolean DEFAULT false,
    CONSTRAINT pedidos_proveedores_estado_check CHECK (((estado)::text = ANY (ARRAY[('pendiente'::character varying)::text, ('recibido'::character varying)::text, ('cancelado'::character varying)::text]))),
    CONSTRAINT pedidos_proveedores_forma_pago_check CHECK (((forma_pago)::text = ANY (ARRAY[('contado'::character varying)::text, ('credito'::character varying)::text])))
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


ALTER SEQUENCE public.pedidos_proveedores_id_seq OWNER TO marlonjimenez;

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


ALTER SEQUENCE public.productos_id_seq OWNER TO marlonjimenez;

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


ALTER SEQUENCE public.proveedores_id_seq OWNER TO marlonjimenez;

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


ALTER SEQUENCE public.roles_id_seq OWNER TO marlonjimenez;

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


ALTER SEQUENCE public.usuarios_id_seq OWNER TO marlonjimenez;

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
    descuento_volumen numeric(10,2) DEFAULT 0,
    descuento_adicional numeric(10,2) DEFAULT 0,
    total_descuentos numeric(10,2) DEFAULT 0,
    requiere_autorizacion boolean DEFAULT false,
    autorizacion_id integer,
    es_envio boolean DEFAULT false,
    envio_id integer,
    CONSTRAINT ventas_descuento_check CHECK ((descuento >= (0)::numeric)),
    CONSTRAINT ventas_estado_check CHECK (((estado)::text = ANY (ARRAY[('completada'::character varying)::text, ('cancelada'::character varying)::text, ('pendiente'::character varying)::text]))),
    CONSTRAINT ventas_iva_check CHECK ((iva >= (0)::numeric)),
    CONSTRAINT ventas_metodo_pago_check CHECK (((metodo_pago)::text = ANY (ARRAY[('efectivo'::character varying)::text, ('tarjeta'::character varying)::text, ('transferencia'::character varying)::text, ('credito'::character varying)::text, ('multiple'::character varying)::text]))),
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


ALTER SEQUENCE public.ventas_id_seq OWNER TO marlonjimenez;

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


ALTER VIEW public.vista_clientes_frecuentes OWNER TO marlonjimenez;

--
-- Name: vista_envios_completa; Type: VIEW; Schema: public; Owner: marlonjimenez
--

CREATE VIEW public.vista_envios_completa AS
 SELECT e.id,
    e.venta_id,
    e.piloto_id,
    e.direccion_entrega,
    e.referencia_direccion,
    e.telefono_contacto,
    e.nombre_contacto,
    e.estado,
    e.fecha_pedido,
    e.fecha_asignacion,
    e.fecha_cargado,
    e.fecha_en_ruta,
    e.fecha_entrega,
    e.costo_envio,
    e.distancia_km,
    e.tiempo_estimado_minutos,
    e.notas_cliente,
    e.notas_piloto,
    e.motivo_cancelacion,
    e.requiere_cobro,
    e.monto_cobrado,
    e.foto_entrega,
    e.firma_cliente,
    e.created_at,
    e.updated_at,
    v.folio AS venta_folio,
    v.total AS venta_total,
    v.fecha_venta,
    c.nombre AS cliente_nombre,
    c.telefono AS cliente_telefono,
    p.nombre AS piloto_nombre,
    p.telefono AS piloto_telefono,
    u.nombre AS vendedor_nombre,
        CASE
            WHEN ((e.estado)::text = 'entregado'::text) THEN 'completado'::text
            WHEN ((e.estado)::text = ANY (ARRAY[('cancelado'::character varying)::text, ('fallido'::character varying)::text])) THEN 'finalizado'::text
            ELSE 'activo'::text
        END AS estado_grupo,
        CASE
            WHEN (e.fecha_entrega IS NOT NULL) THEN (EXTRACT(epoch FROM (e.fecha_entrega - e.fecha_pedido)) / (60)::numeric)
            ELSE NULL::numeric
        END AS tiempo_total_minutos
   FROM ((((public.envios e
     JOIN public.ventas v ON ((e.venta_id = v.id)))
     LEFT JOIN public.clientes c ON ((v.cliente_id = c.id)))
     LEFT JOIN public.usuarios p ON ((e.piloto_id = p.id)))
     LEFT JOIN public.usuarios u ON ((v.usuario_id = u.id)));


ALTER VIEW public.vista_envios_completa OWNER TO marlonjimenez;

--
-- Name: vista_gastos_proximos; Type: VIEW; Schema: public; Owner: marlonjimenez
--

CREATE VIEW public.vista_gastos_proximos AS
 SELECT pg.id,
    pg.fecha_vencimiento,
    pg.fecha_pago,
    pg.monto_pagado,
    pg.estado,
    gf.nombre AS gasto_nombre,
    gf.monto AS monto_esperado,
    gf.proveedor,
    gf.dias_recordatorio,
    cg.nombre AS categoria,
    cg.icono,
    cg.color,
    (pg.fecha_vencimiento - CURRENT_DATE) AS dias_restantes,
        CASE
            WHEN ((pg.estado)::text = 'pagado'::text) THEN 'pagado'::text
            WHEN (pg.fecha_vencimiento < CURRENT_DATE) THEN 'vencido'::text
            WHEN (pg.fecha_vencimiento <= (CURRENT_DATE + gf.dias_recordatorio)) THEN 'por_vencer'::text
            ELSE 'pendiente'::text
        END AS estado_alerta
   FROM ((public.pagos_gastos pg
     JOIN public.gastos_fijos gf ON ((pg.gasto_fijo_id = gf.id)))
     JOIN public.categorias_gastos cg ON ((gf.categoria_id = cg.id)))
  WHERE (gf.activo = true)
  ORDER BY pg.fecha_vencimiento;


ALTER VIEW public.vista_gastos_proximos OWNER TO marlonjimenez;

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


ALTER VIEW public.vista_productos_mas_vendidos OWNER TO marlonjimenez;

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


ALTER VIEW public.vista_productos_por_vencer OWNER TO marlonjimenez;

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


ALTER VIEW public.vista_stock_bajo OWNER TO marlonjimenez;

--
-- Name: vista_ventas_diarias; Type: VIEW; Schema: public; Owner: marlonjimenez
--

CREATE VIEW public.vista_ventas_diarias AS
 SELECT date(fecha_venta) AS fecha,
    count(*) AS total_ventas,
    sum(total) AS monto_total,
    avg(total) AS ticket_promedio,
    sum(
        CASE
            WHEN ((metodo_pago)::text = 'efectivo'::text) THEN total
            ELSE (0)::numeric
        END) AS efectivo,
    sum(
        CASE
            WHEN ((metodo_pago)::text = 'tarjeta'::text) THEN total
            ELSE (0)::numeric
        END) AS tarjeta,
    sum(
        CASE
            WHEN ((metodo_pago)::text = 'credito'::text) THEN total
            ELSE (0)::numeric
        END) AS credito
   FROM public.ventas
  WHERE ((estado)::text = 'completada'::text)
  GROUP BY (date(fecha_venta))
  ORDER BY (date(fecha_venta)) DESC;


ALTER VIEW public.vista_ventas_diarias OWNER TO marlonjimenez;

--
-- Name: ajustes_recepcion id; Type: DEFAULT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.ajustes_recepcion ALTER COLUMN id SET DEFAULT nextval('public.ajustes_recepcion_id_seq'::regclass);


--
-- Name: autorizaciones_descuento id; Type: DEFAULT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.autorizaciones_descuento ALTER COLUMN id SET DEFAULT nextval('public.autorizaciones_descuento_id_seq'::regclass);


--
-- Name: categorias id; Type: DEFAULT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.categorias ALTER COLUMN id SET DEFAULT nextval('public.categorias_id_seq'::regclass);


--
-- Name: categorias_gastos id; Type: DEFAULT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.categorias_gastos ALTER COLUMN id SET DEFAULT nextval('public.categorias_gastos_id_seq'::regclass);


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
-- Name: cuentas_por_pagar id; Type: DEFAULT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.cuentas_por_pagar ALTER COLUMN id SET DEFAULT nextval('public.cuentas_por_pagar_id_seq'::regclass);


--
-- Name: descuentos_volumen id; Type: DEFAULT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.descuentos_volumen ALTER COLUMN id SET DEFAULT nextval('public.descuentos_volumen_id_seq'::regclass);


--
-- Name: detalle_cotizaciones id; Type: DEFAULT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.detalle_cotizaciones ALTER COLUMN id SET DEFAULT nextval('public.detalle_cotizaciones_id_seq'::regclass);


--
-- Name: detalle_devoluciones_clientes id; Type: DEFAULT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.detalle_devoluciones_clientes ALTER COLUMN id SET DEFAULT nextval('public.detalle_devoluciones_clientes_id_seq'::regclass);


--
-- Name: detalle_devoluciones_proveedores id; Type: DEFAULT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.detalle_devoluciones_proveedores ALTER COLUMN id SET DEFAULT nextval('public.detalle_devoluciones_proveedores_id_seq'::regclass);


--
-- Name: detalle_pedidos id; Type: DEFAULT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.detalle_pedidos ALTER COLUMN id SET DEFAULT nextval('public.detalle_pedidos_id_seq'::regclass);


--
-- Name: detalle_ventas id; Type: DEFAULT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.detalle_ventas ALTER COLUMN id SET DEFAULT nextval('public.detalle_ventas_id_seq'::regclass);


--
-- Name: devoluciones_clientes id; Type: DEFAULT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.devoluciones_clientes ALTER COLUMN id SET DEFAULT nextval('public.devoluciones_clientes_id_seq'::regclass);


--
-- Name: devoluciones_proveedores id; Type: DEFAULT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.devoluciones_proveedores ALTER COLUMN id SET DEFAULT nextval('public.devoluciones_proveedores_id_seq'::regclass);


--
-- Name: envios id; Type: DEFAULT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.envios ALTER COLUMN id SET DEFAULT nextval('public.envios_id_seq'::regclass);


--
-- Name: gastos_fijos id; Type: DEFAULT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.gastos_fijos ALTER COLUMN id SET DEFAULT nextval('public.gastos_fijos_id_seq'::regclass);


--
-- Name: historial_envios id; Type: DEFAULT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.historial_envios ALTER COLUMN id SET DEFAULT nextval('public.historial_envios_id_seq'::regclass);


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
-- Name: pagos_gastos id; Type: DEFAULT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.pagos_gastos ALTER COLUMN id SET DEFAULT nextval('public.pagos_gastos_id_seq'::regclass);


--
-- Name: pagos_proveedores id; Type: DEFAULT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.pagos_proveedores ALTER COLUMN id SET DEFAULT nextval('public.pagos_proveedores_id_seq'::regclass);


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
-- Data for Name: ajustes_recepcion; Type: TABLE DATA; Schema: public; Owner: marlonjimenez
--

COPY public.ajustes_recepcion (id, pedido_id, producto_id, cantidad_pedida, cantidad_recibida, diferencia, tipo_ajuste, motivo, usuario_id, created_at) FROM stdin;
1	25	7	4	3	-1	faltante	no vino el producto	3	2025-12-31 18:37:17.26919
2	27	5	2	1	-1	faltante	producto dañado	3	2026-01-10 20:11:10.224139
\.


--
-- Data for Name: autorizaciones_descuento; Type: TABLE DATA; Schema: public; Owner: marlonjimenez
--

COPY public.autorizaciones_descuento (id, venta_id, monto_descuento, porcentaje_descuento, motivo, solicitado_por, autorizado_por, estado, fecha_solicitud, fecha_respuesta, notas_autorizacion, created_at) FROM stdin;
1	\N	0.05	0.02	cliente estrella	3	3	aprobado	2025-12-30 14:33:55.860709	2025-12-30 14:46:11.048638	se aplica descuento	2025-12-30 14:33:55.860709
2	\N	0.05	0.02	cliente estrella	3	3	rechazado	2025-12-30 14:34:25.915444	2025-12-30 14:46:21.190299	no apilca	2025-12-30 14:34:25.915444
3	\N	100.00	49.75	pago	4	3	aprobado	2025-12-30 14:50:17.929771	2025-12-30 14:50:59.071165	si aplica	2025-12-30 14:50:17.929771
4	\N	20.00	2.00	descuento	4	3	aprobado	2025-12-30 15:34:53.332046	2025-12-30 15:35:12.660907	si	2025-12-30 15:34:53.332046
5	\N	200.00	16.67	cliente frecuente	4	3	aprobado	2025-12-30 15:43:15.294538	2025-12-30 15:43:36.876156	si	2025-12-30 15:43:15.294538
6	\N	600.00	50.00	cliente especial	4	3	aprobado	2025-12-30 16:03:15.346611	2025-12-30 16:04:34.432341	si	2025-12-30 16:03:15.346611
7	\N	100.00	33.33	sss	4	3	aprobado	2025-12-30 16:18:07.370876	2025-12-30 16:19:43.83359	sss	2025-12-30 16:18:07.370876
8	\N	100.00	33.33	frecuente	4	3	rechazado	2025-12-30 16:30:48.802323	2025-12-30 16:38:37.365221	ss	2025-12-30 16:30:48.802323
9	\N	40.00	13.33	sss	4	3	aprobado	2025-12-30 16:39:10.998187	2025-12-30 16:39:22.757555	sss	2025-12-30 16:39:10.998187
14	\N	2000.00	83.90	sisissis	4	3	aprobado	2025-12-30 17:22:29.487488	2025-12-30 17:24:33.093731	sdsdsd	2025-12-30 17:22:29.487488
13	\N	300.00	12.58	aiaia	4	3	rechazado	2025-12-30 17:16:02.890184	2025-12-30 19:35:44.182273		2025-12-30 17:16:02.890184
12	\N	300.00	12.58	sisis	4	3	rechazado	2025-12-30 17:14:40.930944	2025-12-30 19:35:46.344146		2025-12-30 17:14:40.930944
11	\N	100.00	33.33	sii	4	3	rechazado	2025-12-30 17:02:00.060085	2025-12-30 19:35:49.33634		2025-12-30 17:02:00.060085
10	\N	20.00	6.67	sisi	4	3	rechazado	2025-12-30 17:01:39.595386	2025-12-30 19:35:52.010788		2025-12-30 17:01:39.595386
15	\N	500.00	12.50	cliente	4	3	aprobado	2025-12-30 19:34:46.356749	2025-12-30 19:35:57.747991		2025-12-30 19:34:46.356749
16	\N	50.00	8.29	cliente	4	3	aprobado	2025-12-30 19:55:14.29295	2025-12-30 19:56:05.359917		2025-12-30 19:55:14.29295
17	\N	50.00	8.29	mejor	4	3	aprobado	2025-12-30 20:07:50.127367	2025-12-30 20:08:02.698616		2025-12-30 20:07:50.127367
18	\N	300.00	21.64	cliente frecuente	4	3	aprobado	2025-12-30 21:09:33.075473	2025-12-30 21:12:09.826543	si aplica	2025-12-30 21:09:33.075473
19	\N	60.00	29.85	cliente	4	3	rechazado	2025-12-30 21:13:23.946053	2025-12-30 21:13:30.997501		2025-12-30 21:13:23.946053
20	\N	12.00	0.29	cliente frecuente	3	3	aprobado	2026-01-10 19:57:54.818724	2026-01-10 19:58:38.502396		2026-01-10 19:57:54.818724
\.


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
-- Data for Name: categorias_gastos; Type: TABLE DATA; Schema: public; Owner: marlonjimenez
--

COPY public.categorias_gastos (id, nombre, descripcion, icono, color, activo, created_at) FROM stdin;
1	Servicios Públicos	Luz, agua, gas	flash_on	warning	t	2025-12-30 21:05:23.872632
2	Alquiler	Renta de local o bodega	home	primary	t	2025-12-30 21:05:23.872632
3	Internet y Telefonía	Servicios de comunicación	wifi	info	t	2025-12-30 21:05:23.872632
4	Impuestos	Obligaciones fiscales	account_balance	error	t	2025-12-30 21:05:23.872632
5	Salarios	Nómina de empleados	people	success	t	2025-12-30 21:05:23.872632
6	Mantenimiento	Mantenimiento de instalaciones	build	default	t	2025-12-30 21:05:23.872632
7	Seguros	Pólizas de seguros	security	secondary	t	2025-12-30 21:05:23.872632
8	Otros	Gastos diversos	more_horiz	default	t	2025-12-30 21:05:23.872632
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
-- Data for Name: cuentas_por_pagar; Type: TABLE DATA; Schema: public; Owner: marlonjimenez
--

COPY public.cuentas_por_pagar (id, proveedor_id, pedido_id, folio, fecha_emision, fecha_vencimiento, monto_total, monto_pagado, saldo_pendiente, estado, dias_credito, concepto, notas, usuario_id, created_at, updated_at) FROM stdin;
1	1	16	CPP-000001	2025-12-29	2026-01-28	297.00	297.00	0.00	pagado	30	Pedido a crédito PED-000011 - 1 productos	\N	3	2025-12-29 14:51:48.876991	2025-12-29 14:58:00.372836
2	1	18	CPP-000002	2025-12-29	2026-01-28	400.00	100.00	300.00	parcial	30	Pedido a crédito PED-000013 - 1 productos	\N	3	2025-12-29 15:00:15.850826	2025-12-29 15:01:03.782474
4	1	21	CPP-000004	2025-12-29	2026-01-29	1600.00	0.00	1600.00	pendiente	30	Pedido a crédito PED-000016 - 1 productos	\N	3	2025-12-29 22:39:25.161711	2025-12-29 22:39:25.161711
3	1	19	CPP-000003	2025-12-29	2025-12-30	200.00	200.00	0.00	pagado	1	Pedido a crédito PED-000014 - 1 productos	\N	3	2025-12-29 17:09:26.114777	2025-12-29 22:41:24.380111
6	1	23	CPP-000006	2025-12-30	2026-01-29	1000.00	0.00	1000.00	pendiente	30	Pedido a crédito PED-000018 - 1 productos	\N	3	2025-12-30 15:26:51.150376	2025-12-30 15:26:51.150376
8	1	27	CPP-000008	2026-01-10	2026-01-26	1600.00	0.00	1600.00	pendiente	15	Pedido a crédito PED-000022 - 1 productos	\N	3	2026-01-10 20:10:21.55676	2026-01-10 20:10:21.55676
5	1	22	CPP-000005	2025-12-29	2025-12-31	200.00	200.00	0.00	pagado	1	Pedido a crédito PED-000017 - 1 productos	\N	3	2025-12-29 22:39:56.993894	2026-01-10 20:11:53.107009
7	1	26	CPP-000007	2026-01-02	2026-02-01	20000.00	200.00	19800.00	parcial	30	Pedido a crédito PED-000021 - 1 productos	\N	3	2026-01-02 14:20:30.522012	2026-01-10 20:12:34.557341
\.


--
-- Data for Name: descuentos_volumen; Type: TABLE DATA; Schema: public; Owner: marlonjimenez
--

COPY public.descuentos_volumen (id, producto_id, cantidad_minima, porcentaje_descuento, activo, fecha_inicio, fecha_fin, created_at, updated_at) FROM stdin;
3	1	50	15.00	t	\N	\N	2025-12-29 16:28:32.067108	2025-12-29 16:28:32.067108
5	4	100	6.00	t	\N	\N	2025-12-29 18:24:52.43168	2025-12-29 18:24:52.43168
6	6	5	1.49	t	\N	\N	2025-12-29 19:52:04.268682	2025-12-29 19:52:04.268682
7	6	10	2.49	t	\N	\N	2025-12-29 19:52:21.519343	2025-12-29 19:52:21.519343
8	7	5	0.67	t	\N	\N	2025-12-29 20:36:00.252934	2025-12-29 20:36:00.252934
9	7	20	1.67	t	\N	\N	2025-12-29 20:36:13.569975	2025-12-29 20:36:13.569975
10	7	200	3.33	t	\N	\N	2025-12-29 22:43:09.128847	2025-12-29 22:43:09.128847
1	1	10	5.00	t	\N	\N	2025-12-29 16:28:32.067108	2026-01-10 19:56:00.182954
2	1	20	10.00	t	\N	\N	2025-12-29 16:28:32.067108	2026-01-10 19:56:02.632605
\.


--
-- Data for Name: detalle_cotizaciones; Type: TABLE DATA; Schema: public; Owner: marlonjimenez
--

COPY public.detalle_cotizaciones (id, cotizacion_id, producto_id, cantidad, precio_unitario, descuento, subtotal, created_at) FROM stdin;
\.


--
-- Data for Name: detalle_devoluciones_clientes; Type: TABLE DATA; Schema: public; Owner: marlonjimenez
--

COPY public.detalle_devoluciones_clientes (id, devolucion_id, producto_id, cantidad, precio_unitario, subtotal, afecta_inventario, motivo_producto, producto_cambio_id, cantidad_cambio, precio_cambio, created_at) FROM stdin;
1	1	5	1	1000.00	1000.00	t	\N	\N	\N	\N	2025-12-31 20:42:33.696229
2	1	4	1	200.00	200.00	t	\N	\N	\N	\N	2025-12-31 20:42:33.696229
3	2	5	1	1000.00	1000.00	t	cambio	6	1	201.00	2025-12-31 20:43:53.745143
4	2	4	1	200.00	200.00	t	cambio	7	1	300.00	2025-12-31 20:43:53.745143
5	3	5	1	1000.00	1000.00	t	mal envio	\N	\N	\N	2026-01-10 20:06:57.722518
6	3	4	2	200.00	400.00	t	mal envio	\N	\N	\N	2026-01-10 20:06:57.722518
7	4	5	1	1000.00	1000.00	t	CAMBIO	7	3	300.00	2026-01-10 20:08:43.608794
8	4	4	1	200.00	200.00	t	CAMBIO	6	1	201.00	2026-01-10 20:08:43.608794
\.


--
-- Data for Name: detalle_devoluciones_proveedores; Type: TABLE DATA; Schema: public; Owner: marlonjimenez
--

COPY public.detalle_devoluciones_proveedores (id, devolucion_id, producto_id, cantidad, precio_unitario, subtotal, afecta_inventario, motivo_producto, producto_cambio_id, cantidad_cambio, precio_cambio, created_at) FROM stdin;
1	1	7	1	200.00	200.00	t	Defectuoso	\N	\N	\N	2025-12-31 20:50:52.501911
2	2	7	3	200.00	600.00	t	devolucion	\N	\N	\N	2026-01-10 20:15:12.542885
3	3	7	1	200.00	200.00	t	Defec	5	1	800.00	2026-01-10 20:15:54.776862
\.


--
-- Data for Name: detalle_pedidos; Type: TABLE DATA; Schema: public; Owner: marlonjimenez
--

COPY public.detalle_pedidos (id, pedido_id, producto_id, cantidad, precio_unitario, descuento, subtotal, created_at) FROM stdin;
3	3	7	2	200.00	0.00	400.00	2025-12-26 17:03:13.515205
4	4	7	6	200.00	0.00	1200.00	2025-12-26 17:15:29.540296
5	5	7	4	200.00	0.00	800.00	2025-12-26 19:18:40.623583
6	6	7	5	200.00	0.00	1000.00	2025-12-27 21:54:09.445248
7	7	7	1	200.00	0.00	200.00	2025-12-28 21:11:28.732744
8	8	7	2	200.00	0.00	400.00	2025-12-29 13:11:53.620703
9	9	7	2	200.00	0.00	400.00	2025-12-29 13:16:52.216679
10	10	6	3	99.00	0.00	297.00	2025-12-29 13:21:43.520271
11	11	5	2	800.00	0.00	1600.00	2025-12-29 14:31:56.999958
12	12	7	2	200.00	0.00	400.00	2025-12-29 14:36:30.213892
16	16	6	3	99.00	0.00	297.00	2025-12-29 14:51:48.876991
17	17	7	1	200.00	0.00	200.00	2025-12-29 14:52:28.223921
18	18	4	4	100.00	0.00	400.00	2025-12-29 15:00:15.850826
19	19	4	2	100.00	0.00	200.00	2025-12-29 17:09:26.114777
20	20	7	40	200.00	0.00	8000.00	2025-12-29 20:33:53.725606
21	21	5	2	800.00	0.00	1600.00	2025-12-29 22:39:25.161711
22	22	7	1	200.00	0.00	200.00	2025-12-29 22:39:56.993894
23	23	7	5	200.00	0.00	1000.00	2025-12-30 15:26:51.150376
24	24	7	50	200.00	0.00	10000.00	2025-12-30 15:41:32.138158
25	24	5	50	800.00	0.00	40000.00	2025-12-30 15:41:32.138158
26	24	6	50	99.00	0.00	4950.00	2025-12-30 15:41:32.138158
27	24	4	50	100.00	0.00	5000.00	2025-12-30 15:41:32.138158
28	25	7	4	200.00	0.00	800.00	2025-12-31 18:26:56.254764
29	26	7	100	200.00	0.00	20000.00	2026-01-02 14:20:30.522012
30	27	5	2	800.00	0.00	1600.00	2026-01-10 20:10:21.55676
\.


--
-- Data for Name: detalle_ventas; Type: TABLE DATA; Schema: public; Owner: marlonjimenez
--

COPY public.detalle_ventas (id, venta_id, producto_id, cantidad, precio_unitario, descuento, subtotal, created_at, descuento_aplicado, porcentaje_descuento, precio_con_descuento) FROM stdin;
1	4	5	1	1000.00	0.00	1000.00	2025-12-23 21:45:03.695195	0.00	0.00	\N
2	4	4	2	200.00	0.00	400.00	2025-12-23 21:45:03.695195	0.00	0.00	\N
3	5	5	2	1000.00	0.00	2000.00	2025-12-23 21:49:57.240517	0.00	0.00	\N
4	5	4	1	200.00	0.00	200.00	2025-12-23 21:49:57.240517	0.00	0.00	\N
5	6	4	3	200.00	0.00	600.00	2025-12-23 21:50:55.125866	0.00	0.00	\N
6	6	5	2	1000.00	0.00	2000.00	2025-12-23 21:50:55.125866	0.00	0.00	\N
7	7	5	1	1000.00	0.00	1000.00	2025-12-23 21:52:06.853466	0.00	0.00	\N
8	8	6	2	201.00	0.00	402.00	2025-12-23 22:17:14.221569	0.00	0.00	\N
9	9	7	2	300.00	0.00	600.00	2025-12-24 22:57:07.603787	0.00	0.00	\N
10	9	6	1	201.00	0.00	201.00	2025-12-24 22:57:07.603787	0.00	0.00	\N
11	10	7	1	300.00	0.00	300.00	2025-12-26 16:09:36.986092	0.00	0.00	\N
15	13	7	70	300.00	0.00	21000.00	2025-12-28 20:14:16.201409	0.00	0.00	\N
16	14	7	2	300.00	0.00	600.00	2025-12-28 20:24:11.140268	0.00	0.00	\N
17	15	7	10	300.00	0.00	3000.00	2025-12-29 20:35:28.737917	0.00	0.00	\N
18	16	7	25	300.00	0.00	7500.00	2025-12-29 22:44:46.809115	0.00	0.00	\N
19	17	7	1	300.00	0.00	300.00	2025-12-30 16:39:36.276785	0.00	0.00	\N
20	18	7	8	300.00	0.00	2400.00	2025-12-30 17:24:49.083544	0.00	0.00	\N
21	19	5	4	1000.00	0.00	4000.00	2025-12-30 19:36:13.353302	0.00	0.00	\N
22	20	6	3	201.00	0.00	603.00	2025-12-30 19:56:16.677444	0.00	0.00	\N
23	21	6	3	201.00	0.00	603.00	2025-12-30 20:08:18.458251	0.00	0.00	\N
24	22	6	7	201.00	0.00	1407.00	2025-12-30 21:12:21.56205	0.00	0.00	\N
25	23	6	1	201.00	0.00	201.00	2025-12-30 21:13:54.404932	0.00	0.00	\N
26	24	6	3	201.00	0.00	603.00	2025-12-31 00:55:41.565315	0.00	0.00	\N
27	25	6	1	201.00	0.00	201.00	2025-12-31 01:22:42.936512	0.00	0.00	\N
28	26	6	1	201.00	0.00	201.00	2025-12-31 01:25:54.464002	0.00	0.00	\N
29	27	6	5	201.00	0.00	1005.00	2025-12-31 16:45:00.20551	0.00	0.00	\N
30	28	6	1	201.00	0.00	201.00	2025-12-31 16:54:25.553631	0.00	0.00	\N
31	29	6	1	201.00	0.00	201.00	2025-12-31 18:34:56.762303	0.00	0.00	\N
32	30	7	1	300.00	0.00	300.00	2026-01-10 20:00:03.637033	0.00	0.00	\N
\.


--
-- Data for Name: devoluciones_clientes; Type: TABLE DATA; Schema: public; Owner: marlonjimenez
--

COPY public.devoluciones_clientes (id, folio, venta_id, cliente_id, tipo, fecha_devolucion, monto_devuelto, estado, motivo, notas, usuario_id, created_at) FROM stdin;
1	DVC-000001	4	\N	devolucion	2025-12-31 20:42:33.696229	1200.00	procesada	mal ingreso	\N	3	2025-12-31 20:42:33.696229
2	DVC-000002	5	\N	cambio	2025-12-31 20:43:53.745143	699.00	procesada	cambios	\N	3	2025-12-31 20:43:53.745143
3	DVC-000003	4	\N	devolucion	2026-01-10 20:06:57.722518	1400.00	procesada	mal envio	\N	3	2026-01-10 20:06:57.722518
4	DVC-000004	5	\N	cambio	2026-01-10 20:08:43.608794	99.00	procesada	MAL ENVIO	\N	3	2026-01-10 20:08:43.608794
\.


--
-- Data for Name: devoluciones_proveedores; Type: TABLE DATA; Schema: public; Owner: marlonjimenez
--

COPY public.devoluciones_proveedores (id, folio, pedido_id, proveedor_id, tipo, fecha_devolucion, monto_devuelto, estado, motivo, notas, usuario_id, created_at) FROM stdin;
1	DVP-000001	3	1	devolucion	2025-12-31 20:50:52.501911	200.00	aprobada	ejemplo	\N	3	2025-12-31 20:50:52.501911
3	DVP-000003	26	1	cambio	2026-01-10 20:15:54.776862	-600.00	aprobada	mal producto	\N	3	2026-01-10 20:15:54.776862
2	DVP-000002	26	1	devolucion	2026-01-10 20:15:12.542885	600.00	aprobada	porque si	\N	3	2026-01-10 20:15:12.542885
\.


--
-- Data for Name: envios; Type: TABLE DATA; Schema: public; Owner: marlonjimenez
--

COPY public.envios (id, venta_id, piloto_id, direccion_entrega, referencia_direccion, telefono_contacto, nombre_contacto, estado, fecha_pedido, fecha_asignacion, fecha_cargado, fecha_en_ruta, fecha_entrega, costo_envio, distancia_km, tiempo_estimado_minutos, notas_cliente, notas_piloto, motivo_cancelacion, requiere_cobro, monto_cobrado, foto_entrega, firma_cliente, created_at, updated_at) FROM stdin;
1	26	6	25 Avenida 4-00 casa A11 condominio Luminela Zona 10 San Miguel Petapa	25 Avenida 4-00 casa A11 condominio Luminela Zona 10 San Miguel Petapa	2323232	dssssss	entregado	2025-12-31 01:25:54.483319	\N	2025-12-31 01:32:17.708554	2025-12-31 01:32:29.010188	2025-12-31 01:32:50.400267	0.00	\N	\N	kjhkjhkjh	\N	\N	f	\N	\N	tiendea	2025-12-31 01:25:54.483319	2025-12-31 01:32:50.400267
2	27	6	25 Avenida 4-00 casa A11 condominio Luminela Zona 10 San Miguel Petapa	25 Avenida 4-00 casa A11 condominio Luminela Zona 10 San Miguel Petapa	798789798	admin@tienda.com	entregado	2025-12-31 16:45:00.224487	\N	2025-12-31 16:48:56.573757	2025-12-31 16:49:00.145476	2025-12-31 16:49:20.799395	0.00	\N	\N	4564	\N	\N	f	\N	\N	deuño	2025-12-31 16:45:00.224487	2025-12-31 16:49:20.799395
3	28	6	25 Avenida 4-00 casa A11 condominio Luminela Zona 10 San Miguel Petapa	25 Avenida 4-00 casa A11 condominio Luminela Zona 10 San Miguel Petapa	686768	ghgjgjhjh	entregado	2025-12-31 16:54:25.577571	\N	2025-12-31 16:54:48.572334	2025-12-31 16:54:51.522363	2025-12-31 16:55:01.307506	0.00	\N	\N	\N		\N	f	\N	\N	fghfghfhgf	2025-12-31 16:54:25.577571	2025-12-31 16:55:01.307506
4	29	6	25 Avenida 4-00 casa A11 condominio Luminela Zona 10 San Miguel Petapa	25 Avenida 4-00 casa A11 condominio Luminela Zona 10 San Miguel Petapa	4324234	Marlon	entregado	2025-12-31 18:34:56.779977	\N	2025-12-31 18:35:46.761961	2025-12-31 18:35:54.973177	2025-12-31 18:36:12.159632	0.00	\N	\N	\N		\N	f	\N	\N	Tendero	2025-12-31 18:34:56.779977	2025-12-31 18:36:12.159632
5	30	6	25 Avenida 4-00 casa A11 condominio Luminela Zona 10 San Miguel Petapa	25 Avenida 4-00 casa A11 condominio Luminela Zona 10 San Miguel Petapa	35230463	Marlon	entregado	2026-01-10 20:00:03.660316	\N	2026-01-10 20:02:29.093287	2026-01-10 20:02:41.83833	2026-01-10 20:03:17.680237	0.00	\N	\N	\N		\N	f	\N	\N	Juan Perez	2026-01-10 20:00:03.660316	2026-01-10 20:03:17.680237
\.


--
-- Data for Name: gastos_fijos; Type: TABLE DATA; Schema: public; Owner: marlonjimenez
--

COPY public.gastos_fijos (id, nombre, categoria_id, monto, frecuencia, dia_vencimiento, proveedor, numero_cuenta, notas, dias_recordatorio, activo, created_at, updated_at) FROM stdin;
1	Luz	6	300.00	mensual	6	EEGSA	3242342323	pago fijo luz	3	t	2025-12-30 21:25:32.761999	2025-12-30 21:25:32.761999
3	Alquiler Local	2	6000.00	mensual	14	Jonathan	3423423423		3	t	2026-01-10 19:46:37.931442	2026-01-10 20:19:48.577741
\.


--
-- Data for Name: historial_envios; Type: TABLE DATA; Schema: public; Owner: marlonjimenez
--

COPY public.historial_envios (id, envio_id, estado_anterior, estado_nuevo, usuario_id, comentario, latitud, longitud, created_at) FROM stdin;
2	1	asignado	preparando	\N	\N	\N	\N	2025-12-31 01:31:59.696693
3	1	asignado	preparando	6	\N	\N	\N	2025-12-31 01:31:59.701042
4	1	preparando	cargado	\N	\N	\N	\N	2025-12-31 01:32:17.708554
5	1	preparando	cargado	6	\N	\N	\N	2025-12-31 01:32:17.70999
6	1	cargado	en_ruta	\N	\N	\N	\N	2025-12-31 01:32:29.010188
7	1	cargado	en_ruta	6	\N	\N	\N	2025-12-31 01:32:29.011678
8	1	en_ruta	entregado	\N	\N	\N	\N	2025-12-31 01:32:50.400267
9	2	asignado	preparando	\N	\N	\N	\N	2025-12-31 16:48:52.431759
10	2	asignado	preparando	3	\N	\N	\N	2025-12-31 16:48:52.435522
11	2	preparando	cargado	\N	\N	\N	\N	2025-12-31 16:48:56.573757
12	2	preparando	cargado	3	\N	\N	\N	2025-12-31 16:48:56.575047
13	2	cargado	en_ruta	\N	\N	\N	\N	2025-12-31 16:49:00.145476
14	2	cargado	en_ruta	3	\N	\N	\N	2025-12-31 16:49:00.146683
15	2	en_ruta	entregado	\N	\N	\N	\N	2025-12-31 16:49:20.799395
16	3	asignado	preparando	\N	\N	\N	\N	2025-12-31 16:54:44.848659
17	3	asignado	preparando	3	\N	\N	\N	2025-12-31 16:54:44.850166
18	3	preparando	cargado	\N	\N	\N	\N	2025-12-31 16:54:48.572334
19	3	preparando	cargado	3	\N	\N	\N	2025-12-31 16:54:48.573487
20	3	cargado	en_ruta	\N	\N	\N	\N	2025-12-31 16:54:51.522363
21	3	cargado	en_ruta	3	\N	\N	\N	2025-12-31 16:54:51.523206
22	3	en_ruta	entregado	\N	\N	\N	\N	2025-12-31 16:55:01.307506
23	4	asignado	preparando	\N	\N	\N	\N	2025-12-31 18:35:38.785203
24	4	asignado	preparando	3	\N	\N	\N	2025-12-31 18:35:38.789967
25	4	preparando	cargado	\N	\N	\N	\N	2025-12-31 18:35:46.761961
26	4	preparando	cargado	3	\N	\N	\N	2025-12-31 18:35:46.763401
27	4	cargado	en_ruta	\N	\N	\N	\N	2025-12-31 18:35:54.973177
28	4	cargado	en_ruta	3	\N	\N	\N	2025-12-31 18:35:54.975116
29	4	en_ruta	entregado	\N	\N	\N	\N	2025-12-31 18:36:12.159632
30	5	asignado	preparando	\N	\N	\N	\N	2026-01-10 20:02:15.562883
31	5	asignado	preparando	6	\N	\N	\N	2026-01-10 20:02:15.568881
32	5	preparando	cargado	\N	\N	\N	\N	2026-01-10 20:02:29.093287
33	5	preparando	cargado	6	\N	\N	\N	2026-01-10 20:02:29.094676
34	5	cargado	en_ruta	\N	\N	\N	\N	2026-01-10 20:02:41.83833
35	5	cargado	en_ruta	6	\N	\N	\N	2026-01-10 20:02:41.839631
36	5	en_ruta	entregado	\N	\N	\N	\N	2026-01-10 20:03:17.680237
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
14	7	entrada	5	\N	\N	Pedido recibido	3	Pedido PED-000004	2025-12-27 22:00:37.974242
16	7	salida	70	\N	\N	Venta	3	Venta VTA-000008	2025-12-28 20:14:16.201409
17	7	salida	2	\N	\N	Venta	3	Venta VTA-000009	2025-12-28 20:24:11.140268
18	7	entrada	2	\N	\N	Pedido recibido	3	Pedido PED-000006	2025-12-29 13:12:15.115207
19	7	entrada	1	\N	\N	Pedido recibido	3	Pedido PED-000012	2025-12-29 14:59:43.275503
20	6	entrada	3	\N	\N	Pedido recibido	3	Pedido PED-000011	2025-12-29 14:59:46.939782
21	7	entrada	2	\N	\N	Pedido recibido	3	Pedido PED-000010	2025-12-29 14:59:50.654109
22	5	entrada	2	\N	\N	Pedido recibido	3	Pedido PED-000009	2025-12-29 14:59:54.39968
23	6	entrada	3	\N	\N	Pedido recibido	3	Pedido PED-000008	2025-12-29 14:59:57.548637
24	7	entrada	2	\N	\N	Pedido recibido	3	Pedido PED-000007	2025-12-29 15:00:01.402797
25	4	entrada	2	\N	\N	Pedido recibido	3	Pedido PED-000014	2025-12-29 20:32:53.785951
26	4	entrada	4	\N	\N	Pedido recibido	3	Pedido PED-000013	2025-12-29 20:32:59.285169
27	7	entrada	40	\N	\N	Pedido recibido	3	Pedido PED-000015	2025-12-29 20:33:58.5755
28	7	salida	10	\N	\N	Venta	3	Venta VTA-000010	2025-12-29 20:35:28.737917
29	7	salida	25	\N	\N	Venta	3	Venta VTA-000011	2025-12-29 22:44:46.809115
30	7	entrada	5	\N	\N	Pedido recibido	3	Pedido PED-000018	2025-12-30 15:37:40.921777
31	7	entrada	1	\N	\N	Pedido recibido	3	Pedido PED-000017	2025-12-30 15:37:44.678895
32	5	entrada	2	\N	\N	Pedido recibido	3	Pedido PED-000016	2025-12-30 15:37:48.030628
33	7	entrada	50	\N	\N	Pedido recibido	3	Pedido PED-000019	2025-12-30 15:41:37.511785
34	5	entrada	50	\N	\N	Pedido recibido	3	Pedido PED-000019	2025-12-30 15:41:37.511785
35	6	entrada	50	\N	\N	Pedido recibido	3	Pedido PED-000019	2025-12-30 15:41:37.511785
36	4	entrada	50	\N	\N	Pedido recibido	3	Pedido PED-000019	2025-12-30 15:41:37.511785
37	7	salida	1	\N	\N	Venta	4	Venta VTA-000012	2025-12-30 16:39:36.276785
38	7	salida	8	\N	\N	Venta	4	Venta VTA-000013	2025-12-30 17:24:49.083544
39	5	salida	4	\N	\N	Venta	4	Venta VTA-000014	2025-12-30 19:36:13.353302
40	6	salida	3	\N	\N	Venta	4	Venta VTA-000015	2025-12-30 19:56:16.677444
41	6	salida	3	\N	\N	Venta	4	Venta VTA-000016	2025-12-30 20:08:18.458251
42	6	salida	7	\N	\N	Venta	4	Venta VTA-000017	2025-12-30 21:12:21.56205
43	6	salida	1	\N	\N	Venta	4	Venta VTA-000018	2025-12-30 21:13:54.404932
44	6	salida	3	\N	\N	Venta	3	Venta VTA-000019	2025-12-31 00:55:41.565315
45	6	salida	1	\N	\N	Venta	3	Venta VTA-000020	2025-12-31 01:22:42.936512
46	6	salida	1	\N	\N	Venta	3	Venta VTA-000021	2025-12-31 01:25:54.464002
47	6	salida	5	\N	\N	Venta	3	Venta VTA-000022	2025-12-31 16:45:00.20551
48	6	salida	1	\N	\N	Venta	3	Venta VTA-000023	2025-12-31 16:54:25.553631
49	6	salida	1	\N	\N	Venta	3	Venta VTA-000024	2025-12-31 18:34:56.762303
50	7	entrada	3	\N	\N	Pedido recibido con ajuste (-1)	3	Pedido PED-000020	2025-12-31 18:37:17.26919
51	5	entrada	1	\N	\N	Devolución de cliente - devolucion	3	DVC-000001	2025-12-31 20:42:33.696229
52	4	entrada	1	\N	\N	Devolución de cliente - devolucion	3	DVC-000001	2025-12-31 20:42:33.696229
53	5	entrada	1	\N	\N	Devolución de cliente - cambio	3	DVC-000002	2025-12-31 20:43:53.745143
54	6	salida	1	\N	\N	Cambio entregado a cliente	3	DVC-000002	2025-12-31 20:43:53.745143
55	4	entrada	1	\N	\N	Devolución de cliente - cambio	3	DVC-000002	2025-12-31 20:43:53.745143
56	7	salida	1	\N	\N	Cambio entregado a cliente	3	DVC-000002	2025-12-31 20:43:53.745143
57	7	salida	1	\N	\N	Devolución a proveedor - devolucion	3	DVP-000001	2025-12-31 20:50:52.501911
58	7	entrada	100	\N	\N	Pedido recibido	3	Pedido PED-000021	2026-01-02 14:20:43.350893
59	7	salida	1	\N	\N	Venta	3	Venta VTA-000025	2026-01-10 20:00:03.637033
60	5	entrada	1	\N	\N	Devolución de cliente - devolucion	3	DVC-000003	2026-01-10 20:06:57.722518
61	4	entrada	2	\N	\N	Devolución de cliente - devolucion	3	DVC-000003	2026-01-10 20:06:57.722518
62	5	entrada	1	\N	\N	Devolución de cliente - cambio	3	DVC-000004	2026-01-10 20:08:43.608794
63	7	salida	3	\N	\N	Cambio entregado a cliente	3	DVC-000004	2026-01-10 20:08:43.608794
64	4	entrada	1	\N	\N	Devolución de cliente - cambio	3	DVC-000004	2026-01-10 20:08:43.608794
65	6	salida	1	\N	\N	Cambio entregado a cliente	3	DVC-000004	2026-01-10 20:08:43.608794
66	5	entrada	1	\N	\N	Pedido recibido con ajuste (-1)	3	Pedido PED-000022	2026-01-10 20:11:10.224139
67	7	salida	3	\N	\N	Devolución a proveedor - devolucion	3	DVP-000002	2026-01-10 20:15:12.542885
68	7	salida	1	\N	\N	Devolución a proveedor - cambio	3	DVP-000003	2026-01-10 20:15:54.776862
69	5	entrada	1	\N	\N	Cambio recibido de proveedor	3	DVP-000003	2026-01-10 20:15:54.776862
\.


--
-- Data for Name: notificaciones; Type: TABLE DATA; Schema: public; Owner: marlonjimenez
--

COPY public.notificaciones (id, tipo, titulo, mensaje, prioridad, leida, datos, fecha, fecha_leida) FROM stdin;
1	stock_negativo	Stock Insuficiente en Venta	El producto "Coca cola chowi" se vendió con stock insuficiente. Stock: 63, Vendido: 70, Faltante: 7	alta	f	{"faltante": 7, "producto_id": 7, "venta_folio": "VTA-000008", "stock_actual": 63, "producto_nombre": "Coca cola chowi", "cantidad_vendida": 70}	2025-12-28 20:14:16.201409	\N
2	stock_negativo	Stock Insuficiente en Venta	El producto "Coca cola chowi" se vendió con stock insuficiente. Stock: -7, Vendido: 2, Faltante: 9	alta	f	{"faltante": 9, "producto_id": 7, "venta_folio": "VTA-000009", "stock_actual": -7, "producto_nombre": "Coca cola chowi", "cantidad_vendida": 2}	2025-12-28 20:24:11.140268	\N
\.


--
-- Data for Name: pagos_gastos; Type: TABLE DATA; Schema: public; Owner: marlonjimenez
--

COPY public.pagos_gastos (id, gasto_fijo_id, fecha_vencimiento, fecha_pago, monto_pagado, metodo_pago, referencia, estado, notas, usuario_id, created_at, updated_at) FROM stdin;
1	1	2026-01-05	\N	300.00	\N	\N	pendiente	\N	\N	2025-12-30 21:25:32.765161	2025-12-30 21:25:32.765161
3	1	2026-02-05	\N	300.00	\N	\N	pendiente	\N	\N	2026-01-10 19:46:37.935638	2026-01-10 19:46:37.935638
5	3	2026-01-15	\N	6000.00	\N	\N	pendiente	\N	\N	2026-01-10 19:46:37.935638	2026-01-10 19:46:37.935638
\.


--
-- Data for Name: pagos_proveedores; Type: TABLE DATA; Schema: public; Owner: marlonjimenez
--

COPY public.pagos_proveedores (id, cuenta_por_pagar_id, fecha_pago, monto, metodo_pago, referencia, notas, usuario_id, created_at) FROM stdin;
1	1	2025-12-29 14:58:00.372836	297.00	efectivo	12313		3	2025-12-29 14:58:00.372836
2	2	2025-12-29 15:01:03.782474	100.00	efectivo			3	2025-12-29 15:01:03.782474
3	3	2025-12-29 22:41:24.380111	200.00	efectivo			3	2025-12-29 22:41:24.380111
4	5	2026-01-10 20:11:53.107009	200.00	efectivo			3	2026-01-10 20:11:53.107009
5	7	2026-01-10 20:12:34.557341	200.00	efectivo			3	2026-01-10 20:12:34.557341
\.


--
-- Data for Name: pedidos; Type: TABLE DATA; Schema: public; Owner: marlonjimenez
--

COPY public.pedidos (id, folio, cliente_id, vendedor_id, fecha_pedido, fecha_entrega_estimada, fecha_entrega_real, subtotal, descuento, iva, total, estado, ubicacion_latitud, ubicacion_longitud, direccion_entrega, venta_id, notas, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: pedidos_proveedores; Type: TABLE DATA; Schema: public; Owner: marlonjimenez
--

COPY public.pedidos_proveedores (id, folio, proveedor_id, usuario_id, fecha_pedido, fecha_recepcion, total, estado, notas, created_at, updated_at, forma_pago, dias_credito, tiene_ajustes) FROM stdin;
3	PED-000001	1	3	2025-12-26 17:03:13.515205	2025-12-26 17:14:59.957043	400.00	recibido	entrega viernes 3	2025-12-26 17:03:13.515205	2025-12-26 17:03:13.515205	contado	0	f
4	PED-000002	1	3	2025-12-26 17:15:29.540296	\N	1200.00	cancelado		2025-12-26 17:15:29.540296	2025-12-26 17:15:29.540296	contado	0	f
5	PED-000003	1	3	2025-12-26 19:18:40.623583	2025-12-26 19:19:43.570875	800.00	recibido		2025-12-26 19:18:40.623583	2025-12-26 19:18:40.623583	contado	0	f
6	PED-000004	1	3	2025-12-27 21:54:09.445248	2025-12-27 22:00:37.974242	1000.00	recibido		2025-12-27 21:54:09.445248	2025-12-27 21:54:09.445248	contado	0	f
7	PED-000005	1	3	2025-12-28 21:11:28.732744	\N	200.00	cancelado		2025-12-28 21:11:28.732744	2025-12-28 21:11:28.732744	contado	0	f
8	PED-000006	1	3	2025-12-29 13:11:53.620703	2025-12-29 13:12:15.115207	400.00	recibido		2025-12-29 13:11:53.620703	2025-12-29 13:11:53.620703	contado	0	f
17	PED-000012	1	3	2025-12-29 14:52:28.223921	2025-12-29 14:59:43.275503	200.00	recibido		2025-12-29 14:52:28.223921	2025-12-29 14:52:28.223921	contado	0	f
16	PED-000011	1	3	2025-12-29 14:51:48.876991	2025-12-29 14:59:46.939782	297.00	recibido		2025-12-29 14:51:48.876991	2025-12-29 14:51:48.876991	credito	30	f
12	PED-000010	1	3	2025-12-29 14:36:30.213892	2025-12-29 14:59:50.654109	400.00	recibido		2025-12-29 14:36:30.213892	2025-12-29 14:36:30.213892	contado	0	f
11	PED-000009	1	3	2025-12-29 14:31:56.999958	2025-12-29 14:59:54.39968	1600.00	recibido		2025-12-29 14:31:56.999958	2025-12-29 14:31:56.999958	contado	0	f
10	PED-000008	1	3	2025-12-29 13:21:43.520271	2025-12-29 14:59:57.548637	297.00	recibido		2025-12-29 13:21:43.520271	2025-12-29 13:21:43.520271	contado	0	f
9	PED-000007	1	3	2025-12-29 13:16:52.216679	2025-12-29 15:00:01.402797	400.00	recibido		2025-12-29 13:16:52.216679	2025-12-29 13:16:52.216679	contado	0	f
19	PED-000014	1	3	2025-12-29 17:09:26.114777	2025-12-29 20:32:53.785951	200.00	recibido		2025-12-29 17:09:26.114777	2025-12-29 17:09:26.114777	credito	1	f
18	PED-000013	1	3	2025-12-29 15:00:15.850826	2025-12-29 20:32:59.285169	400.00	recibido		2025-12-29 15:00:15.850826	2025-12-29 15:00:15.850826	credito	30	f
20	PED-000015	1	3	2025-12-29 20:33:53.725606	2025-12-29 20:33:58.5755	8000.00	recibido		2025-12-29 20:33:53.725606	2025-12-29 20:33:53.725606	contado	0	f
23	PED-000018	1	3	2025-12-30 15:26:51.150376	2025-12-30 15:37:40.921777	1000.00	recibido		2025-12-30 15:26:51.150376	2025-12-30 15:26:51.150376	credito	30	f
22	PED-000017	1	3	2025-12-29 22:39:56.993894	2025-12-30 15:37:44.678895	200.00	recibido		2025-12-29 22:39:56.993894	2025-12-29 22:39:56.993894	credito	1	f
21	PED-000016	1	3	2025-12-29 22:39:25.161711	2025-12-30 15:37:48.030628	1600.00	recibido		2025-12-29 22:39:25.161711	2025-12-29 22:39:25.161711	credito	30	f
24	PED-000019	1	3	2025-12-30 15:41:32.138158	2025-12-30 15:41:37.511785	59950.00	recibido	compra	2025-12-30 15:41:32.138158	2025-12-30 15:41:32.138158	contado	0	f
25	PED-000020	1	3	2025-12-31 18:26:56.254764	2025-12-31 18:37:17.26919	800.00	recibido	 | Recepcionado	2025-12-31 18:26:56.254764	2025-12-31 18:26:56.254764	contado	0	t
26	PED-000021	1	3	2026-01-02 14:20:30.522012	2026-01-02 14:20:43.350893	20000.00	recibido	 | Recepcionado	2026-01-02 14:20:30.522012	2026-01-02 14:20:30.522012	credito	30	f
27	PED-000022	1	3	2026-01-10 20:10:21.55676	2026-01-10 20:11:10.224139	1600.00	recibido	 | Recepcionado	2026-01-10 20:10:21.55676	2026-01-10 20:10:21.55676	credito	15	t
\.


--
-- Data for Name: productos; Type: TABLE DATA; Schema: public; Owner: marlonjimenez
--

COPY public.productos (id, codigo_barras, sku, nombre, descripcion, categoria_id, precio_compra, precio_venta, stock_actual, stock_minimo, stock_maximo, unidad_medida, requiere_vencimiento, dias_alerta_vencimiento, imagen_url, activo, created_at, updated_at) FROM stdin;
7	34354354	\N	Coca cola chowi	355 ml	4	200.00	300.00	143	50	1000	caja	t	30	\N	t	2025-12-24 22:51:28.377696	2025-12-24 22:51:28.377696
5	11100	\N	galletas	khjhkjhkjh	4	800.00	1000.00	57	10	1000	pieza	t	5	\N	t	2025-12-22 22:03:52.145925	2025-12-22 22:03:52.145925
2	1112	\N	galletas picnic	galletas picnic fresa	1	30.00	50.00	100	10	1000	Caja	f	30	\N	f	2025-12-22 21:29:39.802753	2025-12-22 21:47:25.335919
1	1111	\N	galletas	galletas can can	1	12.00	15.00	20	10	1000	pieza	f	30	\N	f	2025-12-22 21:26:28.246612	2025-12-22 21:49:09.643543
3	1113	\N	leche foremost	test de test	4	100.00	105.00	30	30	1000	pieza	t	2	\N	f	2025-12-22 21:40:37.546659	2025-12-22 21:50:06.794828
4	1114	\N	leche foremost	hdjsahdjashda	1	100.00	200.00	61	10	1000	caja	t	5	\N	t	2025-12-22 21:55:44.691414	2025-12-23 22:12:01.476269
6	111000	\N	galletas picnic	galletas	5	99.00	201.00	225	100	1000	pieza	f	30	\N	t	2025-12-23 22:13:03.553068	2025-12-23 22:16:15.999343
8	1	\N	A	ASDFASDFSADF	1	32.00	55.00	122	10	1000	pieza	f	30	\N	t	2026-01-14 11:10:59.418468	2026-01-14 11:10:59.418468
9	2	\N	B	B	4	33.00	50.00	30	10	1000	pieza	f	30	\N	t	2026-01-14 11:11:30.291421	2026-01-14 11:11:30.291421
10	3	\N	C	C	3	33.00	55.00	100	10	1000	pieza	f	30	\N	t	2026-01-14 11:12:04.386339	2026-01-14 11:12:04.386339
11	4	\N	D	D	9	33.00	55.00	30	10	1000	pieza	f	30	\N	t	2026-01-14 11:18:44.307072	2026-01-14 11:18:44.307072
12	5	\N	E	FASDSD	7	33.00	55.00	550	10	1000	pieza	f	30	\N	t	2026-01-14 11:19:36.975346	2026-01-14 11:19:36.975346
13	6	\N	F	FASDFSAF	2	44.00	77.00	50	10	1000	pieza	f	30	\N	t	2026-01-14 11:19:54.700184	2026-01-14 11:19:54.700184
14	7	\N	G	XCVX	10	33.00	55.00	110	10	1000	pieza	f	30	\N	t	2026-01-14 11:20:42.112587	2026-01-14 11:20:42.112587
15	8	\N	H	H	9	33.00	56.00	220	10	1000	pieza	f	30	\N	t	2026-01-14 11:26:42.130365	2026-01-14 11:26:42.130365
16	9 	\N	I	SDGFG	2	44.00	78.00	770	10	1000	pieza	f	30	\N	t	2026-01-14 11:27:28.295919	2026-01-14 11:27:28.295919
17	10	\N	J	J	9	33.00	55.00	110	10	1000	pieza	f	30	\N	t	2026-01-14 11:31:04.66985	2026-01-14 11:31:04.66985
18	11	\N	K	k	7	33.00	66.00	220	10	1000	pieza	f	30	\N	t	2026-01-14 11:33:42.75592	2026-01-14 11:33:42.75592
19	12	\N	L	L	6	33.00	55.00	10	10	1000	pieza	f	30	\N	t	2026-01-14 11:35:23.45247	2026-01-14 11:35:23.45247
21	14	NULL	N	N	2	34.00	56.00	11	10	1000	unidad	f	30	NULL	t	2026-01-14 11:35:23.454	2026-01-14 11:35:23.454
201	15	\N	O	O	3	35.00	57.00	12	10	1000	decena	f	30	\N	t	2026-01-14 11:35:23.455	2026-01-14 11:35:23.455
202	16	\N	P	P	4	36.00	58.00	13	10	1000	caja	f	30	\N	t	2026-01-14 11:35:23.456	2026-01-14 11:35:23.456
203	17	\N	Q	Q	5	37.00	59.00	14	10	1000	fardo	f	30	\N	t	2026-01-14 11:35:23.457	2026-01-14 11:35:23.457
204	18	\N	R	R	6	38.00	60.00	15	10	1000	media caja	f	30	\N	t	2026-01-14 11:35:23.458	2026-01-14 11:35:23.458
205	19	\N	S	S	1	39.00	61.00	16	10	1000	pieza	f	30	\N	t	2026-01-14 11:35:23.459	2026-01-14 11:35:23.459
206	20	\N	T	T	2	40.00	62.00	17	10	1000	unidad	f	30	\N	t	2026-01-14 11:35:23.46	2026-01-14 11:35:23.46
207	21	\N	U	U	3	41.00	63.00	18	10	1000	decena	f	30	\N	t	2026-01-14 11:35:23.461	2026-01-14 11:35:23.461
208	22	\N	V	V	4	42.00	64.00	19	10	1000	caja	f	30	\N	t	2026-01-14 11:35:23.462	2026-01-14 11:35:23.462
209	23	\N	W	W	5	43.00	65.00	20	10	1000	fardo	f	30	\N	t	2026-01-14 11:35:23.463	2026-01-14 11:35:23.463
210	24	\N	X	X	6	44.00	66.00	21	10	1000	media caja	f	30	\N	t	2026-01-14 11:35:23.464	2026-01-14 11:35:23.464
211	25	\N	Y	Y	1	45.00	67.00	22	10	1000	pieza	f	30	\N	t	2026-01-14 11:35:23.465	2026-01-14 11:35:23.465
212	26	\N	Z	Z	2	46.00	68.00	23	10	1000	unidad	f	30	\N	t	2026-01-14 11:35:23.466	2026-01-14 11:35:23.466
213	27	\N	AA	AA	3	47.00	69.00	24	10	1000	decena	f	30	\N	t	2026-01-14 11:35:23.467	2026-01-14 11:35:23.467
214	28	\N	AB	AB	4	48.00	70.00	25	10	1000	caja	f	30	\N	t	2026-01-14 11:35:23.468	2026-01-14 11:35:23.468
215	29	\N	AC	AC	5	49.00	71.00	26	10	1000	fardo	f	30	\N	t	2026-01-14 11:35:23.469	2026-01-14 11:35:23.469
216	30	\N	AD	AD	6	50.00	72.00	27	10	1000	media caja	f	30	\N	t	2026-01-14 11:35:23.47	2026-01-14 11:35:23.47
217	31	\N	AE	AE	1	51.00	73.00	28	10	1000	pieza	f	30	\N	t	2026-01-14 11:35:23.471	2026-01-14 11:35:23.471
218	32	\N	AF	AF	2	52.00	74.00	29	10	1000	unidad	f	30	\N	t	2026-01-14 11:35:23.472	2026-01-14 11:35:23.472
219	33	\N	AG	AG	3	53.00	75.00	30	10	1000	decena	f	30	\N	t	2026-01-14 11:35:23.473	2026-01-14 11:35:23.473
220	34	\N	AH	AH	4	54.00	76.00	31	10	1000	caja	f	30	\N	t	2026-01-14 11:35:23.474	2026-01-14 11:35:23.474
221	35	\N	AJ	AJ	5	55.00	77.00	32	10	1000	fardo	f	30	\N	t	2026-01-14 11:35:23.475	2026-01-14 11:35:23.475
222	36	\N	AK	AK	6	56.00	78.00	33	10	1000	media caja	f	30	\N	t	2026-01-14 11:35:23.476	2026-01-14 11:35:23.476
223	37	\N	AL	AL	1	57.00	79.00	34	10	1000	pieza	f	30	\N	t	2026-01-14 11:35:23.477	2026-01-14 11:35:23.477
224	38	\N	AM	AM	2	58.00	80.00	35	10	1000	unidad	f	30	\N	t	2026-01-14 11:35:23.478	2026-01-14 11:35:23.478
225	39	\N	AN	AN	3	59.00	81.00	36	10	1000	decena	f	30	\N	t	2026-01-14 11:35:23.479	2026-01-14 11:35:23.479
226	40	\N	AO	AO	4	60.00	82.00	37	10	1000	caja	f	30	\N	t	2026-01-14 11:35:23.48	2026-01-14 11:35:23.48
227	41	\N	AP	AP	5	61.00	83.00	38	10	1000	fardo	f	30	\N	t	2026-01-14 11:35:23.481	2026-01-14 11:35:23.481
228	42	\N	AQ	AQ	6	62.00	84.00	39	10	1000	media caja	f	30	\N	t	2026-01-14 11:35:23.482	2026-01-14 11:35:23.482
229	43	\N	AR	AR	1	63.00	85.00	40	10	1000	pieza	f	30	\N	t	2026-01-14 11:35:23.483	2026-01-14 11:35:23.483
230	44	\N	AS	AS	2	64.00	86.00	41	10	1000	unidad	f	30	\N	t	2026-01-14 11:35:23.484	2026-01-14 11:35:23.484
231	45	\N	AT	AT	3	65.00	87.00	42	10	1000	decena	f	30	\N	t	2026-01-14 11:35:23.485	2026-01-14 11:35:23.485
232	46	\N	AV	AV	4	66.00	88.00	43	10	1000	caja	f	30	\N	t	2026-01-14 11:35:23.486	2026-01-14 11:35:23.486
233	47	\N	AW	AW	5	67.00	89.00	44	10	1000	fardo	f	30	\N	t	2026-01-14 11:35:23.487	2026-01-14 11:35:23.487
234	48	\N	AX	AX	6	68.00	90.00	45	10	1000	media caja	f	30	\N	t	2026-01-14 11:35:23.488	2026-01-14 11:35:23.488
235	49	\N	AY	AY	1	69.00	91.00	46	10	1000	pieza	f	30	\N	t	2026-01-14 11:35:23.489	2026-01-14 11:35:23.489
236	50	\N	AZ	AZ	2	70.00	92.00	47	10	1000	unidad	f	30	\N	t	2026-01-14 11:35:23.49	2026-01-14 11:35:23.49
237	51	\N	BA	BA	3	71.00	93.00	48	10	1000	decena	f	30	\N	t	2026-01-14 11:35:23.491	2026-01-14 11:35:23.491
238	52	\N	BB	BB	4	72.00	94.00	49	10	1000	caja	f	30	\N	t	2026-01-14 11:35:23.492	2026-01-14 11:35:23.492
239	53	\N	BC	BC	5	73.00	95.00	50	10	1000	fardo	f	30	\N	t	2026-01-14 11:35:23.493	2026-01-14 11:35:23.493
240	54	\N	BD	BD	6	74.00	96.00	51	10	1000	media caja	f	30	\N	t	2026-01-14 11:35:23.494	2026-01-14 11:35:23.494
241	55	\N	BE	BE	1	75.00	97.00	52	10	1000	pieza	f	30	\N	t	2026-01-14 11:35:23.495	2026-01-14 11:35:23.495
242	56	\N	BF	BF	2	76.00	98.00	53	10	1000	unidad	f	30	\N	t	2026-01-14 11:35:23.496	2026-01-14 11:35:23.496
243	57	\N	BG	BG	3	77.00	99.00	54	10	1000	decena	f	30	\N	t	2026-01-14 11:35:23.497	2026-01-14 11:35:23.497
244	58	\N	BH	BH	4	78.00	100.00	55	10	1000	caja	f	30	\N	t	2026-01-14 11:35:23.498	2026-01-14 11:35:23.498
245	59	\N	BI	BI	5	79.00	101.00	56	10	1000	fardo	f	30	\N	t	2026-01-14 11:35:23.499	2026-01-14 11:35:23.499
246	60	\N	BJ	BJ	6	80.00	102.00	57	10	1000	media caja	f	30	\N	t	2026-01-14 11:35:23.5	2026-01-14 11:35:23.5
247	61	\N	BK	BK	1	81.00	103.00	58	10	1000	pieza	f	30	\N	t	2026-01-14 11:35:23.501	2026-01-14 11:35:23.501
248	62	\N	BL	BL	2	82.00	104.00	59	10	1000	unidad	f	30	\N	t	2026-01-14 11:35:23.502	2026-01-14 11:35:23.502
249	63	\N	BM	BM	3	83.00	105.00	60	10	1000	decena	f	30	\N	t	2026-01-14 11:35:23.503	2026-01-14 11:35:23.503
26	13		M	M	1	33.00	55.00	10	10	1000	pieza	f	30		t	2026-01-14 11:35:23.453	2026-01-14 11:35:23.453
250	64	\N	BN	BN	4	84.00	106.00	61	10	1000	caja	f	30	\N	t	2026-01-14 11:35:23.504	2026-01-14 11:35:23.504
251	65	\N	BO	BO	5	85.00	107.00	62	10	1000	fardo	f	30	\N	t	2026-01-14 11:35:23.505	2026-01-14 11:35:23.505
252	66	\N	BP	BP	6	86.00	108.00	63	10	1000	media caja	f	30	\N	t	2026-01-14 11:35:23.506	2026-01-14 11:35:23.506
253	67	\N	BQ	BQ	1	87.00	109.00	64	10	1000	pieza	f	30	\N	t	2026-01-14 11:35:23.507	2026-01-14 11:35:23.507
254	68	\N	BR	BR	2	88.00	110.00	65	10	1000	unidad	f	30	\N	t	2026-01-14 11:35:23.508	2026-01-14 11:35:23.508
255	69	\N	BS	BS	3	89.00	111.00	66	10	1000	decena	f	30	\N	t	2026-01-14 11:35:23.509	2026-01-14 11:35:23.509
256	70	\N	BT	BT	4	90.00	112.00	67	10	1000	caja	f	30	\N	t	2026-01-14 11:35:23.51	2026-01-14 11:35:23.51
257	71	\N	BU	BU	5	91.00	113.00	68	10	1000	fardo	f	30	\N	t	2026-01-14 11:35:23.511	2026-01-14 11:35:23.511
258	72	\N	BV	BV	6	92.00	114.00	69	10	1000	media caja	f	30	\N	t	2026-01-14 11:35:23.512	2026-01-14 11:35:23.512
259	73	\N	BW	BW	1	93.00	115.00	70	10	1000	pieza	f	30	\N	t	2026-01-14 11:35:23.513	2026-01-14 11:35:23.513
260	74	\N	BX	BX	2	94.00	116.00	71	10	1000	unidad	f	30	\N	t	2026-01-14 11:35:23.514	2026-01-14 11:35:23.514
261	75	\N	BY	BY	3	95.00	117.00	72	10	1000	decena	f	30	\N	t	2026-01-14 11:35:23.515	2026-01-14 11:35:23.515
262	76	\N	BZ	BZ	4	96.00	118.00	73	10	1000	caja	f	30	\N	t	2026-01-14 11:35:23.516	2026-01-14 11:35:23.516
263	77	\N	CA	CA	5	97.00	119.00	74	10	1000	fardo	f	30	\N	t	2026-01-14 11:35:23.517	2026-01-14 11:35:23.517
264	78	\N	CB	CB	6	98.00	120.00	75	10	1000	media caja	f	30	\N	t	2026-01-14 11:35:23.518	2026-01-14 11:35:23.518
265	79	\N	CC	CC	1	99.00	121.00	76	10	1000	pieza	f	30	\N	t	2026-01-14 11:35:23.519	2026-01-14 11:35:23.519
266	80	\N	CD	CD	2	100.00	122.00	77	10	1000	unidad	f	30	\N	t	2026-01-14 11:35:23.52	2026-01-14 11:35:23.52
267	81	\N	CE	CE	3	101.00	123.00	78	10	1000	decena	f	30	\N	t	2026-01-14 11:35:23.521	2026-01-14 11:35:23.521
268	82	\N	CF	CF	4	102.00	124.00	79	10	1000	caja	f	30	\N	t	2026-01-14 11:35:23.522	2026-01-14 11:35:23.522
269	83	\N	CG	CG	5	103.00	125.00	80	10	1000	fardo	f	30	\N	t	2026-01-14 11:35:23.523	2026-01-14 11:35:23.523
270	84	\N	CH	CH	6	104.00	126.00	81	10	1000	media caja	f	30	\N	t	2026-01-14 11:35:23.524	2026-01-14 11:35:23.524
271	85	\N	CI	CI	1	105.00	127.00	82	10	1000	pieza	f	30	\N	t	2026-01-14 11:35:23.525	2026-01-14 11:35:23.525
272	86	\N	CJ	CJ	2	106.00	128.00	83	10	1000	unidad	f	30	\N	t	2026-01-14 11:35:23.526	2026-01-14 11:35:23.526
273	87	\N	CK	CK	3	107.00	129.00	84	10	1000	decena	f	30	\N	t	2026-01-14 11:35:23.527	2026-01-14 11:35:23.527
274	88	\N	CL	CL	4	108.00	130.00	85	10	1000	caja	f	30	\N	t	2026-01-14 11:35:23.528	2026-01-14 11:35:23.528
275	89	\N	CM	CM	5	109.00	131.00	86	10	1000	fardo	f	30	\N	t	2026-01-14 11:35:23.529	2026-01-14 11:35:23.529
276	90	\N	CN	CN	6	110.00	132.00	87	10	1000	media caja	f	30	\N	t	2026-01-14 11:35:23.53	2026-01-14 11:35:23.53
277	91	\N	CO	CO	1	111.00	133.00	88	10	1000	pieza	f	30	\N	t	2026-01-14 11:35:23.531	2026-01-14 11:35:23.531
278	92	\N	CP	CP	2	112.00	134.00	89	10	1000	unidad	f	30	\N	t	2026-01-14 11:35:23.532	2026-01-14 11:35:23.532
279	93	\N	CQ	CQ	3	113.00	135.00	90	10	1000	decena	f	30	\N	t	2026-01-14 11:35:23.533	2026-01-14 11:35:23.533
280	94	\N	CR	CR	4	114.00	136.00	91	10	1000	caja	f	30	\N	t	2026-01-14 11:35:23.534	2026-01-14 11:35:23.534
281	95	\N	CS	CS	5	115.00	137.00	92	10	1000	fardo	f	30	\N	t	2026-01-14 11:35:23.535	2026-01-14 11:35:23.535
282	96	\N	CT	CT	6	116.00	138.00	93	10	1000	media caja	f	30	\N	t	2026-01-14 11:35:23.536	2026-01-14 11:35:23.536
283	97	\N	CU	CU	1	117.00	139.00	94	10	1000	pieza	f	30	\N	t	2026-01-14 11:35:23.537	2026-01-14 11:35:23.537
284	98	\N	CV	CV	2	118.00	140.00	95	10	1000	unidad	f	30	\N	t	2026-01-14 11:35:23.538	2026-01-14 11:35:23.538
285	99	\N	CW	CW	3	119.00	141.00	96	10	1000	decena	f	30	\N	t	2026-01-14 11:35:23.539	2026-01-14 11:35:23.539
286	100	\N	CX	CX	4	120.00	142.00	97	10	1000	caja	f	30	\N	t	2026-01-14 11:35:23.54	2026-01-14 11:35:23.54
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
5	Piloto	Piloto de entregas a domicilio	{"envios": true, "ventas": "read"}	t	2025-12-31 00:29:06.90617	2025-12-31 00:29:06.90617
\.


--
-- Data for Name: usuarios; Type: TABLE DATA; Schema: public; Owner: marlonjimenez
--

COPY public.usuarios (id, nombre, email, password_hash, telefono, rol_id, activo, ultimo_acceso, created_at, updated_at) FROM stdin;
5	Angel	angel@aguila.com	$2b$10$k8DYj.2kqlyI7QYOd1Qx3.iliP6cYocHXLpbaAlCrjMO/R6dOJL0G	\N	3	t	2026-01-02 14:33:35.261567	2025-12-27 22:42:41.501331	2025-12-27 22:42:41.501331
6	Daniel	daniel@gmail.com	$2b$10$boV9bLGhXNjz6glK5XQ8ge4.lYhZubANXYRU46Ih8wOZuHwek9Wjy	232323	5	t	2026-01-10 20:01:50.983185	2025-12-31 01:21:52.406868	2025-12-31 01:27:34.938954
4	Marlon	marlonji2360@gmail.com	$2b$10$/IbeJXoEmaAOkdKjwbFVEuFqaWQVCCiuTO3XhmrOugb0CZduZdB5q	35340463	3	t	2026-01-10 20:17:11.717579	2025-12-27 14:48:31.605955	2025-12-30 14:48:04.423856
3	Administrador	admin@tienda.com	$2b$10$gRDs5vywgnB/KtFKgIMhJOy518Yzyhuo9ViBXWvXnFWTH5do2lLHy	\N	1	t	2026-01-14 10:33:58.171829	2025-12-22 16:55:36.955027	2025-12-22 16:55:36.955027
\.


--
-- Data for Name: ventas; Type: TABLE DATA; Schema: public; Owner: marlonjimenez
--

COPY public.ventas (id, folio, cliente_id, usuario_id, fecha_venta, subtotal, descuento, iva, total, metodo_pago, estado, monto_efectivo, monto_tarjeta, monto_transferencia, cambio, notas, created_at, updated_at, descuento_volumen, descuento_adicional, total_descuentos, requiere_autorizacion, autorizacion_id, es_envio, envio_id) FROM stdin;
4	VTA-000001	\N	3	2025-12-23 21:45:03.695195	1400.00	0.00	0.00	1400.00	efectivo	completada	\N	\N	\N	0.00	\N	2025-12-23 21:45:03.695195	2025-12-23 21:45:03.695195	0.00	0.00	0.00	f	\N	f	\N
5	VTA-000002	\N	3	2025-12-23 21:49:57.240517	2200.00	0.00	0.00	2200.00	transferencia	completada	\N	\N	\N	0.00	\N	2025-12-23 21:49:57.240517	2025-12-23 21:49:57.240517	0.00	0.00	0.00	f	\N	f	\N
6	VTA-000003	\N	3	2025-12-23 21:50:55.125866	2600.00	0.00	0.00	2600.00	efectivo	completada	\N	\N	\N	0.00	\N	2025-12-23 21:50:55.125866	2025-12-23 21:50:55.125866	0.00	0.00	0.00	f	\N	f	\N
7	VTA-000004	\N	3	2025-12-23 21:52:06.853466	1000.00	0.00	0.00	1000.00	transferencia	completada	\N	\N	\N	0.00	\N	2025-12-23 21:52:06.853466	2025-12-23 21:52:06.853466	0.00	0.00	0.00	f	\N	f	\N
8	VTA-000005	\N	3	2025-12-23 22:17:14.221569	402.00	0.00	0.00	402.00	efectivo	completada	\N	\N	\N	0.00	\N	2025-12-23 22:17:14.221569	2025-12-23 22:17:14.221569	0.00	0.00	0.00	f	\N	f	\N
9	VTA-000006	\N	3	2025-12-24 22:57:07.603787	801.00	0.00	0.00	801.00	efectivo	completada	\N	\N	\N	0.00	\N	2025-12-24 22:57:07.603787	2025-12-24 22:57:07.603787	0.00	0.00	0.00	f	\N	f	\N
10	VTA-000007	\N	3	2025-12-26 16:09:36.986092	300.00	0.00	0.00	300.00	efectivo	completada	\N	\N	\N	0.00	\N	2025-12-26 16:09:36.986092	2025-12-26 16:09:36.986092	0.00	0.00	0.00	f	\N	f	\N
13	VTA-000008	\N	3	2025-12-28 20:14:16.201409	21000.00	0.00	0.00	21000.00	efectivo	completada	\N	\N	\N	0.00	\N	2025-12-28 20:14:16.201409	2025-12-28 20:14:16.201409	0.00	0.00	0.00	f	\N	f	\N
14	VTA-000009	2	3	2025-12-28 20:24:11.140268	600.00	0.00	0.00	600.00	efectivo	completada	\N	\N	\N	0.00	\N	2025-12-28 20:24:11.140268	2025-12-28 20:24:11.140268	0.00	0.00	0.00	f	\N	f	\N
15	VTA-000010	3	3	2025-12-29 20:35:28.737917	3000.00	0.00	0.00	3000.00	efectivo	completada	\N	\N	\N	0.00	\N	2025-12-29 20:35:28.737917	2025-12-29 20:35:28.737917	0.00	0.00	0.00	f	\N	f	\N
16	VTA-000011	1	3	2025-12-29 22:44:46.809115	7374.75	0.00	0.00	7374.75	efectivo	completada	\N	\N	\N	0.00	\N	2025-12-29 22:44:46.809115	2025-12-29 22:44:46.809115	0.00	0.00	0.00	f	\N	f	\N
17	VTA-000012	1	4	2025-12-30 16:39:36.276785	300.00	0.00	0.00	260.00	tarjeta	completada	\N	\N	\N	0.00	\N	2025-12-30 16:39:36.276785	2025-12-30 16:39:36.276785	0.00	0.00	0.00	f	\N	f	\N
18	VTA-000013	1	4	2025-12-30 17:24:49.083544	2383.92	0.00	0.00	383.92	tarjeta	completada	\N	\N	\N	0.00	\N	2025-12-30 17:24:49.083544	2025-12-30 17:24:49.083544	0.00	0.00	0.00	f	\N	f	\N
19	VTA-000014	3	4	2025-12-30 19:36:13.353302	4000.00	0.00	0.00	3500.00	efectivo	completada	\N	\N	\N	0.00	\N	2025-12-30 19:36:13.353302	2025-12-30 19:36:13.353302	0.00	0.00	0.00	f	\N	f	\N
20	VTA-000015	2	4	2025-12-30 19:56:16.677444	603.00	0.00	0.00	553.00	tarjeta	completada	\N	\N	\N	0.00	\N	2025-12-30 19:56:16.677444	2025-12-30 19:56:16.677444	0.00	0.00	0.00	f	\N	f	\N
21	VTA-000016	1	4	2025-12-30 20:08:18.458251	603.00	0.00	0.00	553.00	tarjeta	completada	\N	\N	\N	0.00	\N	2025-12-30 20:08:18.458251	2025-12-30 20:08:18.458251	0.00	0.00	0.00	f	\N	f	\N
22	VTA-000017	3	4	2025-12-30 21:12:21.56205	1386.04	0.00	0.00	1086.04	efectivo	completada	\N	\N	\N	0.00	\N	2025-12-30 21:12:21.56205	2025-12-30 21:12:21.56205	0.00	0.00	0.00	f	\N	f	\N
23	VTA-000018	1	4	2025-12-30 21:13:54.404932	201.00	0.00	0.00	201.00	tarjeta	completada	\N	\N	\N	0.00	\N	2025-12-30 21:13:54.404932	2025-12-30 21:13:54.404932	0.00	0.00	0.00	f	\N	f	\N
24	VTA-000019	\N	3	2025-12-31 00:55:41.565315	603.00	0.00	0.00	603.00	tarjeta	completada	\N	\N	\N	0.00	\N	2025-12-31 00:55:41.565315	2025-12-31 00:55:41.565315	0.00	0.00	0.00	f	\N	t	\N
25	VTA-000020	3	3	2025-12-31 01:22:42.936512	201.00	0.00	0.00	201.00	tarjeta	completada	\N	\N	\N	0.00	\N	2025-12-31 01:22:42.936512	2025-12-31 01:22:42.936512	0.00	0.00	0.00	f	\N	t	\N
26	VTA-000021	3	3	2025-12-31 01:25:54.464002	201.00	0.00	0.00	201.00	tarjeta	completada	\N	\N	\N	0.00	\N	2025-12-31 01:25:54.464002	2025-12-31 01:25:54.464002	0.00	0.00	0.00	f	\N	t	1
27	VTA-000022	\N	3	2025-12-31 16:45:00.20551	990.03	0.00	0.00	990.03	tarjeta	completada	\N	\N	\N	0.00	\N	2025-12-31 16:45:00.20551	2025-12-31 16:45:00.20551	0.00	0.00	0.00	f	\N	t	2
28	VTA-000023	1	3	2025-12-31 16:54:25.553631	201.00	0.00	0.00	201.00	tarjeta	completada	\N	\N	\N	0.00	\N	2025-12-31 16:54:25.553631	2025-12-31 16:54:25.553631	0.00	0.00	0.00	f	\N	t	3
29	VTA-000024	2	3	2025-12-31 18:34:56.762303	201.00	0.00	0.00	201.00	tarjeta	completada	\N	\N	\N	0.00	\N	2025-12-31 18:34:56.762303	2025-12-31 18:34:56.762303	0.00	0.00	0.00	f	\N	t	4
30	VTA-000025	\N	3	2026-01-10 20:00:03.637033	300.00	0.00	0.00	300.00	efectivo	completada	\N	\N	\N	0.00	\N	2026-01-10 20:00:03.637033	2026-01-10 20:00:03.637033	0.00	0.00	0.00	f	\N	t	5
\.


--
-- Name: ajustes_recepcion_id_seq; Type: SEQUENCE SET; Schema: public; Owner: marlonjimenez
--

SELECT pg_catalog.setval('public.ajustes_recepcion_id_seq', 2, true);


--
-- Name: autorizaciones_descuento_id_seq; Type: SEQUENCE SET; Schema: public; Owner: marlonjimenez
--

SELECT pg_catalog.setval('public.autorizaciones_descuento_id_seq', 20, true);


--
-- Name: categorias_gastos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: marlonjimenez
--

SELECT pg_catalog.setval('public.categorias_gastos_id_seq', 8, true);


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
-- Name: cuentas_por_pagar_id_seq; Type: SEQUENCE SET; Schema: public; Owner: marlonjimenez
--

SELECT pg_catalog.setval('public.cuentas_por_pagar_id_seq', 8, true);


--
-- Name: descuentos_volumen_id_seq; Type: SEQUENCE SET; Schema: public; Owner: marlonjimenez
--

SELECT pg_catalog.setval('public.descuentos_volumen_id_seq', 10, true);


--
-- Name: detalle_cotizaciones_id_seq; Type: SEQUENCE SET; Schema: public; Owner: marlonjimenez
--

SELECT pg_catalog.setval('public.detalle_cotizaciones_id_seq', 1, false);


--
-- Name: detalle_devoluciones_clientes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: marlonjimenez
--

SELECT pg_catalog.setval('public.detalle_devoluciones_clientes_id_seq', 8, true);


--
-- Name: detalle_devoluciones_proveedores_id_seq; Type: SEQUENCE SET; Schema: public; Owner: marlonjimenez
--

SELECT pg_catalog.setval('public.detalle_devoluciones_proveedores_id_seq', 3, true);


--
-- Name: detalle_pedidos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: marlonjimenez
--

SELECT pg_catalog.setval('public.detalle_pedidos_id_seq', 30, true);


--
-- Name: detalle_ventas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: marlonjimenez
--

SELECT pg_catalog.setval('public.detalle_ventas_id_seq', 32, true);


--
-- Name: devoluciones_clientes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: marlonjimenez
--

SELECT pg_catalog.setval('public.devoluciones_clientes_id_seq', 4, true);


--
-- Name: devoluciones_proveedores_id_seq; Type: SEQUENCE SET; Schema: public; Owner: marlonjimenez
--

SELECT pg_catalog.setval('public.devoluciones_proveedores_id_seq', 3, true);


--
-- Name: envios_id_seq; Type: SEQUENCE SET; Schema: public; Owner: marlonjimenez
--

SELECT pg_catalog.setval('public.envios_id_seq', 5, true);


--
-- Name: gastos_fijos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: marlonjimenez
--

SELECT pg_catalog.setval('public.gastos_fijos_id_seq', 3, true);


--
-- Name: historial_envios_id_seq; Type: SEQUENCE SET; Schema: public; Owner: marlonjimenez
--

SELECT pg_catalog.setval('public.historial_envios_id_seq', 36, true);


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

SELECT pg_catalog.setval('public.movimientos_inventario_id_seq', 69, true);


--
-- Name: notificaciones_id_seq; Type: SEQUENCE SET; Schema: public; Owner: marlonjimenez
--

SELECT pg_catalog.setval('public.notificaciones_id_seq', 2, true);


--
-- Name: pagos_gastos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: marlonjimenez
--

SELECT pg_catalog.setval('public.pagos_gastos_id_seq', 5, true);


--
-- Name: pagos_proveedores_id_seq; Type: SEQUENCE SET; Schema: public; Owner: marlonjimenez
--

SELECT pg_catalog.setval('public.pagos_proveedores_id_seq', 5, true);


--
-- Name: pedidos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: marlonjimenez
--

SELECT pg_catalog.setval('public.pedidos_id_seq', 1, false);


--
-- Name: pedidos_proveedores_id_seq; Type: SEQUENCE SET; Schema: public; Owner: marlonjimenez
--

SELECT pg_catalog.setval('public.pedidos_proveedores_id_seq', 27, true);


--
-- Name: productos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: marlonjimenez
--

SELECT pg_catalog.setval('public.productos_id_seq', 286, true);


--
-- Name: proveedores_id_seq; Type: SEQUENCE SET; Schema: public; Owner: marlonjimenez
--

SELECT pg_catalog.setval('public.proveedores_id_seq', 1, true);


--
-- Name: roles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: marlonjimenez
--

SELECT pg_catalog.setval('public.roles_id_seq', 5, true);


--
-- Name: usuarios_id_seq; Type: SEQUENCE SET; Schema: public; Owner: marlonjimenez
--

SELECT pg_catalog.setval('public.usuarios_id_seq', 6, true);


--
-- Name: ventas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: marlonjimenez
--

SELECT pg_catalog.setval('public.ventas_id_seq', 30, true);


--
-- Name: ajustes_recepcion ajustes_recepcion_pkey; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.ajustes_recepcion
    ADD CONSTRAINT ajustes_recepcion_pkey PRIMARY KEY (id);


--
-- Name: autorizaciones_descuento autorizaciones_descuento_pkey; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.autorizaciones_descuento
    ADD CONSTRAINT autorizaciones_descuento_pkey PRIMARY KEY (id);


--
-- Name: categorias_gastos categorias_gastos_nombre_key; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.categorias_gastos
    ADD CONSTRAINT categorias_gastos_nombre_key UNIQUE (nombre);


--
-- Name: categorias_gastos categorias_gastos_pkey; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.categorias_gastos
    ADD CONSTRAINT categorias_gastos_pkey PRIMARY KEY (id);


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
-- Name: cuentas_por_pagar cuentas_por_pagar_folio_key; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.cuentas_por_pagar
    ADD CONSTRAINT cuentas_por_pagar_folio_key UNIQUE (folio);


--
-- Name: cuentas_por_pagar cuentas_por_pagar_pkey; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.cuentas_por_pagar
    ADD CONSTRAINT cuentas_por_pagar_pkey PRIMARY KEY (id);


--
-- Name: descuentos_volumen descuentos_volumen_pkey; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.descuentos_volumen
    ADD CONSTRAINT descuentos_volumen_pkey PRIMARY KEY (id);


--
-- Name: descuentos_volumen descuentos_volumen_producto_id_cantidad_minima_key; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.descuentos_volumen
    ADD CONSTRAINT descuentos_volumen_producto_id_cantidad_minima_key UNIQUE (producto_id, cantidad_minima);


--
-- Name: detalle_cotizaciones detalle_cotizaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.detalle_cotizaciones
    ADD CONSTRAINT detalle_cotizaciones_pkey PRIMARY KEY (id);


--
-- Name: detalle_devoluciones_clientes detalle_devoluciones_clientes_pkey; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.detalle_devoluciones_clientes
    ADD CONSTRAINT detalle_devoluciones_clientes_pkey PRIMARY KEY (id);


--
-- Name: detalle_devoluciones_proveedores detalle_devoluciones_proveedores_pkey; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.detalle_devoluciones_proveedores
    ADD CONSTRAINT detalle_devoluciones_proveedores_pkey PRIMARY KEY (id);


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
-- Name: devoluciones_clientes devoluciones_clientes_folio_key; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.devoluciones_clientes
    ADD CONSTRAINT devoluciones_clientes_folio_key UNIQUE (folio);


--
-- Name: devoluciones_clientes devoluciones_clientes_pkey; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.devoluciones_clientes
    ADD CONSTRAINT devoluciones_clientes_pkey PRIMARY KEY (id);


--
-- Name: devoluciones_proveedores devoluciones_proveedores_folio_key; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.devoluciones_proveedores
    ADD CONSTRAINT devoluciones_proveedores_folio_key UNIQUE (folio);


--
-- Name: devoluciones_proveedores devoluciones_proveedores_pkey; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.devoluciones_proveedores
    ADD CONSTRAINT devoluciones_proveedores_pkey PRIMARY KEY (id);


--
-- Name: envios envios_pkey; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.envios
    ADD CONSTRAINT envios_pkey PRIMARY KEY (id);


--
-- Name: gastos_fijos gastos_fijos_pkey; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.gastos_fijos
    ADD CONSTRAINT gastos_fijos_pkey PRIMARY KEY (id);


--
-- Name: historial_envios historial_envios_pkey; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.historial_envios
    ADD CONSTRAINT historial_envios_pkey PRIMARY KEY (id);


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
-- Name: pagos_gastos pagos_gastos_pkey; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.pagos_gastos
    ADD CONSTRAINT pagos_gastos_pkey PRIMARY KEY (id);


--
-- Name: pagos_proveedores pagos_proveedores_pkey; Type: CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.pagos_proveedores
    ADD CONSTRAINT pagos_proveedores_pkey PRIMARY KEY (id);


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
-- Name: idx_ajustes_pedido; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_ajustes_pedido ON public.ajustes_recepcion USING btree (pedido_id);


--
-- Name: idx_ajustes_producto; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_ajustes_producto ON public.ajustes_recepcion USING btree (producto_id);


--
-- Name: idx_autorizaciones_estado; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_autorizaciones_estado ON public.autorizaciones_descuento USING btree (estado);


--
-- Name: idx_autorizaciones_venta; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_autorizaciones_venta ON public.autorizaciones_descuento USING btree (venta_id);


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
-- Name: idx_cuentas_estado; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_cuentas_estado ON public.cuentas_por_pagar USING btree (estado);


--
-- Name: idx_cuentas_proveedor; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_cuentas_proveedor ON public.cuentas_por_pagar USING btree (proveedor_id);


--
-- Name: idx_cuentas_vencimiento; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_cuentas_vencimiento ON public.cuentas_por_pagar USING btree (fecha_vencimiento);


--
-- Name: idx_descuentos_activo; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_descuentos_activo ON public.descuentos_volumen USING btree (activo);


--
-- Name: idx_descuentos_producto; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_descuentos_producto ON public.descuentos_volumen USING btree (producto_id);


--
-- Name: idx_detalle_pedidos_pedido; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_detalle_pedidos_pedido ON public.detalle_pedidos USING btree (pedido_id);


--
-- Name: idx_detalle_pedidos_producto; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_detalle_pedidos_producto ON public.detalle_pedidos USING btree (producto_id);


--
-- Name: idx_dev_clientes_cliente; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_dev_clientes_cliente ON public.devoluciones_clientes USING btree (cliente_id);


--
-- Name: idx_dev_clientes_fecha; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_dev_clientes_fecha ON public.devoluciones_clientes USING btree (fecha_devolucion);


--
-- Name: idx_dev_clientes_venta; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_dev_clientes_venta ON public.devoluciones_clientes USING btree (venta_id);


--
-- Name: idx_dev_proveedores_fecha; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_dev_proveedores_fecha ON public.devoluciones_proveedores USING btree (fecha_devolucion);


--
-- Name: idx_dev_proveedores_proveedor; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_dev_proveedores_proveedor ON public.devoluciones_proveedores USING btree (proveedor_id);


--
-- Name: idx_envios_estado; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_envios_estado ON public.envios USING btree (estado);


--
-- Name: idx_envios_fecha_pedido; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_envios_fecha_pedido ON public.envios USING btree (fecha_pedido);


--
-- Name: idx_envios_piloto; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_envios_piloto ON public.envios USING btree (piloto_id);


--
-- Name: idx_envios_venta; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_envios_venta ON public.envios USING btree (venta_id);


--
-- Name: idx_gastos_fijos_activo; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_gastos_fijos_activo ON public.gastos_fijos USING btree (activo);


--
-- Name: idx_gastos_fijos_frecuencia; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_gastos_fijos_frecuencia ON public.gastos_fijos USING btree (frecuencia);


--
-- Name: idx_historial_envio; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_historial_envio ON public.historial_envios USING btree (envio_id);


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

CREATE INDEX idx_notificaciones_fecha ON public.notificaciones USING btree (fecha);


--
-- Name: idx_notificaciones_leida; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_notificaciones_leida ON public.notificaciones USING btree (leida);


--
-- Name: idx_notificaciones_prioridad; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_notificaciones_prioridad ON public.notificaciones USING btree (prioridad);


--
-- Name: idx_notificaciones_tipo; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_notificaciones_tipo ON public.notificaciones USING btree (tipo);


--
-- Name: idx_pagos_cuenta; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_pagos_cuenta ON public.pagos_proveedores USING btree (cuenta_por_pagar_id);


--
-- Name: idx_pagos_gastos_estado; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_pagos_gastos_estado ON public.pagos_gastos USING btree (estado);


--
-- Name: idx_pagos_gastos_fecha_vencimiento; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_pagos_gastos_fecha_vencimiento ON public.pagos_gastos USING btree (fecha_vencimiento);


--
-- Name: idx_pagos_gastos_gasto_fijo; Type: INDEX; Schema: public; Owner: marlonjimenez
--

CREATE INDEX idx_pagos_gastos_gasto_fijo ON public.pagos_gastos USING btree (gasto_fijo_id);


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
-- Name: pagos_proveedores trigger_actualizar_cuenta_pago; Type: TRIGGER; Schema: public; Owner: marlonjimenez
--

CREATE TRIGGER trigger_actualizar_cuenta_pago AFTER INSERT ON public.pagos_proveedores FOR EACH ROW EXECUTE FUNCTION public.actualizar_cuenta_tras_pago();


--
-- Name: cuentas_por_pagar trigger_actualizar_estado_cuenta_pagar; Type: TRIGGER; Schema: public; Owner: marlonjimenez
--

CREATE TRIGGER trigger_actualizar_estado_cuenta_pagar BEFORE INSERT OR UPDATE ON public.cuentas_por_pagar FOR EACH ROW EXECUTE FUNCTION public.actualizar_estado_cuenta_pagar();


--
-- Name: envios trigger_cambio_estado_envio; Type: TRIGGER; Schema: public; Owner: marlonjimenez
--

CREATE TRIGGER trigger_cambio_estado_envio BEFORE UPDATE ON public.envios FOR EACH ROW EXECUTE FUNCTION public.registrar_cambio_estado_envio();


--
-- Name: descuentos_volumen trigger_descuento_volumen_updated_at; Type: TRIGGER; Schema: public; Owner: marlonjimenez
--

CREATE TRIGGER trigger_descuento_volumen_updated_at BEFORE UPDATE ON public.descuentos_volumen FOR EACH ROW EXECUTE FUNCTION public.actualizar_descuento_volumen_updated_at();


--
-- Name: envios trigger_envios_updated_at; Type: TRIGGER; Schema: public; Owner: marlonjimenez
--

CREATE TRIGGER trigger_envios_updated_at BEFORE UPDATE ON public.envios FOR EACH ROW EXECUTE FUNCTION public.actualizar_envios_updated_at();


--
-- Name: gastos_fijos trigger_gastos_fijos_updated_at; Type: TRIGGER; Schema: public; Owner: marlonjimenez
--

CREATE TRIGGER trigger_gastos_fijos_updated_at BEFORE UPDATE ON public.gastos_fijos FOR EACH ROW EXECUTE FUNCTION public.actualizar_gastos_updated_at();


--
-- Name: productos trigger_historial_precios; Type: TRIGGER; Schema: public; Owner: marlonjimenez
--

CREATE TRIGGER trigger_historial_precios AFTER UPDATE ON public.productos FOR EACH ROW WHEN (((old.precio_compra IS DISTINCT FROM new.precio_compra) OR (old.precio_venta IS DISTINCT FROM new.precio_venta))) EXECUTE FUNCTION public.registrar_cambio_precio();


--
-- Name: pagos_gastos trigger_pagos_gastos_updated_at; Type: TRIGGER; Schema: public; Owner: marlonjimenez
--

CREATE TRIGGER trigger_pagos_gastos_updated_at BEFORE UPDATE ON public.pagos_gastos FOR EACH ROW EXECUTE FUNCTION public.actualizar_gastos_updated_at();


--
-- Name: ajustes_recepcion ajustes_recepcion_pedido_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.ajustes_recepcion
    ADD CONSTRAINT ajustes_recepcion_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES public.pedidos_proveedores(id);


--
-- Name: ajustes_recepcion ajustes_recepcion_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.ajustes_recepcion
    ADD CONSTRAINT ajustes_recepcion_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- Name: ajustes_recepcion ajustes_recepcion_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.ajustes_recepcion
    ADD CONSTRAINT ajustes_recepcion_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: autorizaciones_descuento autorizaciones_descuento_autorizado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.autorizaciones_descuento
    ADD CONSTRAINT autorizaciones_descuento_autorizado_por_fkey FOREIGN KEY (autorizado_por) REFERENCES public.usuarios(id);


--
-- Name: autorizaciones_descuento autorizaciones_descuento_solicitado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.autorizaciones_descuento
    ADD CONSTRAINT autorizaciones_descuento_solicitado_por_fkey FOREIGN KEY (solicitado_por) REFERENCES public.usuarios(id);


--
-- Name: autorizaciones_descuento autorizaciones_descuento_venta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.autorizaciones_descuento
    ADD CONSTRAINT autorizaciones_descuento_venta_id_fkey FOREIGN KEY (venta_id) REFERENCES public.ventas(id);


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
-- Name: cuentas_por_pagar cuentas_por_pagar_pedido_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.cuentas_por_pagar
    ADD CONSTRAINT cuentas_por_pagar_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES public.pedidos_proveedores(id);


--
-- Name: cuentas_por_pagar cuentas_por_pagar_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.cuentas_por_pagar
    ADD CONSTRAINT cuentas_por_pagar_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id);


--
-- Name: cuentas_por_pagar cuentas_por_pagar_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.cuentas_por_pagar
    ADD CONSTRAINT cuentas_por_pagar_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: descuentos_volumen descuentos_volumen_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.descuentos_volumen
    ADD CONSTRAINT descuentos_volumen_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id);


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
-- Name: detalle_devoluciones_clientes detalle_devoluciones_clientes_devolucion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.detalle_devoluciones_clientes
    ADD CONSTRAINT detalle_devoluciones_clientes_devolucion_id_fkey FOREIGN KEY (devolucion_id) REFERENCES public.devoluciones_clientes(id) ON DELETE CASCADE;


--
-- Name: detalle_devoluciones_clientes detalle_devoluciones_clientes_producto_cambio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.detalle_devoluciones_clientes
    ADD CONSTRAINT detalle_devoluciones_clientes_producto_cambio_id_fkey FOREIGN KEY (producto_cambio_id) REFERENCES public.productos(id);


--
-- Name: detalle_devoluciones_clientes detalle_devoluciones_clientes_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.detalle_devoluciones_clientes
    ADD CONSTRAINT detalle_devoluciones_clientes_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- Name: detalle_devoluciones_proveedores detalle_devoluciones_proveedores_devolucion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.detalle_devoluciones_proveedores
    ADD CONSTRAINT detalle_devoluciones_proveedores_devolucion_id_fkey FOREIGN KEY (devolucion_id) REFERENCES public.devoluciones_proveedores(id) ON DELETE CASCADE;


--
-- Name: detalle_devoluciones_proveedores detalle_devoluciones_proveedores_producto_cambio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.detalle_devoluciones_proveedores
    ADD CONSTRAINT detalle_devoluciones_proveedores_producto_cambio_id_fkey FOREIGN KEY (producto_cambio_id) REFERENCES public.productos(id);


--
-- Name: detalle_devoluciones_proveedores detalle_devoluciones_proveedores_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.detalle_devoluciones_proveedores
    ADD CONSTRAINT detalle_devoluciones_proveedores_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id);


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
-- Name: devoluciones_clientes devoluciones_clientes_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.devoluciones_clientes
    ADD CONSTRAINT devoluciones_clientes_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);


--
-- Name: devoluciones_clientes devoluciones_clientes_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.devoluciones_clientes
    ADD CONSTRAINT devoluciones_clientes_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: devoluciones_clientes devoluciones_clientes_venta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.devoluciones_clientes
    ADD CONSTRAINT devoluciones_clientes_venta_id_fkey FOREIGN KEY (venta_id) REFERENCES public.ventas(id);


--
-- Name: devoluciones_proveedores devoluciones_proveedores_pedido_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.devoluciones_proveedores
    ADD CONSTRAINT devoluciones_proveedores_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES public.pedidos_proveedores(id);


--
-- Name: devoluciones_proveedores devoluciones_proveedores_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.devoluciones_proveedores
    ADD CONSTRAINT devoluciones_proveedores_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id);


--
-- Name: devoluciones_proveedores devoluciones_proveedores_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.devoluciones_proveedores
    ADD CONSTRAINT devoluciones_proveedores_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: envios envios_piloto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.envios
    ADD CONSTRAINT envios_piloto_id_fkey FOREIGN KEY (piloto_id) REFERENCES public.usuarios(id);


--
-- Name: envios envios_venta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.envios
    ADD CONSTRAINT envios_venta_id_fkey FOREIGN KEY (venta_id) REFERENCES public.ventas(id);


--
-- Name: gastos_fijos gastos_fijos_categoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.gastos_fijos
    ADD CONSTRAINT gastos_fijos_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias_gastos(id);


--
-- Name: historial_envios historial_envios_envio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.historial_envios
    ADD CONSTRAINT historial_envios_envio_id_fkey FOREIGN KEY (envio_id) REFERENCES public.envios(id);


--
-- Name: historial_envios historial_envios_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.historial_envios
    ADD CONSTRAINT historial_envios_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


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
-- Name: pagos_gastos pagos_gastos_gasto_fijo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.pagos_gastos
    ADD CONSTRAINT pagos_gastos_gasto_fijo_id_fkey FOREIGN KEY (gasto_fijo_id) REFERENCES public.gastos_fijos(id) ON DELETE CASCADE;


--
-- Name: pagos_gastos pagos_gastos_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.pagos_gastos
    ADD CONSTRAINT pagos_gastos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: pagos_proveedores pagos_proveedores_cuenta_por_pagar_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.pagos_proveedores
    ADD CONSTRAINT pagos_proveedores_cuenta_por_pagar_id_fkey FOREIGN KEY (cuenta_por_pagar_id) REFERENCES public.cuentas_por_pagar(id);


--
-- Name: pagos_proveedores pagos_proveedores_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.pagos_proveedores
    ADD CONSTRAINT pagos_proveedores_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


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
-- Name: ventas ventas_autorizacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_autorizacion_id_fkey FOREIGN KEY (autorizacion_id) REFERENCES public.autorizaciones_descuento(id);


--
-- Name: ventas ventas_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE SET NULL;


--
-- Name: ventas ventas_envio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_envio_id_fkey FOREIGN KEY (envio_id) REFERENCES public.envios(id);


--
-- Name: ventas ventas_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: marlonjimenez
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict KWFIRr5sDynJwY6Ay9hhutMwoih2Eb9PerRdBQLQw521Cefkkwhre5EfRHLBKvD

