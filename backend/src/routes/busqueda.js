// src/routes/busqueda.js
const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verificarToken } = require('../middleware/auth');

router.use(verificarToken);

// GET /api/busqueda?q=texto - Búsqueda global
router.get('/', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.json({
        resultados: [],
        total: 0
      });
    }

    const searchTerm = `%${q.trim().toLowerCase()}%`;
    const resultados = [];

    // Buscar en Productos
    const productosResult = await query(`
      SELECT 
        id,
        nombre,
        codigo_barras,
        precio_venta,
        stock_actual,
        'producto' as tipo
      FROM productos
      WHERE activo = true
      AND (
        LOWER(nombre) LIKE $1 
        OR LOWER(codigo_barras) LIKE $1
      )
      LIMIT 5
    `, [searchTerm]);

    productosResult.rows.forEach(p => {
      resultados.push({
        id: p.id,
        tipo: 'producto',
        titulo: p.nombre,
        subtitulo: `Código: ${p.codigo_barras} | Stock: ${p.stock_actual} | Q${parseFloat(p.precio_venta).toFixed(2)}`,
        ruta: '/productos',
        icono: 'inventory'
      });
    });

    // Buscar en Clientes
    const clientesResult = await query(`
      SELECT 
        id,
        nombre,
        telefono,
        email,
        'cliente' as tipo
      FROM clientes
      WHERE activo = true
      AND (
        LOWER(nombre) LIKE $1 
        OR LOWER(telefono) LIKE $1
        OR LOWER(email) LIKE $1
      )
      LIMIT 5
    `, [searchTerm]);

    clientesResult.rows.forEach(c => {
      resultados.push({
        id: c.id,
        tipo: 'cliente',
        titulo: c.nombre,
        subtitulo: `${c.telefono || ''} ${c.email || ''}`.trim() || 'Sin contacto',
        ruta: '/clientes',
        icono: 'person'
      });
    });

    // Buscar en Ventas (por folio)
    const ventasResult = await query(`
      SELECT 
        v.id,
        v.folio,
        v.total,
        v.fecha_venta,
        c.nombre as cliente_nombre,
        'venta' as tipo
      FROM ventas v
      LEFT JOIN clientes c ON v.cliente_id = c.id
      WHERE LOWER(v.folio) LIKE $1
      ORDER BY v.fecha_venta DESC
      LIMIT 5
    `, [searchTerm]);

    ventasResult.rows.forEach(v => {
      resultados.push({
        id: v.id,
        tipo: 'venta',
        titulo: v.folio,
        subtitulo: `${v.cliente_nombre || 'Sin cliente'} | Q${parseFloat(v.total).toFixed(2)}`,
        ruta: '/ventas',
        icono: 'receipt'
      });
    });

    // Buscar en Proveedores
    const proveedoresResult = await query(`
      SELECT 
        id,
        nombre,
        telefono,
        email,
        'proveedor' as tipo
      FROM proveedores
      WHERE activo = true
      AND (
        LOWER(nombre) LIKE $1 
        OR LOWER(telefono) LIKE $1
        OR LOWER(email) LIKE $1
      )
      LIMIT 5
    `, [searchTerm]);

    proveedoresResult.rows.forEach(p => {
      resultados.push({
        id: p.id,
        tipo: 'proveedor',
        titulo: p.nombre,
        subtitulo: `${p.telefono || ''} ${p.email || ''}`.trim() || 'Sin contacto',
        ruta: '/proveedores',
        icono: 'business'
      });
    });

    res.json({
      resultados: resultados,
      total: resultados.length,
      query: q
    });

  } catch (error) {
    console.error('Error en búsqueda global:', error);
    res.status(500).json({ 
      error: 'Error al realizar búsqueda',
      resultados: [],
      total: 0
    });
  }
});

module.exports = router;
