// src/routes/auth.js - Rutas de autenticación
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { verificarToken } = require('../middleware/auth');

// POST /api/auth/login - Iniciar sesión
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validar datos
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email y contraseña son requeridos' 
      });
    }

    // Buscar usuario
    const result = await query(
      `SELECT u.*, r.nombre as rol, r.permisos 
       FROM usuarios u 
       LEFT JOIN roles r ON u.rol_id = r.id 
       WHERE u.email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ 
        error: 'Credenciales inválidas' 
      });
    }

    const usuario = result.rows[0];

    // Verificar que el usuario esté activo
    if (!usuario.activo) {
      return res.status(401).json({ 
        error: 'Usuario inactivo. Contacta al administrador.' 
      });
    }

    // Verificar contraseña
    const passwordValida = await bcrypt.compare(password, usuario.password_hash);

    if (!passwordValida) {
      return res.status(401).json({ 
        error: 'Credenciales inválidas' 
      });
    }

    // Actualizar último acceso
    await query(
      'UPDATE usuarios SET ultimo_acceso = CURRENT_TIMESTAMP WHERE id = $1',
      [usuario.id]
    );

    // Generar token JWT
    const token = jwt.sign(
      { 
        id: usuario.id,
        email: usuario.email,
        rol: usuario.rol
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Enviar respuesta (sin el password_hash)
    const { password_hash, ...usuarioSinPassword } = usuario;

    res.json({
      message: 'Inicio de sesión exitoso',
      token,
      usuario: usuarioSinPassword
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ 
      error: 'Error al iniciar sesión' 
    });
  }
});

// POST /api/auth/register - Registrar nuevo usuario (solo admin)
router.post('/register', verificarToken, async (req, res) => {
  try {
    const { nombre, email, password, telefono, rol_id } = req.body;

    // Validar datos
    if (!nombre || !email || !password) {
      return res.status(400).json({ 
        error: 'Nombre, email y contraseña son requeridos' 
      });
    }

    // Verificar que el email no exista
    const existeEmail = await query(
      'SELECT id FROM usuarios WHERE email = $1',
      [email]
    );

    if (existeEmail.rows.length > 0) {
      return res.status(400).json({ 
        error: 'El email ya está registrado' 
      });
    }

    // Hashear contraseña
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insertar usuario
    const result = await query(
      `INSERT INTO usuarios (nombre, email, password_hash, telefono, rol_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, nombre, email, telefono, rol_id, activo, created_at`,
      [nombre, email, passwordHash, telefono, rol_id || 3] // 3 = Vendedor por defecto
    );

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      usuario: result.rows[0]
    });

  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ 
      error: 'Error al registrar usuario' 
    });
  }
});

// GET /api/auth/me - Obtener información del usuario actual
router.get('/me', verificarToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.nombre, u.email, u.telefono, u.activo, 
              u.ultimo_acceso, u.created_at, r.nombre as rol, r.permisos
       FROM usuarios u
       LEFT JOIN roles r ON u.rol_id = r.id
       WHERE u.id = $1`,
      [req.usuario.id]
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
      error: 'Error al obtener información del usuario' 
    });
  }
});

// PUT /api/auth/cambiar-password - Cambiar contraseña
router.put('/cambiar-password', verificarToken, async (req, res) => {
  try {
    const { passwordActual, passwordNueva } = req.body;

    if (!passwordActual || !passwordNueva) {
      return res.status(400).json({ 
        error: 'Contraseña actual y nueva son requeridas' 
      });
    }

    // Obtener usuario
    const result = await query(
      'SELECT password_hash FROM usuarios WHERE id = $1',
      [req.usuario.id]
    );

    const usuario = result.rows[0];

    // Verificar contraseña actual
    const passwordValida = await bcrypt.compare(passwordActual, usuario.password_hash);

    if (!passwordValida) {
      return res.status(401).json({ 
        error: 'Contraseña actual incorrecta' 
      });
    }

    // Hashear nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(passwordNueva, salt);

    // Actualizar contraseña
    await query(
      'UPDATE usuarios SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [passwordHash, req.usuario.id]
    );

    res.json({
      message: 'Contraseña actualizada exitosamente'
    });

  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    res.status(500).json({ 
      error: 'Error al cambiar contraseña' 
    });
  }
});

// POST /api/auth/logout - Cerrar sesión (opcional, principalmente para limpiar en frontend)
router.post('/logout', verificarToken, (req, res) => {
  res.json({
    message: 'Sesión cerrada exitosamente'
  });
});

module.exports = router;
