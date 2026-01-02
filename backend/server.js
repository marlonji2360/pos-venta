// server.js - Servidor principal del backend
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { testConnection } = require('./src/config/database');

// Crear aplicación Express
const app = express();

// Middlewares - IMPORTANTE: CORS debe estar ANTES de las rutas
app.use(cors({
  origin: '*', // Permitir todas las conexiones (cambiar en producción)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware para logging de requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Ruta principal
app.get('/', (req, res) => {
  res.json({ 
    message: '🛒 API del Sistema POS - Tienda de Abarrotes',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// Ruta de health check
app.get('/api/health', async (req, res) => {
  try {
    const dbConnected = await testConnection();
    res.json({ 
      status: 'OK',
      database: dbConnected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      database: 'error',
      error: error.message
    });
  }
});

// Importar rutas
const authRoutes = require('./src/routes/auth');
const productosRoutes = require('./src/routes/productos');
const categoriasRoutes = require('./src/routes/categorias');
const clientesRoutes = require('./src/routes/clientes');
const proveedoresRoutes = require('./src/routes/proveedores');
const ventasRoutes = require('./src/routes/ventas');
const pedidosRoutes = require('./src/routes/pedidos');
const dashboardRoutes = require('./src/routes/dashboard');
const notificacionesRoutes = require('./src/routes/notificaciones');
const lotesRoutes = require('./src/routes/lotes');
const reportesRoutes = require('./src/routes/reportes');
const usuariosRoutes = require('./src/routes/usuarios');
const configuracionRoutes = require('./src/routes/configuracion');
const busquedaRoutes = require('./src/routes/busqueda');
const historialPreciosRoutes = require('./src/routes/historial-precios');
const backupRoutes = require('./src/routes/backup');
const cuentasPorPagarRoutes = require('./src/routes/cuentas-por-pagar');
const descuentosRoutes = require('./src/routes/descuentos');
const gastosFijosRoutes = require('./src/routes/gastos-fijos');
const enviosRoutes = require('./src/routes/envios');
const devolucionesClientesRoutes = require('./src/routes/devoluciones-clientes');
const devolucionesProveedoresRoutes = require('./src/routes/devoluciones-proveedores');





// Usar rutas
app.use('/api/auth', authRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/categorias', categoriasRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/proveedores', proveedoresRoutes);
app.use('/api/ventas', ventasRoutes);
app.use('/api/pedidos', pedidosRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/lotes', lotesRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/configuracion', configuracionRoutes);
app.use('/api/busqueda', busquedaRoutes);
app.use('/api/historial-precios', historialPreciosRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/cuentas-por-pagar', cuentasPorPagarRoutes);
app.use('/api/descuentos', descuentosRoutes);
app.use('/api/gastos-fijos', gastosFijosRoutes);
app.use('/api/envios', enviosRoutes);
app.use('/api/devoluciones-clientes', devolucionesClientesRoutes);
app.use('/api/devoluciones-proveedores', devolucionesProveedoresRoutes);




// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Ruta no encontrada',
    path: req.path,
    method: req.method
  });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(err.status || 500).json({ 
    error: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Puerto del servidor
const PORT = process.env.PORT || 5000;

// Iniciar servidor
const server = app.listen(PORT, async () => {
  console.log('\n' + '='.repeat(50));
  console.log('🚀 Servidor POS iniciado correctamente');
  console.log('='.repeat(50));
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🕐 Hora: ${new Date().toLocaleString('es-MX')}`);
  
  // Probar conexión a la base de datos
  console.log('\n🔍 Probando conexión a la base de datos...');
  const dbConnected = await testConnection();
  
  if (dbConnected) {
    console.log('✅ Base de datos conectada exitosamente');
  } else {
    console.log('❌ Error al conectar a la base de datos');
  }
  
  console.log('='.repeat(50) + '\n');
});

// Manejo de cierre graceful
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM recibido. Cerrando servidor...');
  server.close(() => {
    console.log('🛑 Servidor cerrado');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n👋 SIGINT recibido. Cerrando servidor...');
  server.close(() => {
    console.log('🛑 Servidor cerrado');
    process.exit(0);
  });
});

module.exports = app;
