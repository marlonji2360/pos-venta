// backend/src/routes/devoluciones-clientes.js
const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verificarToken, verificarRol } = require('../middleware/auth');

router.use(verificarToken);

// ============================================
// DEVOLUCIONES DE CLIENTES
// ============================================

// GET /api/devoluciones-clientes - Listar todas las devoluciones
router.get('/', async (req, res) => {
  try {
    const { tipo, estado, fecha_inicio, fecha_fin, limit = 100 } = req.query;
    
    let queryText = `
      SELECT 
        dc.*,
        c.nombre as cliente_nombre,
        v.folio as venta_folio,
        u.nombre as usuario_nombre
      FROM devoluciones_clientes dc
      LEFT JOIN clientes c ON dc.cliente_id = c.id
      LEFT JOIN ventas v ON dc.venta_id = v.id
      LEFT JOIN usuarios u ON dc.usuario_id = u.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;

    if (tipo) {
      queryText += ` AND dc.tipo = $${paramCount}`;
      params.push(tipo);
      paramCount++;
    }

    if (estado) {
      queryText += ` AND dc.estado = $${paramCount}`;
      params.push(estado);
      paramCount++;
    }

    if (fecha_inicio) {
      queryText += ` AND DATE(dc.fecha_devolucion) >= $${paramCount}`;
      params.push(fecha_inicio);
      paramCount++;
    }

    if (fecha_fin) {
      queryText += ` AND DATE(dc.fecha_devolucion) <= $${paramCount}`;
      params.push(fecha_fin);
      paramCount++;
    }

    queryText += ` ORDER BY dc.fecha_devolucion DESC LIMIT $${paramCount}`;
    params.push(limit);

    const result = await query(queryText, params);

    res.json({
      devoluciones: result.rows
    });

  } catch (error) {
    console.error('Error al listar devoluciones:', error);
    res.status(500).json({ error: 'Error al obtener devoluciones' });
  }
});

// GET /api/devoluciones-clientes/:id - Obtener detalle
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const devolucionResult = await query(`
      SELECT 
        dc.*,
        c.nombre as cliente_nombre,
        c.telefono as cliente_telefono,
        v.folio as venta_folio,
        v.total as venta_total,
        u.nombre as usuario_nombre
      FROM devoluciones_clientes dc
      LEFT JOIN clientes c ON dc.cliente_id = c.id
      LEFT JOIN ventas v ON dc.venta_id = v.id
      LEFT JOIN usuarios u ON dc.usuario_id = u.id
      WHERE dc.id = $1
    `, [id]);

    if (devolucionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Devolución no encontrada' });
    }

    const productosResult = await query(`
      SELECT 
        ddc.*,
        p.nombre as producto_nombre,
        p.codigo_barras,
        pc.nombre as producto_cambio_nombre,
        pc.codigo_barras as producto_cambio_codigo
      FROM detalle_devoluciones_clientes ddc
      JOIN productos p ON ddc.producto_id = p.id
      LEFT JOIN productos pc ON ddc.producto_cambio_id = pc.id
      WHERE ddc.devolucion_id = $1
    `, [id]);

    res.json({
      devolucion: devolucionResult.rows[0],
      productos: productosResult.rows
    });

  } catch (error) {
    console.error('Error al obtener devolución:', error);
    res.status(500).json({ error: 'Error al obtener detalle' });
  }
});

// POST /api/devoluciones-clientes - Crear devolución/cambio
router.post('/', verificarRol('Administrador', 'Gerente', 'Vendedor'), async (req, res) => {
  const client = await require('../config/database').pool.connect();
  
  try {
    const {
      venta_id,
      cliente_id,
      tipo,
      motivo,
      notas,
      productos
    } = req.body;

    if (!tipo || !productos || productos.length === 0) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    if (!['devolucion', 'cambio'].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo inválido' });
    }

    await client.query('BEGIN');

    // Generar folio
    const folioResult = await client.query(`
      SELECT COALESCE(MAX(CAST(SUBSTRING(folio FROM 5) AS INTEGER)), 0) + 1 as next_num 
      FROM devoluciones_clientes 
      WHERE folio LIKE 'DVC-%'
    `);
    const folio = `DVC-${String(folioResult.rows[0].next_num).padStart(6, '0')}`;

    // Calcular monto total
    let montoTotal = 0;
    for (const prod of productos) {
      montoTotal += (prod.cantidad * prod.precio_unitario);
      if (tipo === 'cambio' && prod.producto_cambio_id) {
        montoTotal -= (prod.cantidad_cambio * prod.precio_cambio);
      }
    }

    // Crear devolución
    const devolucionResult = await client.query(`
      INSERT INTO devoluciones_clientes (
        folio,
        venta_id,
        cliente_id,
        tipo,
        monto_devuelto,
        motivo,
        notas,
        usuario_id,
        estado
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'procesada')
      RETURNING *
    `, [
      folio,
      venta_id || null,
      cliente_id || null,
      tipo,
      montoTotal,
      motivo,
      notas || null,
      req.usuario.id
    ]);

    const devolucion = devolucionResult.rows[0];

    // Insertar productos y actualizar inventario
    for (const prod of productos) {
      // Insertar detalle
      await client.query(`
        INSERT INTO detalle_devoluciones_clientes (
          devolucion_id,
          producto_id,
          cantidad,
          precio_unitario,
          subtotal,
          afecta_inventario,
          motivo_producto,
          producto_cambio_id,
          cantidad_cambio,
          precio_cambio
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        devolucion.id,
        prod.producto_id,
        prod.cantidad,
        prod.precio_unitario,
        prod.cantidad * prod.precio_unitario,
        prod.afecta_inventario !== false,
        prod.motivo_producto || null,
        prod.producto_cambio_id || null,
        prod.cantidad_cambio || null,
        prod.precio_cambio || null
      ]);

      // Actualizar inventario si aplica
      if (prod.afecta_inventario !== false) {
        // Producto devuelto (aumenta stock)
        await client.query(
          'UPDATE productos SET stock_actual = stock_actual + $1 WHERE id = $2',
          [prod.cantidad, prod.producto_id]
        );

        // Registrar movimiento
        await client.query(`
          INSERT INTO movimientos_inventario (
            producto_id,
            tipo_movimiento,
            cantidad,
            motivo,
            usuario_id,
            referencia
          ) VALUES ($1, 'entrada', $2, $3, $4, $5)
        `, [
          prod.producto_id,
          prod.cantidad,
          `Devolución de cliente - ${tipo}`,
          req.usuario.id,
          folio
        ]);

        // Si es cambio, descontar producto nuevo entregado
        if (tipo === 'cambio' && prod.producto_cambio_id) {
          await client.query(
            'UPDATE productos SET stock_actual = stock_actual - $1 WHERE id = $2',
            [prod.cantidad_cambio, prod.producto_cambio_id]
          );

          await client.query(`
            INSERT INTO movimientos_inventario (
              producto_id,
              tipo_movimiento,
              cantidad,
              motivo,
              usuario_id,
              referencia
            ) VALUES ($1, 'salida', $2, $3, $4, $5)
          `, [
            prod.producto_cambio_id,
            prod.cantidad_cambio,
            'Cambio entregado a cliente',
            req.usuario.id,
            folio
          ]);
        }
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: tipo === 'devolucion' 
        ? 'Devolución procesada exitosamente'
        : 'Cambio procesado exitosamente',
      devolucion: {
        id: devolucion.id,
        folio: devolucion.folio,
        monto_devuelto: devolucion.monto_devuelto
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al crear devolución:', error);
    res.status(500).json({ 
      error: 'Error al procesar devolución',
      detalles: error.message
    });
  } finally {
    client.release();
  }
});

// GET /api/devoluciones-clientes/venta/:venta_id - Obtener productos de una venta
router.get('/venta/:venta_id/productos', async (req, res) => {
  try {
    const { venta_id } = req.params;

    const result = await query(`
      SELECT 
        dv.*,
        p.nombre as producto_nombre,
        p.codigo_barras,
        p.stock_actual
      FROM detalle_ventas dv
      JOIN productos p ON dv.producto_id = p.id
      WHERE dv.venta_id = $1
    `, [venta_id]);

    res.json({
      productos: result.rows
    });

  } catch (error) {
    console.error('Error al obtener productos de venta:', error);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

module.exports = router;
