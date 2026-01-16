// backend/src/routes/envios.js
const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verificarToken, verificarRol } = require('../middleware/auth');

router.use(verificarToken);

// ============================================
// UTILIDAD DE PAGINACIÓN
// ============================================

/**
 * Función helper para construir respuesta paginada
 */
const construirRespuestaPaginada = (datos, nombreCampo, page, limit, total) => {
  const totalPages = Math.ceil(total / limit);
  
  return {
    [nombreCampo]: datos,  // 'envios'
    datos: datos,          // Para compatibilidad
    paginacion: {
      paginaActual: parseInt(page),
      porPagina: parseInt(limit),
      totalRegistros: parseInt(total),
      totalPaginas: totalPages,
      tienePaginaAnterior: page > 1,
      tienePaginaSiguiente: page < totalPages
    },
    // Mantener compatibilidad
    total: parseInt(total),
    limit: parseInt(limit),
    offset: (page - 1) * limit
  };
};

// ============================================
// ENVÍOS - CRUD COMPLETO
// ============================================

// GET /api/envios - Listar envíos (CON PAGINACIÓN)
router.get('/', async (req, res) => {
  try {
    const { estado, piloto_id, fecha_inicio, fecha_fin, buscar } = req.query;
    
    // Paginación
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    
    let baseQuery = `
      FROM envios e
      JOIN ventas v ON e.venta_id = v.id
      LEFT JOIN clientes c ON v.cliente_id = c.id
      LEFT JOIN usuarios p ON e.piloto_id = p.id
      LEFT JOIN usuarios u ON v.usuario_id = u.id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    // Filtro por rol
    if (req.usuario.rol === 'Piloto') {
      baseQuery += ` AND e.piloto_id = $${paramCount}`;
      params.push(req.usuario.id);
      paramCount++;
    }

    if (estado) {
      baseQuery += ` AND e.estado = $${paramCount}`;
      params.push(estado);
      paramCount++;
    }

    if (piloto_id && (req.usuario.rol === 'Administrador' || req.usuario.rol === 'Gerente')) {
      baseQuery += ` AND e.piloto_id = $${paramCount}`;
      params.push(piloto_id);
      paramCount++;
    }

    if (fecha_inicio) {
      baseQuery += ` AND DATE(e.fecha_pedido) >= $${paramCount}`;
      params.push(fecha_inicio);
      paramCount++;
    }

    if (fecha_fin) {
      baseQuery += ` AND DATE(e.fecha_pedido) <= $${paramCount}`;
      params.push(fecha_fin);
      paramCount++;
    }

    // Búsqueda
    if (buscar && buscar.trim()) {
      baseQuery += ` AND (
        v.folio ILIKE $${paramCount} OR
        c.nombre ILIKE $${paramCount} OR
        c.telefono ILIKE $${paramCount} OR
        e.direccion_entrega ILIKE $${paramCount} OR
        p.nombre ILIKE $${paramCount}
      )`;
      params.push(`%${buscar.trim()}%`);
      paramCount++;
    }

    // Contar total
    const countQuery = `SELECT COUNT(*) as total ${baseQuery}`;
    const countResult = await query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Obtener datos paginados
    let dataQuery = `
      SELECT 
        e.*,
        v.folio as venta_folio,
        v.total as venta_total,
        v.fecha_venta,
        c.nombre as cliente_nombre,
        c.telefono as cliente_telefono,
        c.direccion as cliente_direccion,
        p.nombre as piloto_nombre,
        p.telefono as piloto_telefono,
        u.nombre as vendedor_nombre,
        CASE
          WHEN e.fecha_entrega IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (e.fecha_entrega - e.fecha_pedido))/60
          ELSE NULL
        END as tiempo_total_minutos
      ${baseQuery}
      ORDER BY e.fecha_pedido DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;
    params.push(limit, offset);

    const result = await query(dataQuery, params);

    res.json(construirRespuestaPaginada(
      result.rows,
      'envios',
      page,
      limit,
      total
    ));

  } catch (error) {
    console.error('Error al listar envíos:', error);
    res.status(500).json({ error: 'Error al obtener envíos' });
  }
});

