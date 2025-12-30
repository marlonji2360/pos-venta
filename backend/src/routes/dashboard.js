// src/routes/dashboard.js
const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verificarToken } = require('../middleware/auth');
const { startOfMonth, endOfMonth, subMonths } = require('date-fns');

router.use(verificarToken);

// GET /api/dashboard/estadisticas - Obtener estadísticas generales
router.get('/estadisticas', async (req, res) => {
  try {
    // Ventas del día
    const ventasHoyResult = await query(`
      SELECT 
        COUNT(*) as total_ventas,
        COALESCE(SUM(total), 0) as monto_total
      FROM ventas
      WHERE DATE(fecha_venta) = CURRENT_DATE
      AND estado = 'completada'
    `);

    // Ventas del mes
    const ventasMesResult = await query(`
      SELECT 
        COUNT(*) as total_ventas,
        COALESCE(SUM(total), 0) as monto_total
      FROM ventas
      WHERE DATE_TRUNC('month', fecha_venta) = DATE_TRUNC('month', CURRENT_DATE)
      AND estado = 'completada'
    `);

    // Productos con stock bajo (menor al mínimo)
    const stockBajoResult = await query(`
      SELECT COUNT(*) as total
      FROM productos
      WHERE stock_actual <= stock_minimo
      AND activo = true
    `);

    // Productos próximos a vencer (próximos 30 días)
    const porVencerResult = await query(`
      SELECT COUNT(DISTINCT producto_id) as total
      FROM lotes_productos
      WHERE fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
      AND cantidad > 0
    `);

    // Pedidos pendientes
    const pedidosPendientesResult = await query(`
      SELECT COUNT(*) as total
      FROM pedidos_proveedores
      WHERE estado = 'pendiente'
    `);

    // Total de productos activos
    const productosResult = await query(`
      SELECT COUNT(*) as total
      FROM productos
      WHERE activo = true
    `);

    // Total de clientes activos
    const clientesResult = await query(`
      SELECT COUNT(*) as total
      FROM clientes
      WHERE activo = true
    `);

    res.json({
      ventasHoy: {
        total: parseInt(ventasHoyResult.rows[0].total_ventas),
        monto: parseFloat(ventasHoyResult.rows[0].monto_total)
      },
      ventasMes: {
        total: parseInt(ventasMesResult.rows[0].total_ventas),
        monto: parseFloat(ventasMesResult.rows[0].monto_total)
      },
      stockBajo: parseInt(stockBajoResult.rows[0].total),
      productosPorVencer: parseInt(porVencerResult.rows[0].total),
      pedidosPendientes: parseInt(pedidosPendientesResult.rows[0].total),
      totalProductos: parseInt(productosResult.rows[0].total),
      totalClientes: parseInt(clientesResult.rows[0].total)
    });

  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ 
      error: 'Error al obtener estadísticas del dashboard' 
    });
  }
});

// GET /api/dashboard/ventas-recientes - Últimas ventas
router.get('/ventas-recientes', async (req, res) => {
  try {
    const { limit = 5 } = req.query;

    const result = await query(`
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
      WHERE v.estado = 'completada'
      ORDER BY v.fecha_venta DESC
      LIMIT $1
    `, [limit]);

    res.json({
      ventas: result.rows
    });

  } catch (error) {
    console.error('Error al obtener ventas recientes:', error);
    res.status(500).json({ 
      error: 'Error al obtener ventas recientes' 
    });
  }
});

// GET /api/dashboard/productos-mas-vendidos - Top productos vendidos
router.get('/productos-mas-vendidos', async (req, res) => {
  try {
    const { limit = 5, dias = 30 } = req.query;

    const result = await query(`
      SELECT 
        p.id,
        p.nombre,
        p.codigo_barras,
        SUM(dv.cantidad) as total_vendido,
        COUNT(DISTINCT v.id) as num_ventas
      FROM detalle_ventas dv
      JOIN productos p ON dv.producto_id = p.id
      JOIN ventas v ON dv.venta_id = v.id
      WHERE v.fecha_venta >= CURRENT_DATE - INTERVAL '${dias} days'
      AND v.estado = 'completada'
      GROUP BY p.id, p.nombre, p.codigo_barras
      ORDER BY total_vendido DESC
      LIMIT $1
    `, [limit]);

    res.json({
      productos: result.rows
    });

  } catch (error) {
    console.error('Error al obtener productos más vendidos:', error);
    res.status(500).json({ 
      error: 'Error al obtener productos más vendidos' 
    });
  }
});

// GET /api/dashboard/stock-bajo - Productos con stock bajo
router.get('/stock-bajo', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const result = await query(`
      SELECT 
        id,
        nombre,
        codigo_barras,
        stock_actual,
        stock_minimo,
        unidad_medida
      FROM productos
      WHERE stock_actual <= stock_minimo
      AND activo = true
      ORDER BY (stock_minimo - stock_actual) DESC
      LIMIT $1
    `, [limit]);

    res.json({
      productos: result.rows
    });

  } catch (error) {
    console.error('Error al obtener productos con stock bajo:', error);
    res.status(500).json({ 
      error: 'Error al obtener productos con stock bajo' 
    });
  }
});

