// src/config/database.js - Configuración de PostgreSQL
const { Pool } = require('pg');

// Crear pool de conexiones
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'pos_abarrotes',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  max: 20, // Máximo de conexiones en el pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Evento cuando hay error en el pool
pool.on('error', (err, client) => {
  console.error('❌ Error inesperado en cliente de base de datos', err);
});

// Evento cuando se conecta un cliente
pool.on('connect', (client) => {
  console.log('🔌 Cliente de base de datos conectado');
});

// Función para probar la conexión
const testConnection = async () => {
  try {
    const client = await pool.connect();
    const res = await client.query('SELECT NOW() as now, version() as version');
    console.log('✅ Conexión exitosa a PostgreSQL');
    console.log('🕐 Hora del servidor DB:', res.rows[0].now);
    client.release();
    return true;
  } catch (err) {
    console.error('❌ Error al conectar a la base de datos:', err.message);
    return false;
  }
};

// Query helper con logging
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Query ejecutado:', { 
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        duration: `${duration}ms`, 
        rows: res.rowCount 
      });
    }
    
    return res;
  } catch (error) {
    console.error('❌ Error en query:', error.message);
    console.error('Query:', text);
    console.error('Params:', params);
    throw error;
  }
};

// Función para obtener un cliente del pool (para transacciones)
const getClient = async () => {
  const client = await pool.connect();
  const query = client.query.bind(client);
  const release = client.release.bind(client);
  
  // Timeout para liberar el cliente automáticamente
  const timeout = setTimeout(() => {
    console.error('⚠️ Cliente no liberado después de 5 segundos');
    console.error('Stack trace:', new Error().stack);
  }, 5000);
  
  // Sobrescribir release para limpiar el timeout
  client.release = () => {
    clearTimeout(timeout);
    client.release = release;
    return release();
  };
  
  return client;
};

// Función para ejecutar transacciones
const transaction = async (callback) => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Función para cerrar el pool (útil para tests y shutdown)
const closePool = async () => {
  await pool.end();
  console.log('🔌 Pool de conexiones cerrado');
};

module.exports = {
  pool,
  query,
  getClient,
  transaction,
  testConnection,
  closePool
};
