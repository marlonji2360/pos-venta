// src/routes/reportes.js
const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verificarToken, verificarRol } = require('../middleware/auth');

router.use(verificarToken);

// GET /api/reportes/ventas - Reporte de ventas por período
router.get('/ventas', verificarRol('Administrador', 'Gerente'), async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;

    if (!fecha_inicio || !fecha_fin) {
      return res.status(400).json({ 
        error: 'Se requieren fecha_inicio y fecha_fin' 
      });
    }

    // Resumen general
    const resumenResult = await query(`
      SELECT 
        COUNT(*) as total_ventas,
        COALESCE(SUM(total), 0) as monto_total,
        COALESCE(SUM(subtotal), 0) as subtotal_total,
        COALESCE(SUM(iva), 0) as iva_total,
        COALESCE(AVG(total), 0) as promedio_venta
      FROM ventas
      WHERE fecha_venta BETWEEN $1 AND $2
      AND estado = 'completada'
    `, [fecha_inicio, fecha_fin]);

    // Ventas por día
    const ventasPorDiaResult = await query(`
      SELECT 
        DATE(fecha_venta) as fecha,
        COUNT(*) as num_ventas,
        COALESCE(SUM(total), 0) as monto_total
      FROM ventas
      WHERE fecha_venta BETWEEN $1 AND $2
      AND estado = 'completada'
      GROUP BY DATE(fecha_venta)
      ORDER BY fecha
    `, [fecha_inicio, fecha_fin]);

    // Ventas por método de pago
    const ventasPorMetodoResult = await query(`
      SELECT 
        metodo_pago,
        COUNT(*) as num_ventas,
        COALESCE(SUM(total), 0) as monto_total
      FROM ventas
      WHERE fecha_venta BETWEEN $1 AND $2
      AND estado = 'completada'
      GROUP BY metodo_pago
      ORDER BY monto_total DESC
    `, [fecha_inicio, fecha_fin]);

    // Detalle de ventas
    const ventasDetalleResult = await query(`
      SELECT 
        v.id,
        v.folio,
        v.fecha_venta,
        v.total,
        v.metodo_pago,
        c.nombre as cliente_nombre,
        u.nombre as vendedor_nombre
      FROM ventas v
      LEFT JOIN clientes c ON v.cliente_id = c.id
      LEFT JOIN usuarios u ON v.usuario_id = u.id
      WHERE v.fecha_venta BETWEEN $1 AND $2
      AND v.estado = 'completada'
      ORDER BY v.fecha_venta DESC
    `, [fecha_inicio, fecha_fin]);

    res.json({
      resumen: resumenResult.rows[0],
      ventasPorDia: ventasPorDiaResult.rows,
      ventasPorMetodo: ventasPorMetodoResult.rows,
      ventasDetalle: ventasDetalleResult.rows
    });

  } catch (error) {
    console.error('Error al generar reporte de ventas:', error);
    res.status(500).json({ 
      error: 'Error al generar reporte de ventas' 
    });
  }
});

// GET /api/reportes/productos-vendidos - Productos más vendidos
router.get('/productos-vendidos', verificarRol('Administrador', 'Gerente'), async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin, limit = 50 } = req.query;

    if (!fecha_inicio || !fecha_fin) {
      return res.status(400).json({ 
        error: 'Se requieren fecha_inicio y fecha_fin' 
      });
    }
const result = await query(`
  SELECT 
    p.id,
    p.nombre,
    p.codigo_barras,
    p.categoria_id,
    c.nombre as categoria_nombre,
    SUM(dv.cantidad) as total_vendido,
    COUNT(DISTINCT v.id) as num_ventas,
    COALESCE(SUM(dv.subtotal), 0) as monto_total,
    p.precio_venta,
    p.stock_actual
  FROM detalle_ventas dv
  JOIN productos p ON dv.producto_id = p.id
  LEFT JOIN categorias c ON p.categoria_id = c.id
  JOIN ventas v ON dv.venta_id = v.id
  WHERE v.fecha_venta BETWEEN $1 AND $2
  AND v.estado = 'completada'
  GROUP BY p.id, p.nombre, p.codigo_barras, p.categoria_id, c.nombre, p.precio_venta, p.stock_actual
  ORDER BY total_vendido DESC
  LIMIT $3
`, [fecha_inicio, fecha_fin, limit]);

    res.json({
      productos: result.rows
    });

  } catch (error) {
    console.error('Error al generar reporte de productos:', error);
    res.status(500).json({ 
      error: 'Error al generar reporte de productos' 
    });
  }
});

