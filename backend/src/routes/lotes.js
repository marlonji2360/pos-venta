// src/routes/lotes.js
const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verificarToken, verificarRol } = require('../middleware/auth');

router.use(verificarToken);

// POST /api/lotes - Crear nuevo lote
router.post('/', verificarRol('Administrador', 'Gerente'), async (req, res) => {
  try {
    const {
      producto_id,
      numero_lote,
      cantidad,
      fecha_vencimiento,
      precio_compra,
    } = req.body;

    // Insertar lote
    const result = await query(
      `INSERT INTO lotes_productos (producto_id, numero_lote, cantidad, fecha_vencimiento, precio_compra)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [producto_id, numero_lote, cantidad, fecha_vencimiento, precio_compra]
    );

    // Actualizar stock del producto
    await query(
      'UPDATE productos SET stock_actual = stock_actual + $1 WHERE id = $2',
      [cantidad, producto_id]
    );

    res.status(201).json({
      message: 'Lote creado exitosamente',
      lote: result.rows[0]
    });

  } catch (error) {
    console.error('Error al crear lote:', error);
    res.status(500).json({ 
      error: 'Error al crear lote' 
    });
  }
});

// GET /api/lotes/producto/:id - Obtener lotes de un producto
router.get('/producto/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT * FROM lotes_productos 
       WHERE producto_id = $1 AND activo = true
       ORDER BY fecha_vencimiento ASC`,
      [id]
    );

    res.json({
      lotes: result.rows
    });

  } catch (error) {
    console.error('Error al obtener lotes:', error);
    res.status(500).json({ 
      error: 'Error al obtener lotes' 
    });
  }
});

module.exports = router;