// GET /api/envios/:id - Obtener detalle de envío
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Obtener envío
    const envioResult = await query(`
      SELECT 
        e.*,
        v.folio as venta_folio,
        v.total as venta_total,
        v.subtotal,
        v.fecha_venta,
        v.metodo_pago,
        c.nombre as cliente_nombre,
        c.telefono as cliente_telefono,
        c.email as cliente_email,
        c.direccion as cliente_direccion,
        p.nombre as piloto_nombre,
        p.telefono as piloto_telefono,
        u.nombre as vendedor_nombre
      FROM envios e
      JOIN ventas v ON e.venta_id = v.id
      LEFT JOIN clientes c ON v.cliente_id = c.id
      LEFT JOIN usuarios p ON e.piloto_id = p.id
      LEFT JOIN usuarios u ON v.usuario_id = u.id
      WHERE e.id = $1
    `, [id]);

    if (envioResult.rows.length === 0) {
      return res.status(404).json({ error: 'Envío no encontrado' });
    }

    // Obtener productos de la venta
    const productosResult = await query(`
      SELECT 
        dv.*,
        p.nombre as producto_nombre,
        p.codigo_barras
      FROM detalle_ventas dv
      JOIN productos p ON dv.producto_id = p.id
      WHERE dv.venta_id = $1
    `, [envioResult.rows[0].venta_id]);

    // Obtener historial de estados
    const historialResult = await query(`
      SELECT 
        he.*,
        u.nombre as usuario_nombre
      FROM historial_envios he
      LEFT JOIN usuarios u ON he.usuario_id = u.id
      WHERE he.envio_id = $1
      ORDER BY he.created_at ASC
    `, [id]);

    res.json({
      envio: envioResult.rows[0],
      productos: productosResult.rows,
      historial: historialResult.rows
    });

  } catch (error) {
    console.error('Error al obtener envío:', error);
    res.status(500).json({ error: 'Error al obtener envío' });
  }
});

// POST /api/envios - Crear envío (al registrar venta)
router.post('/', async (req, res) => {
  try {
    const {
      venta_id,
      direccion_entrega,
      referencia_direccion,
      telefono_contacto,
      nombre_contacto,
      notas_cliente,
      costo_envio,
      asignar_piloto_auto
    } = req.body;

    if (!venta_id || !direccion_entrega) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    // Asignar piloto automáticamente si se solicita
    let piloto_id = null;
    if (asignar_piloto_auto) {
      const pilotoResult = await query('SELECT asignar_piloto_automatico() as piloto_id');
      piloto_id = pilotoResult.rows[0].piloto_id;
    }

    const result = await query(`
      INSERT INTO envios (
        venta_id,
        piloto_id,
        direccion_entrega,
        referencia_direccion,
        telefono_contacto,
        nombre_contacto,
        notas_cliente,
        costo_envio,
        estado
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      venta_id,
      piloto_id,
      direccion_entrega,
      referencia_direccion || null,
      telefono_contacto || null,
      nombre_contacto || null,
      notas_cliente || null,
      costo_envio || 0,
      piloto_id ? 'asignado' : 'pendiente'
    ]);

    // Actualizar venta para marcarla como envío
    await query(`
      UPDATE ventas 
      SET es_envio = true, envio_id = $1
      WHERE id = $2
    `, [result.rows[0].id, venta_id]);

    res.status(201).json({
      message: 'Envío creado exitosamente',
      envio: result.rows[0]
    });

  } catch (error) {
    console.error('Error al crear envío:', error);
    res.status(500).json({ error: 'Error al crear envío' });
  }
});

// PUT /api/envios/:id/estado - Cambiar estado del envío
router.put('/:id/estado', async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, notas_piloto, comentario, latitud, longitud } = req.body;

    const estadosValidos = ['pendiente', 'asignado', 'preparando', 'cargado', 'en_ruta', 'entregado', 'cancelado', 'fallido'];
    
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    // Verificar permisos
    const envioActual = await query('SELECT * FROM envios WHERE id = $1', [id]);
    
    if (envioActual.rows.length === 0) {
      return res.status(404).json({ error: 'Envío no encontrado' });
    }

    // El piloto solo puede cambiar sus propios envíos
    // Admin y Gerente pueden cambiar cualquier envío
    if (req.usuario.rol === 'Piloto' && envioActual.rows[0].piloto_id !== req.usuario.id) {
      return res.status(403).json({ error: 'No tienes permiso para modificar este envío' });
    }

    // Actualizar estado
    const result = await query(`
      UPDATE envios
      SET 
        estado = $1,
        notas_piloto = COALESCE($2, notas_piloto)
      WHERE id = $3
      RETURNING *
    `, [estado, notas_piloto, id]);

    // Registrar en historial con datos adicionales
    await query(`
      INSERT INTO historial_envios (
        envio_id,
        estado_anterior,
        estado_nuevo,
        usuario_id,
        comentario,
        latitud,
        longitud
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      id,
      envioActual.rows[0].estado,
      estado,
      req.usuario.id,
      comentario || null,
      latitud || null,
      longitud || null
    ]);

    res.json({
      message: 'Estado actualizado exitosamente',
      envio: result.rows[0]
    });

  } catch (error) {
    console.error('Error al actualizar estado:', error);
    res.status(500).json({ error: 'Error al actualizar estado' });
  }
});

