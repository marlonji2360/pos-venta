// crear-admin.js - Script para crear usuario administrador
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query } = require('./src/config/database');

async function crearAdmin() {
  try {
    console.log('🔧 Creando usuario administrador...');
    
    // Generar hash de la contraseña "admin123"
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('admin123', salt);
    
    console.log('🔐 Hash generado:', passwordHash);
    
    // Eliminar usuario admin si existe
    await query('DELETE FROM usuarios WHERE email = $1', ['admin@tienda.com']);
    console.log('🗑️  Usuario anterior eliminado (si existía)');
    
    // Crear nuevo usuario admin
    const result = await query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol_id, activo)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, nombre, email, activo`,
      ['Administrador', 'admin@tienda.com', passwordHash, 1, true]
    );
    
    console.log('✅ Usuario administrador creado exitosamente:');
    console.log(result.rows[0]);
    console.log('\n📧 Email: admin@tienda.com');
    console.log('🔑 Password: admin123');
    
    // Verificar que funciona
    const verificar = await bcrypt.compare('admin123', passwordHash);
    console.log('\n🧪 Verificación de contraseña:', verificar ? '✅ OK' : '❌ ERROR');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

crearAdmin();
