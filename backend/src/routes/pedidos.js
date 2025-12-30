// src/routes/pedidos.js
const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verificarToken, verificarRol } = require('../middleware/auth');

router.use(verificarToken);

// GET /api/pedidos - Listar todos los pedidos
router.get('/', async (req, res) => {
  try {
    const { estado, proveedor_id, limit = 100, offset = 0 } = req.query;
    
    let queryText = `
      SELECT 
        p.*,
        prov.nombre as proveedor_nombre,
        u.nombre as usuario_nombre
      FROM pedidos_proveedores p
      LEFT JOIN proveedores prov ON p.proveedor_id = prov.id
      LEFT JOIN usuarios u ON p.usuario_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (estado) {
      queryText += ` AND p.estado = $${paramCount}`;
      params.push(estado);
      paramCount++;
    }

    if (proveedor_id) {
      queryText += ` AND p.proveedor_id = $${paramCount}`;
      params.push(proveedor_id);
      paramCount++;
    }

    queryText += ` ORDER BY p.fecha_pedido DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await query(queryText, params);

    res.json({
      pedidos: result.rows,
      total: result.rows.length
    });

  } catch (error) {
    console.error('Error al listar pedidos:', error);
    res.status(500).json({ 
      error: 'Error al obtener pedidos' 
    });
  }
});

// GET /api/pedidos/:id - Obtener detalle de un pedido
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const pedidoResult = await query(
      `SELECT 
        p.*,
        prov.nombre as proveedor_nombre,
        u.nombre as usuario_nombre
      FROM pedidos_proveedores p
      LEFT JOIN proveedores prov ON p.proveedor_id = prov.id
      LEFT JOIN usuarios u ON p.usuario_id = u.id
      WHERE p.id = $1`,
      [id]
    );

    if (pedidoResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Pedido no encontrado' 
      });
    }

    const productosResult = await query(
      `SELECT 
        dp.*,
        prod.nombre as producto_nombre
      FROM detalle_pedidos dp
      JOIN productos prod ON dp.producto_id = prod.id
      WHERE dp.pedido_id = $1`,
      [id]
    );

    res.json({
      pedido: pedidoResult.rows[0],
      productos: productosResult.rows
    });

  } catch (error) {
    console.error('Error al obtener pedido:', error);
    res.status(500).json({ 
      error: 'Error al obtener detalle del pedido' 
    });
  }
});

