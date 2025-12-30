// src/pages/HistorialPrecios.js
import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Box,
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
  Grid,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  Button,
  IconButton,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Timeline as TimelineIcon,
  Visibility as VisibilityIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const HistorialPrecios = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [estadisticas, setEstadisticas] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProducto, setSelectedProducto] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [productoHistorial, setProductoHistorial] = useState(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const [historialRes, statsRes] = await Promise.all([
        api.get('/api/historial-precios', { params: { limit: 100 } }),
        api.get('/api/historial-precios/estadisticas', { params: { dias: 30 } })
      ]);
      
      setHistorial(historialRes.data.historial);
      setEstadisticas(statsRes.data);
    } catch (err) {
      setError('Error al cargar historial');
    } finally {
      setLoading(false);
    }
  };

  const verDetalleProducto = async (productoId) => {
    try {
      const response = await api.get(`/api/historial-precios/producto/${productoId}`);
      setProductoHistorial(response.data);
      setOpenDialog(true);
    } catch (err) {
      setError('Error al cargar detalle del producto');
    }
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setProductoHistorial(null);
  };

  const historialFiltrado = historial.filter((item) =>
    item.producto_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.codigo_barras?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getCambioColor = (diferencia) => {
    return diferencia > 0 ? 'success' : diferencia < 0 ? 'error' : 'default';
  };

  const getCambioIcon = (diferencia) => {
    return diferencia > 0 ? <TrendingUpIcon /> : <TrendingDownIcon />;
  };

  // Preparar datos para la gráfica
  const prepararDatosGrafica = () => {
    if (!productoHistorial) return [];
    
    const compras = productoHistorial.historial
      .filter(h => h.tipo_precio === 'compra')
      .reverse()
      .map((h, i) => ({
        fecha: format(new Date(h.fecha_cambio), 'dd/MM'),
        compra: parseFloat(h.precio_nuevo),
      }));
    
    const ventas = productoHistorial.historial
      .filter(h => h.tipo_precio === 'venta')
      .reverse()
      .map((h, i) => ({
        fecha: format(new Date(h.fecha_cambio), 'dd/MM'),
        venta: parseFloat(h.precio_nuevo),
      }));

    // Combinar ambos arrays
    const combined = {};
    [...compras, ...ventas].forEach(item => {
      if (!combined[item.fecha]) {
        combined[item.fecha] = { fecha: item.fecha };
      }
      Object.assign(combined[item.fecha], item);
    });

    return Object.values(combined);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        Cargando...
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Historial de Precios
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Auditoría y seguimiento de cambios de precios
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={cargarDatos}
        >
          Actualizar
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Estadísticas */}
      {estadisticas && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={4}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">Total Cambios (30 días)</Typography>
                <Typography variant="h3" color="primary">
                  {estadisticas.total_cambios}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">Productos Modificados</Typography>
                <Typography variant="h3">
                  {estadisticas.productos_mas_cambios.length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">Promedio Diario</Typography>
                <Typography variant="h3">
                  {estadisticas.cambios_por_dia.length > 0 
                    ? Math.round(estadisticas.total_cambios / estadisticas.cambios_por_dia.length)
                    : 0
                  }
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab icon={<TimelineIcon />} label="Historial General" />
          <Tab icon={<TrendingUpIcon />} label="Productos Más Cambios" />
        </Tabs>
      </Box>

      {/* Búsqueda */}
      {tabValue === 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <TextField
              fullWidth
              placeholder="Buscar por producto o código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Historial General */}
      {tabValue === 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Cambios Recientes</Typography>
            <TableContainer sx={{ maxHeight: 600 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Fecha</TableCell>
                    <TableCell>Producto</TableCell>
                    <TableCell>Tipo</TableCell>
                    <TableCell align="right">Precio Anterior</TableCell>
                    <TableCell align="right">Precio Nuevo</TableCell>
                    <TableCell align="right">Cambio</TableCell>
                    <TableCell>Usuario</TableCell>
                    <TableCell align="center">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {historialFiltrado.map((item) => (
                    <TableRow key={item.id} hover>
                      <TableCell>
                        {format(new Date(item.fecha_cambio), 'dd/MM/yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {item.producto_nombre}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.codigo_barras}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={item.tipo_precio === 'compra' ? 'Compra' : 'Venta'} 
                          size="small"
                          color={item.tipo_precio === 'compra' ? 'info' : 'success'}
                        />
                      </TableCell>
                      <TableCell align="right">
                        Q{parseFloat(item.precio_anterior).toFixed(2)}
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="bold">
                          Q{parseFloat(item.precio_nuevo).toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          icon={getCambioIcon(item.diferencia)}
                          label={`${item.diferencia > 0 ? '+' : ''}Q${parseFloat(item.diferencia).toFixed(2)} (${item.porcentaje_cambio}%)`}
                          size="small"
                          color={getCambioColor(item.diferencia)}
                        />
                      </TableCell>
                      <TableCell>{item.usuario_nombre || '-'}</TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={() => verDetalleProducto(item.producto_id)}
                          title="Ver historial completo"
                        >
                          <VisibilityIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Productos con Más Cambios */}
      {tabValue === 1 && estadisticas && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Top 10 Productos con Más Cambios (30 días)
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>Producto</TableCell>
                    <TableCell>Código</TableCell>
                    <TableCell align="center">Cambios</TableCell>
                    <TableCell>Último Cambio</TableCell>
                    <TableCell align="center">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {estadisticas.productos_mas_cambios.map((producto, index) => (
                    <TableRow key={producto.id} hover>
                      <TableCell>
                        <Chip label={index + 1} size="small" color="primary" />
                      </TableCell>
                      <TableCell>{producto.nombre}</TableCell>
                      <TableCell>{producto.codigo_barras}</TableCell>
                      <TableCell align="center">
                        <Typography variant="h6" color="primary">
                          {producto.num_cambios}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {format(new Date(producto.ultimo_cambio), 'dd/MM/yyyy HH:mm')}
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => verDetalleProducto(producto.id)}
                        >
                          <VisibilityIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Dialog de Detalle del Producto */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="lg" fullWidth>
        <DialogTitle>
          {productoHistorial?.producto.nombre}
          <Typography variant="body2" color="text.secondary">
            Código: {productoHistorial?.producto.codigo_barras}
          </Typography>
        </DialogTitle>
        <DialogContent>
          {productoHistorial && (
            <Box>
              {/* Precios Actuales */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="body2" color="text.secondary">Precio Compra Actual</Typography>
                      <Typography variant="h4" color="info.main">
                        Q{parseFloat(productoHistorial.producto.precio_compra).toFixed(2)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="body2" color="text.secondary">Precio Venta Actual</Typography>
                      <Typography variant="h4" color="success.main">
                        Q{parseFloat(productoHistorial.producto.precio_venta).toFixed(2)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Gráfica de Evolución */}
              {productoHistorial.historial.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" gutterBottom>Evolución de Precios</Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={prepararDatosGrafica()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="fecha" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="compra" stroke="#0288d1" name="Precio Compra" />
                      <Line type="monotone" dataKey="venta" stroke="#2e7d32" name="Precio Venta" />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              )}

              {/* Tabla de Historial */}
              <Typography variant="h6" gutterBottom>Historial Completo</Typography>
              <TableContainer sx={{ maxHeight: 400 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Fecha</TableCell>
                      <TableCell>Tipo</TableCell>
                      <TableCell align="right">Anterior</TableCell>
                      <TableCell align="right">Nuevo</TableCell>
                      <TableCell align="right">Cambio</TableCell>
                      <TableCell>Usuario</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {productoHistorial.historial.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell>
                          {format(new Date(h.fecha_cambio), 'dd/MM/yyyy HH:mm')}
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={h.tipo_precio === 'compra' ? 'Compra' : 'Venta'} 
                            size="small"
                            color={h.tipo_precio === 'compra' ? 'info' : 'success'}
                          />
                        </TableCell>
                        <TableCell align="right">Q{parseFloat(h.precio_anterior).toFixed(2)}</TableCell>
                        <TableCell align="right">
                          <Typography fontWeight="bold">
                            Q{parseFloat(h.precio_nuevo).toFixed(2)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Chip
                            icon={getCambioIcon(h.diferencia)}
                            label={`${h.diferencia > 0 ? '+' : ''}${h.porcentaje_cambio}%`}
                            size="small"
                            color={getCambioColor(h.diferencia)}
                          />
                        </TableCell>
                        <TableCell>{h.usuario_nombre || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default HistorialPrecios;
