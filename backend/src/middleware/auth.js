// src/middleware/auth.js - Middleware de autenticación
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

// Verificar token JWT
const verificarToken = async (req, res, next) => {
  try {
    // Obtener token del header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        error: 'Acceso denegado. No se proporcionó token.' 
      });
    }

    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verificar que el usuario aún existe y está activo
    const result = await query(
      'SELECT u.id, u.nombre, u.email, u.activo, r.nombre as rol FROM usuarios u LEFT JOIN roles r ON u.rol_id = r.id WHERE u.id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ 
        error: 'Usuario no encontrado' 
      });
    }

    if (!result.rows[0].activo) {
      return res.status(401).json({ 
        error: 'Usuario inactivo' 
      });
    }

    // Agregar usuario a la request
    req.usuario = result.rows[0];
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Token inválido' 
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expirado' 
      });
    }
    console.error('Error en middleware de autenticación:', error);
    res.status(500).json({ 
      error: 'Error al verificar autenticación' 
    });
  }
};

// Verificar rol específico
const verificarRol = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ 
        error: 'No autenticado' 
      });
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ 
        error: 'No tienes permisos para realizar esta acción',
        rolRequerido: rolesPermitidos,
        tuRol: req.usuario.rol
      });
    }

    next();
  };
};

// Verificar que el usuario sea administrador o el mismo usuario
const verificarPropietarioOAdmin = (req, res, next) => {
  const userId = parseInt(req.params.id);
  
  if (req.usuario.rol === 'Administrador' || req.usuario.id === userId) {
    next();
  } else {
    res.status(403).json({ 
      error: 'No tienes permisos para realizar esta acción' 
    });
  }
};

module.exports = {
  verificarToken,
  verificarRol,
  verificarPropietarioOAdmin
};
