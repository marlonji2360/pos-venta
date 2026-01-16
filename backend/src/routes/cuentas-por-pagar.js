// src/routes/cuentas-por-pagar.js
const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verificarToken, verificarRol } = require('../middleware/auth');

router.use(verificarToken);

// GET /api/cuentas-por-pagar - Listar todas las cuentas
router.get('/', verificarRol('Administrador', 'Gerente'), async (req, res) => {
  try {
    const { estado, proveedor_id, limit = 1000, offset = 0 } = req.query;
    
    let queryText = `
      SELECT 
        cpp.*,
        p.nombre as proveedor_nombre,
        p.telefono as proveedor_telefono,
        u.nombre as usuario_nombre,
        CASE 
          WHEN cpp.fecha_vencimiento < CURRENT_DATE AND cpp.saldo_pendiente > 0 THEN 'vencido'
          ELSE cpp.estado
        END as estado_actual,
        (cpp.fecha_vencimiento - CURRENT_DATE) as dias_para_vencer
      FROM cuentas_por_pagar cpp
      JOIN proveedores p ON cpp.proveedor_id = p.id
      LEFT JOIN usuarios u ON cpp.usuario_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (estado) {
      // Manejar estado "vencido" que es calculado
      if (estado === 'vencido') {
        queryText += ` AND cpp.fecha_vencimiento < CURRENT_DATE AND cpp.saldo_pendiente > 0`;
      } else {
        queryText += ` AND cpp.estado = $${paramCount}`;
        params.push(estado);
        paramCount++;
      }
    }

    if (proveedor_id) {
      queryText += ` AND cpp.proveedor_id = $${paramCount}`;
      params.push(proveedor_id);
      paramCount++;
    }

    queryText += ` ORDER BY cpp.fecha_vencimiento ASC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await query(queryText, params);

    // Contar total con los mismos filtros
    let countQuery = `
      SELECT COUNT(*) as total
      FROM cuentas_por_pagar cpp
      WHERE 1=1
    `;
    const countParams = [];
    let countParamCount = 1;

    if (estado) {
      if (estado === 'vencido') {
        countQuery += ` AND cpp.fecha_vencimiento < CURRENT_DATE AND cpp.saldo_pendiente > 0`;
      } else {
        countQuery += ` AND cpp.estado = $${countParamCount}`;
        countParams.push(estado);
        countParamCount++;
      }
    }

    if (proveedor_id) {
      countQuery += ` AND cpp.proveedor_id = $${countParamCount}`;
      countParams.push(proveedor_id);
      countParamCount++;
    }

    const countResult = await query(countQuery, countParams);

    res.json({
      cuentas: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('Error al listar cuentas por pagar:', error);
    res.status(500).json({ 
      error: 'Error al obtener cuentas por pagar' 
    });
  }
});

// GET /api/cuentas-por-pagar/estadisticas - Estadísticas generales
router.get('/estadisticas', verificarRol('Administrador', 'Gerente'), async (req, res) => {
  try {
    // Total por pagar
    const totalResult = await query(`
      SELECT 
        COUNT(*) as total_cuentas,
        COALESCE(SUM(saldo_pendiente), 0) as saldo_total,
        COALESCE(SUM(CASE WHEN estado = 'vencido' OR fecha_vencimiento < CURRENT_DATE THEN saldo_pendiente ELSE 0 END), 0) as saldo_vencido,
        COALESCE(SUM(CASE WHEN fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days' THEN saldo_pendiente ELSE 0 END), 0) as por_vencer_7dias
      FROM cuentas_por_pagar
      WHERE estado IN ('pendiente', 'parcial', 'vencido')
    `);

    // Por proveedor
    const porProveedorResult = await query(`
      SELECT 
        p.id,
        p.nombre,
        COUNT(cpp.id) as num_cuentas,
        COALESCE(SUM(cpp.saldo_pendiente), 0) as saldo_total
      FROM proveedores p
      LEFT JOIN cuentas_por_pagar cpp ON p.id = cpp.proveedor_id
      WHERE cpp.estado IN ('pendiente', 'parcial', 'vencido')
      GROUP BY p.id, p.nombre
      HAVING COUNT(cpp.id) > 0
      ORDER BY saldo_total DESC
      LIMIT 10
    `);

    // Próximos vencimientos
    const proximosResult = await query(`
      SELECT 
        cpp.id,
        cpp.folio,
        cpp.fecha_vencimiento,
        cpp.saldo_pendiente,
        p.nombre as proveedor_nombre,
        (cpp.fecha_vencimiento - CURRENT_DATE) as dias_restantes
      FROM cuentas_por_pagar cpp
      JOIN proveedores p ON cpp.proveedor_id = p.id
      WHERE cpp.estado IN ('pendiente', 'parcial')
      AND cpp.fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '15 days'
      ORDER BY cpp.fecha_vencimiento ASC
      LIMIT 10
    `);

    res.json({
      totales: totalResult.rows[0],
      por_proveedor: porProveedorResult.rows,
      proximos_vencimientos: proximosResult.rows
    });

  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ 
      error: 'Error al obtener estadísticas' 
    });
  }
});

