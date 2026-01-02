// src/pages/GastosFijos.js
import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Box, Card, CardContent, Typography, Button, TextField, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton, Grid, Alert,
  Chip, Dialog, DialogTitle, DialogContent, DialogActions, Tabs, Tab,
  Select, MenuItem, FormControl, InputLabel, Autocomplete,
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  MonetizationOn as MoneyIcon, Refresh as RefreshIcon,
  CheckCircle as CheckIcon, Warning as WarningIcon,
  Receipt as ReceiptIcon,
} from '@mui/icons-material';
import { format, addMonths } from 'date-fns';

const GastosFijos = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [tabActual, setTabActual] = useState(0); // 0=Gastos Fijos, 1=Pagos
  
  // Estados para gastos fijos
  const [gastos, setGastos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [openDialogGasto, setOpenDialogGasto] = useState(false);
  const [gastoSeleccionado, setGastoSeleccionado] = useState(null);
  
  // Estados para pagos
  const [pagos, setPagos] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState('pendiente');
  const [openDialogPago, setOpenDialogPago] = useState(false);
  const [pagoSeleccionado, setPagoSeleccionado] = useState(null);
  
  // Estados del formulario de gasto
  const [formGasto, setFormGasto] = useState({
    nombre: '',
    categoria_id: '',
    monto: '',
    frecuencia: 'mensual',
    dia_vencimiento: '',
    proveedor: '',
    numero_cuenta: '',
    notas: '',
    dias_recordatorio: 3
  });
  
  // Estados del formulario de pago
  const [formPago, setFormPago] = useState({
    fecha_pago: format(new Date(), 'yyyy-MM-dd'),
    monto_pagado: '',
    metodo_pago: 'efectivo',
    referencia: '',
    notas: ''
  });

  useEffect(() => {
    cargarDatos();
  }, [tabActual, filtroEstado]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      
      if (tabActual === 0) {
        const [gastosRes, categoriasRes] = await Promise.all([
          api.get('/api/gastos-fijos?activo=true'),
          api.get('/api/gastos-fijos/categorias'),
        ]);
        setGastos(gastosRes.data.gastos);
        setCategorias(categoriasRes.data.categorias);
      } else {
        const mesActual = new Date().getMonth() + 1;
        const anioActual = new Date().getFullYear();
        
        const pagosRes = await api.get('/api/gastos-fijos/pagos', {
          params: { estado: filtroEstado === 'todos' ? null : filtroEstado, mes: mesActual, anio: anioActual }
        });
        setPagos(pagosRes.data.pagos);
      }
    } catch (err) {
      setError('Error al cargar datos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // FUNCIONES DE GASTOS FIJOS
  // ============================================

  const handleOpenDialogGasto = (gasto = null) => {
    if (gasto) {
      setGastoSeleccionado(gasto);
      setFormGasto({
        nombre: gasto.nombre,
        categoria_id: gasto.categoria_id,
        monto: gasto.monto,
        frecuencia: gasto.frecuencia,
        dia_vencimiento: gasto.dia_vencimiento,
        proveedor: gasto.proveedor || '',
        numero_cuenta: gasto.numero_cuenta || '',
        notas: gasto.notas || '',
        dias_recordatorio: gasto.dias_recordatorio
      });
    } else {
      setGastoSeleccionado(null);
      setFormGasto({
        nombre: '',
        categoria_id: '',
        monto: '',
        frecuencia: 'mensual',
        dia_vencimiento: '',
        proveedor: '',
        numero_cuenta: '',
        notas: '',
        dias_recordatorio: 3
      });
    }
    setOpenDialogGasto(true);
  };

  const handleGuardarGasto = async () => {
    try {
      if (!formGasto.nombre || !formGasto.monto || !formGasto.dia_vencimiento) {
        setError('Completa los campos obligatorios');
        return;
      }

      if (gastoSeleccionado) {
        await api.put(`/api/gastos-fijos/${gastoSeleccionado.id}`, formGasto);
        setSuccess('Gasto actualizado exitosamente');
      } else {
        await api.post('/api/gastos-fijos', formGasto);
        setSuccess('Gasto creado exitosamente');
      }

      setOpenDialogGasto(false);
      cargarDatos();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar gasto');
    }
  };

  const handleEliminarGasto = async (id) => {
    if (window.confirm('¿Estás seguro de eliminar este gasto fijo?')) {
      try {
        await api.delete(`/api/gastos-fijos/${id}`);
        setSuccess('Gasto eliminado exitosamente');
        cargarDatos();
      } catch (err) {
        setError('Error al eliminar gasto');
      }
    }
  };

  // ============================================
  // FUNCIONES DE PAGOS
  // ============================================

  const handleOpenDialogPago = (pago) => {
    setPagoSeleccionado(pago);
    setFormPago({
      fecha_pago: format(new Date(), 'yyyy-MM-dd'),
      monto_pagado: pago.monto_pagado || '',
      metodo_pago: 'efectivo',
      referencia: '',
      notas: ''
    });
    setOpenDialogPago(true);
  };

  const handleRegistrarPago = async () => {
    try {
      if (!formPago.monto_pagado) {
        setError('Ingresa el monto pagado');
        return;
      }

      await api.post(`/api/gastos-fijos/pagos/${pagoSeleccionado.id}/pagar`, formPago);
      setSuccess('Pago registrado exitosamente');
      setOpenDialogPago(false);
      cargarDatos();
    } catch (err) {
      setError('Error al registrar pago');
    }
  };

  const getColorEstado = (estadoAlerta) => {
    switch (estadoAlerta) {
      case 'pagado': return 'success';
      case 'vencido': return 'error';
      case 'por_vencer': return 'warning';
      default: return 'default';
    }
  };

  const getTextoEstado = (estadoAlerta, diasRestantes) => {
    switch (estadoAlerta) {
      case 'pagado': return 'Pagado';
      case 'vencido': return `Vencido (${Math.abs(diasRestantes)} días)`;
      case 'por_vencer': return `Por vencer (${diasRestantes} días)`;
      default: return 'Pendiente';
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            💰 Gastos Fijos
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gestiona tus gastos recurrentes y pagos
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
          {tabActual === 0 && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialogGasto()}
            >
              Nuevo Gasto Fijo
            </Button>
          )}
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

      <Card>
        <Tabs value={tabActual} onChange={(e, v) => setTabActual(v)}>
          <Tab label="Gastos Fijos" />
          <Tab label="Pagos del Mes" />
        </Tabs>

        <CardContent>
          {/* TAB 0: GASTOS FIJOS */}
          {tabActual === 0 && (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Nombre</TableCell>
                    <TableCell>Categoría</TableCell>
                    <TableCell>Monto</TableCell>
                    <TableCell>Frecuencia</TableCell>
                    <TableCell>Día Vencimiento</TableCell>
                    <TableCell>Proveedor</TableCell>
                    <TableCell align="center">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {gastos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        <Typography color="text.secondary">No hay gastos fijos registrados</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    gastos.map((gasto) => (
                      <TableRow key={gasto.id}>
                        <TableCell>{gasto.nombre}</TableCell>
                        <TableCell>
                          <Chip 
                            label={gasto.categoria_nombre || 'Sin categoría'} 
                            size="small"
                            color={gasto.color || 'default'}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography fontWeight="bold">Q{parseFloat(gasto.monto).toFixed(2)}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={gasto.frecuencia} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>Día {gasto.dia_vencimiento}</TableCell>
                        <TableCell>{gasto.proveedor || '-'}</TableCell>
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleOpenDialogGasto(gasto)}
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleEliminarGasto(gasto.id)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* TAB 1: PAGOS */}
          {tabActual === 1 && (
            <>
              <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>Filtrar por Estado</InputLabel>
                  <Select
                    value={filtroEstado}
                    label="Filtrar por Estado"
                    onChange={(e) => setFiltroEstado(e.target.value)}
                  >
                    <MenuItem value="todos">Todos</MenuItem>
                    <MenuItem value="pendiente">Pendiente</MenuItem>
                    <MenuItem value="pagado">Pagado</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Gasto</TableCell>
                      <TableCell>Fecha Vencimiento</TableCell>
                      <TableCell>Monto</TableCell>
                      <TableCell>Proveedor</TableCell>
                      <TableCell>Estado</TableCell>
                      <TableCell align="center">Acciones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pagos.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          <Typography color="text.secondary">No hay pagos para mostrar</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      pagos.map((pago) => (
                        <TableRow key={pago.id}>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Chip 
                                label={pago.categoria_nombre} 
                                size="small"
                                sx={{ bgcolor: pago.color }}
                              />
                              <Typography>{pago.gasto_nombre}</Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            {format(new Date(pago.fecha_vencimiento), 'dd/MM/yyyy')}
                          </TableCell>
                          <TableCell>
                            <Typography fontWeight="bold">
                              Q{parseFloat(pago.monto_pagado || 0).toFixed(2)}
                            </Typography>
                          </TableCell>
                          <TableCell>{pago.proveedor || '-'}</TableCell>
                          <TableCell>
                            <Chip
                              label={getTextoEstado(pago.estado_alerta, pago.dias_restantes)}
                              size="small"
                              color={getColorEstado(pago.estado_alerta)}
                              icon={pago.estado_alerta === 'vencido' ? <WarningIcon /> : undefined}
                            />
                          </TableCell>
                          <TableCell align="center">
                            {pago.estado === 'pendiente' && (
                              <Button
                                size="small"
                                variant="contained"
                                color="success"
                                startIcon={<CheckIcon />}
                                onClick={() => handleOpenDialogPago(pago)}
                              >
                                Pagar
                              </Button>
                            )}
                            {pago.estado === 'pagado' && (
                              <Chip label="✓ Pagado" size="small" color="success" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </CardContent>
      </Card>

      {/* DIÁLOGO: CREAR/EDITAR GASTO FIJO */}
      <Dialog open={openDialogGasto} onClose={() => setOpenDialogGasto(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {gastoSeleccionado ? 'Editar Gasto Fijo' : 'Nuevo Gasto Fijo'}
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Nombre del Gasto"
                value={formGasto.nombre}
                onChange={(e) => setFormGasto({ ...formGasto, nombre: e.target.value })}
                required
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Categoría</InputLabel>
                <Select
                  value={formGasto.categoria_id}
                  label="Categoría"
                  onChange={(e) => setFormGasto({ ...formGasto, categoria_id: e.target.value })}
                >
                  {categorias.map((cat) => (
                    <MenuItem key={cat.id} value={cat.id}>{cat.nombre}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Monto"
                type="number"
                value={formGasto.monto}
                onChange={(e) => setFormGasto({ ...formGasto, monto: e.target.value })}
                required
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <FormControl fullWidth required>
                <InputLabel>Frecuencia</InputLabel>
                <Select
                  value={formGasto.frecuencia}
                  label="Frecuencia"
                  onChange={(e) => setFormGasto({ ...formGasto, frecuencia: e.target.value })}
                >
                  <MenuItem value="mensual">Mensual</MenuItem>
                  <MenuItem value="bimensual">Bimensual</MenuItem>
                  <MenuItem value="trimestral">Trimestral</MenuItem>
                  <MenuItem value="semestral">Semestral</MenuItem>
                  <MenuItem value="anual">Anual</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Día de Vencimiento"
                type="number"
                value={formGasto.dia_vencimiento}
                onChange={(e) => setFormGasto({ ...formGasto, dia_vencimiento: e.target.value })}
                required
                inputProps={{ min: 1, max: 31 }}
                helperText="1-31"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Proveedor/Empresa"
                value={formGasto.proveedor}
                onChange={(e) => setFormGasto({ ...formGasto, proveedor: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Número de Cuenta/Referencia"
                value={formGasto.numero_cuenta}
                onChange={(e) => setFormGasto({ ...formGasto, numero_cuenta: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Días de Recordatorio"
                type="number"
                value={formGasto.dias_recordatorio}
                onChange={(e) => setFormGasto({ ...formGasto, dias_recordatorio: e.target.value })}
                inputProps={{ min: 1, max: 30 }}
                helperText="Días antes para notificar"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notas"
                multiline
                rows={2}
                value={formGasto.notas}
                onChange={(e) => setFormGasto({ ...formGasto, notas: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialogGasto(false)}>Cancelar</Button>
          <Button onClick={handleGuardarGasto} variant="contained">
            {gastoSeleccionado ? 'Actualizar' : 'Crear'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIÁLOGO: REGISTRAR PAGO */}
      <Dialog open={openDialogPago} onClose={() => setOpenDialogPago(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: 'success.main', color: 'white' }}>
          💳 Registrar Pago
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {pagoSeleccionado && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Alert severity="info">
                  <Typography variant="body2">
                    <strong>Gasto:</strong> {pagoSeleccionado.gasto_nombre}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Vencimiento:</strong> {format(new Date(pagoSeleccionado.fecha_vencimiento), 'dd/MM/yyyy')}
                  </Typography>
                </Alert>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Fecha de Pago"
                  type="date"
                  value={formPago.fecha_pago}
                  onChange={(e) => setFormPago({ ...formPago, fecha_pago: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Monto Pagado"
                  type="number"
                  value={formPago.monto_pagado}
                  onChange={(e) => setFormPago({ ...formPago, monto_pagado: e.target.value })}
                  required
                  inputProps={{ min: 0, step: 0.01 }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Método de Pago</InputLabel>
                  <Select
                    value={formPago.metodo_pago}
                    label="Método de Pago"
                    onChange={(e) => setFormPago({ ...formPago, metodo_pago: e.target.value })}
                  >
                    <MenuItem value="efectivo">Efectivo</MenuItem>
                    <MenuItem value="transferencia">Transferencia</MenuItem>
                    <MenuItem value="cheque">Cheque</MenuItem>
                    <MenuItem value="tarjeta">Tarjeta</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Referencia/No. Transacción"
                  value={formPago.referencia}
                  onChange={(e) => setFormPago({ ...formPago, referencia: e.target.value })}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Notas"
                  multiline
                  rows={2}
                  value={formPago.notas}
                  onChange={(e) => setFormPago({ ...formPago, notas: e.target.value })}
                />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialogPago(false)}>Cancelar</Button>
          <Button onClick={handleRegistrarPago} variant="contained" color="success">
            Registrar Pago
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GastosFijos;
