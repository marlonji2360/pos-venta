// src/routes/backup.js
const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verificarToken, verificarRol } = require('../middleware/auth');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');

const execPromise = util.promisify(exec);

router.use(verificarToken);
router.use(verificarRol('Administrador'));

// Directorio para backups
const BACKUP_DIR = path.join(__dirname, '../../backups');

// Crear directorio si no existe
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// GET /api/backup/listar - Listar backups disponibles
router.get('/listar', async (req, res) => {
  try {
    const files = fs.readdirSync(BACKUP_DIR);
    const backups = files
      .filter(file => file.endsWith('.sql'))
      .map(file => {
        const stats = fs.statSync(path.join(BACKUP_DIR, file));
        return {
          nombre: file,
          tamano: stats.size,
          fecha: stats.mtime,
          ruta: path.join(BACKUP_DIR, file)
        };
      })
      .sort((a, b) => b.fecha - a.fecha);

    res.json({
      backups: backups,
      total: backups.length,
      directorio: BACKUP_DIR
    });

  } catch (error) {
    console.error('Error al listar backups:', error);
    res.status(500).json({ 
      error: 'Error al listar backups',
      detalles: error.message
    });
  }
});

// POST /api/backup/crear - Crear nuevo backup
router.post('/crear', async (req, res) => {
  try {
    const { descripcion } = req.body;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T');
    const fecha = timestamp[0];
    const hora = timestamp[1].split('Z')[0];
    const nombreArchivo = `backup_${fecha}_${hora}.sql`;
    const rutaArchivo = path.join(BACKUP_DIR, nombreArchivo);

    // Obtener configuración de la base de datos
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'pos_abarrotes',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || ''
    };

    // Comando pg_dump con variables de entorno
    const command = `PGPASSWORD="${dbConfig.password}" pg_dump -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -d ${dbConfig.database} -f "${rutaArchivo}"`;

    console.log('Creando backup:', nombreArchivo);
    
    await execPromise(command);

    // Verificar que el archivo se creó
    if (!fs.existsSync(rutaArchivo)) {
      throw new Error('El archivo de backup no se creó correctamente');
    }

    const stats = fs.statSync(rutaArchivo);

    // Registrar en logs
    await query(`
      INSERT INTO logs_sistema (tipo, descripcion, usuario_id, datos)
      VALUES ('backup', $1, $2, $3)
    `, [
      descripcion || 'Backup manual',
      req.usuario.id,
      JSON.stringify({
        archivo: nombreArchivo,
        tamano: stats.size
      })
    ]).catch(err => console.log('No se pudo registrar log:', err.message));

    res.json({
      message: 'Backup creado exitosamente',
      backup: {
        nombre: nombreArchivo,
        tamano: stats.size,
        fecha: stats.mtime,
        ruta: rutaArchivo
      }
    });

  } catch (error) {
    console.error('Error al crear backup:', error);
    res.status(500).json({ 
      error: 'Error al crear backup',
      detalles: error.message
    });
  }
});

// GET /api/backup/descargar/:nombre - Descargar un backup
router.get('/descargar/:nombre', async (req, res) => {
  try {
    const { nombre } = req.params;
    const rutaArchivo = path.join(BACKUP_DIR, nombre);

    // Verificar que el archivo existe y es un .sql
    if (!fs.existsSync(rutaArchivo) || !nombre.endsWith('.sql')) {
      return res.status(404).json({ 
        error: 'Backup no encontrado' 
      });
    }

    // Enviar archivo
    res.download(rutaArchivo, nombre, (err) => {
      if (err) {
        console.error('Error al descargar backup:', err);
        res.status(500).json({ 
          error: 'Error al descargar backup' 
        });
      }
    });

  } catch (error) {
    console.error('Error al descargar backup:', error);
    res.status(500).json({ 
      error: 'Error al descargar backup',
      detalles: error.message
    });
  }
});

// DELETE /api/backup/eliminar/:nombre - Eliminar un backup
router.delete('/eliminar/:nombre', async (req, res) => {
  try {
    const { nombre } = req.params;
    const rutaArchivo = path.join(BACKUP_DIR, nombre);

    // Verificar que el archivo existe
    if (!fs.existsSync(rutaArchivo) || !nombre.endsWith('.sql')) {
      return res.status(404).json({ 
        error: 'Backup no encontrado' 
      });
    }

    // Eliminar archivo
    fs.unlinkSync(rutaArchivo);

    // Registrar en logs
    await query(`
      INSERT INTO logs_sistema (tipo, descripcion, usuario_id, datos)
      VALUES ('backup_eliminado', $1, $2, $3)
    `, [
      'Backup eliminado',
      req.usuario.id,
      JSON.stringify({ archivo: nombre })
    ]).catch(err => console.log('No se pudo registrar log:', err.message));

    res.json({
      message: 'Backup eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error al eliminar backup:', error);
    res.status(500).json({ 
      error: 'Error al eliminar backup',
      detalles: error.message
    });
  }
});

// POST /api/backup/restaurar/:nombre - Restaurar desde backup
router.post('/restaurar/:nombre', async (req, res) => {
  try {
    const { nombre } = req.params;
    const rutaArchivo = path.join(BACKUP_DIR, nombre);

    // Verificar que el archivo existe
    if (!fs.existsSync(rutaArchivo) || !nombre.endsWith('.sql')) {
      return res.status(404).json({ 
        error: 'Backup no encontrado' 
      });
    }

    // Obtener configuración de la base de datos
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'pos_abarrotes',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || ''
    };

    // ADVERTENCIA: Esto eliminará todos los datos actuales
    console.log('⚠️ RESTAURANDO BACKUP:', nombre);
    
    // Comando psql para restaurar
    const command = `PGPASSWORD="${dbConfig.password}" psql -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -d ${dbConfig.database} -f "${rutaArchivo}"`;

    await execPromise(command);

    // Registrar en logs
    await query(`
      INSERT INTO logs_sistema (tipo, descripcion, usuario_id, datos)
      VALUES ('backup_restaurado', $1, $2, $3)
    `, [
      'Base de datos restaurada',
      req.usuario.id,
      JSON.stringify({ archivo: nombre })
    ]).catch(err => console.log('No se pudo registrar log:', err.message));

    res.json({
      message: 'Backup restaurado exitosamente',
      advertencia: 'La base de datos ha sido restaurada. Se recomienda reiniciar el sistema.'
    });

  } catch (error) {
    console.error('Error al restaurar backup:', error);
    res.status(500).json({ 
      error: 'Error al restaurar backup',
      detalles: error.message
    });
  }
});

// GET /api/backup/info - Información del sistema de backup
router.get('/info', async (req, res) => {
  try {
    // Información de la base de datos
    const sizeResult = await query(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as tamano_db
    `);

    const tablesResult = await query(`
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      LIMIT 10
    `);

    // Espacio disponible en disco
    let espacioDisponible = 'N/A';
    try {
      const { stdout } = await execPromise('df -h .');
      espacioDisponible = stdout;
    } catch (err) {
      console.log('No se pudo obtener espacio en disco');
    }

    res.json({
      tamano_base_datos: sizeResult.rows[0].tamano_db,
      tablas_grandes: tablesResult.rows,
      directorio_backups: BACKUP_DIR,
      espacio_disco: espacioDisponible
    });

  } catch (error) {
    console.error('Error al obtener información:', error);
    res.status(500).json({ 
      error: 'Error al obtener información',
      detalles: error.message
    });
  }
});

module.exports = router;