// GET /api/cuentas-por-pagar/:id - Obtener detalle de una cuenta
router.get('/:id', verificarRol('Administrador', 'Gerente'), async (req, res) => {
  try {
    const { id } = req.params;

    const cuentaResult = await query(`
      SELECT 
        cpp.*,
        p.nombre as proveedor_nombre,
        p.telefono as proveedor_telefono,
        p.email as proveedor_email,
        u.nombre as usuario_nombre
      FROM cuentas_por_pagar cpp
      JOIN proveedores p ON cpp.proveedor_id = p.id
      LEFT JOIN usuarios u ON cpp.usuario_id = u.id
      WHERE cpp.id = $1
    `, [id]);

    if (cuentaResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Cuenta por pagar no encontrada' 
      });
    }

    // Obtener historial de pagos
    const pagosResult = await query(`
      SELECT 
        pp.*,
        u.nombre as usuario_nombre
      FROM pagos_proveedores pp
      LEFT JOIN usuarios u ON pp.usuario_id = u.id
      WHERE pp.cuenta_por_pagar_id = $1
      ORDER BY pp.fecha_pago DESC
    `, [id]);

    res.json({
      cuenta: cuentaResult.rows[0],
      pagos: pagosResult.rows
    });

  } catch (error) {
    console.error('Error al obtener cuenta:', error);
    res.status(500).json({ 
      error: 'Error al obtener detalle de cuenta' 
    });
  }
});

// POST /api/cuentas-por-pagar - Crear nueva cuenta por pagar
router.post('/', verificarRol('Administrador', 'Gerente'), async (req, res) => {
  try {
    const {
      proveedor_id,
      pedido_id,
      fecha_emision,
      dias_credito,
      monto_total,
      concepto,
      notas
    } = req.body;

    if (!proveedor_id || !monto_total || !dias_credito) {
      return res.status(400).json({ 
        error: 'Datos incompletos. Se requiere proveedor, monto y días de crédito' 
      });
    }

    // Generar folio
    const folioResult = await query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(folio FROM 5) AS INTEGER)), 0) + 1 as next_num 
       FROM cuentas_por_pagar 
       WHERE folio LIKE 'CPP-%'`
    );
    const folio = `CPP-${String(folioResult.rows[0].next_num).padStart(6, '0')}`;

    // Calcular fecha de vencimiento
    const fechaEmision = fecha_emision || new Date().toISOString().split('T')[0];
    const fechaVencimiento = new Date(fechaEmision);
    fechaVencimiento.setDate(fechaVencimiento.getDate() + parseInt(dias_credito));

    const result = await query(`
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
        notas,
        usuario_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      proveedor_id,
      pedido_id || null,
      folio,
      fechaEmision,
      fechaVencimiento.toISOString().split('T')[0],
      monto_total,
      monto_total,
      dias_credito,
      concepto,
      notas,
      req.usuario.id
    ]);

    res.status(201).json({
      message: 'Cuenta por pagar creada exitosamente',
      cuenta: result.rows[0]
    });

  } catch (error) {
    console.error('Error al crear cuenta:', error);
    res.status(500).json({ 
      error: 'Error al crear cuenta por pagar',
      detalles: error.message
    });
  }
});

