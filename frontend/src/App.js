// src/App.js
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Productos from './pages/Productos';
import Ventas from './pages/Ventas';
import Clientes from './pages/Clientes';
import Proveedores from './pages/Proveedores';
import Pedidos from './pages/Pedidos';
import Reportes from './pages/Reportes';
import Notificaciones from './pages/Notificaciones';
import Usuarios from './pages/Usuarios';
import Configuracion from './pages/Configuracion';
import HistorialPrecios from './pages/HistorialPrecios';
import Backup from './pages/Backup';
import CuentasPorPagar from './pages/CuentasPorPagar';
import ReporteCuentasPorPagar from './pages/ReporteCuentasPorPagar';
import GestionDescuentos from './pages/GestionDescuentos';
import AutorizacionesDescuento from './pages/AutorizacionesDescuento';
import GastosFijos from './pages/GastosFijos';
import Envios from './pages/Envios';
import DevolucionesClientes from './pages/DevolucionesClientes';
import DevolucionesProveedores from './pages/DevolucionesProveedores';

const theme = createTheme({
  palette: {
    primary: {
      main: '#667eea',
    },
    secondary: {
      main: '#764ba2',
    },
  },
});

// Componente para proteger rutas
const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div>Cargando...</div>;
  }

  return isAuthenticated ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Layout />
                </PrivateRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="productos" element={<Productos />} />
              <Route path="ventas" element={<Ventas />} />
              <Route path="clientes" element={<Clientes />} />
              <Route path="proveedores" element={<Proveedores />} />
              <Route path="pedidos" element={<Pedidos />} />
              <Route path="reportes" element={<Reportes />} />
              <Route path="notificaciones" element={<Notificaciones />} />
              <Route path="usuarios" element={<Usuarios />} />
              <Route path="configuracion" element={<Configuracion />} />
              <Route path="historial-precios" element={<HistorialPrecios />} />
              <Route path="backup" element={<Backup />} />
              <Route path="cuentas-por-pagar" element={<CuentasPorPagar />} />
              <Route path="reporte-cuentas-por-pagar" element={<ReporteCuentasPorPagar />} />
              <Route path="gestion-descuentos" element={<GestionDescuentos />} />
              <Route path="autorizaciones-descuento" element={<AutorizacionesDescuento />} />
              <Route path="gastos-fijos" element={<GastosFijos />} />
              <Route path="envios" element={<Envios />} />
              <Route path="devoluciones-clientes" element={<DevolucionesClientes />} />
              <Route path="devoluciones-proveedores" element={<DevolucionesProveedores />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
