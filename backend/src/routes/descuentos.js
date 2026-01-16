// backend/src/routes/descuentos.js
const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verificarToken, verificarRol } = require('../middleware/auth');

router.use(verificarToken);

// ============================================
// DESCUENTOS POR VOLUMEN
// ============================================

// GET /api/descuentos/volumen - Listar todos los descuentos por volumen
router.get('/volumen', verificarRol('Administrador', 'Gerente'), async (req, res) => {
  try {
    const { producto_id, activo, limit = 1000, offset = 0 } = req.query;
    
    let queryText = `
      SELECT 
        dv.*,
        p.nombre as producto_nombre,
        p.codigo_barras as producto_codigo,
        p.precio_venta as producto_precio
      FROM descuentos_volumen dv
      JOIN productos p ON dv.producto_id = p.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (producto_id) {
      queryText += ` AND dv.producto_id = $${paramCount}`;
      params.push(producto_id);
      paramCount++;
    }

    if (activo !== undefined) {
      queryText += ` AND dv.activo = $${paramCount}`;
      params.push(activo === 'true');
      paramCount++;
    }

    queryText += ` ORDER BY p.nombre, dv.cantidad_minima LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await query(queryText, params);

    // Contar total con los mismos filtros
    let countQuery = `
      SELECT COUNT(*) as total
      FROM descuentos_volumen dv
      JOIN productos p ON dv.producto_id = p.id
      WHERE 1=1
    `;
    const countParams = [];
    let countParamCount = 1;

    if (producto_id) {
      countQuery += ` AND dv.producto_id = $${countParamCount}`;
      countParams.push(producto_id);
      countParamCount++;
    }

    if (activo !== undefined) {
      countQuery += ` AND dv.activo = $${countParamCount}`;
      countParams.push(activo === 'true');
      countParamCount++;
    }

    const countResult = await query(countQuery, countParams);

    res.json({
      descuentos: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('Error al listar descuentos por volumen:', error);
    res.status(500).json({ 
      error: 'Error al obtener descuentos' 
    });
  }
});

// GET /api/descuentos/volumen/producto/:id - Obtener descuentos de un producto
router.get('/volumen/producto/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(`
      SELECT *
      FROM descuentos_volumen
      WHERE producto_id = $1
      AND activo = true
      AND (fecha_inicio IS NULL OR fecha_inicio <= CURRENT_DATE)
      AND (fecha_fin IS NULL OR fecha_fin >= CURRENT_DATE)
      ORDER BY cantidad_minima DESC
    `, [id]);

    res.json({
      descuentos: result.rows
    });

  } catch (error) {
    console.error('Error al obtener descuentos del producto:', error);
    res.status(500).json({ 
      error: 'Error al obtener descuentos' 
    });
  }
});

// POST /api/descuentos/volumen - Crear descuento por volumen
router.post('/volumen', verificarRol('Administrador', 'Gerente'), async (req, res) => {
  try {
    const {
      producto_id,
      cantidad_minima,
      porcentaje_descuento,
      fecha_inicio,
      fecha_fin
    } = req.body;

    if (!producto_id || !cantidad_minima || !porcentaje_descuento) {
      return res.status(400).json({ 
        error: 'Datos incompletos' 
      });
    }

    if (cantidad_minima < 1) {
      return res.status(400).json({ 
        error: 'La cantidad mínima debe ser mayor a 0' 
      });
    }

    if (porcentaje_descuento <= 0 || porcentaje_descuento > 100) {
      return res.status(400).json({ 
        error: 'El porcentaje debe estar entre 0 y 100' 
      });
    }

    const result = await query(`
      INSERT INTO descuentos_volumen (
        producto_id,
        cantidad_minima,
        porcentaje_descuento,
        fecha_inicio,
        fecha_fin
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      producto_id,
      cantidad_minima,
      porcentaje_descuento,
      fecha_inicio || null,
      fecha_fin || null
    ]);

    res.status(201).json({
      message: 'Descuento creado exitosamente',
      descuento: result.rows[0]
    });

  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ 
        error: 'Ya existe un descuento para esta cantidad en este producto' 
      });
    }
    console.error('Error al crear descuento:', error);
    res.status(500).json({ 
      error: 'Error al crear descuento' 
    });
  }
});

// PUT /api/descuentos/volumen/:id - Actualizar descuento
router.put('/volumen/:id', verificarRol('Administrador', 'Gerente'), async (req, res) => {
  try {
    const { id } = req.params;
    const { porcentaje_descuento, activo, fecha_inicio, fecha_fin } = req.body;

    const result = await query(`
      UPDATE descuentos_volumen
      SET 
        porcentaje_descuento = COALESCE($1, porcentaje_descuento),
        activo = COALESCE($2, activo),
        fecha_inicio = COALESCE($3, fecha_inicio),
        fecha_fin = COALESCE($4, fecha_fin),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *
    `, [porcentaje_descuento, activo, fecha_inicio, fecha_fin, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Descuento no encontrado' 
      });
    }

    res.json({
      message: 'Descuento actualizado exitosamente',
      descuento: result.rows[0]
    });

  } catch (error) {
    console.error('Error al actualizar descuento:', error);
    res.status(500).json({ 
      error: 'Error al actualizar descuento' 
    });
  }
});

