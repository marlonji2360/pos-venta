// src/routes/productos.js - Rutas de productos CORREGIDAS
const express = require('express');
const router = express.Router();
const { query, transaction } = require('../config/database');
const { verificarToken, verificarRol } = require('../middleware/auth');

// Aplicar verificación de token a todas las rutas
router.use(verificarToken);

// GET /api/productos - Listar todos los productos
router.get('/', async (req, res) => {
  try {
    const { activo, categoria_id, search, limit = 50, offset = 0 } = req.query;
    
    let queryText = `
      SELECT p.*, c.nombre as categoria_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    // Filtros opcionales
    if (activo !== undefined) {
      queryText += ` AND p.activo = $${paramCount}`;
      params.push(activo === 'true');
      paramCount++;
    }

    if (categoria_id) {
      queryText += ` AND p.categoria_id = $${paramCount}`;
      params.push(categoria_id);
      paramCount++;
    }

    if (search) {
      queryText += ` AND (p.nombre ILIKE $${paramCount} OR p.codigo_barras ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    queryText += ` ORDER BY p.nombre LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await query(queryText, params);

    // Contar total de productos
    const countResult = await query(
      'SELECT COUNT(*) as total FROM productos WHERE activo = true'
    );

    res.json({
      productos: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('Error al listar productos:', error);
    res.status(500).json({ 
      error: 'Error al obtener productos' 
    });
  }
});

// GET /api/productos/:id - Obtener un producto específico
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT p.*, c.nombre as categoria_nombre
       FROM productos p
       LEFT JOIN categorias c ON p.categoria_id = c.id
       WHERE p.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Producto no encontrado' 
      });
    }

    // Obtener lotes del producto
    const lotes = await query(
      `SELECT * FROM lotes_productos 
       WHERE producto_id = $1 AND activo = true
       ORDER BY fecha_vencimiento ASC`,
      [id]
    );

    res.json({
      producto: result.rows[0],
      lotes: lotes.rows
    });

  } catch (error) {
    console.error('Error al obtener producto:', error);
    res.status(500).json({ 
      error: 'Error al obtener producto' 
    });
  }
});

// POST /api/productos - Crear nuevo producto
router.post('/', verificarRol('Administrador', 'Gerente'), async (req, res) => {
  try {
    const {
      codigo_barras,
      sku,
      nombre,
      descripcion,
      categoria_id,
      precio_compra,
      precio_venta,
      stock_actual,
      stock_minimo,
      stock_maximo,
      unidad_medida,
      requiere_vencimiento,
      dias_alerta_vencimiento,
      imagen_url
    } = req.body;

    // Validar datos requeridos
    if (!nombre || !precio_compra || !precio_venta) {
      return res.status(400).json({ 
        error: 'Nombre, precio de compra y precio de venta son requeridos' 
      });
    }

    // Verificar que no exista el código de barras
    if (codigo_barras) {
      const existe = await query(
        'SELECT id FROM productos WHERE codigo_barras = $1',
        [codigo_barras]
      );
      if (existe.rows.length > 0) {
        return res.status(400).json({ 
          error: 'El código de barras ya existe' 
        });
      }
    }

    // Insertar producto
    const result = await query(
      `INSERT INTO productos (
        codigo_barras, sku, nombre, descripcion, categoria_id,
        precio_compra, precio_venta, stock_actual, stock_minimo, stock_maximo,
        unidad_medida, requiere_vencimiento, dias_alerta_vencimiento, imagen_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        codigo_barras, sku, nombre, descripcion, categoria_id,
        precio_compra, precio_venta, stock_actual || 0, stock_minimo || 10, 
        stock_maximo || 1000, unidad_medida || 'pieza', 
        requiere_vencimiento || false, dias_alerta_vencimiento || 30, imagen_url
      ]
    );

    res.status(201).json({
      message: 'Producto creado exitosamente',
      producto: result.rows[0]
    });

  } catch (error) {
    console.error('Error al crear producto:', error);
    res.status(500).json({ 
      error: 'Error al crear producto' 
    });
  }
});

