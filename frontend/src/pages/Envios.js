// src/pages/Envios.js
import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Box, Card, CardContent, Typography, Button, Grid, Alert, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Stepper, Step, StepLabel, Tabs, Tab, Avatar,
  Select, MenuItem, FormControl, InputLabel, Paper,
  InputAdornment, TablePagination, CircularProgress,
} from '@mui/material';
import {
  LocalShipping as ShippingIcon, CheckCircle as CheckIcon,
  Cancel as CancelIcon, Refresh as RefreshIcon, Info as InfoIcon,
  Phone as PhoneIcon, Place as PlaceIcon, AccessTime as TimeIcon,
  Person as PersonIcon, Receipt as ReceiptIcon, Search as SearchIcon,
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
  
  // Paginación
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [totalEnvios, setTotalEnvios] = useState(0);
  
  // Búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  
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
  }, [filtroEstado, page, rowsPerPage, searchTerm]);

  const cargarEnvios = async () => {
    try {
      setLoading(true);
      const params = {
        page: page + 1,
        limit: rowsPerPage
      };
      
      if (filtroEstado !== 'todos') {
        params.estado = filtroEstado;
      }
      
      if (searchTerm.trim()) {
        params.buscar = searchTerm.trim();
      }
      
      const response = await api.get('/api/envios', { params });
      setEnvios(response.data.envios || []);
      setTotalEnvios(response.data.total || 0);
    } catch (err) {
      setError('Error al cargar envíos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Paginación
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setPage(0);
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

  const handleConfirmarEntrega = async () => {
    try {
      await api.put(`/api/envios/${envioParaEntregar}/entregar`, datosEntrega);
      setSuccess('Entrega registrada exitosamente');
      setOpenDialogEntrega(false);
      cargarEnvios();
    } catch (err) {
      setError('Error al registrar entrega');
    }
  };

  const getColorEstado = (estado) => {
    const colores = {
      pendiente: 'default',
      asignado: 'info',
      preparando: 'info',
      cargado: 'primary',
      en_ruta: 'warning',
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

  const filtrarPorTab = (envio) => {
    if (tabActual === 0) return true; // Todos
    if (tabActual === 1) return ['pendiente', 'asignado'].includes(envio.estado);
    if (tabActual === 2) return ['preparando', 'cargado', 'en_ruta'].includes(envio.estado);
    if (tabActual === 3) return envio.estado === 'entregado';
    return true;
  };

  const enviosFiltrados = envios.filter(filtrarPorTab);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            🚚 Envíos
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gestión de entregas y seguimiento
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

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      <Card>
        <Tabs value={tabActual} onChange={(e, v) => setTabActual(v)}>
          <Tab label="📋 Todos" />
          <Tab label="⏳ Pendientes" />
          <Tab label="🚀 En Proceso" />
          <Tab label="✅ Entregados" />
        </Tabs>

        <CardContent>
          {/* Filtros */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Buscar por folio, cliente, teléfono, dirección..."
                value={searchTerm}
                onChange={handleSearchChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Estado</InputLabel>
                <Select
                  value={filtroEstado}
                  label="Estado"
                  onChange={(e) => {
                    setFiltroEstado(e.target.value);
                    setPage(0);
                  }}
                >
                  <MenuItem value="todos">Todos</MenuItem>
                  <MenuItem value="pendiente">Pendiente</MenuItem>
                  <MenuItem value="asignado">Asignado</MenuItem>
                  <MenuItem value="preparando">Preparando</MenuItem>
                  <MenuItem value="cargado">Cargado</MenuItem>
                  <MenuItem value="en_ruta">En Ruta</MenuItem>
                  <MenuItem value="entregado">Entregado</MenuItem>
                  <MenuItem value="cancelado">Cancelado</MenuItem>
                  <MenuItem value="fallido">Fallido</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                {totalEnvios} envío{totalEnvios !== 1 ? 's' : ''} encontrado{totalEnvios !== 1 ? 's' : ''}
              </Typography>
            </Grid>
          </Grid>

          {/* Tabla de Envíos */}
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Folio</TableCell>
                  <TableCell>Cliente</TableCell>
                  <TableCell>Dirección</TableCell>
                  <TableCell>Piloto</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell>Fecha Pedido</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell align="center">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <CircularProgress size={30} sx={{ my: 2 }} />
                    </TableCell>
                  </TableRow>
                ) : enviosFiltrados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                        No hay envíos para mostrar
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  enviosFiltrados.map((envio) => (
                    <TableRow key={envio.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {envio.venta_folio}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2">{envio.cliente_nombre || 'Sin nombre'}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {envio.cliente_telefono}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {envio.direccion_entrega}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {envio.piloto_nombre || 'Sin asignar'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getTextoEstado(envio.estado)}
                          size="small"
                          color={getColorEstado(envio.estado)}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {format(new Date(envio.fecha_pedido), 'dd/MM/yyyy HH:mm')}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="medium">
                          Q{parseFloat(envio.venta_total).toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleVerDetalle(envio.id)}
                        >
                          <InfoIcon />
                        </IconButton>
                        {esPiloto && envio.estado === 'en_ruta' && (
                          <IconButton
                            size="small"
                            color="success"
                            onClick={() => handleMarcarEntregado(envio.id)}
                          >
                            <CheckIcon />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Paginación */}
          {!loading && (
            <TablePagination
              component="div"
              count={totalEnvios}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[10, 25, 50, 100]}
              labelRowsPerPage="Envíos por página:"
              labelDisplayedRows={({ from, to, count }) => 
                `${from}-${to} de ${count !== -1 ? count : `más de ${to}`}`
              }
            />
          )}
        </CardContent>
      </Card>

      {/* DIÁLOGO: DETALLE DEL ENVÍO */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        {envioSeleccionado && (
          <>
            <DialogTitle>
              Detalle del Envío - {envioSeleccionado.envio.venta_folio}
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                {/* Información del Cliente */}
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    👤 Cliente
                  </Typography>
                  <Typography variant="body2">
                    <strong>Nombre:</strong> {envioSeleccionado.envio.cliente_nombre}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Teléfono:</strong> {envioSeleccionado.envio.cliente_telefono}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Dirección:</strong> {envioSeleccionado.envio.direccion_entrega}
                  </Typography>
                  {envioSeleccionado.envio.referencia_direccion && (
                    <Typography variant="body2">
                      <strong>Referencia:</strong> {envioSeleccionado.envio.referencia_direccion}
                    </Typography>
                  )}
                </Grid>

                {/* Información del Piloto */}
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    🚗 Piloto
                  </Typography>
                  <Typography variant="body2">
                    <strong>Nombre:</strong> {envioSeleccionado.envio.piloto_nombre || 'Sin asignar'}
                  </Typography>
                  {envioSeleccionado.envio.piloto_telefono && (
                    <Typography variant="body2">
                      <strong>Teléfono:</strong> {envioSeleccionado.envio.piloto_telefono}
                    </Typography>
                  )}
                </Grid>

                {/* Estado Actual */}
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    📊 Estado
                  </Typography>
                  <Chip
                    label={getTextoEstado(envioSeleccionado.envio.estado)}
                    color={getColorEstado(envioSeleccionado.envio.estado)}
                    sx={{ mb: 2 }}
                  />
                </Grid>

                {/* Productos */}
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    📦 Productos
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Producto</TableCell>
                          <TableCell align="right">Cantidad</TableCell>
                          <TableCell align="right">Precio</TableCell>
                          <TableCell align="right">Total</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {envioSeleccionado.productos.map((prod) => (
                          <TableRow key={prod.id}>
                            <TableCell>{prod.producto_nombre}</TableCell>
                            <TableCell align="right">{prod.cantidad}</TableCell>
                            <TableCell align="right">Q{parseFloat(prod.precio_unitario).toFixed(2)}</TableCell>
                            <TableCell align="right">Q{parseFloat(prod.subtotal).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>

                {/* Acciones rápidas para piloto */}
                {esPiloto && envioSeleccionado.envio.estado !== 'entregado' && (
                  <Grid item xs={12}>
                    <Typography variant="h6" gutterBottom>
                      ⚡ Acciones Rápidas
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {envioSeleccionado.envio.estado === 'asignado' && (
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => handleCambiarEstado(envioSeleccionado.envio.id, 'preparando')}
                        >
                          Iniciar Preparación
                        </Button>
                      )}
                      {envioSeleccionado.envio.estado === 'preparando' && (
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => handleCambiarEstado(envioSeleccionado.envio.id, 'cargado')}
                        >
                          Marcar Cargado
                        </Button>
                      )}
                      {envioSeleccionado.envio.estado === 'cargado' && (
                        <Button
                          size="small"
                          variant="contained"
                          color="warning"
                          onClick={() => handleCambiarEstado(envioSeleccionado.envio.id, 'en_ruta')}
                        >
                          Salir a Ruta
                        </Button>
                      )}
                      {envioSeleccionado.envio.estado === 'en_ruta' && (
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          onClick={() => handleMarcarEntregado(envioSeleccionado.envio.id)}
                        >
                          Marcar Entregado
                        </Button>
                      )}
                    </Box>
                  </Grid>
                )}
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpenDialog(false)}>Cerrar</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* DIÁLOGO: CONFIRMAR ENTREGA */}
      <Dialog open={openDialogEntrega} onClose={() => setOpenDialogEntrega(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: 'success.main', color: 'white' }}>
          ✅ Confirmar Entrega
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Nombre del que recibe (opcional)"
                value={datosEntrega.firma_cliente}
                onChange={(e) => setDatosEntrega({ ...datosEntrega, firma_cliente: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Notas del piloto (opcional)"
                value={datosEntrega.notas_piloto}
                onChange={(e) => setDatosEntrega({ ...datosEntrega, notas_piloto: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialogEntrega(false)}>Cancelar</Button>
          <Button onClick={handleConfirmarEntrega} variant="contained" color="success">
            Confirmar Entrega
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Envios;