// DELETE /api/descuentos/volumen/:id - Eliminar descuento
router.delete('/volumen/:id', verificarRol('Administrador'), async (req, res) => {
  try {
    const { id } = req.params;

    await query('DELETE FROM descuentos_volumen WHERE id = $1', [id]);

    res.json({
      message: 'Descuento eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error al eliminar descuento:', error);
    res.status(500).json({ 
      error: 'Error al eliminar descuento' 
    });
  }
});

// POST /api/descuentos/calcular - Calcular descuentos para un carrito
router.post('/calcular', async (req, res) => {
  try {
    const { productos } = req.body; // Array de {producto_id, cantidad}

    if (!productos || productos.length === 0) {
      return res.json({ productos: [] });
    }

    const productosConDescuento = [];

    for (const item of productos) {
      // Buscar el mejor descuento aplicable
      const descuentos = await query(`
        SELECT *
        FROM descuentos_volumen
        WHERE producto_id = $1
        AND cantidad_minima <= $2
        AND activo = true
        AND (fecha_inicio IS NULL OR fecha_inicio <= CURRENT_DATE)
        AND (fecha_fin IS NULL OR fecha_fin >= CURRENT_DATE)
        ORDER BY cantidad_minima DESC
        LIMIT 1
      `, [item.producto_id, item.cantidad]);

      if (descuentos.rows.length > 0) {
        const descuento = descuentos.rows[0];
        productosConDescuento.push({
          producto_id: item.producto_id,
          cantidad: item.cantidad,
          descuento_id: descuento.id,
          porcentaje_descuento: parseFloat(descuento.porcentaje_descuento),
          cantidad_minima: descuento.cantidad_minima
        });
      }
    }

    res.json({
      productos: productosConDescuento
    });

  } catch (error) {
    console.error('Error al calcular descuentos:', error);
    res.status(500).json({ 
      error: 'Error al calcular descuentos' 
    });
  }
});

// ============================================
// AUTORIZACIONES DE DESCUENTO
// ============================================

// GET /api/descuentos/autorizaciones - Listar autorizaciones
router.get('/autorizaciones', async (req, res) => {
  try {
    const { estado, limit = 1000, offset = 0 } = req.query;
    
    let queryText = `
      SELECT 
        ad.*,
        us.nombre as solicitado_por_nombre,
        ua.nombre as autorizado_por_nombre
      FROM autorizaciones_descuento ad
      LEFT JOIN usuarios us ON ad.solicitado_por = us.id
      LEFT JOIN usuarios ua ON ad.autorizado_por = ua.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    // Si es vendedor, solo ve sus propias solicitudes
    if (req.usuario.rol !== 'Administrador' && req.usuario.rol !== 'Gerente') {
      queryText += ` AND ad.solicitado_por = $${paramCount}`;
      params.push(req.usuario.id);
      paramCount++;
    }

    if (estado) {
      queryText += ` AND ad.estado = $${paramCount}`;
      params.push(estado);
      paramCount++;
    }

    queryText += ` ORDER BY ad.fecha_solicitud DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await query(queryText, params);

    // Contar total con los mismos filtros
    let countQuery = `
      SELECT COUNT(*) as total
      FROM autorizaciones_descuento ad
      WHERE 1=1
    `;
    const countParams = [];
    let countParamCount = 1;

    if (req.usuario.rol !== 'Administrador' && req.usuario.rol !== 'Gerente') {
      countQuery += ` AND ad.solicitado_por = $${countParamCount}`;
      countParams.push(req.usuario.id);
      countParamCount++;
    }

    if (estado) {
      countQuery += ` AND ad.estado = $${countParamCount}`;
      countParams.push(estado);
      countParamCount++;
    }

    const countResult = await query(countQuery, countParams);

    res.json({
      autorizaciones: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('Error al listar autorizaciones:', error);
    res.status(500).json({ 
      error: 'Error al obtener autorizaciones' 
    });
  }
});

/// POST /api/descuentos/solicitar-autorizacion - Solicitar autorización de descuento
router.post('/solicitar-autorizacion', async (req, res) => {
  try {
    const { monto_descuento, porcentaje_descuento, motivo } = req.body;

    if (!monto_descuento || monto_descuento <= 0) {
      return res.status(400).json({ 
        error: 'Monto de descuento inválido' 
      });
    }

    const result = await query(`
      INSERT INTO autorizaciones_descuento (
        monto_descuento,
        porcentaje_descuento,
        motivo,
        solicitado_por,
        estado
      ) VALUES ($1, $2, $3, $4, 'pendiente')
      RETURNING *
    `, [
      monto_descuento,
      porcentaje_descuento || null,
      motivo,
      req.usuario.id
    ]);

    const autorizacion = result.rows[0];

    

    res.status(201).json({
      message: 'Solicitud de autorización creada',
      autorizacion: autorizacion
    });

  } catch (error) {
    console.error('Error al solicitar autorización:', error);
    res.status(500).json({ 
      error: 'Error al solicitar autorización' 
    });
  }
});

// POST /api/descuentos/autorizar/:id - Aprobar o rechazar descuento
router.post('/autorizar/:id', verificarRol('Administrador', 'Gerente'), async (req, res) => {
  try {
    const { id } = req.params;
    const { aprobar, notas } = req.body; // aprobar: true/false

    const estado = aprobar ? 'aprobado' : 'rechazado';

    const result = await query(`
      UPDATE autorizaciones_descuento
      SET 
        estado = $1,
        autorizado_por = $2,
        fecha_respuesta = CURRENT_TIMESTAMP,
        notas_autorizacion = $3
      WHERE id = $4
      AND estado = 'pendiente'
      RETURNING *
    `, [estado, req.usuario.id, notas, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Autorización no encontrada o ya procesada' 
      });
    }

    res.json({
      message: `Descuento ${aprobar ? 'aprobado' : 'rechazado'}`,
      autorizacion: result.rows[0]
    });

  } catch (error) {
    console.error('Error al autorizar descuento:', error);
    res.status(500).json({ 
      error: 'Error al procesar autorización' 
    });
  }
});

module.exports = router;