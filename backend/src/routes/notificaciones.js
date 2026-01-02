const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verificarToken } = require('../middleware/auth');

router.use(verificarToken);

// ======================================================
// GET /api/notificaciones - Obtener todas las notificaciones
// ======================================================
router.get('/', async (req, res) => {
  try {
    const notificaciones = [];

    // 1. Productos con stock bajo
    const stockBajoResult = await query(`
      SELECT id, nombre, codigo_barras, stock_actual, stock_minimo
      FROM productos
      WHERE stock_actual <= stock_minimo
      AND activo = true
      ORDER BY (stock_minimo - stock_actual) DESC
      LIMIT 10
    `);

    stockBajoResult.rows.forEach(producto => {
      notificaciones.push({
        id: `stock-${producto.id}`,
        tipo: 'stock_bajo',
        prioridad: 'alta',
        titulo: 'Stock Bajo',
        mensaje: `${producto.nombre} tiene solo ${producto.stock_actual} unidades (mínimo: ${producto.stock_minimo})`,
        icono: 'warning',
        color: 'warning',
        fecha: new Date(),
        datos: producto
      });
    });

    // 2. Productos próximos a vencer
    const porVencerResult = await query(`
      SELECT 
        l.id,
        l.numero_lote,
        l.fecha_vencimiento,
        l.cantidad,
        p.nombre AS producto_nombre,
        (l.fecha_vencimiento - CURRENT_DATE) AS dias_restantes
      FROM lotes_productos l
      JOIN productos p ON l.producto_id = p.id
      WHERE l.fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
      AND l.cantidad > 0
      AND p.activo = true
      ORDER BY l.fecha_vencimiento ASC
      LIMIT 10
    `);

    porVencerResult.rows.forEach(lote => {
      const dias = parseInt(lote.dias_restantes);
      const prioridad = dias <= 7 ? 'alta' : dias <= 15 ? 'media' : 'baja';

      notificaciones.push({
        id: `vencimiento-${lote.id}`,
        tipo: 'producto_vencer',
        prioridad,
        titulo: 'Producto por Vencer',
        mensaje: `${lote.producto_nombre} (Lote: ${lote.numero_lote}) vence en ${dias} días`,
        icono: 'schedule',
        color: prioridad === 'alta' ? 'error' : prioridad === 'media' ? 'warning' : 'info',
        fecha: new Date(),
        datos: lote
      });
    });

    // 3. Pedidos pendientes
    const pedidosPendientesResult = await query(`
      SELECT 
        pp.id,
        pp.folio,
        pp.fecha_pedido,
        prov.nombre AS proveedor_nombre,
        (CURRENT_DATE - DATE(pp.fecha_pedido)) AS dias_pendiente
      FROM pedidos_proveedores pp
      JOIN proveedores prov ON pp.proveedor_id = prov.id
      WHERE pp.estado = 'pendiente'
      ORDER BY pp.fecha_pedido ASC
      LIMIT 10
    `);

    pedidosPendientesResult.rows.forEach(pedido => {
      const dias = parseInt(pedido.dias_pendiente);
      const prioridad = dias >= 7 ? 'alta' : dias >= 3 ? 'media' : 'baja';

      notificaciones.push({
        id: `pedido-${pedido.id}`,
        tipo: 'pedido_pendiente',
        prioridad,
        titulo: 'Pedido Pendiente',
        mensaje: `Pedido ${pedido.folio} de ${pedido.proveedor_nombre} lleva ${dias} días pendiente`,
        icono: 'local_shipping',
        color: 'info',
        fecha: new Date(),
        datos: pedido
      });
    });

    // 4. Productos sin stock
    const sinStockResult = await query(`
      SELECT id, nombre, codigo_barras
      FROM productos
      WHERE stock_actual = 0
      AND activo = true
      LIMIT 5
    `);

    sinStockResult.rows.forEach(producto => {
      notificaciones.push({
        id: `sin-stock-${producto.id}`,
        tipo: 'sin_stock',
        prioridad: 'alta',
        titulo: 'Sin Stock',
        mensaje: `${producto.nombre} no tiene unidades disponibles`,
        icono: 'error',
        color: 'error',
        fecha: new Date(),
        datos: producto
      });
    });

    // 5. Gastos por vencer (solo Admin/Gerente)
    if (req.usuario.rol === 'Administrador' || req.usuario.rol === 'Gerente') {
      const gastosPorVencerResult = await query(`
        SELECT 
          pg.id,
          pg.fecha_vencimiento,
          pg.monto_pagado as monto,
          gf.nombre as gasto_nombre,
          gf.proveedor,
          gf.dias_recordatorio,
          cg.nombre as categoria_nombre,
          cg.color,
          (pg.fecha_vencimiento - CURRENT_DATE) as dias_restantes,
          CASE 
            WHEN pg.fecha_vencimiento < CURRENT_DATE THEN 'vencido'
            WHEN pg.fecha_vencimiento <= CURRENT_DATE + gf.dias_recordatorio THEN 'por_vencer'
            ELSE 'pendiente'
          END as estado_alerta
        FROM pagos_gastos pg
        JOIN gastos_fijos gf ON pg.gasto_fijo_id = gf.id
        JOIN categorias_gastos cg ON gf.categoria_id = cg.id
        WHERE pg.estado = 'pendiente'
        AND gf.activo = true
        AND (
          pg.fecha_vencimiento < CURRENT_DATE
          OR pg.fecha_vencimiento <= CURRENT_DATE + gf.dias_recordatorio
        )
        ORDER BY pg.fecha_vencimiento ASC
      `);

      gastosPorVencerResult.rows.forEach(gasto => {
        const diasRestantes = parseInt(gasto.dias_restantes);
        const esVencido = gasto.estado_alerta === 'vencido';
        const prioridad = esVencido ? 'alta' : diasRestantes <= 1 ? 'alta' : 'media';

        notificaciones.push({
          id: `gasto-${gasto.id}`,
          tipo: 'gasto_por_vencer',
          prioridad: prioridad,
          titulo: esVencido ? '🚨 Gasto Vencido' : '💰 Gasto Por Vencer',
          mensaje: esVencido 
            ? `${gasto.gasto_nombre} venció hace ${Math.abs(diasRestantes)} días - Q${parseFloat(gasto.monto).toFixed(2)}`
            : `${gasto.gasto_nombre} vence en ${diasRestantes} días - Q${parseFloat(gasto.monto).toFixed(2)}`,
          icono: esVencido ? 'error' : 'warning',
          color: esVencido ? 'error' : 'warning',
          fecha: gasto.fecha_vencimiento,
          datos: {
            gasto_id: gasto.id,
            monto: gasto.monto,
            proveedor: gasto.proveedor,
            categoria: gasto.categoria_nombre,
            url: '/gastos-fijos'
          }
        });
      });
    }

    // 6. Solicitudes de descuento (Admin / Gerente)
    if (req.usuario.rol === 'Administrador' || req.usuario.rol === 'Gerente') {
      const solicitudesResult = await query(`
        SELECT ad.*, u.nombre AS solicitado_por_nombre
        FROM autorizaciones_descuento ad
        JOIN usuarios u ON ad.solicitado_por = u.id
        WHERE ad.estado = 'pendiente'
        ORDER BY ad.fecha_solicitud DESC
      `);

      solicitudesResult.rows.forEach(solicitud => {
        notificaciones.push({
          id: `descuento-${solicitud.id}`,
          tipo: 'solicitud_descuento',
          prioridad: 'alta',
          titulo: '🎁 Nueva Solicitud de Descuento',
          mensaje: `${solicitud.solicitado_por_nombre} solicita Q${parseFloat(solicitud.monto_descuento).toFixed(2)}`,
          fecha: solicitud.fecha_solicitud,
          datos: solicitud
        });
      });
    }

    // Ordenar por prioridad
    const prioridadOrden = { alta: 1, media: 2, baja: 3 };
    notificaciones.sort((a, b) => prioridadOrden[a.prioridad] - prioridadOrden[b.prioridad]);

    res.json({ notificaciones });

  } catch (error) {
    console.error('Error al obtener notificaciones:', error);
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
});

// ======================================================
// GET /api/notificaciones/contador - SOLO CONTADOR
// ======================================================
router.get('/contador', async (req, res) => {
  try {
    const stockBajo = await query(`
      SELECT COUNT(*) AS total
      FROM productos
      WHERE stock_actual <= stock_minimo
      AND activo = true
    `);

    const porVencer = await query(`
      SELECT COUNT(DISTINCT producto_id) AS total
      FROM lotes_productos
      WHERE fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
      AND cantidad > 0
    `);

    const pedidosPendientes = await query(`
      SELECT COUNT(*) AS total
      FROM pedidos_proveedores
      WHERE estado = 'pendiente'
    `);

    const sinStock = await query(`
      SELECT COUNT(*) AS total
      FROM productos
      WHERE stock_actual = 0
      AND activo = true
    `);

    let gastosPorVencer = 0;
    let solicitudesDescuento = 0;

    if (req.usuario.rol === 'Administrador' || req.usuario.rol === 'Gerente') {
      const gastos = await query(`
        SELECT COUNT(*) AS total
        FROM pagos_gastos pg
        JOIN gastos_fijos gf ON pg.gasto_fijo_id = gf.id
        WHERE pg.estado = 'pendiente'
        AND gf.activo = true
        AND (
          pg.fecha_vencimiento < CURRENT_DATE
          OR pg.fecha_vencimiento <= CURRENT_DATE + gf.dias_recordatorio
        )
      `);

      const solicitudes = await query(`
        SELECT COUNT(*) AS total
        FROM autorizaciones_descuento
        WHERE estado = 'pendiente'
      `);

      gastosPorVencer = parseInt(gastos.rows[0].total);
      solicitudesDescuento = parseInt(solicitudes.rows[0].total);
    }

    const total =
      parseInt(stockBajo.rows[0].total) +
      parseInt(porVencer.rows[0].total) +
      parseInt(pedidosPendientes.rows[0].total) +
      parseInt(sinStock.rows[0].total) +
      gastosPorVencer +
      solicitudesDescuento;

    res.json({
      total,
      desglose: {
        stock_bajo: parseInt(stockBajo.rows[0].total),
        por_vencer: parseInt(porVencer.rows[0].total),
        pedidos_pendientes: parseInt(pedidosPendientes.rows[0].total),
        sin_stock: parseInt(sinStock.rows[0].total),
        gastos_por_vencer: gastosPorVencer,
        solicitudes_descuento: solicitudesDescuento
      }
    });

  } catch (error) {
    console.error('Error al obtener contador de notificaciones:', error);
    res.status(500).json({ error: 'Error al obtener contador' });
  }
});

module.exports = router;
