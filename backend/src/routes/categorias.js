const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verificarToken } = require('../middleware/auth');

router.use(verificarToken);

router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM categorias WHERE activo = true ORDER BY nombre');
    res.json({ categorias: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
});

module.exports = router;
