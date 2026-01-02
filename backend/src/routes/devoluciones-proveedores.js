// backend/src/routes/devoluciones-proveedores.js
const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verificarToken, verificarRol } = require('../middleware/auth');

router.use(verificarToken);
router.use(verificarRol('Administrador', 'Gerente'));

// ============================================
// DEVOLUCIONES A PROVEEDORES
// ============================================

// GET /api/devoluciones-proveedores - Listar todas las devoluciones
router.get('/', async (req, res) => {
  try {
    const { tipo, estado, proveedor_id, fecha_inicio, fecha_fin, limit = 100 } = req.query;
    
    let queryText = `
      SELECT 
        dp.*,
        prov.nombre as proveedor_nombre,
        ped.folio as pedido_folio,
        u.nombre as usuario_nombre
      FROM devoluciones_proveedores dp
      JOIN proveedores prov ON dp.proveedor_id = prov.id
      LEFT JOIN pedidos_proveedores ped ON dp.pedido_id = ped.id
      LEFT JOIN usuarios u ON dp.usuario_id = u.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;

    if (tipo) {
      queryText += ` AND dp.tipo = $${paramCount}`;
      params.push(tipo);
      paramCount++;
    }

    if (estado) {
      queryText += ` AND dp.estado = $${paramCount}`;
      params.push(estado);
      paramCount++;
    }

    if (proveedor_id) {
      queryText += ` AND dp.proveedor_id = $${paramCount}`;
      params.push(proveedor_id);
      paramCount++;
    }

    if (fecha_inicio) {
      queryText += ` AND DATE(dp.fecha_devolucion) >= $${paramCount}`;
      params.push(fecha_inicio);
      paramCount++;
    }

    if (fecha_fin) {
      queryText += ` AND DATE(dp.fecha_devolucion) <= $${paramCount}`;
      params.push(fecha_fin);
      paramCount++;
    }

    queryText += ` ORDER BY dp.fecha_devolucion DESC LIMIT $${paramCount}`;
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

// GET /api/devoluciones-proveedores/:id - Obtener detalle
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const devolucionResult = await query(`
      SELECT 
        dp.*,
        prov.nombre as proveedor_nombre,
        prov.telefono as proveedor_telefono,
        prov.email as proveedor_email,
        ped.folio as pedido_folio,
        u.nombre as usuario_nombre
      FROM devoluciones_proveedores dp
      JOIN proveedores prov ON dp.proveedor_id = prov.id
      LEFT JOIN pedidos_proveedores ped ON dp.pedido_id = ped.id
      LEFT JOIN usuarios u ON dp.usuario_id = u.id
      WHERE dp.id = $1
    `, [id]);

    if (devolucionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Devolución no encontrada' });
    }

    const productosResult = await query(`
      SELECT 
        ddp.*,
        p.nombre as producto_nombre,
        p.codigo_barras,
        pc.nombre as producto_cambio_nombre,
        pc.codigo_barras as producto_cambio_codigo
      FROM detalle_devoluciones_proveedores ddp
      JOIN productos p ON ddp.producto_id = p.id
      LEFT JOIN productos pc ON ddp.producto_cambio_id = pc.id
      WHERE ddp.devolucion_id = $1
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

// POST /api/devoluciones-proveedores - Crear devolución/cambio
router.post('/', async (req, res) => {
  const client = await require('../config/database').pool.connect();
  
  try {
    const {
      pedido_id,
      proveedor_id,
      tipo,
      motivo,
      notas,
      productos
    } = req.body;

    if (!proveedor_id || !tipo || !productos || productos.length === 0) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    if (!['devolucion', 'cambio'].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo inválido' });
    }

    await client.query('BEGIN');

    // Generar folio
    const folioResult = await client.query(`
      SELECT COALESCE(MAX(CAST(SUBSTRING(folio FROM 5) AS INTEGER)), 0) + 1 as next_num 
      FROM devoluciones_proveedores 
      WHERE folio LIKE 'DVP-%'
    `);
    const folio = `DVP-${String(folioResult.rows[0].next_num).padStart(6, '0')}`;

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
      INSERT INTO devoluciones_proveedores (
        folio,
        pedido_id,
        proveedor_id,
        tipo,
        monto_devuelto,
        motivo,
        notas,
        usuario_id,
        estado
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pendiente')
      RETURNING *
    `, [
      folio,
      pedido_id || null,
      proveedor_id,
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
        INSERT INTO detalle_devoluciones_proveedores (
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
        // Producto devuelto (disminuye stock)
        await client.query(
          'UPDATE productos SET stock_actual = stock_actual - $1 WHERE id = $2',
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
          ) VALUES ($1, 'salida', $2, $3, $4, $5)
        `, [
          prod.producto_id,
          prod.cantidad,
          `Devolución a proveedor - ${tipo}`,
          req.usuario.id,
          folio
        ]);

        // Si es cambio, recibir producto nuevo
        if (tipo === 'cambio' && prod.producto_cambio_id) {
          await client.query(
            'UPDATE productos SET stock_actual = stock_actual + $1 WHERE id = $2',
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
            ) VALUES ($1, 'entrada', $2, $3, $4, $5)
          `, [
            prod.producto_cambio_id,
            prod.cantidad_cambio,
            'Cambio recibido de proveedor',
            req.usuario.id,
            folio
          ]);
        }
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: tipo === 'devolucion' 
        ? 'Devolución registrada exitosamente'
        : 'Cambio registrado exitosamente',
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

// PATCH /api/devoluciones-proveedores/:id/estado - Cambiar estado
router.patch('/:id/estado', async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    const estadosValidos = ['pendiente', 'aprobada', 'rechazada', 'completada'];
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    const result = await query(`
      UPDATE devoluciones_proveedores
      SET estado = $1
      WHERE id = $2
      RETURNING *
    `, [estado, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Devolución no encontrada' });
    }

    res.json({
      message: 'Estado actualizado',
      devolucion: result.rows[0]
    });

  } catch (error) {
    console.error('Error al actualizar estado:', error);
    res.status(500).json({ error: 'Error al actualizar estado' });
  }
});

// GET /api/devoluciones-proveedores/pedido/:pedido_id/productos - Productos de un pedido
router.get('/pedido/:pedido_id/productos', async (req, res) => {
  try {
    const { pedido_id } = req.params;

    const result = await query(`
      SELECT 
        dp.*,
        p.nombre as producto_nombre,
        p.codigo_barras,
        p.stock_actual
      FROM detalle_pedidos dp
      JOIN productos p ON dp.producto_id = p.id
      WHERE dp.pedido_id = $1
    `, [pedido_id]);

    res.json({
      productos: result.rows
    });

  } catch (error) {
    console.error('Error al obtener productos:', error);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

module.exports = router;