// POST /api/cuentas-por-pagar/:id/pago - Registrar un pago
router.post('/:id/pago', verificarRol('Administrador', 'Gerente'), async (req, res) => {
  const client = await require('../config/database').pool.connect();
  
  try {
    const { id } = req.params;
    const { monto, metodo_pago, referencia, notas } = req.body;

    if (!monto || monto <= 0) {
      return res.status(400).json({ 
        error: 'El monto debe ser mayor a cero' 
      });
    }

    await client.query('BEGIN');

    // Verificar que la cuenta existe y obtener saldo
    const cuentaResult = await client.query(
      'SELECT * FROM cuentas_por_pagar WHERE id = $1',
      [id]
    );

    if (cuentaResult.rows.length === 0) {
      throw new Error('Cuenta por pagar no encontrada');
    }

    const cuenta = cuentaResult.rows[0];

    if (parseFloat(monto) > parseFloat(cuenta.saldo_pendiente)) {
      throw new Error('El monto del pago no puede ser mayor al saldo pendiente');
    }

    // Registrar el pago
    const pagoResult = await client.query(`
      INSERT INTO pagos_proveedores (
        cuenta_por_pagar_id,
        monto,
        metodo_pago,
        referencia,
        notas,
        usuario_id
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      id,
      monto,
      metodo_pago || 'efectivo',
      referencia,
      notas,
      req.usuario.id
    ]);

    // El trigger actualiza automáticamente la cuenta
    await client.query('COMMIT');

    res.json({
      message: 'Pago registrado exitosamente',
      pago: pagoResult.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al registrar pago:', error);
    res.status(500).json({ 
      error: error.message || 'Error al registrar pago'
    });
  } finally {
    client.release();
  }
});

// PUT /api/cuentas-por-pagar/:id - Actualizar cuenta
router.put('/:id', verificarRol('Administrador', 'Gerente'), async (req, res) => {
  try {
    const { id } = req.params;
    const { notas, concepto } = req.body;

    const result = await query(`
      UPDATE cuentas_por_pagar
      SET notas = COALESCE($1, notas),
          concepto = COALESCE($2, concepto),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `, [notas, concepto, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Cuenta por pagar no encontrada' 
      });
    }

    res.json({
      message: 'Cuenta actualizada exitosamente',
      cuenta: result.rows[0]
    });

  } catch (error) {
    console.error('Error al actualizar cuenta:', error);
    res.status(500).json({ 
      error: 'Error al actualizar cuenta' 
    });
  }
});

// DELETE /api/cuentas-por-pagar/:id - Eliminar cuenta (solo si no tiene pagos)
router.delete('/:id', verificarRol('Administrador'), async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si tiene pagos
    const pagosResult = await query(
      'SELECT COUNT(*) as total FROM pagos_proveedores WHERE cuenta_por_pagar_id = $1',
      [id]
    );

    if (parseInt(pagosResult.rows[0].total) > 0) {
      return res.status(400).json({ 
        error: 'No se puede eliminar una cuenta con pagos registrados' 
      });
    }

    await query('DELETE FROM cuentas_por_pagar WHERE id = $1', [id]);

    res.json({
      message: 'Cuenta eliminada exitosamente'
    });

  } catch (error) {
    console.error('Error al eliminar cuenta:', error);
    res.status(500).json({ 
      error: 'Error al eliminar cuenta' 
    });
  }
});

module.exports = router;