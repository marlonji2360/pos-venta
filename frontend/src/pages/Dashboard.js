// src/pages/Dashboard.js - Dashboard Mejorado
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
  LinearProgress,
  Avatar,
  Divider,
  IconButton,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  ShoppingCart as ShoppingCartIcon,
  Inventory as InventoryIcon,
  Warning as WarningIcon,
  LocalShipping as LocalShippingIcon,
  People as PeopleIcon,
  Category as CategoryIcon,
  AttachMoney as AttachMoneyIcon,
  Refresh as RefreshIcon,
  Assessment as AssessmentIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  MonetizationOn as MonetizationOnIcon,
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { format, formatDistanceToNow } from 'date-fns';
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
  const [ultimaActualizacion, setUltimaActualizacion] = useState(new Date());

  useEffect(() => {
    cargarDatos();
    
    // Auto-refresh cada 5 minutos
    const interval = setInterval(() => {
      cargarDatos();
    }, 300000);
    
    return () => clearInterval(interval);
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
        ventasDiaRes,
      ] = await Promise.all([
        api.get('/api/dashboard/estadisticas'),
        api.get('/api/dashboard/ventas-recientes?limit=8'),
        api.get('/api/dashboard/productos-mas-vendidos?limit=8'),
        api.get('/api/dashboard/stock-bajo?limit=8'),
        api.get('/api/dashboard/productos-por-vencer?limit=8'),
        api.get('/api/dashboard/ventas-por-dia?dias=14'),
      ]);

      setEstadisticas(estadisticasRes.data);
      setVentasRecientes(ventasRecientesRes.data.ventas || []);
      setProductosMasVendidos(masVendidosRes.data.productos || []);
      setStockBajo(stockBajoRes.data.productos || []);
      setProductosPorVencer(porVencerRes.data.lotes || []);
      setVentasPorDia(ventasDiaRes.data.ventas || []);
      
      setUltimaActualizacion(new Date());
    } catch (err) {
      setError('Error al cargar datos del dashboard');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, subtitle, icon: Icon, color, bgColor, trend, trendValue }) => (
    <Card sx={{ height: '100%', position: 'relative', overflow: 'visible' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom sx={{ fontWeight: 500 }}>
              {title}
            </Typography>
            <Typography variant="h4" component="div" sx={{ mb: 0.5, color: color, fontWeight: 700 }}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                {subtitle}
              </Typography>
            )}
            {trend && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                {trend === 'up' ? (
                  <TrendingUpIcon sx={{ fontSize: 18, color: 'success.main' }} />
                ) : (
                  <TrendingDownIcon sx={{ fontSize: 18, color: 'error.main' }} />
                )}
                <Typography variant="caption" sx={{ color: trend === 'up' ? 'success.main' : 'error.main', fontWeight: 600 }}>
                  {trendValue}
                </Typography>
              </Box>
            )}
          </Box>
          <Avatar
            sx={{
              bgcolor: bgColor,
              width: 56,
              height: 56,
            }}
          >
            <Icon sx={{ fontSize: 28, color: color }} />
          </Avatar>
        </Box>
      </CardContent>
    </Card>
  );

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  if (loading && !estadisticas) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
        <IconButton size="small" onClick={cargarDatos} sx={{ ml: 2 }}>
          <RefreshIcon />
        </IconButton>
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
            <AssessmentIcon sx={{ fontSize: 32 }} />
            Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Última actualización: {formatDistanceToNow(ultimaActualizacion, { addSuffix: true, locale: es })}
          </Typography>
        </Box>
        <Tooltip title="Actualizar datos">
          <IconButton onClick={cargarDatos} disabled={loading} color="primary">
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Tarjetas de estadísticas principales */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Ventas Hoy"
            value={`Q${(estadisticas?.ventasHoy?.monto || 0).toFixed(2)}`}
            subtitle={`${estadisticas?.ventasHoy?.total || 0} transacciones`}
            icon={AttachMoneyIcon}
            color="success.main"
            bgColor="success.light"
            trend="up"
            trendValue="+12.5%"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Ventas del Mes"
            value={`Q${(estadisticas?.ventasMes?.monto || 0).toFixed(2)}`}
            subtitle={`${estadisticas?.ventasMes?.total || 0} ventas totales`}
            icon={TrendingUpIcon}
            color="primary.main"
            bgColor="primary.light"
            trend="up"
            trendValue="+8.3%"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Stock Crítico"
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
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Envíos Pendientes"
            value={estadisticas?.enviosPendientes || 0}
            subtitle="Requieren atención"
            icon={LocalShippingIcon}
            color="info.main"
            bgColor="info.light"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Productos"
            value={estadisticas?.totalProductos || 0}
            subtitle="En catálogo activo"
            icon={CategoryIcon}
            color="secondary.main"
            bgColor="secondary.light"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Clientes"
            value={estadisticas?.totalClientes || 0}
            subtitle="Registrados"
            icon={PeopleIcon}
            color="success.main"
            bgColor="success.light"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Ticket Promedio"
            value={`Q${(estadisticas?.ticketPromedio || 0).toFixed(2)}`}
            subtitle="Por venta"
            icon={MonetizationOnIcon}
            color="primary.main"
            bgColor="primary.light"
          />
        </Grid>
      </Grid>

      {/* Gráficas */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Gráfica de ventas por día */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingUpIcon color="primary" />
                Tendencia de Ventas (Últimos 14 días)
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={ventasPorDia}>
                  <defs>
                    <linearGradient id="colorMonto" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1976d2" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#1976d2" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="fecha"
                    tickFormatter={(fecha) => format(new Date(fecha), 'dd/MM', { locale: es })}
                    style={{ fontSize: 12 }}
                  />
                  <YAxis style={{ fontSize: 12 }} />
                  <RechartsTooltip
                    labelFormatter={(fecha) => format(new Date(fecha), 'dd MMMM yyyy', { locale: es })}
                    formatter={(value) => [`Q${parseFloat(value).toFixed(2)}`, 'Total']}
                    contentStyle={{ borderRadius: 8, border: '1px solid #e0e0e0' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="monto_total"
                    stroke="#1976d2"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorMonto)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tablas de datos */}
      <Grid container spacing={3}>
        {/* Ventas recientes */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ShoppingCartIcon color="primary" />
                Ventas Recientes
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Folio</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Cliente</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Método</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {ventasRecientes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                          <Typography variant="body2" color="text.secondary">
                            No hay ventas recientes
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      ventasRecientes.map((venta) => (
                        <TableRow key={venta.id} hover>
                          <TableCell>
                            <Chip label={venta.folio} size="small" color="primary" variant="outlined" />
                          </TableCell>
                          <TableCell>{venta.cliente_nombre || 'Público General'}</TableCell>
                          <TableCell>
                            <Chip
                              label={venta.metodo_pago}
                              size="small"
                              color={
                                venta.metodo_pago === 'efectivo' ? 'success' :
                                venta.metodo_pago === 'tarjeta' ? 'info' : 'default'
                              }
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Typography fontWeight="bold" color="success.main">
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
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingUpIcon color="success" />
                Top Productos
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Producto</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Vendidos</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {productosMasVendidos.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} align="center" sx={{ py: 3 }}>
                          <Typography variant="body2" color="text.secondary">
                            No hay datos disponibles
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      productosMasVendidos.map((producto, index) => (
                        <TableRow key={producto.id} hover>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Avatar sx={{ width: 24, height: 24, bgcolor: 'primary.main', fontSize: 12 }}>
                                {index + 1}
                              </Avatar>
                              {producto.nombre}
                            </Box>
                          </TableCell>
                          <TableCell align="right">
                            <Chip
                              label={producto.total_vendido}
                              size="small"
                              color="primary"
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" color="success.main" fontWeight="bold">
                              Q{(producto.total_vendido * (producto.precio_venta || 0)).toFixed(2)}
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

        {/* Stock bajo */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <WarningIcon color="warning" />
                Alerta de Stock Bajo
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Producto</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600 }}>Stock</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600 }}>Mínimo</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Estado</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stockBajo.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                          <Box>
                            <CheckCircleIcon color="success" sx={{ fontSize: 40, mb: 1 }} />
                            <Typography variant="body2" color="text.secondary">
                              Todos los productos tienen stock suficiente
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ) : (
                      stockBajo.map((producto) => {
                        const porcentaje = (producto.stock_actual / producto.stock_minimo) * 100;
                        return (
                          <TableRow key={producto.id} hover>
                            <TableCell>{producto.nombre}</TableCell>
                            <TableCell align="center">
                              <Chip
                                label={producto.stock_actual}
                                size="small"
                                color={producto.stock_actual === 0 ? 'error' : 'warning'}
                              />
                            </TableCell>
                            <TableCell align="center">{producto.stock_minimo}</TableCell>
                            <TableCell align="right">
                              <Box sx={{ width: 60 }}>
                                <LinearProgress
                                  variant="determinate"
                                  value={Math.min(porcentaje, 100)}
                                  color={porcentaje < 50 ? 'error' : 'warning'}
                                  sx={{ height: 6, borderRadius: 3 }}
                                />
                              </Box>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Productos por vencer */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ScheduleIcon color="error" />
                Próximos a Vencer
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Producto</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Lote</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Días</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {productosPorVencer.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} align="center" sx={{ py: 3 }}>
                          <Box>
                            <CheckCircleIcon color="success" sx={{ fontSize: 40, mb: 1 }} />
                            <Typography variant="body2" color="text.secondary">
                              No hay productos próximos a vencer
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ) : (
                      productosPorVencer.map((lote) => (
                        <TableRow key={lote.id} hover>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {lote.producto_nombre}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {lote.numero_lote}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Chip
                              label={`${lote.dias_restantes} días`}
                              size="small"
                              color={
                                lote.dias_restantes <= 7 ? 'error' :
                                lote.dias_restantes <= 15 ? 'warning' : 'info'
                              }
                              icon={
                                lote.dias_restantes <= 7 ? <WarningIcon /> : <ScheduleIcon />
                              }
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