// PUT /api/envios/:id/asignar-piloto - Asignar o reasignar piloto
router.put('/:id/asignar-piloto', verificarRol('Administrador', 'Gerente'), async (req, res) => {
  try {
    const { id } = req.params;
    const { piloto_id } = req.body;

    if (!piloto_id) {
      return res.status(400).json({ error: 'ID de piloto requerido' });
    }

    // Verificar que el piloto existe y es activo
    const pilotoResult = await query(`
      SELECT * FROM usuarios 
      WHERE id = $1 AND rol = 'Piloto' AND activo = true
    `, [piloto_id]);

    if (pilotoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Piloto no encontrado o inactivo' });
    }

    const result = await query(`
      UPDATE envios
      SET 
        piloto_id = $1,
        estado = CASE 
          WHEN estado = 'pendiente' THEN 'asignado'
          ELSE estado
        END,
        fecha_asignacion = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [piloto_id, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Envío no encontrado' });
    }

    res.json({
      message: 'Piloto asignado exitosamente',
      envio: result.rows[0]
    });

  } catch (error) {
    console.error('Error al asignar piloto:', error);
    res.status(500).json({ error: 'Error al asignar piloto' });
  }
});

// PUT /api/envios/:id/entregar - Registrar entrega
router.put('/:id/entregar', async (req, res) => {
  try {
    const { id } = req.params;
    const { firma_cliente, foto_entrega, monto_cobrado, notas_piloto } = req.body;

    // Verificar que el envío pertenece al piloto
    const envioActual = await query('SELECT * FROM envios WHERE id = $1', [id]);
    
    if (envioActual.rows.length === 0) {
      return res.status(404).json({ error: 'Envío no encontrado' });
    }

    if (req.usuario.rol === 'Piloto' && envioActual.rows[0].piloto_id !== req.usuario.id) {
      return res.status(403).json({ error: 'No tienes permiso para modificar este envío' });
    }

    const result = await query(`
      UPDATE envios
      SET 
        estado = 'entregado',
        fecha_entrega = CURRENT_TIMESTAMP,
        firma_cliente = $1,
        foto_entrega = $2,
        monto_cobrado = $3,
        notas_piloto = COALESCE($4, notas_piloto)
      WHERE id = $5
      RETURNING *
    `, [firma_cliente || null, foto_entrega || null, monto_cobrado || null, notas_piloto, id]);

    res.json({
      message: 'Entrega registrada exitosamente',
      envio: result.rows[0]
    });

  } catch (error) {
    console.error('Error al registrar entrega:', error);
    res.status(500).json({ error: 'Error al registrar entrega' });
  }
});

// GET /api/envios/pilotos/disponibles - Listar pilotos disponibles
router.get('/pilotos/disponibles', verificarRol('Administrador', 'Gerente', 'Vendedor'), async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        u.id,
        u.nombre,
        u.telefono,
        COUNT(e.id) as envios_activos
      FROM usuarios u
      LEFT JOIN envios e ON u.id = e.piloto_id 
        AND e.estado IN ('asignado', 'preparando', 'cargado', 'en_ruta')
      WHERE u.rol = 'Piloto'
      AND u.activo = true
      GROUP BY u.id, u.nombre, u.telefono
      ORDER BY envios_activos ASC, u.nombre
    `);

    res.json({
      pilotos: result.rows
    });

  } catch (error) {
    console.error('Error al listar pilotos:', error);
    res.status(500).json({ error: 'Error al obtener pilotos' });
  }
});

// GET /api/envios/estadisticas - Estadísticas de envíos
router.get('/estadisticas/resumen', verificarRol('Administrador', 'Gerente'), async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin, piloto_id } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (fecha_inicio) {
      whereClause += ` AND DATE(fecha_pedido) >= $${paramCount}`;
      params.push(fecha_inicio);
      paramCount++;
    }

    if (fecha_fin) {
      whereClause += ` AND DATE(fecha_pedido) <= $${paramCount}`;
      params.push(fecha_fin);
      paramCount++;
    }

    if (piloto_id) {
      whereClause += ` AND piloto_id = $${paramCount}`;
      params.push(piloto_id);
      paramCount++;
    }

    // Total por estado
    const porEstado = await query(`
      SELECT 
        estado,
        COUNT(*) as total,
        COALESCE(SUM(costo_envio), 0) as total_costo
      FROM envios
      ${whereClause}
      GROUP BY estado
    `, params);

    // Tiempo promedio de entrega
    const tiempos = await query(`
      SELECT 
        AVG(EXTRACT(EPOCH FROM (fecha_entrega - fecha_pedido))/60) as tiempo_promedio_minutos,
        MIN(EXTRACT(EPOCH FROM (fecha_entrega - fecha_pedido))/60) as tiempo_minimo_minutos,
        MAX(EXTRACT(EPOCH FROM (fecha_entrega - fecha_pedido))/60) as tiempo_maximo_minutos
      FROM envios
      ${whereClause}
      AND estado = 'entregado'
    `, params);

    // Por piloto
    const porPiloto = await query(`
      SELECT 
        u.nombre as piloto_nombre,
        COUNT(e.id) as total_envios,
        COUNT(CASE WHEN e.estado = 'entregado' THEN 1 END) as entregados,
        COUNT(CASE WHEN e.estado IN ('asignado', 'preparando', 'cargado', 'en_ruta') THEN 1 END) as activos
      FROM usuarios u
      LEFT JOIN envios e ON u.id = e.piloto_id
      WHERE u.rol = 'Piloto'
      AND u.activo = true
      GROUP BY u.nombre
      ORDER BY total_envios DESC
    `);

    res.json({
      porEstado: porEstado.rows,
      tiempos: tiempos.rows[0],
      porPiloto: porPiloto.rows
    });

  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

module.exports = router;