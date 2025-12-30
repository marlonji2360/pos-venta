// src/routes/configuracion.js
const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verificarToken, verificarRol } = require('../middleware/auth');

router.use(verificarToken);

// GET /api/configuracion - Obtener configuración del sistema
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT clave, valor, descripcion, tipo
      FROM configuracion
      ORDER BY clave
    `);

    // Convertir array a objeto para facilitar el uso
    const config = {};
    result.rows.forEach(row => {
      config[row.clave] = {
        valor: row.valor,
        descripcion: row.descripcion,
        tipo: row.tipo
      };
    });

    res.json({
      configuracion: config
    });

  } catch (error) {
    console.error('Error al obtener configuración:', error);
    res.status(500).json({ 
      error: 'Error al obtener configuración' 
    });
  }
});

// PUT /api/configuracion - Actualizar configuración
router.put('/', verificarRol('Administrador'), async (req, res) => {
  try {
    const { configuracion } = req.body;

    if (!configuracion) {
      return res.status(400).json({ 
        error: 'Se requiere el objeto de configuración' 
      });
    }

    console.log('Actualizando configuración:', configuracion);

    // Actualizar cada configuración
    for (const [clave, valor] of Object.entries(configuracion)) {
      await query(`
        INSERT INTO configuracion (clave, valor, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (clave) 
        DO UPDATE SET valor = $2, updated_at = CURRENT_TIMESTAMP
      `, [clave, valor]);
    }

    res.json({
      message: 'Configuración actualizada exitosamente'
    });

  } catch (error) {
    console.error('Error al actualizar configuración:', error);
    res.status(500).json({ 
      error: 'Error al actualizar configuración',
      detalles: error.message
    });
  }
});

// POST /api/configuracion/inicializar - Crear configuración inicial
router.post('/inicializar', verificarRol('Administrador'), async (req, res) => {
  try {
    const configuracionesIniciales = [
      { clave: 'nombre_negocio', valor: 'POS Abarrotes', descripcion: 'Nombre del negocio', tipo: 'texto' },
      { clave: 'direccion', valor: 'Ciudad de Guatemala, Guatemala', descripcion: 'Dirección del negocio', tipo: 'texto' },
      { clave: 'telefono', valor: '(502) 1234-5678', descripcion: 'Teléfono de contacto', tipo: 'texto' },
      { clave: 'email', valor: 'info@posabarrotes.com', descripcion: 'Email de contacto', tipo: 'texto' },
      { clave: 'nit', valor: 'CF', descripcion: 'NIT del negocio', tipo: 'texto' },
      { clave: 'moneda', valor: 'Q', descripcion: 'Símbolo de moneda', tipo: 'texto' },
      { clave: 'timezone', valor: 'America/Guatemala', descripcion: 'Zona horaria', tipo: 'texto' },
      { clave: 'iva', valor: '12', descripcion: 'Porcentaje de IVA', tipo: 'numero' },
      { clave: 'ticket_mensaje', valor: '¡Gracias por su compra!', descripcion: 'Mensaje en tickets', tipo: 'texto' },
      { clave: 'ticket_pie', valor: 'Vuelva pronto', descripcion: 'Pie de página en tickets', tipo: 'texto' },
    ];

    for (const config of configuracionesIniciales) {
      await query(`
        INSERT INTO configuracion (clave, valor, descripcion, tipo)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (clave) DO NOTHING
      `, [config.clave, config.valor, config.descripcion, config.tipo]);
    }

    res.json({
      message: 'Configuración inicializada exitosamente'
    });

  } catch (error) {
    console.error('Error al inicializar configuración:', error);
    res.status(500).json({ 
      error: 'Error al inicializar configuración',
      detalles: error.message
    });
  }
});

module.exports = router;
