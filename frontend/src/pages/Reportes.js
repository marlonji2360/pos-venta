// src/pages/Reportes.js
import React, { useState } from 'react';
import api from '../services/api';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Grid,
  Alert,
  Tabs,
  Tab,
  CircularProgress,
  Chip,
} from '@mui/material';
import {
  Assessment as AssessmentIcon,
  TrendingUp as TrendingUpIcon,
  Inventory as InventoryIcon,
  People as PeopleIcon,
  AttachMoney as AttachMoneyIcon,
  SwapVert as SwapVertIcon,
  AccountBalance as AccountBalanceIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const Reportes = () => {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fechaInicio, setFechaInicio] = useState(format(new Date(), 'yyyy-MM-01'));
  const [fechaFin, setFechaFin] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Estados para cada reporte
  const [reporteVentas, setReporteVentas] = useState(null);
  const [reporteProductos, setReporteProductos] = useState(null);
  const [reporteInventario, setReporteInventario] = useState(null);
  const [reporteVendedores, setReporteVendedores] = useState(null);
  const [reporteGanancias, setReporteGanancias] = useState(null);
  const [reporteMovimientos, setReporteMovimientos] = useState(null);
  const [reporteCuentasPorPagar, setReporteCuentasPorPagar] = useState(null);

  const generarReporteVentas = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/reportes/ventas', {
        params: { fecha_inicio: fechaInicio, fecha_fin: fechaFin }
      });
      setReporteVentas(response.data);
    } catch (err) {
      setError('Error al generar reporte de ventas');
    } finally {
      setLoading(false);
    }
  };

  const generarReporteProductos = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/reportes/productos-vendidos', {
        params: { fecha_inicio: fechaInicio, fecha_fin: fechaFin, limit: 20 }
      });
      setReporteProductos(response.data);
    } catch (err) {
      setError('Error al generar reporte de productos');
    } finally {
      setLoading(false);
    }
  };

  const generarReporteInventario = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/reportes/inventario');
      setReporteInventario(response.data);
    } catch (err) {
      setError('Error al generar reporte de inventario');
    } finally {
      setLoading(false);
    }
  };

  const generarReporteVendedores = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/reportes/vendedores', {
        params: { fecha_inicio: fechaInicio, fecha_fin: fechaFin }
      });
      setReporteVendedores(response.data);
    } catch (err) {
      setError('Error al generar reporte de vendedores');
    } finally {
      setLoading(false);
    }
  };

  const generarReporteGanancias = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/reportes/ganancias', {
        params: { fecha_inicio: fechaInicio, fecha_fin: fechaFin }
      });
      setReporteGanancias(response.data);
    } catch (err) {
      setError('Error al generar reporte de ganancias');
    } finally {
      setLoading(false);
    }
  };

  const generarReporteMovimientos = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/reportes/movimientos', {
        params: { fecha_inicio: fechaInicio, fecha_fin: fechaFin, limit: 50 }
      });
      setReporteMovimientos(response.data);
    } catch (err) {
      setError('Error al generar reporte de movimientos');
    } finally {
      setLoading(false);
    }
  };

  const generarReporteCuentasPorPagar = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/reportes/cuentas-por-pagar', {
        params: { fecha_inicio: fechaInicio, fecha_fin: fechaFin }
      });
      setReporteCuentasPorPagar(response.data);
    } catch (err) {
      setError('Error al generar reporte de cuentas por pagar');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    setError(null);
  };

  const handleGenerar = () => {
    switch (tabValue) {
      case 0:
        generarReporteVentas();
        break;
      case 1:
        generarReporteProductos();
        break;
      case 2:
        generarReporteInventario();
        break;
      case 3:
        generarReporteVendedores();
        break;
      case 4:
        generarReporteGanancias();
        break;
      case 5:
        generarReporteMovimientos();
        break;
      case 6:
        generarReporteCuentasPorPagar();
        break;
      default:
        break;
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Reportes
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Análisis y estadísticas del negocio
          </Typography>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Filtros de fecha */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Fecha Inicio"
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Fecha Fin"
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Button
                fullWidth
                variant="contained"
                onClick={handleGenerar}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : <AssessmentIcon />}
                sx={{ height: '56px' }}
              >
                {loading ? 'Generando...' : 'Generar Reporte'}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Tabs de reportes */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab icon={<AttachMoneyIcon />} label="Ventas" />
          <Tab icon={<TrendingUpIcon />} label="Productos" />
          <Tab icon={<InventoryIcon />} label="Inventario" />
          <Tab icon={<PeopleIcon />} label="Vendedores" />
          <Tab icon={<AttachMoneyIcon />} label="Ganancias" />
          <Tab icon={<SwapVertIcon />} label="Movimientos" />
          <Tab icon={<AccountBalanceIcon />} label="Cuentas por Pagar" />
        </Tabs>
      </Box>

      {/* Reporte de Ventas */}
      {tabValue === 0 && reporteVentas && (
        <Box>
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">Total Ventas</Typography>
                  <Typography variant="h4">{reporteVentas.resumen.total_ventas}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">Monto Total</Typography>
                  <Typography variant="h4" color="primary">
                    Q{parseFloat(reporteVentas.resumen.monto_total).toFixed(2)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">Promedio</Typography>
                  <Typography variant="h4">
                    Q{parseFloat(reporteVentas.resumen.promedio_venta).toFixed(2)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Ventas por Día</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={reporteVentas.ventasPorDia}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fecha" tickFormatter={(fecha) => format(new Date(fecha), 'dd/MM')} />
                  <YAxis />
                  <Tooltip labelFormatter={(fecha) => format(new Date(fecha), 'dd/MM/yyyy')} />
                  <Legend />
                  <Bar dataKey="monto_total" fill="#1976d2" name="Ventas (Q)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Por Método de Pago</Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Método</TableCell>
                          <TableCell align="right">Ventas</TableCell>
                          <TableCell align="right">Monto</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {reporteVentas.ventasPorMetodo.map((metodo) => (
                          <TableRow key={metodo.metodo_pago}>
                            <TableCell sx={{ textTransform: 'capitalize' }}>{metodo.metodo_pago}</TableCell>
                            <TableCell align="right">{metodo.num_ventas}</TableCell>
                            <TableCell align="right">Q{parseFloat(metodo.monto_total).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Detalle de Ventas</Typography>
                  <TableContainer sx={{ maxHeight: 400 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>Folio</TableCell>
                          <TableCell>Cliente</TableCell>
                          <TableCell align="right">Total</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {reporteVentas.ventasDetalle.slice(0, 10).map((venta) => (
                          <TableRow key={venta.id}>
                            <TableCell>{venta.folio}</TableCell>
                            <TableCell>{venta.cliente_nombre || 'Sin cliente'}</TableCell>
                            <TableCell align="right">Q{parseFloat(venta.total).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Reporte de Productos */}
      {tabValue === 1 && reporteProductos && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Productos Más Vendidos</Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Producto</TableCell>
                    <TableCell>Categoría</TableCell>
                    <TableCell align="right">Cantidad</TableCell>
                    <TableCell align="right">Ventas</TableCell>
                    <TableCell align="right">Monto Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reporteProductos.productos.map((producto, index) => (
                    <TableRow key={producto.id}>
                      <TableCell>
                        <Chip label={`#${index + 1}`} size="small" sx={{ mr: 1 }} />
                        {producto.nombre}
                      </TableCell>
                      <TableCell>{producto.categoria_nombre || producto.categoria_id || '-'}</TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="bold">{producto.total_vendido}</Typography>
                      </TableCell>
                      <TableCell align="right">{producto.num_ventas}</TableCell>
                      <TableCell align="right">
                        <Typography color="primary" fontWeight="bold">
                          Q{parseFloat(producto.monto_total).toFixed(2)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Reporte de Inventario */}
      {tabValue === 2 && reporteInventario && (
        <Box>
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">Total Productos</Typography>
                  <Typography variant="h4">{reporteInventario.valorTotal.total_productos}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">Valor Inventario</Typography>
                  <Typography variant="h4" color="success.main">
                    Q{parseFloat(reporteInventario.valorTotal.valor_total_inventario).toFixed(2)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Productos en Inventario</Typography>
              <TableContainer sx={{ maxHeight: 500 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Producto</TableCell>
                      <TableCell>Categoría</TableCell>
                      <TableCell align="right">Stock</TableCell>
                      <TableCell align="right">Mín</TableCell>
                      <TableCell align="right">Precio</TableCell>
                      <TableCell align="right">Valor</TableCell>
                      <TableCell align="center">Estado</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {reporteInventario.productos.map((producto) => (
                      <TableRow key={producto.id}>
                        <TableCell>{producto.nombre}</TableCell>
                        <TableCell>{producto.categoria_nombre || producto.categoria_id || '-'}</TableCell>
                        <TableCell align="right">{producto.stock_actual}</TableCell>
                        <TableCell align="right">{producto.stock_minimo}</TableCell>
                        <TableCell align="right">Q{parseFloat(producto.precio_compra).toFixed(2)}</TableCell>
                        <TableCell align="right">Q{parseFloat(producto.valor_inventario).toFixed(2)}</TableCell>
                        <TableCell align="center">
                          <Chip
                            label={producto.estado_stock}
                            size="small"
                            color={
                              producto.estado_stock === 'bajo' ? 'error' :
                              producto.estado_stock === 'alto' ? 'warning' : 'success'
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Reporte de Vendedores */}
      {tabValue === 3 && reporteVendedores && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Ventas por Vendedor</Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Vendedor</TableCell>
                    <TableCell>Rol ID</TableCell>
                    <TableCell align="right">Ventas</TableCell>
                    <TableCell align="right">Monto Total</TableCell>
                    <TableCell align="right">Promedio</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reporteVendedores.vendedores.map((vendedor) => (
                    <TableRow key={vendedor.id}>
                      <TableCell>{vendedor.vendedor}</TableCell>
                      <TableCell>
                        <Chip 
                          label={vendedor.rol_id === 1 ? 'Admin' : vendedor.rol_id === 2 ? 'Gerente' : 'Vendedor'} 
                          size="small"
                          color={vendedor.rol_id === 1 ? 'error' : vendedor.rol_id === 2 ? 'warning' : 'default'}
                        />
                      </TableCell>
                      <TableCell align="right">{vendedor.total_ventas}</TableCell>
                      <TableCell align="right">
                        <Typography color="primary" fontWeight="bold">
                          Q{parseFloat(vendedor.monto_total).toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">Q{parseFloat(vendedor.promedio_venta).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Reporte de Ganancias */}
      {tabValue === 4 && reporteGanancias && (
        <Box>
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">Ingresos</Typography>
                  <Typography variant="h5" color="primary">
                    Q{parseFloat(reporteGanancias.resumen.ingreso_total).toFixed(2)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">Costos</Typography>
                  <Typography variant="h5" color="error">
                    Q{parseFloat(reporteGanancias.resumen.costo_total).toFixed(2)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">Ganancia</Typography>
                  <Typography variant="h5" color="success.main">
                    Q{parseFloat(reporteGanancias.resumen.ganancia_total).toFixed(2)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Margen: {reporteGanancias.resumen.margen_ganancia.toFixed(2)}%
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Ganancias por Producto</Typography>
              <TableContainer sx={{ maxHeight: 500 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Producto</TableCell>
                      <TableCell align="right">Vendidos</TableCell>
                      <TableCell align="right">Ingreso</TableCell>
                      <TableCell align="right">Costo</TableCell>
                      <TableCell align="right">Ganancia</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {reporteGanancias.productos.map((producto) => (
                      <TableRow key={producto.id}>
                        <TableCell>{producto.nombre}</TableCell>
                        <TableCell align="right">{producto.cantidad_vendida}</TableCell>
                        <TableCell align="right">Q{parseFloat(producto.ingreso_total).toFixed(2)}</TableCell>
                        <TableCell align="right">Q{parseFloat(producto.costo_total).toFixed(2)}</TableCell>
                        <TableCell align="right">
                          <Typography color="success.main" fontWeight="bold">
                            Q{parseFloat(producto.ganancia_total).toFixed(2)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Reporte de Movimientos */}
      {tabValue === 5 && reporteMovimientos && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Movimientos de Inventario</Typography>
            <TableContainer sx={{ maxHeight: 500 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Fecha</TableCell>
                    <TableCell>Producto</TableCell>
                    <TableCell>Tipo</TableCell>
                    <TableCell align="right">Cantidad</TableCell>
                    <TableCell>Motivo</TableCell>
                    <TableCell>Usuario</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reporteMovimientos.movimientos.map((mov) => (
                    <TableRow key={mov.id}>
                      <TableCell>{format(new Date(mov.fecha), 'dd/MM/yyyy HH:mm')}</TableCell>
                      <TableCell>{mov.producto_nombre}</TableCell>
                      <TableCell>
                        <Chip
                          label={mov.tipo_movimiento}
                          size="small"
                          color={mov.tipo_movimiento === 'entrada' ? 'success' : 'error'}
                        />
                      </TableCell>
                      <TableCell align="right">{mov.cantidad}</TableCell>
                      <TableCell>{mov.motivo}</TableCell>
                      <TableCell>{mov.usuario_nombre}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Tab 6: Cuentas por Pagar */}
      {tabValue === 6 && reporteCuentasPorPagar && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Reporte de Cuentas por Pagar</Typography>
            
            {/* Totales */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">Total Cuentas</Typography>
                    <Typography variant="h4">{reporteCuentasPorPagar.totales.total_cuentas}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">Monto Total</Typography>
                    <Typography variant="h4">Q{parseFloat(reporteCuentasPorPagar.totales.monto_total).toFixed(2)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">Monto Pagado</Typography>
                    <Typography variant="h4" color="success.main">Q{parseFloat(reporteCuentasPorPagar.totales.monto_pagado).toFixed(2)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">Saldo Pendiente</Typography>
                    <Typography variant="h4" color="error.main">Q{parseFloat(reporteCuentasPorPagar.totales.saldo_pendiente).toFixed(2)}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Vencido: Q{parseFloat(reporteCuentasPorPagar.totales.total_vencido).toFixed(2)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Tabla */}
            <TableContainer sx={{ maxHeight: 500 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Folio</TableCell>
                    <TableCell>Proveedor</TableCell>
                    <TableCell>F. Emisión</TableCell>
                    <TableCell>F. Vencimiento</TableCell>
                    <TableCell align="right">Monto Total</TableCell>
                    <TableCell align="right">Pagado</TableCell>
                    <TableCell align="right">Saldo</TableCell>
                    <TableCell>Estado</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reporteCuentasPorPagar.cuentas.map((cuenta) => (
                    <TableRow key={cuenta.id}>
                      <TableCell>{cuenta.folio}</TableCell>
                      <TableCell>{cuenta.proveedor_nombre}</TableCell>
                      <TableCell>{format(new Date(cuenta.fecha_emision), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>
                        {format(new Date(cuenta.fecha_vencimiento), 'dd/MM/yyyy')}
                        {cuenta.dias_para_vencer !== null && (
                          <Typography variant="caption" display="block" color={cuenta.dias_para_vencer < 0 ? 'error' : 'text.secondary'}>
                            {cuenta.dias_para_vencer >= 0 
                              ? `En ${cuenta.dias_para_vencer} días`
                              : `Vencido hace ${Math.abs(cuenta.dias_para_vencer)} días`
                            }
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">Q{parseFloat(cuenta.monto_total).toFixed(2)}</TableCell>
                      <TableCell align="right">
                        <Typography color="success.main">Q{parseFloat(cuenta.monto_pagado).toFixed(2)}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography color="error.main" fontWeight="bold">
                          Q{parseFloat(cuenta.saldo_pendiente).toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={cuenta.estado_actual || cuenta.estado}
                          size="small"
                          color={
                            (cuenta.estado_actual || cuenta.estado) === 'vencido' ? 'error' :
                            (cuenta.estado_actual || cuenta.estado) === 'pendiente' ? 'warning' :
                            (cuenta.estado_actual || cuenta.estado) === 'parcial' ? 'info' : 'success'
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default Reportes;