// PUT /api/productos/:id - Actualizar producto (CORREGIDO)
router.put('/:id', verificarRol('Administrador', 'Gerente'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      codigo_barras,
      sku,
      nombre,
      descripcion,
      categoria_id,
      precio_compra,
      precio_venta,
      stock_minimo,
      stock_maximo,
      unidad_medida,
      requiere_vencimiento,
      dias_alerta_vencimiento,
      imagen_url,
      activo
    } = req.body;

    console.log('Actualizando producto:', id, req.body);

    // Verificar que el producto existe
    const existe = await query('SELECT id FROM productos WHERE id = $1', [id]);
    if (existe.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Producto no encontrado' 
      });
    }

    // Construir query dinámicamente solo con los campos que vienen
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (codigo_barras !== undefined) {
      updates.push(`codigo_barras = $${paramCount++}`);
      values.push(codigo_barras);
    }
    if (sku !== undefined) {
      updates.push(`sku = $${paramCount++}`);
      values.push(sku);
    }
    if (nombre !== undefined) {
      updates.push(`nombre = $${paramCount++}`);
      values.push(nombre);
    }
    if (descripcion !== undefined) {
      updates.push(`descripcion = $${paramCount++}`);
      values.push(descripcion);
    }
    if (categoria_id !== undefined) {
      updates.push(`categoria_id = $${paramCount++}`);
      values.push(categoria_id || null);
    }
    if (precio_compra !== undefined) {
      updates.push(`precio_compra = $${paramCount++}`);
      values.push(precio_compra);
    }
    if (precio_venta !== undefined) {
      updates.push(`precio_venta = $${paramCount++}`);
      values.push(precio_venta);
    }
    if (stock_minimo !== undefined) {
      updates.push(`stock_minimo = $${paramCount++}`);
      values.push(stock_minimo);
    }
    if (stock_maximo !== undefined) {
      updates.push(`stock_maximo = $${paramCount++}`);
      values.push(stock_maximo);
    }
    if (unidad_medida !== undefined) {
      updates.push(`unidad_medida = $${paramCount++}`);
      values.push(unidad_medida);
    }
    if (requiere_vencimiento !== undefined) {
      updates.push(`requiere_vencimiento = $${paramCount++}`);
      values.push(requiere_vencimiento);
    }
    if (dias_alerta_vencimiento !== undefined) {
      updates.push(`dias_alerta_vencimiento = $${paramCount++}`);
      values.push(dias_alerta_vencimiento);
    }
    if (imagen_url !== undefined) {
      updates.push(`imagen_url = $${paramCount++}`);
      values.push(imagen_url);
    }
    if (activo !== undefined) {
      updates.push(`activo = $${paramCount++}`);
      values.push(activo);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const queryText = `UPDATE productos SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;

    const result = await query(queryText, values);

    res.json({
      message: 'Producto actualizado exitosamente',
      producto: result.rows[0]
    });

  } catch (error) {
    console.error('Error al actualizar producto:', error);
    res.status(500).json({ 
      error: 'Error al actualizar producto',
      detalles: error.message
    });
  }
});

// DELETE /api/productos/:id - Eliminar producto (soft delete) (CORREGIDO)
router.delete('/:id', verificarRol('Administrador'), async (req, res) => {
  try {
    const { id } = req.params;

    console.log('Eliminando producto:', id);

    const result = await query(
      'UPDATE productos SET activo = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Producto no encontrado' 
      });
    }

    res.json({
      message: 'Producto desactivado exitosamente',
      producto: result.rows[0]
    });

  } catch (error) {
    console.error('Error al eliminar producto:', error);
    res.status(500).json({ 
      error: 'Error al eliminar producto',
      detalles: error.message
    });
  }
});

// GET /api/productos/alertas/stock-bajo - Productos con stock bajo
router.get('/alertas/stock-bajo', async (req, res) => {
  try {
    const result = await query('SELECT * FROM vista_stock_bajo LIMIT 50');

    res.json({
      productos: result.rows,
      total: result.rows.length
    });

  } catch (error) {
    console.error('Error al obtener productos con stock bajo:', error);
    res.status(500).json({ 
      error: 'Error al obtener alertas de stock' 
    });
  }
});

// GET /api/productos/alertas/por-vencer - Productos próximos a vencer
router.get('/alertas/por-vencer', async (req, res) => {
  try {
    const result = await query('SELECT * FROM vista_productos_por_vencer');

    res.json({
      productos: result.rows,
      total: result.rows.length
    });

  } catch (error) {
    console.error('Error al obtener productos por vencer:', error);
    res.status(500).json({ 
      error: 'Error al obtener alertas de vencimiento' 
    });
  }
});

module.exports = router;
