// src/routes/ventas.js
const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verificarToken, verificarRol } = require('../middleware/auth');

router.use(verificarToken);

// POST /api/ventas - Crear nueva venta
router.post('/', verificarRol('Administrador', 'Gerente', 'Vendedor'), async (req, res) => {
  const client = await require('../config/database').pool.connect();
  
  try {
    const {
      cliente_id,
      metodo_pago,
      subtotal,
      iva,
      total,
      productos
    } = req.body;

    // Validar datos requeridos
    if (!metodo_pago || !total || !productos || productos.length === 0) {
      return res.status(400).json({ 
        error: 'Datos incompletos. Se requiere método de pago, total y productos' 
      });
    }

    await client.query('BEGIN');

    // VALIDAR STOCK Y CREAR ADVERTENCIAS (pero permitir la venta)
    const advertencias = [];
    for (const item of productos) {
      const stockResult = await client.query(
        'SELECT stock_actual, nombre FROM productos WHERE id = $1',
        [item.producto_id]
      );

      if (stockResult.rows.length === 0) {
        throw new Error(`Producto con ID ${item.producto_id} no encontrado`);
      }

      const producto = stockResult.rows[0];
      if (producto.stock_actual < item.cantidad) {
        advertencias.push({
          producto_id: item.producto_id,
          producto_nombre: producto.nombre,
          stock_actual: producto.stock_actual,
          cantidad_solicitada: item.cantidad,
          faltante: item.cantidad - producto.stock_actual
        });
      }
    }

    // Generar folio único
    const folioResult = await client.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(folio FROM 6) AS INTEGER)), 0) + 1 as next_num 
       FROM ventas 
       WHERE folio LIKE 'VTA-%'`
    );
    const folio = `VTA-${String(folioResult.rows[0].next_num).padStart(6, '0')}`;

    // Insertar venta
    const ventaResult = await client.query(
      `INSERT INTO ventas (
        folio, 
        usuario_id, 
        cliente_id, 
        fecha_venta, 
        metodo_pago, 
        subtotal, 
        iva, 
        total, 
        estado
      ) VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, 'completada')
      RETURNING *`,
      [folio, req.usuario.id, cliente_id, metodo_pago, subtotal, iva, total]
    );

    const venta = ventaResult.rows[0];

    // Insertar detalles de venta y actualizar stock
    for (const item of productos) {
      // Insertar detalle de venta
      await client.query(
        `INSERT INTO detalle_ventas (
          venta_id, 
          producto_id, 
          cantidad, 
          precio_unitario, 
          subtotal
        ) VALUES ($1, $2, $3, $4, $5)`,
        [
          venta.id, 
          item.producto_id, 
          item.cantidad, 
          item.precio_unitario,
          item.cantidad * item.precio_unitario
        ]
      );

      // Actualizar stock del producto
      await client.query(
        'UPDATE productos SET stock_actual = stock_actual - $1 WHERE id = $2',
        [item.cantidad, item.producto_id]
      );

      // Registrar movimiento de inventario
      await client.query(
        `INSERT INTO movimientos_inventario (
          producto_id,
          tipo_movimiento,
          cantidad,
          motivo,
          usuario_id,
          referencia
        ) VALUES ($1, 'salida', $2, 'Venta', $3, $4)`,
        [item.producto_id, item.cantidad, req.usuario.id, `Venta ${folio}`]
      );

      // Si hay advertencia de stock, crear notificación
      const advertencia = advertencias.find(a => a.producto_id === item.producto_id);
      if (advertencia) {
        await client.query(
          `INSERT INTO notificaciones (
            tipo,
            titulo,
            mensaje,
            prioridad,
            datos,
            fecha
          ) VALUES ($1, $2, $3, $4, $5, NOW())`,
          [
            'stock_negativo',
            'Stock Insuficiente en Venta',
            `El producto "${advertencia.producto_nombre}" se vendió con stock insuficiente. Stock: ${advertencia.stock_actual}, Vendido: ${advertencia.cantidad_solicitada}, Faltante: ${advertencia.faltante}`,
            'alta',
            JSON.stringify({
              producto_id: advertencia.producto_id,
              producto_nombre: advertencia.producto_nombre,
              stock_actual: advertencia.stock_actual,
              cantidad_vendida: advertencia.cantidad_solicitada,
              faltante: advertencia.faltante,
              venta_folio: folio
            })
          ]
        );
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: advertencias.length > 0 
        ? 'Venta registrada con advertencias de stock' 
        : 'Venta registrada exitosamente',
      venta: {
        id: venta.id,
        folio: venta.folio,
        total: venta.total,
        fecha: venta.fecha_venta
      },
      advertencias: advertencias.length > 0 ? advertencias : undefined,
      stock_negativo: advertencias.length > 0
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al crear venta:', error);
    res.status(500).json({ 
      error: error.message || 'Error al registrar venta',
      detalles: error.message
    });
  } finally {
    client.release();
  }
});

// GET /api/ventas - Listar ventas
router.get('/', async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin, estado, limit = 50, offset = 0 } = req.query;
    
    let queryText = `
      SELECT 
        v.*,
        u.nombre as vendedor_nombre,
        c.nombre as cliente_nombre,
        COUNT(dv.id) as cantidad_productos
      FROM ventas v
      LEFT JOIN usuarios u ON v.usuario_id = u.id
      LEFT JOIN clientes c ON v.cliente_id = c.id
      LEFT JOIN detalle_ventas dv ON v.id = dv.venta_id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (fecha_inicio) {
      queryText += ` AND v.fecha_venta >= $${paramCount}`;
      params.push(fecha_inicio);
      paramCount++;
    }

    if (fecha_fin) {
      queryText += ` AND v.fecha_venta <= $${paramCount}`;
      params.push(fecha_fin);
      paramCount++;
    }

    if (estado) {
      queryText += ` AND v.estado = $${paramCount}`;
      params.push(estado);
      paramCount++;
    }

    queryText += ` 
      GROUP BY v.id, u.nombre, c.nombre
      ORDER BY v.fecha_venta DESC 
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;
    params.push(limit, offset);

    const result = await query(queryText, params);

    const countResult = await query('SELECT COUNT(*) as total FROM ventas');

    res.json({
      ventas: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('Error al listar ventas:', error);
    res.status(500).json({ 
      error: 'Error al obtener ventas' 
    });
  }
});

// GET /api/ventas/:id - Obtener detalle de una venta
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const ventaResult = await query(
      `SELECT 
        v.*,
        u.nombre as vendedor_nombre,
        c.nombre as cliente_nombre,
        c.telefono as cliente_telefono,
        c.email as cliente_email
      FROM ventas v
      LEFT JOIN usuarios u ON v.usuario_id = u.id
      LEFT JOIN clientes c ON v.cliente_id = c.id
      WHERE v.id = $1`,
      [id]
    );

    if (ventaResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Venta no encontrada' 
      });
    }

    const detalleResult = await query(
      `SELECT 
        dv.*,
        p.nombre as producto_nombre,
        p.codigo_barras
      FROM detalle_ventas dv
      JOIN productos p ON dv.producto_id = p.id
      WHERE dv.venta_id = $1`,
      [id]
    );

    res.json({
      venta: ventaResult.rows[0],
      detalle: detalleResult.rows
    });

  } catch (error) {
    console.error('Error al obtener venta:', error);
    res.status(500).json({ 
      error: 'Error al obtener detalle de venta' 
    });
  }
});

// DELETE /api/ventas/:id - Cancelar venta (devuelve stock)
router.delete('/:id', verificarRol('Administrador', 'Gerente'), async (req, res) => {
  const client = await require('../config/database').pool.connect();
  
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    // Verificar que la venta existe
    const ventaResult = await client.query(
      'SELECT * FROM ventas WHERE id = $1',
      [id]
    );

    if (ventaResult.rows.length === 0) {
      throw new Error('Venta no encontrada');
    }

    const venta = ventaResult.rows[0];

    if (venta.estado === 'cancelada') {
      throw new Error('La venta ya está cancelada');
    }

    // Obtener productos de la venta
    const detalleResult = await client.query(
      'SELECT producto_id, cantidad FROM detalle_ventas WHERE venta_id = $1',
      [id]
    );

    // Devolver stock a cada producto
    for (const item of detalleResult.rows) {
      await client.query(
        'UPDATE productos SET stock_actual = stock_actual + $1 WHERE id = $2',
        [item.cantidad, item.producto_id]
      );

      // Registrar movimiento de devolución
      await client.query(
        `INSERT INTO movimientos_inventario (
          producto_id,
          tipo_movimiento,
          cantidad,
          motivo,
          usuario_id,
          referencia
        ) VALUES ($1, 'entrada', $2, 'Cancelación de venta', $3, $4)`,
        [item.producto_id, item.cantidad, req.usuario.id, `Cancelación ${venta.folio}`]
      );
    }

    // Actualizar estado de la venta
    await client.query(
      'UPDATE ventas SET estado = $1 WHERE id = $2',
      ['cancelada', id]
    );

    await client.query('COMMIT');

    res.json({
      message: 'Venta cancelada exitosamente. Stock devuelto.'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al cancelar venta:', error);
    res.status(500).json({ 
      error: error.message || 'Error al cancelar venta'
    });
  } finally {
    client.release();
  }
});

module.exports = router;
