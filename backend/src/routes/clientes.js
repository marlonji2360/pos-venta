// src/routes/clientes.js
const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verificarToken, verificarRol } = require('../middleware/auth');

router.use(verificarToken);

// GET /api/clientes - Listar todos los clientes
router.get('/', async (req, res) => {
  try {
    const { activo, search, limit = 100, offset = 0 } = req.query;
    
    let queryText = 'SELECT * FROM clientes WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (activo !== undefined) {
      queryText += ` AND activo = $${paramCount}`;
      params.push(activo === 'true');
      paramCount++;
    }

    if (search) {
      queryText += ` AND (nombre ILIKE $${paramCount} OR telefono ILIKE $${paramCount} OR email ILIKE $${paramCount} OR nit ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    queryText += ` ORDER BY nombre LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await query(queryText, params);

    const countResult = await query(
      'SELECT COUNT(*) as total FROM clientes WHERE activo = true'
    );

    res.json({
      clientes: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('Error al listar clientes:', error);
    res.status(500).json({ 
      error: 'Error al obtener clientes' 
    });
  }
});

// GET /api/clientes/:id - Obtener un cliente específico
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'SELECT * FROM clientes WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Cliente no encontrado' 
      });
    }

    res.json({
      cliente: result.rows[0]
    });

  } catch (error) {
    console.error('Error al obtener cliente:', error);
    res.status(500).json({ 
      error: 'Error al obtener cliente' 
    });
  }
});

// POST /api/clientes - Crear nuevo cliente
router.post('/', verificarRol('Administrador', 'Gerente', 'Vendedor'), async (req, res) => {
  try {
    const {
      nombre,
      telefono,
      email,
      direccion,
      nit,
      notas
    } = req.body;

    // Validar datos requeridos
    if (!nombre || nombre.trim() === '') {
      return res.status(400).json({ 
        error: 'El nombre es requerido' 
      });
    }

    // Verificar si el email ya existe (si se proporciona)
    if (email) {
      const emailExiste = await query(
        'SELECT id FROM clientes WHERE email = $1 AND activo = true',
        [email]
      );
      if (emailExiste.rows.length > 0) {
        return res.status(400).json({ 
          error: 'El email ya está registrado' 
        });
      }
    }

    // Insertar cliente
    const result = await query(
      `INSERT INTO clientes (
        nombre, 
        telefono, 
        email, 
        direccion, 
        nit, 
        notas
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        nombre.trim(),
        telefono || null,
        email || null,
        direccion || null,
        nit || null,
        notas || null
      ]
    );

    res.status(201).json({
      message: 'Cliente creado exitosamente',
      cliente: result.rows[0]
    });

  } catch (error) {
    console.error('Error al crear cliente:', error);
    res.status(500).json({ 
      error: 'Error al crear cliente',
      detalles: error.message
    });
  }
});

// PUT /api/clientes/:id - Actualizar cliente
router.put('/:id', verificarRol('Administrador', 'Gerente', 'Vendedor'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre,
      telefono,
      email,
      direccion,
      nit,
      notas
    } = req.body;

    console.log('Actualizando cliente:', id, req.body);

    // Verificar que el cliente existe
    const existe = await query('SELECT id FROM clientes WHERE id = $1', [id]);
    if (existe.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Cliente no encontrado' 
      });
    }

    // Validar datos requeridos
    if (!nombre || nombre.trim() === '') {
      return res.status(400).json({ 
        error: 'El nombre es requerido' 
      });
    }

    // Verificar si el email ya existe en otro cliente
    if (email) {
      const emailExiste = await query(
        'SELECT id FROM clientes WHERE email = $1 AND id != $2 AND activo = true',
        [email, id]
      );
      if (emailExiste.rows.length > 0) {
        return res.status(400).json({ 
          error: 'El email ya está registrado por otro cliente' 
        });
      }
    }

    // Actualizar cliente
    const result = await query(
      `UPDATE clientes 
       SET nombre = $1,
           telefono = $2,
           email = $3,
           direccion = $4,
           nit = $5,
           notas = $6,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [
        nombre.trim(),
        telefono || null,
        email || null,
        direccion || null,
        nit || null,
        notas || null,
        id
      ]
    );

    res.json({
      message: 'Cliente actualizado exitosamente',
      cliente: result.rows[0]
    });

  } catch (error) {
    console.error('Error al actualizar cliente:', error);
    res.status(500).json({ 
      error: 'Error al actualizar cliente',
      detalles: error.message
    });
  }
});

// DELETE /api/clientes/:id - Eliminar cliente (soft delete)
router.delete('/:id', verificarRol('Administrador', 'Gerente'), async (req, res) => {
  try {
    const { id } = req.params;

    console.log('Eliminando cliente:', id);

    // Verificar que el cliente existe
    const existe = await query('SELECT id FROM clientes WHERE id = $1', [id]);
    if (existe.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Cliente no encontrado' 
      });
    }

    // Soft delete
    const result = await query(
      'UPDATE clientes SET activo = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );

    res.json({
      message: 'Cliente eliminado exitosamente',
      cliente: result.rows[0]
    });

  } catch (error) {
    console.error('Error al eliminar cliente:', error);
    res.status(500).json({ 
      error: 'Error al eliminar cliente',
      detalles: error.message
    });
  }
});

module.exports = router;
