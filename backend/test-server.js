// test-server.js - Servidor de prueba mínimo
const express = require('express');
const cors = require('cors');

const app = express();

// CORS completamente abierto
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  console.log('✅ GET / recibido');
  res.json({ message: 'Servidor de prueba funcionando', timestamp: new Date() });
});

app.post('/api/test-login', (req, res) => {
  console.log('✅ POST /api/test-login recibido');
  console.log('Body:', req.body);
  res.json({ 
    success: true, 
    message: 'Login de prueba exitoso',
    data: req.body 
  });
});

app.listen(3001, () => {
  console.log('🧪 Servidor de prueba en http://localhost:3001');
});
