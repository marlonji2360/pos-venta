// src/pages/CuentasPorPagar.js
import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Box,
  Grid,
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
  Paper,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Tabs,
  Tab,
  MenuItem,
  Divider,
  LinearProgress,
  Autocomplete,
} from '@mui/material';
import {
  Add as AddIcon,
  Payment as PaymentIcon,
  Visibility as VisibilityIcon,
  Receipt as ReceiptIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  TrendingUp as TrendingUpIcon,
  AttachMoney as AttachMoneyIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const CuentasPorPagar = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  
  // Datos
  const [cuentas, setCuentas] = useState([]);
  const [estadisticas, setEstadisticas] = useState(null);
  const [proveedores, setProveedores] = useState([]);
  
  // Diálogos
  const [openNuevaCuenta, setOpenNuevaCuenta] = useState(false);
  const [openDetalle, setOpenDetalle] = useState(false);
  const [openPago, setOpenPago] = useState(false);
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState(null);
  
  // Formulario nueva cuenta
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState(null);
  const [montoTotal, setMontoTotal] = useState('');
  const [diasCredito, setDiasCredito] = useState(30);
  const [concepto, setConcepto] = useState('');
  const [notas, setNotas] = useState('');
  
  // Formulario pago
  const [montoPago, setMontoPago] = useState('');
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [referencia, setReferencia] = useState('');
  const [notasPago, setNotasPago] = useState('');

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const [cuentasRes, estadisticasRes, proveedoresRes] = await Promise.all([
        api.get('/api/cuentas-por-pagar'),
        api.get('/api/cuentas-por-pagar/estadisticas'),
        api.get('/api/proveedores'),
      ]);
      
      setCuentas(cuentasRes.data.cuentas);
      setEstadisticas(estadisticasRes.data);
      setProveedores(proveedoresRes.data.proveedores);
    } catch (err) {
      setError('Error al cargar datos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCrearCuenta = async () => {
    try {
      if (!proveedorSeleccionado || !montoTotal || !diasCredito) {
        setError('Completa todos los campos obligatorios');
        return;
      }

      await api.post('/api/cuentas-por-pagar', {
        proveedor_id: proveedorSeleccionado.id,
        monto_total: parseFloat(montoTotal),
        dias_credito: parseInt(diasCredito),
        concepto: concepto,
        notas: notas,
      });

      setSuccess('Cuenta por pagar creada exitosamente');
      handleCloseNuevaCuenta();
      cargarDatos();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear cuenta');
    }
  };

  const handleVerDetalle = async (cuenta) => {
    try {
      const response = await api.get(`/api/cuentas-por-pagar/${cuenta.id}`);
      setCuentaSeleccionada(response.data);
      setOpenDetalle(true);
    } catch (err) {
      setError('Error al cargar detalle');
    }
  };

  const handleAbrirPago = (cuenta) => {
    setCuentaSeleccionada({ cuenta, pagos: [] });
    setMontoPago(cuenta.saldo_pendiente);
    setOpenPago(true);
  };

  const handleRegistrarPago = async () => {
    try {
      if (!montoPago || parseFloat(montoPago) <= 0) {
        setError('El monto debe ser mayor a cero');
        return;
      }

      await api.post(`/api/cuentas-por-pagar/${cuentaSeleccionada.cuenta.id}/pago`, {
        monto: parseFloat(montoPago),
        metodo_pago: metodoPago,
        referencia: referencia,
        notas: notasPago,
      });

      setSuccess('Pago registrado exitosamente');
      handleClosePago();
      cargarDatos();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar pago');
    }
  };

  const handleCloseNuevaCuenta = () => {
    setOpenNuevaCuenta(false);
    setProveedorSeleccionado(null);
    setMontoTotal('');
    setDiasCredito(30);
    setConcepto('');
    setNotas('');
  };

  const handleClosePago = () => {
    setOpenPago(false);
    setMontoPago('');
    setMetodoPago('efectivo');
    setReferencia('');
    setNotasPago('');
  };

  const getEstadoColor = (estado) => {
    switch (estado) {
      case 'pendiente': return 'warning';
      case 'parcial': return 'info';
      case 'pagado': return 'success';
      case 'vencido': return 'error';
      default: return 'default';
    }
  };

  const getEstadoTexto = (estado) => {
    switch (estado) {
      case 'pendiente': return 'Pendiente';
      case 'parcial': return 'Pago Parcial';
      case 'pagado': return 'Pagado';
      case 'vencido': return 'Vencido';
      default: return estado;
    }
  };

  if (loading) {
    return (
      <Box sx={{ width: '100%', mt: 2 }}>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Cuentas por Pagar
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gestión de créditos con proveedores
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={cargarDatos}
          >
            Actualizar
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenNuevaCuenta(true)}
          >
            Nueva Cuenta
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Dashboard de Estadísticas */}
      {estadisticas && (
        <>
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: 'error.main', color: 'white' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>
                        Total por Pagar
                      </Typography>
                      <Typography variant="h4" fontWeight="bold">
                        Q{parseFloat(estadisticas.totales.saldo_total).toFixed(2)}
                      </Typography>
                      <Typography variant="caption" sx={{ opacity: 0.9 }}>
                        {estadisticas.totales.total_cuentas} cuentas activas
                      </Typography>
                    </Box>
                    <AttachMoneyIcon sx={{ fontSize: 50, opacity: 0.3 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: 'warning.main', color: 'white' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>
                        Saldo Vencido
                      </Typography>
                      <Typography variant="h4" fontWeight="bold">
                        Q{parseFloat(estadisticas.totales.saldo_vencido).toFixed(2)}
                      </Typography>
                    </Box>
                    <WarningIcon sx={{ fontSize: 50, opacity: 0.3 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: 'info.main', color: 'white' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>
                        Vence en 7 días
                      </Typography>
                      <Typography variant="h4" fontWeight="bold">
                        Q{parseFloat(estadisticas.totales.por_vencer_7dias).toFixed(2)}
                      </Typography>
                    </Box>
                    <ScheduleIcon sx={{ fontSize: 50, opacity: 0.3 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Próximos Vencimientos
                      </Typography>
                      <Typography variant="h4" fontWeight="bold">
                        {estadisticas.proximos_vencimientos.length}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Siguientes 15 días
                      </Typography>
                    </Box>
                    <TrendingUpIcon sx={{ fontSize: 50, color: 'success.main', opacity: 0.3 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Gráficas */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Top 5 Proveedores con Deuda
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={estadisticas.por_proveedor.slice(0, 5)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="nombre" angle={-45} textAnchor="end" height={80} />
                      <YAxis />
                      <Tooltip formatter={(value) => `Q${parseFloat(value).toFixed(2)}`} />
                      <Bar dataKey="saldo_total" fill="#ff5722" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Distribución por Proveedor
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={estadisticas.por_proveedor.slice(0, 5)}
                        dataKey="saldo_total"
                        nameKey="nombre"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={(entry) => `${entry.nombre}: Q${parseFloat(entry.saldo_total).toFixed(0)}`}
                      >
                        {estadisticas.por_proveedor.slice(0, 5).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `Q${parseFloat(value).toFixed(2)}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </>
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab label="Todas las Cuentas" />
          <Tab label="Próximos Vencimientos" />
          <Tab label="Vencidas" />
        </Tabs>
      </Box>

      {/* Tab 1: Todas las Cuentas */}
      {tabValue === 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Listado de Cuentas por Pagar
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Folio</TableCell>
                    <TableCell>Proveedor</TableCell>
                    <TableCell>Fecha Emisión</TableCell>
                    <TableCell>Vencimiento</TableCell>
                    <TableCell align="right">Monto Total</TableCell>
                    <TableCell align="right">Saldo Pendiente</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell align="center">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cuentas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        <Box sx={{ py: 3 }}>
                          <ReceiptIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                          <Typography variant="body2" color="text.secondary">
                            No hay cuentas por pagar registradas
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ) : (
                    cuentas.map((cuenta) => (
                      <TableRow key={cuenta.id} hover>
                        <TableCell>{cuenta.folio}</TableCell>
                        <TableCell>{cuenta.proveedor_nombre}</TableCell>
                        <TableCell>
                          {format(new Date(cuenta.fecha_emision), 'dd/MM/yyyy')}
                        </TableCell>
                        <TableCell>
                          {format(new Date(cuenta.fecha_vencimiento), 'dd/MM/yyyy')}
                          {cuenta.dias_para_vencer !== null && (
                            <Typography variant="caption" display="block" color="text.secondary">
                              {cuenta.dias_para_vencer > 0 
                                ? `En ${cuenta.dias_para_vencer} días`
                                : `Vencido hace ${Math.abs(cuenta.dias_para_vencer)} días`
                              }
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          Q{parseFloat(cuenta.monto_total).toFixed(2)}
                        </TableCell>
                        <TableCell align="right">
                          <Typography fontWeight="bold" color="error.main">
                            Q{parseFloat(cuenta.saldo_pendiente).toFixed(2)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={getEstadoTexto(cuenta.estado_actual || cuenta.estado)}
                            size="small"
                            color={getEstadoColor(cuenta.estado_actual || cuenta.estado)}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleVerDetalle(cuenta)}
                            title="Ver detalle"
                          >
                            <VisibilityIcon />
                          </IconButton>
                          {cuenta.saldo_pendiente > 0 && (
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() => handleAbrirPago(cuenta)}
                              title="Registrar pago"
                            >
                              <PaymentIcon />
                            </IconButton>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Tab 2: Próximos Vencimientos */}
      {tabValue === 1 && estadisticas && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Próximos Vencimientos (15 días)
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Folio</TableCell>
                    <TableCell>Proveedor</TableCell>
                    <TableCell>Vencimiento</TableCell>
                    <TableCell>Días Restantes</TableCell>
                    <TableCell align="right">Saldo</TableCell>
                    <TableCell align="center">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {estadisticas.proximos_vencimientos.map((cuenta) => (
                    <TableRow key={cuenta.id}>
                      <TableCell>{cuenta.folio}</TableCell>
                      <TableCell>{cuenta.proveedor_nombre}</TableCell>
                      <TableCell>
                        {format(new Date(cuenta.fecha_vencimiento), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={`${cuenta.dias_restantes} días`}
                          size="small"
                          color={cuenta.dias_restantes <= 3 ? 'error' : cuenta.dias_restantes <= 7 ? 'warning' : 'info'}
                        />
                      </TableCell>
                      <TableCell align="right">
                        Q{parseFloat(cuenta.saldo_pendiente).toFixed(2)}
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() => handleAbrirPago(cuenta)}
                        >
                          <PaymentIcon />
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

      {/* Tab 3: Vencidas */}
      {tabValue === 2 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Cuentas Vencidas
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Folio</TableCell>
                    <TableCell>Proveedor</TableCell>
                    <TableCell>Vencimiento</TableCell>
                    <TableCell align="right">Saldo</TableCell>
                    <TableCell align="center">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cuentas
                    .filter(c => c.estado === 'vencido' || c.estado_actual === 'vencido')
                    .map((cuenta) => (
                      <TableRow key={cuenta.id} sx={{ bgcolor: 'error.lighter' }}>
                        <TableCell>{cuenta.folio}</TableCell>
                        <TableCell>{cuenta.proveedor_nombre}</TableCell>
                        <TableCell>
                          {format(new Date(cuenta.fecha_vencimiento), 'dd/MM/yyyy')}
                        </TableCell>
                        <TableCell align="right">
                          <Typography fontWeight="bold" color="error">
                            Q{parseFloat(cuenta.saldo_pendiente).toFixed(2)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Button
                            size="small"
                            variant="contained"
                            color="error"
                            startIcon={<PaymentIcon />}
                            onClick={() => handleAbrirPago(cuenta)}
                          >
                            Pagar Ahora
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Diálogo: Nueva Cuenta */}
      <Dialog open={openNuevaCuenta} onClose={handleCloseNuevaCuenta} maxWidth="sm" fullWidth>
        <DialogTitle>Nueva Cuenta por Pagar</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <Autocomplete
                options={proveedores.filter(p => p.activo)}
                getOptionLabel={(option) => option.nombre}
                value={proveedorSeleccionado}
                onChange={(event, newValue) => setProveedorSeleccionado(newValue)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Proveedor"
                    required
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Monto Total"
                type="number"
                value={montoTotal}
                onChange={(e) => setMontoTotal(e.target.value)}
                required
                inputProps={{ min: 0.01, step: 0.01 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Días de Crédito"
                type="number"
                value={diasCredito}
                onChange={(e) => setDiasCredito(e.target.value)}
                required
                inputProps={{ min: 1, max: 365 }}
                helperText={`Vence: ${format(addDays(new Date(), parseInt(diasCredito || 0)), 'dd/MM/yyyy')}`}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Concepto"
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                placeholder="Ej: Compra de mercancía"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notas"
                multiline
                rows={3}
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Información adicional..."
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseNuevaCuenta}>Cancelar</Button>
          <Button onClick={handleCrearCuenta} variant="contained">
            Crear Cuenta
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo: Detalle de Cuenta */}
      <Dialog open={openDetalle} onClose={() => setOpenDetalle(false)} maxWidth="md" fullWidth>
        {cuentaSeleccionada && (
          <>
            <DialogTitle>
              Detalle de Cuenta - {cuentaSeleccionada.cuenta.folio}
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">Proveedor</Typography>
                  <Typography variant="body1" fontWeight="bold">{cuentaSeleccionada.cuenta.proveedor_nombre}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">Estado</Typography>
                  <Chip
                    label={getEstadoTexto(cuentaSeleccionada.cuenta.estado)}
                    color={getEstadoColor(cuentaSeleccionada.cuenta.estado)}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="body2" color="text.secondary">Monto Total</Typography>
                  <Typography variant="h6">Q{parseFloat(cuentaSeleccionada.cuenta.monto_total).toFixed(2)}</Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="body2" color="text.secondary">Pagado</Typography>
                  <Typography variant="h6" color="success.main">
                    Q{parseFloat(cuentaSeleccionada.cuenta.monto_pagado).toFixed(2)}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="body2" color="text.secondary">Saldo Pendiente</Typography>
                  <Typography variant="h6" color="error.main">
                    Q{parseFloat(cuentaSeleccionada.cuenta.saldo_pendiente).toFixed(2)}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">Fecha Emisión</Typography>
                  <Typography>{format(new Date(cuentaSeleccionada.cuenta.fecha_emision), 'dd/MM/yyyy')}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">Fecha Vencimiento</Typography>
                  <Typography>{format(new Date(cuentaSeleccionada.cuenta.fecha_vencimiento), 'dd/MM/yyyy')}</Typography>
                </Grid>
                {cuentaSeleccionada.cuenta.concepto && (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">Concepto</Typography>
                    <Typography>{cuentaSeleccionada.cuenta.concepto}</Typography>
                  </Grid>
                )}
              </Grid>

              <Divider sx={{ my: 3 }} />

              <Typography variant="h6" gutterBottom>
                Historial de Pagos
              </Typography>
              {!cuentaSeleccionada.pagos || cuentaSeleccionada.pagos.length === 0 ? (
                <Alert severity="info">No hay pagos registrados</Alert>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Fecha</TableCell>
                        <TableCell align="right">Monto</TableCell>
                        <TableCell>Método</TableCell>
                        <TableCell>Referencia</TableCell>
                        <TableCell>Usuario</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(cuentaSeleccionada.pagos || []).map((pago) => (
                        <TableRow key={pago.id}>
                          <TableCell>
                            {format(new Date(pago.fecha_pago), 'dd/MM/yyyy HH:mm')}
                          </TableCell>
                          <TableCell align="right">
                            <Typography color="success.main" fontWeight="bold">
                              Q{parseFloat(pago.monto).toFixed(2)}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ textTransform: 'capitalize' }}>
                            {pago.metodo_pago}
                          </TableCell>
                          <TableCell>{pago.referencia || '-'}</TableCell>
                          <TableCell>{pago.usuario_nombre || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </DialogContent>
            <DialogActions>
              {cuentaSeleccionada.cuenta.saldo_pendiente > 0 && (
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<PaymentIcon />}
                  onClick={() => {
                    setOpenDetalle(false);
                    handleAbrirPago(cuentaSeleccionada.cuenta);
                  }}
                >
                  Registrar Pago
                </Button>
              )}
              <Button onClick={() => setOpenDetalle(false)}>Cerrar</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Diálogo: Registrar Pago */}
      <Dialog open={openPago} onClose={handleClosePago} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: 'success.main', color: 'white' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PaymentIcon />
            <Typography variant="h6">Registrar Pago</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {cuentaSeleccionada && (
            <Box sx={{ mt: 2 }}>
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>Folio:</strong> {cuentaSeleccionada.cuenta.folio}
                </Typography>
                <Typography variant="body2">
                  <strong>Proveedor:</strong> {cuentaSeleccionada.cuenta.proveedor_nombre}
                </Typography>
                <Typography variant="body2">
                  <strong>Saldo Pendiente:</strong> Q{parseFloat(cuentaSeleccionada.cuenta.saldo_pendiente).toFixed(2)}
                </Typography>
              </Alert>

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Monto del Pago"
                    type="number"
                    value={montoPago}
                    onChange={(e) => setMontoPago(e.target.value)}
                    required
                    inputProps={{
                      min: 0.01,
                      max: parseFloat(cuentaSeleccionada.cuenta.saldo_pendiente),
                      step: 0.01
                    }}
                    helperText={`Máximo: Q${parseFloat(cuentaSeleccionada.cuenta.saldo_pendiente).toFixed(2)}`}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    select
                    fullWidth
                    label="Método de Pago"
                    value={metodoPago}
                    onChange={(e) => setMetodoPago(e.target.value)}
                    required
                  >
                    <MenuItem value="efectivo">Efectivo</MenuItem>
                    <MenuItem value="transferencia">Transferencia</MenuItem>
                    <MenuItem value="cheque">Cheque</MenuItem>
                    <MenuItem value="tarjeta">Tarjeta</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Referencia / No. Transacción"
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value)}
                    placeholder="Ej: Transferencia #123456"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Notas"
                    multiline
                    rows={2}
                    value={notasPago}
                    onChange={(e) => setNotasPago(e.target.value)}
                    placeholder="Información adicional..."
                  />
                </Grid>
              </Grid>

              {parseFloat(montoPago) === parseFloat(cuentaSeleccionada.cuenta.saldo_pendiente) && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  ✓ Este pago liquidará completamente la cuenta
                </Alert>
              )}

              {parseFloat(montoPago) < parseFloat(cuentaSeleccionada.cuenta.saldo_pendiente) && montoPago > 0 && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  Pago parcial - Saldo restante: Q{(parseFloat(cuentaSeleccionada.cuenta.saldo_pendiente) - parseFloat(montoPago)).toFixed(2)}
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePago}>Cancelar</Button>
          <Button
            onClick={handleRegistrarPago}
            variant="contained"
            color="success"
            startIcon={<CheckCircleIcon />}
          >
            Confirmar Pago
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CuentasPorPagar;
