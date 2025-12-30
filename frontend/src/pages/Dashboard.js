// src/pages/Dashboard.js - Mejorado con datos reales
import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  ShoppingCart as ShoppingCartIcon,
  Inventory as InventoryIcon,
  Warning as WarningIcon,
  LocalShipping as LocalShippingIcon,
  People as PeopleIcon,
  Category as CategoryIcon,
  AttachMoney as AttachMoneyIcon,
} from '@mui/icons-material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [estadisticas, setEstadisticas] = useState(null);
  const [ventasRecientes, setVentasRecientes] = useState([]);
  const [productosMasVendidos, setProductosMasVendidos] = useState([]);
  const [stockBajo, setStockBajo] = useState([]);
  const [productosPorVencer, setProductosPorVencer] = useState([]);
  const [ventasPorDia, setVentasPorDia] = useState([]);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const [
        estadisticasRes,
        ventasRecientesRes,
        masVendidosRes,
        stockBajoRes,
        porVencerRes,
        ventasDiaRes
      ] = await Promise.all([
        api.get('/api/dashboard/estadisticas'),
        api.get('/api/dashboard/ventas-recientes?limit=5'),
        api.get('/api/dashboard/productos-mas-vendidos?limit=5'),
        api.get('/api/dashboard/stock-bajo?limit=5'),
        api.get('/api/dashboard/productos-por-vencer?limit=5'),
        api.get('/api/dashboard/ventas-por-dia?dias=7')
      ]);

      setEstadisticas(estadisticasRes.data);
      setVentasRecientes(ventasRecientesRes.data.ventas);
      setProductosMasVendidos(masVendidosRes.data.productos);
      setStockBajo(stockBajoRes.data.productos);
      setProductosPorVencer(porVencerRes.data.lotes);
      setVentasPorDia(ventasDiaRes.data.ventas);
    } catch (err) {
      setError('Error al cargar datos del dashboard');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, subtitle, icon: Icon, color, bgColor }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h4" component="div" sx={{ mb: 1, color: color }}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              bgcolor: bgColor,
              borderRadius: 2,
              p: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon sx={{ fontSize: 32, color: color }} />
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Resumen general del negocio
      </Typography>

      {/* Tarjetas de estadísticas */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Ventas Hoy"
            value={`Q${estadisticas?.ventasHoy.monto.toFixed(2)}`}
            subtitle={`${estadisticas?.ventasHoy.total} ventas`}
            icon={AttachMoneyIcon}
            color="success.main"
            bgColor="success.light"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Ventas del Mes"
            value={`Q${estadisticas?.ventasMes.monto.toFixed(2)}`}
            subtitle={`${estadisticas?.ventasMes.total} ventas`}
            icon={TrendingUpIcon}
            color="primary.main"
            bgColor="primary.light"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Stock Bajo"
            value={estadisticas?.stockBajo || 0}
            subtitle="Productos por reabastecer"
            icon={WarningIcon}
            color="warning.main"
            bgColor="warning.light"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Por Vencer"
            value={estadisticas?.productosPorVencer || 0}
            subtitle="Próximos 30 días"
            icon={InventoryIcon}
            color="error.main"
            bgColor="error.light"
          />
        </Grid>
      </Grid>

      {/* Segunda fila de estadísticas */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <StatCard
            title="Pedidos Pendientes"
            value={estadisticas?.pedidosPendientes || 0}
            subtitle="De proveedores"
            icon={LocalShippingIcon}
            color="info.main"
            bgColor="info.light"
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatCard
            title="Total Productos"
            value={estadisticas?.totalProductos || 0}
            subtitle="Activos"
            icon={CategoryIcon}
            color="secondary.main"
            bgColor="secondary.light"
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatCard
            title="Total Clientes"
            value={estadisticas?.totalClientes || 0}
            subtitle="Registrados"
            icon={PeopleIcon}
            color="success.main"
            bgColor="success.light"
          />
        </Grid>
      </Grid>

      {/* Gráfica de ventas */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Ventas de los Últimos 7 Días
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={ventasPorDia}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="fecha"
                tickFormatter={(fecha) => format(new Date(fecha), 'dd/MM', { locale: es })}
              />
              <YAxis />
              <Tooltip
                labelFormatter={(fecha) => format(new Date(fecha), 'dd MMM yyyy', { locale: es })}
                formatter={(value) => [`Q${parseFloat(value).toFixed(2)}`, 'Total']}
              />
              <Legend />
              <Bar dataKey="monto_total" fill="#1976d2" name="Ventas" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        {/* Ventas recientes */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ShoppingCartIcon /> Ventas Recientes
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Folio</TableCell>
                      <TableCell>Cliente</TableCell>
                      <TableCell align="right">Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {ventasRecientes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} align="center">
                          No hay ventas recientes
                        </TableCell>
                      </TableRow>
                    ) : (
                      ventasRecientes.map((venta) => (
                        <TableRow key={venta.id}>
                          <TableCell>{venta.folio}</TableCell>
                          <TableCell>{venta.cliente_nombre || 'Sin cliente'}</TableCell>
                          <TableCell align="right">
                            <Typography fontWeight="bold">
                              Q{parseFloat(venta.total).toFixed(2)}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Productos más vendidos */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingUpIcon /> Productos Más Vendidos
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Producto</TableCell>
                      <TableCell align="right">Vendidos</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {productosMasVendidos.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} align="center">
                          No hay datos disponibles
                        </TableCell>
                      </TableRow>
                    ) : (
                      productosMasVendidos.map((producto) => (
                        <TableRow key={producto.id}>
                          <TableCell>{producto.nombre}</TableCell>
                          <TableCell align="right">
                            <Chip
                              label={producto.total_vendido}
                              size="small"
                              color="primary"
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Stock bajo */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <WarningIcon color="warning" /> Stock Bajo
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Producto</TableCell>
                      <TableCell align="right">Actual</TableCell>
                      <TableCell align="right">Mínimo</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stockBajo.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} align="center">
                          Todos los productos tienen stock suficiente
                        </TableCell>
                      </TableRow>
                    ) : (
                      stockBajo.map((producto) => (
                        <TableRow key={producto.id}>
                          <TableCell>{producto.nombre}</TableCell>
                          <TableCell align="right">
                            <Chip
                              label={producto.stock_actual}
                              size="small"
                              color="error"
                            />
                          </TableCell>
                          <TableCell align="right">{producto.stock_minimo}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Productos por vencer */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <InventoryIcon color="error" /> Próximos a Vencer
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Producto</TableCell>
                      <TableCell>Lote</TableCell>
                      <TableCell align="right">Días</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {productosPorVencer.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} align="center">
                          No hay productos próximos a vencer
                        </TableCell>
                      </TableRow>
                    ) : (
                      productosPorVencer.map((lote) => (
                        <TableRow key={lote.id}>
                          <TableCell>{lote.producto_nombre}</TableCell>
                          <TableCell>{lote.numero_lote}</TableCell>
                          <TableCell align="right">
                            <Chip
                              label={`${lote.dias_restantes} días`}
                              size="small"
                              color={lote.dias_restantes <= 7 ? 'error' : 'warning'}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
