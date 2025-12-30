// src/routes/notificaciones.js
const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verificarToken } = require('../middleware/auth');

router.use(verificarToken);

// GET /api/notificaciones - Obtener todas las notificaciones
router.get('/', async (req, res) => {
  try {
    const notificaciones = [];

    // 1. Productos con stock bajo
    const stockBajoResult = await query(`
      SELECT 
        id,
        nombre,
        codigo_barras,
        stock_actual,
        stock_minimo
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

    // 2. Productos próximos a vencer (próximos 30 días)
    const porVencerResult = await query(`
      SELECT 
        l.id,
        l.numero_lote,
        l.fecha_vencimiento,
        l.cantidad,
        p.nombre as producto_nombre,
        p.id as producto_id,
        (l.fecha_vencimiento - CURRENT_DATE) as dias_restantes
      FROM lotes_productos l
      JOIN productos p ON l.producto_id = p.id
      WHERE l.fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
      AND l.cantidad > 0
      AND p.activo = true
      ORDER BY l.fecha_vencimiento ASC
      LIMIT 10
    `);

    porVencerResult.rows.forEach(lote => {
      const diasRestantes = parseInt(lote.dias_restantes);
      const prioridad = diasRestantes <= 7 ? 'alta' : diasRestantes <= 15 ? 'media' : 'baja';
      const color = diasRestantes <= 7 ? 'error' : diasRestantes <= 15 ? 'warning' : 'info';

      notificaciones.push({
        id: `vencimiento-${lote.id}`,
        tipo: 'producto_vencer',
        prioridad: prioridad,
        titulo: 'Producto por Vencer',
        mensaje: `${lote.producto_nombre} (Lote: ${lote.numero_lote}) vence en ${diasRestantes} días`,
        icono: 'schedule',
        color: color,
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
        pp.total,
        prov.nombre as proveedor_nombre,
        (CURRENT_DATE - DATE(pp.fecha_pedido)) as dias_pendiente
      FROM pedidos_proveedores pp
      JOIN proveedores prov ON pp.proveedor_id = prov.id
      WHERE pp.estado = 'pendiente'
      ORDER BY pp.fecha_pedido ASC
      LIMIT 10
    `);

    pedidosPendientesResult.rows.forEach(pedido => {
      const diasPendiente = parseInt(pedido.dias_pendiente);
      const prioridad = diasPendiente >= 7 ? 'alta' : diasPendiente >= 3 ? 'media' : 'baja';

      notificaciones.push({
        id: `pedido-${pedido.id}`,
        tipo: 'pedido_pendiente',
        prioridad: prioridad,
        titulo: 'Pedido Pendiente',
        mensaje: `Pedido ${pedido.folio} de ${pedido.proveedor_nombre} lleva ${diasPendiente} días pendiente`,
        icono: 'local_shipping',
        color: 'info',
        fecha: new Date(),
        datos: pedido
      });
    });

    // 4. Productos sin stock
    const sinStockResult = await query(`
      SELECT 
        id,
        nombre,
        codigo_barras
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

    // 5. Solicitudes de descuento pendientes (solo Admin/Gerente)
    if (req.usuario.rol === 'Administrador' || req.usuario.rol === 'Gerente') {
      const solicitudesResult = await query(`
        SELECT 
          ad.*,
          u.nombre as solicitado_por_nombre
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
          mensaje: `${solicitud.solicitado_por_nombre} solicita Q${parseFloat(solicitud.monto_descuento).toFixed(2)} de descuento`,
          fecha: solicitud.fecha_solicitud,
          leida: false,
          datos: {
            autorizacion_id: solicitud.id,
            monto: solicitud.monto_descuento,
            porcentaje: solicitud.porcentaje_descuento,
            motivo: solicitud.motivo,
            solicitante: solicitud.solicitado_por_nombre,
            url: '/autorizaciones-descuento'
          }
        });
      });
    }

    // Ordenar por prioridad
    const prioridadOrden = { alta: 1, media: 2, baja: 3 };
    notificaciones.sort((a, b) => prioridadOrden[a.prioridad] - prioridadOrden[b.prioridad]);

    // Contar por tipo y prioridad
    const resumen = {
      total: notificaciones.length,
      por_prioridad: {
        alta: notificaciones.filter(n => n.prioridad === 'alta').length,
        media: notificaciones.filter(n => n.prioridad === 'media').length,
        baja: notificaciones.filter(n => n.prioridad === 'baja').length
      },
      por_tipo: {
        stock_bajo: notificaciones.filter(n => n.tipo === 'stock_bajo').length,
        producto_vencer: notificaciones.filter(n => n.tipo === 'producto_vencer').length,
        pedido_pendiente: notificaciones.filter(n => n.tipo === 'pedido_pendiente').length,
        sin_stock: notificaciones.filter(n => n.tipo === 'sin_stock').length
      }
    };

    res.json({
      notificaciones: notificaciones,
      resumen: resumen
    });

  } catch (error) {
    console.error('Error al obtener notificaciones:', error);
    res.status(500).json({ 
      error: 'Error al obtener notificaciones' 
    });
  }
});

// GET /api/notificaciones/contador - Obtener solo el contador
router.get('/contador', async (req, res) => {
  try {
    // Stock bajo
    const stockBajo = await query(`
      SELECT COUNT(*) as total
      FROM productos
      WHERE stock_actual <= stock_minimo
      AND activo = true
    `);

    // Productos por vencer
    const porVencer = await query(`
      SELECT COUNT(DISTINCT producto_id) as total
      FROM lotes_productos
      WHERE fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
      AND cantidad > 0
    `);

    // Pedidos pendientes
    const pedidosPendientes = await query(`
      SELECT COUNT(*) as total
      FROM pedidos_proveedores
      WHERE estado = 'pendiente'
    `);

    // Sin stock
    const sinStock = await query(`
      SELECT COUNT(*) as total
      FROM productos
      WHERE stock_actual = 0
      AND activo = true
    `);

    const total = 
      parseInt(stockBajo.rows[0].total) +
      parseInt(porVencer.rows[0].total) +
      parseInt(pedidosPendientes.rows[0].total) +
      parseInt(sinStock.rows[0].total);

    res.json({
      total: total,
      desglose: {
        stock_bajo: parseInt(stockBajo.rows[0].total),
        por_vencer: parseInt(porVencer.rows[0].total),
        pedidos_pendientes: parseInt(pedidosPendientes.rows[0].total),
        sin_stock: parseInt(sinStock.rows[0].total)
      }
    });

  } catch (error) {
    console.error('Error al obtener contador de notificaciones:', error);
    res.status(500).json({ 
      error: 'Error al obtener contador' 
    });
  }
});

module.exports = router;
