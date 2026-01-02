// src/pages/Envios.js
import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Box, Card, CardContent, Typography, Button, Grid, Alert, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Stepper, Step, StepLabel, Tabs, Tab, Avatar,
  Select, MenuItem, FormControl, InputLabel, Paper,
  InputAdornment,
} from '@mui/material';
import {
  LocalShipping as ShippingIcon, CheckCircle as CheckIcon,
  Cancel as CancelIcon, Refresh as RefreshIcon, Info as InfoIcon,
  Phone as PhoneIcon, Place as PlaceIcon, AccessTime as TimeIcon,
  Person as PersonIcon, Receipt as ReceiptIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';

const Envios = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [envios, setEnvios] = useState([]);
  const [envioSeleccionado, setEnvioSeleccionado] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [tabActual, setTabActual] = useState(0);
  const [filtroEstado, setFiltroEstado] = useState('todos');
  
  // Estados para confirmar entrega
  const [openDialogEntrega, setOpenDialogEntrega] = useState(false);
  const [envioParaEntregar, setEnvioParaEntregar] = useState(null);
  const [datosEntrega, setDatosEntrega] = useState({
    firma_cliente: '',
    notas_piloto: ''
  });
  
  const usuario = JSON.parse(localStorage.getItem('usuario'));
  const esPiloto = usuario?.rol === 'Piloto';
  const esGerente = usuario?.rol === 'Administrador' || usuario?.rol === 'Gerente';

  useEffect(() => {
    cargarEnvios();
    
    // Auto-refresh cada 30 segundos
    const interval = setInterval(cargarEnvios, 30000);
    return () => clearInterval(interval);
  }, [filtroEstado]);

  const cargarEnvios = async () => {
    try {
      setLoading(true);
      const params = {};
      
      if (filtroEstado !== 'todos') {
        params.estado = filtroEstado;
      }
      
      const response = await api.get('/api/envios', { params });
      setEnvios(response.data.envios);
    } catch (err) {
      setError('Error al cargar envíos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerDetalle = async (envioId) => {
    try {
      const response = await api.get(`/api/envios/${envioId}`);
      setEnvioSeleccionado(response.data);
      setOpenDialog(true);
    } catch (err) {
      setError('Error al cargar detalle');
    }
  };

  const handleCambiarEstado = async (envioId, nuevoEstado) => {
    try {
      await api.put(`/api/envios/${envioId}/estado`, {
        estado: nuevoEstado
      });
      
      setSuccess(`Estado cambiado a: ${nuevoEstado}`);
      cargarEnvios();
      setOpenDialog(false);
    } catch (err) {
      setError('Error al cambiar estado');
    }
  };

  const handleMarcarEntregado = async (envioId) => {
    setEnvioParaEntregar(envioId);
    setDatosEntrega({
      firma_cliente: '',
      notas_piloto: ''
    });
    setOpenDialogEntrega(true);
  };

  const confirmarEntrega = async () => {
    try {
      if (!datosEntrega.firma_cliente.trim()) {
        setError('Ingresa el nombre de quien recibe');
        return;
      }

      await api.put(`/api/envios/${envioParaEntregar}/entregar`, datosEntrega);
      
      setSuccess('¡Envío marcado como entregado!');
      setOpenDialogEntrega(false);
      cargarEnvios();
      setOpenDialog(false);
    } catch (err) {
      setError('Error al marcar como entregado');
    }
  };

  const getColorEstado = (estado) => {
    const colores = {
      pendiente: 'default',
      asignado: 'info',
      preparando: 'warning',
      cargado: 'primary',
      en_ruta: 'secondary',
      entregado: 'success',
      cancelado: 'error',
      fallido: 'error'
    };
    return colores[estado] || 'default';
  };

  const getTextoEstado = (estado) => {
    const textos = {
      pendiente: 'Pendiente',
      asignado: 'Asignado',
      preparando: 'Preparando',
      cargado: 'Cargado',
      en_ruta: 'En Ruta',
      entregado: 'Entregado',
      cancelado: 'Cancelado',
      fallido: 'Fallido'
    };
    return textos[estado] || estado;
  };

  const getStepActual = (estado) => {
    const steps = {
      pendiente: 0,
      asignado: 0,
      preparando: 1,
      cargado: 2,
      en_ruta: 3,
      entregado: 4
    };
    return steps[estado] || 0;
  };

  const getBotonesAccion = (envio) => {
    // Admin y Gerente pueden cambiar cualquier estado
    // Piloto solo puede cambiar sus propios envíos
    if (!esPiloto && !esGerente) return null;
    
    if (esPiloto && envio.piloto_id !== usuario.id) {
      return null; // Piloto solo ve sus envíos
    }

    const botones = {
      asignado: (
        <Button
          size="small"
          variant="contained"
          color="warning"
          onClick={() => handleCambiarEstado(envio.id, 'preparando')}
        >
          Preparar Pedido
        </Button>
      ),
      preparando: (
        <Button
          size="small"
          variant="contained"
          color="primary"
          onClick={() => handleCambiarEstado(envio.id, 'cargado')}
        >
          Marcar Cargado
        </Button>
      ),
      cargado: (
        <Button
          size="small"
          variant="contained"
          color="secondary"
          onClick={() => handleCambiarEstado(envio.id, 'en_ruta')}
        >
          Iniciar Ruta
        </Button>
      ),
      en_ruta: (
        <Button
          size="small"
          variant="contained"
          color="success"
          startIcon={<CheckIcon />}
          onClick={() => handleMarcarEntregado(envio.id)}
        >
          Entregar
        </Button>
      )
    };

    return botones[envio.estado] || null;
  };

  // Filtrar envíos por tab
  const enviosFiltrados = envios.filter(envio => {
    if (tabActual === 0) {
      // Activos
      return ['asignado', 'preparando', 'cargado', 'en_ruta'].includes(envio.estado);
    } else if (tabActual === 1) {
      // Completados
      return envio.estado === 'entregado';
    } else {
      // Todos
      return true;
    }
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            🚚 {esPiloto ? 'Mis Envíos' : 'Gestión de Envíos'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {esPiloto ? 'Gestiona tus entregas asignadas' : 'Monitorea todos los envíos en tiempo real'}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={cargarEnvios}
        >
          Actualizar
        </Button>
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
          <Tab label={`Activos (${envios.filter(e => ['asignado', 'preparando', 'cargado', 'en_ruta'].includes(e.estado)).length})`} />
          <Tab label={`Completados (${envios.filter(e => e.estado === 'entregado').length})`} />
          <Tab label="Todos" />
        </Tabs>

        <CardContent>
          {esGerente && (
            <Box sx={{ mb: 2 }}>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Filtrar por Estado</InputLabel>
                <Select
                  value={filtroEstado}
                  label="Filtrar por Estado"
                  onChange={(e) => setFiltroEstado(e.target.value)}
                >
                  <MenuItem value="todos">Todos</MenuItem>
                  <MenuItem value="pendiente">Pendiente</MenuItem>
                  <MenuItem value="asignado">Asignado</MenuItem>
                  <MenuItem value="preparando">Preparando</MenuItem>
                  <MenuItem value="cargado">Cargado</MenuItem>
                  <MenuItem value="en_ruta">En Ruta</MenuItem>
                  <MenuItem value="entregado">Entregado</MenuItem>
                </Select>
              </FormControl>
            </Box>
          )}

          {enviosFiltrados.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 5 }}>
              <ShippingIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                No hay envíos para mostrar
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Folio Venta</TableCell>
                    <TableCell>Cliente</TableCell>
                    <TableCell>Dirección</TableCell>
                    {esGerente && <TableCell>Piloto</TableCell>}
                    <TableCell>Estado</TableCell>
                    <TableCell>Fecha</TableCell>
                    <TableCell align="center">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {enviosFiltrados.map((envio) => (
                    <TableRow key={envio.id} hover>
                      <TableCell>
                        <Chip label={envio.venta_folio} size="small" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {envio.cliente_nombre || 'Cliente general'}
                        </Typography>
                        {envio.telefono_contacto && (
                          <Typography variant="caption" color="text.secondary">
                            📞 {envio.telefono_contacto}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                          {envio.direccion_entrega}
                        </Typography>
                      </TableCell>
                      {esGerente && (
                        <TableCell>
                          {envio.piloto_nombre || (
                            <Chip label="Sin asignar" size="small" color="warning" />
                          )}
                        </TableCell>
                      )}
                      <TableCell>
                        <Chip
                          label={getTextoEstado(envio.estado)}
                          size="small"
                          color={getColorEstado(envio.estado)}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">
                          {format(new Date(envio.fecha_pedido), 'dd/MM/yyyy HH:mm')}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Button
                          size="small"
                          onClick={() => handleVerDetalle(envio.id)}
                        >
                          Ver Detalle
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Diálogo: Detalle del Envío */}
      <Dialog 
        open={openDialog} 
        onClose={() => setOpenDialog(false)}
        maxWidth="md"
        fullWidth
      >
        {envioSeleccionado && (
          <>
            <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">
                  📦 Envío - {envioSeleccionado.envio.venta_folio}
                </Typography>
                <Chip
                  label={getTextoEstado(envioSeleccionado.envio.estado)}
                  color={getColorEstado(envioSeleccionado.envio.estado)}
                />
              </Box>
            </DialogTitle>
            <DialogContent sx={{ mt: 2 }}>
              <Grid container spacing={3}>
                {/* Progreso del envío */}
                <Grid item xs={12}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      Estado del Envío
                    </Typography>
                    <Stepper activeStep={getStepActual(envioSeleccionado.envio.estado)} alternativeLabel>
                      <Step>
                        <StepLabel>Preparando</StepLabel>
                      </Step>
                      <Step>
                        <StepLabel>Cargado</StepLabel>
                      </Step>
                      <Step>
                        <StepLabel>En Ruta</StepLabel>
                      </Step>
                      <Step>
                        <StepLabel>Entregado</StepLabel>
                      </Step>
                    </Stepper>
                  </Paper>
                </Grid>

                {/* Información del cliente */}
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      <PersonIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Cliente
                    </Typography>
                    <Typography variant="body1">
                      <strong>{envioSeleccionado.envio.cliente_nombre || 'Cliente general'}</strong>
                    </Typography>
                    {envioSeleccionado.envio.telefono_contacto && (
                      <Typography variant="body2" color="text.secondary">
                        📞 {envioSeleccionado.envio.telefono_contacto}
                      </Typography>
                    )}
                    {envioSeleccionado.envio.nombre_contacto && (
                      <Typography variant="body2" color="text.secondary">
                        Contacto: {envioSeleccionado.envio.nombre_contacto}
                      </Typography>
                    )}
                  </Paper>
                </Grid>

                {/* Dirección */}
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      <PlaceIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Dirección
                    </Typography>
                    <Typography variant="body2">
                      {envioSeleccionado.envio.direccion_entrega}
                    </Typography>
                    {envioSeleccionado.envio.referencia_direccion && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                        Ref: {envioSeleccionado.envio.referencia_direccion}
                      </Typography>
                    )}
                  </Paper>
                </Grid>

                {/* Productos */}
                <Grid item xs={12}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      <ReceiptIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Productos
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Producto</TableCell>
                            <TableCell align="center">Cantidad</TableCell>
                            <TableCell align="right">Precio</TableCell>
                            <TableCell align="right">Subtotal</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {envioSeleccionado.productos.map((producto, index) => (
                            <TableRow key={index}>
                              <TableCell>{producto.producto_nombre}</TableCell>
                              <TableCell align="center">{producto.cantidad}</TableCell>
                              <TableCell align="right">Q{parseFloat(producto.precio_unitario).toFixed(2)}</TableCell>
                              <TableCell align="right">Q{parseFloat(producto.subtotal).toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow>
                            <TableCell colSpan={3} align="right"><strong>Total:</strong></TableCell>
                            <TableCell align="right">
                              <strong>Q{parseFloat(envioSeleccionado.envio.venta_total).toFixed(2)}</strong>
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                </Grid>

                {/* Notas */}
                {envioSeleccionado.envio.notas_cliente && (
                  <Grid item xs={12}>
                    <Alert severity="info">
                      <Typography variant="body2">
                        <strong>Notas:</strong> {envioSeleccionado.envio.notas_cliente}
                      </Typography>
                    </Alert>
                  </Grid>
                )}
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpenDialog(false)}>
                Cerrar
              </Button>
              {getBotonesAccion(envioSeleccionado.envio)}
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Diálogo: Confirmar Entrega */}
      <Dialog 
        open={openDialogEntrega} 
        onClose={() => setOpenDialogEntrega(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: 'success.main', color: 'white' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckIcon />
            <Typography variant="h6">
              Confirmar Entrega
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 3 }}>
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              Confirma que el pedido ha sido entregado exitosamente al cliente.
            </Typography>
          </Alert>

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Nombre de quien recibe *"
                value={datosEntrega.firma_cliente}
                onChange={(e) => setDatosEntrega({ 
                  ...datosEntrega, 
                  firma_cliente: e.target.value 
                })}
                placeholder="Ej: Juan Pérez"
                required
                autoFocus
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notas de entrega (opcional)"
                value={datosEntrega.notas_piloto}
                onChange={(e) => setDatosEntrega({ 
                  ...datosEntrega, 
                  notas_piloto: e.target.value 
                })}
                placeholder="Ej: Entregado en recepción"
                multiline
                rows={2}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={() => setOpenDialogEntrega(false)}
            color="inherit"
          >
            Cancelar
          </Button>
          <Button 
            onClick={confirmarEntrega}
            variant="contained"
            color="success"
            startIcon={<CheckIcon />}
          >
            Confirmar Entrega
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Envios;