// GET /api/reportes/inventario - Reporte de inventario
router.get('/inventario', verificarRol('Administrador', 'Gerente'), async (req, res) => {
  try {
    const { categoria, estado } = req.query;

    let whereClause = 'WHERE p.activo = true';
    const params = [];
    let paramCount = 1;

    if (categoria) {
      whereClause += ` AND p.categoria_id = $${paramCount}`;
      params.push(categoria);
      paramCount++;
    }

    // Inventario general
    const inventarioResult = await query(`
  SELECT 
    p.id,
    p.nombre,
    p.codigo_barras,
    p.categoria_id,
    c.nombre as categoria_nombre,
    p.stock_actual,
    p.stock_minimo,
    p.stock_maximo,
    p.precio_compra,
    p.precio_venta,
    p.unidad_medida,
    (p.stock_actual * p.precio_compra) as valor_inventario,
    CASE 
      WHEN p.stock_actual <= p.stock_minimo THEN 'bajo'
      WHEN p.stock_actual >= p.stock_maximo THEN 'alto'
      ELSE 'normal'
    END as estado_stock
  FROM productos p
  LEFT JOIN categorias c ON p.categoria_id = c.id
  ${whereClause}
  ORDER BY p.nombre
`, params);

    // Resumen por categoría
    const resumenCategoriaResult = await query(`
      SELECT 
        categoria_id,
        COUNT(*) as total_productos,
        SUM(stock_actual) as stock_total,
        COALESCE(SUM(stock_actual * precio_compra), 0) as valor_total
      FROM productos
      WHERE activo = true
      GROUP BY categoria_id
      ORDER BY valor_total DESC
    `);

    // Valor total del inventario
    const valorTotalResult = await query(`
      SELECT 
        COALESCE(SUM(stock_actual * precio_compra), 0) as valor_total_inventario,
        COUNT(*) as total_productos
      FROM productos
      WHERE activo = true
    `);

    // Filtrar por estado si se especifica
    let productosFiltrados = inventarioResult.rows;
    if (estado) {
      productosFiltrados = productosFiltrados.filter(p => p.estado_stock === estado);
    }

    res.json({
      productos: productosFiltrados,
      resumenCategoria: resumenCategoriaResult.rows,
      valorTotal: valorTotalResult.rows[0]
    });

  } catch (error) {
    console.error('Error al generar reporte de inventario:', error);
    res.status(500).json({ 
      error: 'Error al generar reporte de inventario' 
    });
  }
});

// GET /api/reportes/vendedores - Reporte de ventas por vendedor
router.get('/vendedores', verificarRol('Administrador', 'Gerente'), async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;

    if (!fecha_inicio || !fecha_fin) {
      return res.status(400).json({ 
        error: 'Se requieren fecha_inicio y fecha_fin' 
      });
    }

    const result = await query(`
      SELECT 
        u.id,
        u.nombre as vendedor,
        u.rol_id,
        COUNT(v.id) as total_ventas,
        COALESCE(SUM(v.total), 0) as monto_total,
        COALESCE(AVG(v.total), 0) as promedio_venta,
        MIN(v.fecha_venta) as primera_venta,
        MAX(v.fecha_venta) as ultima_venta
      FROM usuarios u
      LEFT JOIN ventas v ON u.id = v.usuario_id 
        AND v.fecha_venta BETWEEN $1 AND $2
        AND v.estado = 'completada'
      WHERE u.activo = true
      GROUP BY u.id, u.nombre, u.rol_id
      ORDER BY monto_total DESC
    `, [fecha_inicio, fecha_fin]);

    res.json({
      vendedores: result.rows
    });

  } catch (error) {
    console.error('Error al generar reporte de vendedores:', error);
    res.status(500).json({ 
      error: 'Error al generar reporte de vendedores' 
    });
  }
});

