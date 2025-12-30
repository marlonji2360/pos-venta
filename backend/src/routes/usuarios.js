// src/routes/usuarios.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { query } = require('../config/database');
const { verificarToken, verificarRol } = require('../middleware/auth');

// Todas las rutas requieren autenticación y ser Administrador
router.use(verificarToken);
router.use(verificarRol('Administrador'));

// GET /api/usuarios - Listar todos los usuarios
router.get('/', async (req, res) => {
  try {
    const { activo, rol_id, limit = 100, offset = 0 } = req.query;
    
    let queryText = 'SELECT id, nombre, email, telefono, rol_id, activo, created_at, ultimo_acceso FROM usuarios WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (activo !== undefined) {
      queryText += ` AND activo = $${paramCount}`;
      params.push(activo === 'true');
      paramCount++;
    }

    if (rol_id) {
      queryText += ` AND rol_id = $${paramCount}`;
      params.push(rol_id);
      paramCount++;
    }

    queryText += ` ORDER BY nombre LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await query(queryText, params);

    const countResult = await query(
      'SELECT COUNT(*) as total FROM usuarios WHERE activo = true'
    );

    res.json({
      usuarios: result.rows,
      total: parseInt(countResult.rows[0].total)
    });

  } catch (error) {
    console.error('Error al listar usuarios:', error);
    res.status(500).json({ 
      error: 'Error al obtener usuarios' 
    });
  }
});

// GET /api/usuarios/:id - Obtener un usuario específico
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'SELECT id, nombre, email, telefono, rol_id, activo, created_at, ultimo_acceso FROM usuarios WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Usuario no encontrado' 
      });
    }

    res.json({
      usuario: result.rows[0]
    });

  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({ 
      error: 'Error al obtener usuario' 
    });
  }
});

// POST /api/usuarios - Crear nuevo usuario
router.post('/', async (req, res) => {
  try {
    const {
      nombre,
      email,
      password,
      telefono,
      rol_id
    } = req.body;

    // Validar datos requeridos
    if (!nombre || !email || !password || !rol_id) {
      return res.status(400).json({ 
        error: 'Nombre, email, password y rol son requeridos' 
      });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: 'Email inválido' 
      });
    }

    // Validar longitud de contraseña
    if (password.length < 6) {
      return res.status(400).json({ 
        error: 'La contraseña debe tener al menos 6 caracteres' 
      });
    }

    // Validar rol válido (1=Admin, 2=Gerente, 3=Vendedor)
    if (![1, 2, 3].includes(parseInt(rol_id))) {
      return res.status(400).json({ 
        error: 'Rol inválido' 
      });
    }

    // Verificar si el email ya existe
    const emailExiste = await query(
      'SELECT id FROM usuarios WHERE email = $1',
      [email]
    );
    if (emailExiste.rows.length > 0) {
      return res.status(400).json({ 
        error: 'El email ya está registrado' 
      });
    }

    // Hash de la contraseña
    const password_hash = await bcrypt.hash(password, 10);

    // Insertar usuario
    const result = await query(
      `INSERT INTO usuarios (
        nombre, 
        email, 
        password_hash,
        telefono, 
        rol_id
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING id, nombre, email, telefono, rol_id, activo, created_at`,
      [
        nombre.trim(),
        email.trim().toLowerCase(),
        password_hash,
        telefono || null,
        rol_id
      ]
    );

    res.status(201).json({
      message: 'Usuario creado exitosamente',
      usuario: result.rows[0]
    });

  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({ 
      error: 'Error al crear usuario',
      detalles: error.message
    });
  }
});

// PUT /api/usuarios/:id - Actualizar usuario
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre,
      email,
      telefono,
      rol_id
    } = req.body;

    console.log('Actualizando usuario:', id, req.body);

    // Verificar que el usuario existe
    const existe = await query('SELECT id FROM usuarios WHERE id = $1', [id]);
    if (existe.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Usuario no encontrado' 
      });
    }

    // Validar datos requeridos
    if (!nombre || !email || !rol_id) {
      return res.status(400).json({ 
        error: 'Nombre, email y rol son requeridos' 
      });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: 'Email inválido' 
      });
    }

    // Validar rol válido
    if (![1, 2, 3].includes(parseInt(rol_id))) {
      return res.status(400).json({ 
        error: 'Rol inválido' 
      });
    }

    // Verificar si el email ya existe en otro usuario
    const emailExiste = await query(
      'SELECT id FROM usuarios WHERE email = $1 AND id != $2',
      [email, id]
    );
    if (emailExiste.rows.length > 0) {
      return res.status(400).json({ 
        error: 'El email ya está registrado por otro usuario' 
      });
    }

    // Actualizar usuario
    const result = await query(
      `UPDATE usuarios 
       SET nombre = $1,
           email = $2,
           telefono = $3,
           rol_id = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING id, nombre, email, telefono, rol_id, activo, created_at`,
      [
        nombre.trim(),
        email.trim().toLowerCase(),
        telefono || null,
        rol_id,
        id
      ]
    );

    res.json({
      message: 'Usuario actualizado exitosamente',
      usuario: result.rows[0]
    });

  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ 
      error: 'Error al actualizar usuario',
      detalles: error.message
    });
  }
});

// PATCH /api/usuarios/:id/password - Cambiar contraseña
router.patch('/:id/password', async (req, res) => {
  try {
    const { id } = req.params;
    const { nueva_password } = req.body;

    console.log('Cambiando contraseña del usuario:', id);

    // Verificar que el usuario existe
    const existe = await query('SELECT id FROM usuarios WHERE id = $1', [id]);
    if (existe.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Usuario no encontrado' 
      });
    }

    // Validar nueva contraseña
    if (!nueva_password || nueva_password.length < 6) {
      return res.status(400).json({ 
        error: 'La contraseña debe tener al menos 6 caracteres' 
      });
    }

    // Hash de la nueva contraseña
    const password_hash = await bcrypt.hash(nueva_password, 10);

    // Actualizar contraseña
    await query(
      'UPDATE usuarios SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [password_hash, id]
    );

    res.json({
      message: 'Contraseña actualizada exitosamente'
    });

  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    res.status(500).json({ 
      error: 'Error al cambiar contraseña',
      detalles: error.message
    });
  }
});

// DELETE /api/usuarios/:id - Eliminar usuario (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    console.log('Eliminando usuario:', id);

    // No permitir eliminar al usuario actual
    if (parseInt(id) === req.usuario.id) {
      return res.status(400).json({ 
        error: 'No puedes eliminar tu propio usuario' 
      });
    }

    // Verificar que el usuario existe
    const existe = await query('SELECT id FROM usuarios WHERE id = $1', [id]);
    if (existe.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Usuario no encontrado' 
      });
    }

    // Soft delete
    const result = await query(
      'UPDATE usuarios SET activo = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id, nombre, email',
      [id]
    );

    res.json({
      message: 'Usuario desactivado exitosamente',
      usuario: result.rows[0]
    });

  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ 
      error: 'Error al eliminar usuario',
      detalles: error.message
    });
  }
});

// PATCH /api/usuarios/:id/reactivar - Reactivar usuario
router.patch('/:id/reactivar', async (req, res) => {
  try {
    const { id } = req.params;

    console.log('Reactivando usuario:', id);

    const result = await query(
      'UPDATE usuarios SET activo = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id, nombre, email',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Usuario no encontrado' 
      });
    }

    res.json({
      message: 'Usuario reactivado exitosamente',
      usuario: result.rows[0]
    });

  } catch (error) {
    console.error('Error al reactivar usuario:', error);
    res.status(500).json({ 
      error: 'Error al reactivar usuario',
      detalles: error.message
    });
  }
});

module.exports = router;
