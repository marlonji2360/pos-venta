// src/routes/historial-precios.js
const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verificarToken, verificarRol } = require('../middleware/auth');

router.use(verificarToken);

// GET /api/historial-precios - Obtener historial general
router.get('/', verificarRol('Administrador', 'Gerente'), async (req, res) => {
  try {
    const { limit = 50, offset = 0, tipo_precio, producto_id } = req.query;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (tipo_precio) {
      whereClause += ` AND hp.tipo_precio = $${paramCount}`;
      params.push(tipo_precio);
      paramCount++;
    }

    if (producto_id) {
      whereClause += ` AND hp.producto_id = $${paramCount}`;
      params.push(producto_id);
      paramCount++;
    }

    whereClause += ` ORDER BY hp.fecha_cambio DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await query(`
      SELECT 
        hp.id,
        hp.producto_id,
        hp.precio_anterior,
        hp.precio_nuevo,
        hp.tipo_precio,
        hp.motivo,
        hp.fecha_cambio,
        p.nombre as producto_nombre,
        p.codigo_barras,
        u.nombre as usuario_nombre,
        (hp.precio_nuevo - hp.precio_anterior) as diferencia,
        ROUND(((hp.precio_nuevo - hp.precio_anterior) / hp.precio_anterior * 100)::numeric, 2) as porcentaje_cambio
      FROM historial_precios hp
      JOIN productos p ON hp.producto_id = p.id
      LEFT JOIN usuarios u ON hp.usuario_id = u.id
      ${whereClause}
    `, params);

    const countResult = await query(
      'SELECT COUNT(*) as total FROM historial_precios'
    );

    res.json({
      historial: result.rows,
      total: parseInt(countResult.rows[0].total)
    });

  } catch (error) {
    console.error('Error al obtener historial de precios:', error);
    res.status(500).json({ 
      error: 'Error al obtener historial de precios' 
    });
  }
});

// GET /api/historial-precios/producto/:id - Historial de un producto específico
router.get('/producto/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Obtener información del producto
    const productoResult = await query(
      'SELECT id, nombre, codigo_barras, precio_compra, precio_venta FROM productos WHERE id = $1',
      [id]
    );

    if (productoResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Producto no encontrado' 
      });
    }

    // Obtener historial completo
    const historialResult = await query(`
      SELECT 
        hp.id,
        hp.precio_anterior,
        hp.precio_nuevo,
        hp.tipo_precio,
        hp.motivo,
        hp.fecha_cambio,
        u.nombre as usuario_nombre,
        (hp.precio_nuevo - hp.precio_anterior) as diferencia,
        ROUND(((hp.precio_nuevo - hp.precio_anterior) / hp.precio_anterior * 100)::numeric, 2) as porcentaje_cambio
      FROM historial_precios hp
      LEFT JOIN usuarios u ON hp.usuario_id = u.id
      WHERE hp.producto_id = $1
      ORDER BY hp.fecha_cambio DESC
    `, [id]);

    // Obtener estadísticas
    const statsResult = await query(`
      SELECT 
        tipo_precio,
        COUNT(*) as num_cambios,
        MIN(precio_nuevo) as precio_minimo,
        MAX(precio_nuevo) as precio_maximo,
        AVG(precio_nuevo) as precio_promedio
      FROM historial_precios
      WHERE producto_id = $1
      GROUP BY tipo_precio
    `, [id]);

    res.json({
      producto: productoResult.rows[0],
      historial: historialResult.rows,
      estadisticas: statsResult.rows
    });

  } catch (error) {
    console.error('Error al obtener historial del producto:', error);
    res.status(500).json({ 
      error: 'Error al obtener historial del producto' 
    });
  }
});

// GET /api/historial-precios/estadisticas - Estadísticas generales
router.get('/estadisticas', verificarRol('Administrador', 'Gerente'), async (req, res) => {
  try {
    const { dias = 30 } = req.query;

    // Productos con más cambios
    const productosResult = await query(`
      SELECT 
        p.id,
        p.nombre,
        p.codigo_barras,
        COUNT(hp.id) as num_cambios,
        MAX(hp.fecha_cambio) as ultimo_cambio
      FROM productos p
      JOIN historial_precios hp ON p.id = hp.producto_id
      WHERE hp.fecha_cambio >= CURRENT_DATE - INTERVAL '${parseInt(dias)} days'
      GROUP BY p.id, p.nombre, p.codigo_barras
      ORDER BY num_cambios DESC
      LIMIT 10
    `);

    // Cambios por día
    const cambiosPorDiaResult = await query(`
      SELECT 
        DATE(fecha_cambio) as fecha,
        COUNT(*) as num_cambios
      FROM historial_precios
      WHERE fecha_cambio >= CURRENT_DATE - INTERVAL '${parseInt(dias)} days'
      GROUP BY DATE(fecha_cambio)
      ORDER BY fecha DESC
    `);

    // Cambios por tipo
    const cambiosPorTipoResult = await query(`
      SELECT 
        tipo_precio,
        COUNT(*) as num_cambios
      FROM historial_precios
      WHERE fecha_cambio >= CURRENT_DATE - INTERVAL '${parseInt(dias)} days'
      GROUP BY tipo_precio
    `);

    // Total de cambios
    const totalResult = await query(`
      SELECT COUNT(*) as total
      FROM historial_precios
      WHERE fecha_cambio >= CURRENT_DATE - INTERVAL '${parseInt(dias)} days'
    `);

    res.json({
      productos_mas_cambios: productosResult.rows,
      cambios_por_dia: cambiosPorDiaResult.rows,
      cambios_por_tipo: cambiosPorTipoResult.rows,
      total_cambios: parseInt(totalResult.rows[0].total)
    });

  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ 
      error: 'Error al obtener estadísticas' 
    });
  }
});

// POST /api/historial-precios/registrar - Registrar cambio manual
router.post('/registrar', verificarRol('Administrador', 'Gerente'), async (req, res) => {
  try {
    const {
      producto_id,
      precio_anterior,
      precio_nuevo,
      tipo_precio,
      motivo
    } = req.body;

    if (!producto_id || !precio_anterior || !precio_nuevo || !tipo_precio) {
      return res.status(400).json({ 
        error: 'Todos los campos son requeridos' 
      });
    }

    const result = await query(`
      INSERT INTO historial_precios (
        producto_id,
        precio_anterior,
        precio_nuevo,
        tipo_precio,
        usuario_id,
        motivo
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      producto_id,
      precio_anterior,
      precio_nuevo,
      tipo_precio,
      req.usuario.id,
      motivo || 'Cambio manual'
    ]);

    res.status(201).json({
      message: 'Cambio registrado exitosamente',
      cambio: result.rows[0]
    });

  } catch (error) {
    console.error('Error al registrar cambio:', error);
    res.status(500).json({ 
      error: 'Error al registrar cambio' 
    });
  }
});

module.exports = router;