// GET /api/reportes/ganancias - Reporte de ganancias
router.get('/ganancias', verificarRol('Administrador', 'Gerente'), async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;

    if (!fecha_inicio || !fecha_fin) {
      return res.status(400).json({ 
        error: 'Se requieren fecha_inicio y fecha_fin' 
      });
    }

    // Ganancias por producto
    const result = await query(`
  SELECT 
    p.id,
    p.nombre,
    p.categoria_id,
    c.nombre as categoria_nombre,
    SUM(dv.cantidad) as cantidad_vendida,
    p.precio_compra,
    p.precio_venta,
    (p.precio_venta - p.precio_compra) as ganancia_unitaria,
    SUM(dv.cantidad * p.precio_venta) as ingreso_total,
    SUM(dv.cantidad * p.precio_compra) as costo_total,
    SUM(dv.cantidad * (p.precio_venta - p.precio_compra)) as ganancia_total
  FROM detalle_ventas dv
  JOIN productos p ON dv.producto_id = p.id
  LEFT JOIN categorias c ON p.categoria_id = c.id
  JOIN ventas v ON dv.venta_id = v.id
  WHERE v.fecha_venta BETWEEN $1 AND $2
  AND v.estado = 'completada'
  GROUP BY p.id, p.nombre, p.categoria_id, c.nombre, p.precio_compra, p.precio_venta
  ORDER BY ganancia_total DESC
`, [fecha_inicio, fecha_fin]);

const resumenResult = await query(`
      SELECT 
        COALESCE(SUM(dv.cantidad * p.precio_venta), 0) as ingreso_total,
        COALESCE(SUM(dv.cantidad * p.precio_compra), 0) as costo_total,
        COALESCE(SUM(dv.cantidad * (p.precio_venta - p.precio_compra)), 0) as ganancia_total
      FROM detalle_ventas dv
      JOIN productos p ON dv.producto_id = p.id
      JOIN ventas v ON dv.venta_id = v.id
      WHERE v.fecha_venta BETWEEN $1 AND $2
      AND v.estado = 'completada'
    `, [fecha_inicio, fecha_fin]);

    const resumen = resumenResult.rows[0];
    const margen = resumen.ingreso_total > 0 
      ? ((resumen.ganancia_total / resumen.ingreso_total) * 100) 
      : 0;

    res.json({
      productos: result.rows,
      resumen: {
        ...resumen,
        margen_ganancia: margen
      }
    });

  } catch (error) {
    console.error('Error al generar reporte de ganancias:', error);
    res.status(500).json({ 
      error: 'Error al generar reporte de ganancias' 
    });
  }
});

// GET /api/reportes/movimientos - Movimientos de inventario
router.get('/movimientos', verificarRol('Administrador', 'Gerente'), async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin, tipo_movimiento, limit = 100 } = req.query;

    if (!fecha_inicio || !fecha_fin) {
      return res.status(400).json({
        error: 'Se requieren fecha_inicio y fecha_fin'
      });
    }

    // Convertir fechas para incluir todo el día
    const fechaInicioCompleta = `${fecha_inicio} 00:00:00`;
    const fechaFinCompleta = `${fecha_fin} 23:59:59`;

    let whereClause = 'WHERE m.created_at BETWEEN $1 AND $2';
    const params = [fechaInicioCompleta, fechaFinCompleta];
    let paramCount = 3;

    if (tipo_movimiento) {
      whereClause += ` AND m.tipo_movimiento = $${paramCount}`;
      params.push(tipo_movimiento);
      paramCount++;
    }

    whereClause += ` ORDER BY m.created_at DESC LIMIT $${paramCount}`;
    params.push(limit);

    const result = await query(`
      SELECT
        m.id,
        m.created_at as fecha,
        m.tipo_movimiento,
        m.cantidad,
        m.motivo,
        m.referencia,
        p.nombre as producto_nombre,
        p.codigo_barras,
        u.nombre as usuario_nombre
      FROM movimientos_inventario m
      JOIN productos p ON m.producto_id = p.id
      LEFT JOIN usuarios u ON m.usuario_id = u.id
      ${whereClause}
    `, params);

    res.json({
      movimientos: result.rows
    });

  } catch (error) {
    console.error('Error al generar reporte de movimientos:', error);
    res.status(500).json({
      error: 'Error al generar reporte de movimientos'
    });
  }
});

