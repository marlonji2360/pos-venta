// src/routes/proveedores.js
const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verificarToken, verificarRol } = require('../middleware/auth');

router.use(verificarToken);

// GET /api/proveedores - Listar todos los proveedores
router.get('/', async (req, res) => {
  try {
    const { activo, search, limit = 100, offset = 0 } = req.query;
    
    let queryText = 'SELECT * FROM proveedores WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (activo !== undefined) {
      queryText += ` AND activo = $${paramCount}`;
      params.push(activo === 'true');
      paramCount++;
    }

    if (search) {
      queryText += ` AND (nombre ILIKE $${paramCount} OR contacto ILIKE $${paramCount} OR telefono ILIKE $${paramCount} OR email ILIKE $${paramCount} OR nit ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    queryText += ` ORDER BY nombre LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await query(queryText, params);

    const countResult = await query(
      'SELECT COUNT(*) as total FROM proveedores WHERE activo = true'
    );

    res.json({
      proveedores: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('Error al listar proveedores:', error);
    res.status(500).json({ 
      error: 'Error al obtener proveedores' 
    });
  }
});

// GET /api/proveedores/:id - Obtener un proveedor específico
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'SELECT * FROM proveedores WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Proveedor no encontrado' 
      });
    }

    res.json({
      proveedor: result.rows[0]
    });

  } catch (error) {
    console.error('Error al obtener proveedor:', error);
    res.status(500).json({ 
      error: 'Error al obtener proveedor' 
    });
  }
});

// POST /api/proveedores - Crear nuevo proveedor
router.post('/', verificarRol('Administrador', 'Gerente'), async (req, res) => {
  try {
    const {
      nombre,
      contacto,
      telefono,
      email,
      direccion,
      nit,
      notas
    } = req.body;

    // Validar datos requeridos
    if (!nombre || nombre.trim() === '') {
      return res.status(400).json({ 
        error: 'El nombre de la empresa es requerido' 
      });
    }

    // Verificar si el email ya existe (si se proporciona)
    if (email) {
      const emailExiste = await query(
        'SELECT id FROM proveedores WHERE email = $1 AND activo = true',
        [email]
      );
      if (emailExiste.rows.length > 0) {
        return res.status(400).json({ 
          error: 'El email ya está registrado' 
        });
      }
    }

    // Insertar proveedor
    const result = await query(
      `INSERT INTO proveedores (
        nombre, 
        contacto,
        telefono, 
        email, 
        direccion, 
        nit, 
        notas
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        nombre.trim(),
        contacto || null,
        telefono || null,
        email || null,
        direccion || null,
        nit || null,
        notas || null
      ]
    );

    res.status(201).json({
      message: 'Proveedor creado exitosamente',
      proveedor: result.rows[0]
    });

  } catch (error) {
    console.error('Error al crear proveedor:', error);
    res.status(500).json({ 
      error: 'Error al crear proveedor',
      detalles: error.message
    });
  }
});

// PUT /api/proveedores/:id - Actualizar proveedor
router.put('/:id', verificarRol('Administrador', 'Gerente'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre,
      contacto,
      telefono,
      email,
      direccion,
      nit,
      notas
    } = req.body;

    console.log('Actualizando proveedor:', id, req.body);

    // Verificar que el proveedor existe
    const existe = await query('SELECT id FROM proveedores WHERE id = $1', [id]);
    if (existe.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Proveedor no encontrado' 
      });
    }

    // Validar datos requeridos
    if (!nombre || nombre.trim() === '') {
      return res.status(400).json({ 
        error: 'El nombre de la empresa es requerido' 
      });
    }

    // Verificar si el email ya existe en otro proveedor
    if (email) {
      const emailExiste = await query(
        'SELECT id FROM proveedores WHERE email = $1 AND id != $2 AND activo = true',
        [email, id]
      );
      if (emailExiste.rows.length > 0) {
        return res.status(400).json({ 
          error: 'El email ya está registrado por otro proveedor' 
        });
      }
    }

    // Actualizar proveedor
    const result = await query(
      `UPDATE proveedores 
       SET nombre = $1,
           contacto = $2,
           telefono = $3,
           email = $4,
           direccion = $5,
           nit = $6,
           notas = $7,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING *`,
      [
        nombre.trim(),
        contacto || null,
        telefono || null,
        email || null,
        direccion || null,
        nit || null,
        notas || null,
        id
      ]
    );

    res.json({
      message: 'Proveedor actualizado exitosamente',
      proveedor: result.rows[0]
    });

  } catch (error) {
    console.error('Error al actualizar proveedor:', error);
    res.status(500).json({ 
      error: 'Error al actualizar proveedor',
      detalles: error.message
    });
  }
});

// DELETE /api/proveedores/:id - Eliminar proveedor (soft delete)
router.delete('/:id', verificarRol('Administrador'), async (req, res) => {
  try {
    const { id } = req.params;

    console.log('Eliminando proveedor:', id);

    // Verificar que el proveedor existe
    const existe = await query('SELECT id FROM proveedores WHERE id = $1', [id]);
    if (existe.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Proveedor no encontrado' 
      });
    }

    // Soft delete
    const result = await query(
      'UPDATE proveedores SET activo = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );

    res.json({
      message: 'Proveedor eliminado exitosamente',
      proveedor: result.rows[0]
    });

  } catch (error) {
    console.error('Error al eliminar proveedor:', error);
    res.status(500).json({ 
      error: 'Error al eliminar proveedor',
      detalles: error.message
    });
  }
});

module.exports = router;