// GET /api/dashboard/productos-por-vencer - Productos próximos a vencer
router.get('/productos-por-vencer', async (req, res) => {
  try {
    const { limit = 10, dias = 30 } = req.query;

    const result = await query(`
      SELECT 
        l.id,
        l.numero_lote,
        l.fecha_vencimiento,
        l.cantidad,
        p.nombre as producto_nombre,
        p.codigo_barras,
        (l.fecha_vencimiento - CURRENT_DATE) as dias_restantes
      FROM lotes_productos l
      JOIN productos p ON l.producto_id = p.id
      WHERE l.fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '${dias} days'
      AND l.cantidad > 0
      AND p.activo = true
      ORDER BY l.fecha_vencimiento ASC
      LIMIT $1
    `, [limit]);

    res.json({
      lotes: result.rows
    });

  } catch (error) {
    console.error('Error al obtener productos por vencer:', error);
    res.status(500).json({ 
      error: 'Error al obtener productos por vencer' 
    });
  }
});

// GET /api/dashboard/ventas-por-dia - Ventas de los últimos días para gráfica
router.get('/ventas-por-dia', async (req, res) => {
  try {
    const { dias = 7 } = req.query;

    const result = await query(`
      SELECT 
        DATE(fecha_venta) as fecha,
        COUNT(*) as num_ventas,
        COALESCE(SUM(total), 0) as monto_total
      FROM ventas
      WHERE fecha_venta >= CURRENT_DATE - INTERVAL '${dias} days'
      AND estado = 'completada'
      GROUP BY DATE(fecha_venta)
      ORDER BY fecha ASC
    `);

    res.json({
      ventas: result.rows
    });

  } catch (error) {
    console.error('Error al obtener ventas por día:', error);
    res.status(500).json({ 
      error: 'Error al obtener ventas por día' 
    });
  }
});

module.exports = router;


// GET /api/dashboard/comparativa-mensual - Comparativa mes actual vs anterior
router.get('/comparativa-mensual', async (req, res) => {
  try {
    const mesActualInicio = startOfMonth(new Date());
    const mesActualFin = endOfMonth(new Date());
    const mesAnteriorInicio = startOfMonth(subMonths(new Date(), 1));
    const mesAnteriorFin = endOfMonth(subMonths(new Date(), 1));

    // Ventas mes actual
    const mesActualResult = await query(`
      SELECT 
        COUNT(*) as num_ventas,
        COALESCE(SUM(total), 0) as total_ventas,
        COALESCE(AVG(total), 0) as promedio_venta
      FROM ventas
      WHERE fecha_venta BETWEEN $1 AND $2
      AND estado = 'completada'
    `, [mesActualInicio.toISOString(), mesActualFin.toISOString()]);

    // Ventas mes anterior
    const mesAnteriorResult = await query(`
      SELECT 
        COUNT(*) as num_ventas,
        COALESCE(SUM(total), 0) as total_ventas,
        COALESCE(AVG(total), 0) as promedio_venta
      FROM ventas
      WHERE fecha_venta BETWEEN $1 AND $2
      AND estado = 'completada'
    `, [mesAnteriorInicio.toISOString(), mesAnteriorFin.toISOString()]);

    const mesActual = mesActualResult.rows[0];
    const mesAnterior = mesAnteriorResult.rows[0];

    const diferencia = parseFloat(mesActual.total_ventas) - parseFloat(mesAnterior.total_ventas);
    const cambioPorcentual = mesAnterior.total_ventas > 0 
      ? ((diferencia / parseFloat(mesAnterior.total_ventas)) * 100).toFixed(1)
      : 0;

    res.json({
      ventas_mes_actual: mesActual.total_ventas,
      num_ventas_actual: parseInt(mesActual.num_ventas),
      promedio_venta_actual: mesActual.promedio_venta,
      ventas_mes_anterior: mesAnterior.total_ventas,
      num_ventas_anterior: parseInt(mesAnterior.num_ventas),
      promedio_venta_anterior: mesAnterior.promedio_venta,
      diferencia: diferencia,
      cambio_porcentual: parseFloat(cambioPorcentual)
    });

  } catch (error) {
    console.error('Error al obtener comparativa mensual:', error);
    res.status(500).json({ 
      error: 'Error al obtener comparativa mensual' 
    });
  }
});

// GET /api/dashboard/ventas-por-categoria - Ventas por categoría
router.get('/ventas-por-categoria', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        c.id as categoria_id,
        c.nombre as categoria_nombre,
        SUM(dv.cantidad) as total_vendido,
        COALESCE(SUM(dv.subtotal), 0) as monto_total
      FROM detalle_ventas dv
      JOIN productos p ON dv.producto_id = p.id
      JOIN categorias c ON p.categoria_id = c.id
      JOIN ventas v ON dv.venta_id = v.id
      WHERE v.fecha_venta >= CURRENT_DATE - INTERVAL '30 days'
      AND v.estado = 'completada'
      GROUP BY c.id, c.nombre
      ORDER BY total_vendido DESC
      LIMIT 6
    `);

    res.json({
      categorias: result.rows
    });

  } catch (error) {
    console.error('Error al obtener ventas por categoría:', error);
    res.status(500).json({ 
      error: 'Error al obtener ventas por categoría' 
    });
  }
});