// POST /api/pedidos - Crear nuevo pedido
router.post('/', verificarRol('Administrador', 'Gerente'), async (req, res) => {
  const client = await require('../config/database').pool.connect();
  
  try {
    const {
      proveedor_id,
      total,
      notas,
      productos,
      forma_pago,
      dias_credito
    } = req.body;

    // Validar datos requeridos
    if (!proveedor_id || !total || !productos || productos.length === 0) {
      return res.status(400).json({ 
        error: 'Datos incompletos' 
      });
    }

    await client.query('BEGIN');

    // Generar folio único
    const folioResult = await client.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(folio FROM 5) AS INTEGER)), 0) + 1 as next_num 
       FROM pedidos_proveedores 
       WHERE folio LIKE 'PED-%'`
    );
    const folio = `PED-${String(folioResult.rows[0].next_num).padStart(6, '0')}`;

    // Insertar pedido
    const pedidoResult = await client.query(
      `INSERT INTO pedidos_proveedores (
        folio,
        proveedor_id,
        usuario_id,
        fecha_pedido,
        total,
        estado,
        notas,
        forma_pago,
        dias_credito
      ) VALUES ($1, $2, $3, NOW(), $4, 'pendiente', $5, $6, $7)
      RETURNING *`,
      [folio, proveedor_id, req.usuario.id, total, notas, forma_pago || 'contado', dias_credito || 0]
    );

    const pedido = pedidoResult.rows[0];

    // Insertar detalles del pedido
    for (const producto of productos) {
      await client.query(
        `INSERT INTO detalle_pedidos (
          pedido_id,
          producto_id,
          cantidad,
          precio_unitario,
          subtotal
        ) VALUES ($1, $2, $3, $4, $5)`,
        [
          pedido.id,
          producto.producto_id,
          producto.cantidad,
          producto.precio_unitario,
          producto.cantidad * producto.precio_unitario
        ]
      );
    }

    // Si el pedido es a crédito, crear cuenta por pagar automáticamente
    if (forma_pago === 'credito' && dias_credito > 0) {
      // Generar folio para cuenta por pagar
      const folioCPPResult = await client.query(
        `SELECT COALESCE(MAX(CAST(SUBSTRING(folio FROM 5) AS INTEGER)), 0) + 1 as next_num 
         FROM cuentas_por_pagar 
         WHERE folio LIKE 'CPP-%'`
      );
      const folioCPP = `CPP-${String(folioCPPResult.rows[0].next_num).padStart(6, '0')}`;

      // Calcular fecha de vencimiento
      const fechaVencimiento = new Date();
      fechaVencimiento.setDate(fechaVencimiento.getDate() + parseInt(dias_credito));

      // Crear cuenta por pagar
      await client.query(`
        INSERT INTO cuentas_por_pagar (
          proveedor_id,
          pedido_id,
          folio,
          fecha_emision,
          fecha_vencimiento,
          monto_total,
          saldo_pendiente,
          dias_credito,
          concepto,
          usuario_id
        ) VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, $6, $7, $8, $9)
      `, [
        proveedor_id,
        pedido.id,
        folioCPP,
        fechaVencimiento.toISOString().split('T')[0],
        total,
        total,
        dias_credito,
        `Pedido a crédito ${pedido.folio} - ${productos.length} productos`,
        req.usuario.id
      ]);

      console.log(`✅ Cuenta por pagar creada: ${folioCPP} - Vence: ${fechaVencimiento.toISOString().split('T')[0]}`);
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Pedido creado exitosamente',
      pedido: {
        id: pedido.id,
        folio: pedido.folio,
        total: pedido.total
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al crear pedido:', error);
    res.status(500).json({ 
      error: 'Error al crear pedido',
      detalles: error.message
    });
  } finally {
    client.release();
  }
});

// PATCH /api/pedidos/:id/recibir - Marcar pedido como recibido y actualizar inventario
router.patch('/:id/recibir', verificarRol('Administrador', 'Gerente'), async (req, res) => {
  const client = await require('../config/database').pool.connect();
  
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    // Verificar que el pedido existe y está pendiente
    const pedidoResult = await client.query(
      'SELECT * FROM pedidos_proveedores WHERE id = $1',
      [id]
    );

    if (pedidoResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    const pedido = pedidoResult.rows[0];

    if (pedido.estado !== 'pendiente') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El pedido no está en estado pendiente' });
    }

    // Obtener productos del pedido
    const productosResult = await client.query(
      'SELECT * FROM detalle_pedidos WHERE pedido_id = $1',
      [id]
    );

    // Actualizar stock de cada producto
    for (const item of productosResult.rows) {
      await client.query(
        'UPDATE productos SET stock_actual = stock_actual + $1 WHERE id = $2',
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
        ) VALUES ($1, 'entrada', $2, 'Pedido recibido', $3, $4)`,
        [
          item.producto_id,
          item.cantidad,
          req.usuario.id,
          `Pedido ${pedido.folio}`
        ]
      );
    }

    // Actualizar estado del pedido
    await client.query(
      'UPDATE pedidos_proveedores SET estado = $1, fecha_recepcion = NOW() WHERE id = $2',
      ['recibido', id]
    );

    await client.query('COMMIT');

    res.json({
      message: 'Pedido marcado como recibido. Inventario actualizado.',
      pedido_id: id
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al recibir pedido:', error);
    res.status(500).json({ 
      error: 'Error al marcar pedido como recibido',
      detalles: error.message
    });
  } finally {
    client.release();
  }
});

// PATCH /api/pedidos/:id/cancelar - Cancelar pedido
router.patch('/:id/cancelar', verificarRol('Administrador', 'Gerente'), async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el pedido existe
    const pedidoResult = await query(
      'SELECT * FROM pedidos_proveedores WHERE id = $1',
      [id]
    );

    if (pedidoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    const pedido = pedidoResult.rows[0];

    if (pedido.estado !== 'pendiente') {
      return res.status(400).json({ error: 'Solo se pueden cancelar pedidos pendientes' });
    }

    // Actualizar estado
    await query(
      'UPDATE pedidos_proveedores SET estado = $1 WHERE id = $2',
      ['cancelado', id]
    );

    res.json({
      message: 'Pedido cancelado exitosamente',
      pedido_id: id
    });

  } catch (error) {
    console.error('Error al cancelar pedido:', error);
    res.status(500).json({ 
      error: 'Error al cancelar pedido',
      detalles: error.message
    });
  }
});

module.exports = router;