// GET /api/reportes/cuentas-por-pagar
router.get('/cuentas-por-pagar', verificarToken, async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin, proveedor_id, estado } = req.query;

    let queryText = `
      SELECT 
        cpp.id,
        cpp.folio,
        cpp.fecha_emision,
        cpp.fecha_vencimiento,
        cpp.monto_total,
        cpp.monto_pagado,
        cpp.saldo_pendiente,
        cpp.estado,
        cpp.dias_credito,
        cpp.concepto,
        cpp.notas,
        p.nombre as proveedor_nombre,
        p.telefono as proveedor_telefono,
        p.email as proveedor_email,
        u.nombre as usuario_nombre,
        CASE 
          WHEN cpp.fecha_vencimiento < CURRENT_DATE AND cpp.saldo_pendiente > 0 THEN 'vencido'
          ELSE cpp.estado
        END as estado_actual,
        CASE
          WHEN cpp.fecha_vencimiento >= CURRENT_DATE 
          THEN cpp.fecha_vencimiento - CURRENT_DATE
          ELSE (CURRENT_DATE - cpp.fecha_vencimiento) * -1
        END as dias_para_vencer,
        (
          SELECT COUNT(*) 
          FROM pagos_proveedores pp 
          WHERE pp.cuenta_por_pagar_id = cpp.id
        ) as num_pagos,
        (
          SELECT json_agg(
            json_build_object(
              'fecha_pago', pp.fecha_pago,
              'monto', pp.monto,
              'metodo_pago', pp.metodo_pago,
              'referencia', pp.referencia,
              'usuario', u2.nombre
            ) ORDER BY pp.fecha_pago DESC
          )
          FROM pagos_proveedores pp
          LEFT JOIN usuarios u2 ON pp.usuario_id = u2.id
          WHERE pp.cuenta_por_pagar_id = cpp.id
        ) as historial_pagos
      FROM cuentas_por_pagar cpp
      JOIN proveedores p ON cpp.proveedor_id = p.id
      LEFT JOIN usuarios u ON cpp.usuario_id = u.id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    if (fecha_inicio) {
      queryText += ` AND cpp.fecha_emision >= $${paramCount}`;
      params.push(fecha_inicio);
      paramCount++;
    }

    if (fecha_fin) {
      queryText += ` AND cpp.fecha_emision <= $${paramCount}`;
      params.push(fecha_fin);
      paramCount++;
    }

    if (proveedor_id) {
      queryText += ` AND cpp.proveedor_id = $${paramCount}`;
      params.push(proveedor_id);
      paramCount++;
    }

    if (estado) {
      if (estado === 'vencido') {
        queryText += ` AND cpp.fecha_vencimiento < CURRENT_DATE AND cpp.saldo_pendiente > 0`;
      } else {
        queryText += ` AND cpp.estado = $${paramCount}`;
        params.push(estado);
        paramCount++;
      }
    }

    queryText += ` ORDER BY cpp.fecha_emision DESC`;

    const result = await query(queryText, params);

    // Calcular totales
    const totales = {
      total_cuentas: result.rows.length,
      monto_total: result.rows.reduce((sum, row) => sum + parseFloat(row.monto_total), 0),
      monto_pagado: result.rows.reduce((sum, row) => sum + parseFloat(row.monto_pagado), 0),
      saldo_pendiente: result.rows.reduce((sum, row) => sum + parseFloat(row.saldo_pendiente), 0),
      total_vencido: result.rows
        .filter(row => row.estado_actual === 'vencido')
        .reduce((sum, row) => sum + parseFloat(row.saldo_pendiente), 0),
    };

    res.json({
      cuentas: result.rows,
      totales,
    });

  } catch (error) {
    console.error('Error al generar reporte de cuentas por pagar:', error);
    res.status(500).json({ 
      error: 'Error al generar reporte' 
    });
  }
});

module.exports = router;
