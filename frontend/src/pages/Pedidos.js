// src/pages/Pedidos.js
import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Box,
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  InputAdornment,
  Alert,
  Chip,
  Autocomplete,
  MenuItem,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  ShoppingCart as ShoppingCartIcon,
  Check as CheckIcon,
  Visibility as VisibilityIcon,
  Warning as WarningIcon,
  Cancel as CancelIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';

const Pedidos = () => {
  const [pedidos, setPedidos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [openDetalle, setOpenDetalle] = useState(false);
  const [pedidoDetalle, setPedidoDetalle] = useState(null);
  const [tabValue, setTabValue] = useState(0);

  // Estado para nuevo pedido
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState(null);
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [carrito, setCarrito] = useState([]);
  const [notas, setNotas] = useState('');
  const [formaPago, setFormaPago] = useState('contado');
  const [diasCredito, setDiasCredito] = useState(30);
  const [openConfirmRecibir, setOpenConfirmRecibir] = useState(false);
  const [openConfirmCancelar, setOpenConfirmCancelar] = useState(false);
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null);
  
  // Estados para recepción con ajustes
  const [openDialogRecepcion, setOpenDialogRecepcion] = useState(false);
  const [pedidoParaRecibir, setPedidoParaRecibir] = useState(null);
  const [productosRecepcion, setProductosRecepcion] = useState([]);
  const [notasRecepcion, setNotasRecepcion] = useState('');

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const [pedidosRes, proveedoresRes, productosRes] = await Promise.all([
        api.get('/api/pedidos'),
        api.get('/api/proveedores'),
        api.get('/api/productos?activo=true'),
      ]);
      setPedidos(pedidosRes.data.pedidos);
      setProveedores(proveedoresRes.data.proveedores);
      setProductos(productosRes.data.productos);
    } catch (err) {
      setError('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = () => {
    setProveedorSeleccionado(null);
    setCarrito([]);
    setNotas('');
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setProveedorSeleccionado(null);
    setProductoSeleccionado(null);
    setCarrito([]);
    setNotas('');
    setFormaPago('contado');
    setDiasCredito(30);
  };

  const agregarProducto = () => {
    if (!productoSeleccionado) return;

    const productoEnCarrito = carrito.find(
      (item) => item.producto_id === productoSeleccionado.id
    );

    if (productoEnCarrito) {
      setCarrito(
        carrito.map((item) =>
          item.producto_id === productoSeleccionado.id
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        )
      );
    } else {
      setCarrito([
        ...carrito,
        {
          producto_id: productoSeleccionado.id,
          nombre: productoSeleccionado.nombre,
          precio_compra: parseFloat(productoSeleccionado.precio_compra),
          cantidad: 1,
        },
      ]);
    }

    setProductoSeleccionado(null);
  };

  const modificarCantidad = (productoId, cantidad) => {
    if (cantidad <= 0) {
      eliminarProducto(productoId);
      return;
    }

    setCarrito(
      carrito.map((item) =>
        item.producto_id === productoId ? { ...item, cantidad } : item
      )
    );
  };

  const eliminarProducto = (productoId) => {
    setCarrito(carrito.filter((item) => item.producto_id !== productoId));
  };

  const calcularTotal = () => {
    return carrito.reduce(
      (sum, item) => sum + item.precio_compra * item.cantidad,
      0
    );
  };

  const handleCrearPedido = async () => {
    try {
      if (!proveedorSeleccionado) {
        setError('Debes seleccionar un proveedor');
        return;
      }

      if (carrito.length === 0) {
        setError('Debes agregar al menos un producto');
        return;
      }

      const pedidoData = {
        proveedor_id: proveedorSeleccionado.id,
        total: calcularTotal(),
        notas: notas,
        forma_pago: formaPago,
        dias_credito: formaPago === 'credito' ? parseInt(diasCredito) : 0,
        productos: carrito.map((item) => ({
          producto_id: item.producto_id,
          cantidad: item.cantidad,
          precio_unitario: item.precio_compra,
        })),
      };

      // DEBUG: Ver qué se está enviando
      console.log('📦 DATOS DEL PEDIDO A ENVIAR:', pedidoData);
      console.log('💳 Forma de pago:', formaPago);
      console.log('📅 Días de crédito:', diasCredito);

      await api.post('/api/pedidos', pedidoData);
      setSuccess('Pedido creado exitosamente');
      handleCloseDialog();
      cargarDatos();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear pedido');
    }
  };

  const handleVerDetalle = async (pedidoId) => {
    try {
      const response = await api.get(`/api/pedidos/${pedidoId}`);
      setPedidoDetalle(response.data);
      setOpenDetalle(true);
    } catch (err) {
      setError('Error al cargar detalle del pedido');
    }
  };

  const handleMarcarRecibido = async (pedido) => {
    try {
      // Cargar detalle del pedido
      const response = await api.get(`/api/pedidos/${pedido.id}`);
      setPedidoParaRecibir(response.data.pedido);
      
      // Inicializar productos con cantidades pedidas por defecto
      const productosIniciales = response.data.productos.map(p => ({
        ...p,
        cantidad_recibida: p.cantidad, // Por defecto, misma cantidad
        motivo: ''
      }));
      setProductosRecepcion(productosIniciales);
      setNotasRecepcion('');
      setOpenDialogRecepcion(true);
    } catch (err) {
      setError('Error al cargar detalle del pedido');
    }
  };

  const confirmarRecepcion = async () => {
    try {
      // Preparar datos para enviar
      const productosParaEnviar = productosRecepcion
        .filter(p => p.cantidad_recibida !== p.cantidad || p.motivo) // Solo enviar los que tienen diferencias o motivo
        .map(p => ({
          producto_id: p.producto_id,
          cantidad_recibida: p.cantidad_recibida,
          motivo: p.motivo || null
        }));

      await api.patch(`/api/pedidos/${pedidoParaRecibir.id}/recibir`, {
        productos_recibidos: productosParaEnviar.length > 0 ? productosParaEnviar : undefined,
        notas_recepcion: notasRecepcion || undefined
      });

      const tieneAjustes = productosRecepcion.some(p => p.cantidad_recibida !== p.cantidad);
      setSuccess(
        tieneAjustes 
          ? 'Pedido recibido con ajustes. Inventario actualizado.' 
          : 'Pedido recibido. Inventario actualizado.'
      );
      setOpenDialogRecepcion(false);
      setOpenDetalle(false);
      cargarDatos();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al recepcionar pedido');
    }
  };

  const actualizarCantidadRecibida = (productoId, nuevaCantidad) => {
    setProductosRecepcion(prev => 
      prev.map(p => 
        p.producto_id === productoId 
          ? { ...p, cantidad_recibida: parseInt(nuevaCantidad) || 0 }
          : p
      )
    );
  };

  const actualizarMotivo = (productoId, motivo) => {
    setProductosRecepcion(prev => 
      prev.map(p => 
        p.producto_id === productoId 
          ? { ...p, motivo }
          : p
      )
    );
  };

  const confirmarMarcarRecibido = async () => {
    try {
      await api.patch(`/api/pedidos/${pedidoSeleccionado.id}/recibir`);
      setSuccess('Pedido marcado como recibido. Inventario actualizado.');
      setOpenConfirmRecibir(false);
      setOpenDetalle(false);
      cargarDatos();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al marcar pedido como recibido');
    }
  };

  const handleCancelar = (pedido) => {
    setPedidoSeleccionado(pedido);
    setOpenConfirmCancelar(true);
  };

  const confirmarCancelar = async () => {
    try {
      await api.patch(`/api/pedidos/${pedidoSeleccionado.id}/cancelar`);
      setSuccess('Pedido cancelado');
      setOpenConfirmCancelar(false);
      setOpenDetalle(false);
      cargarDatos();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cancelar pedido');
    }
  };

  const getEstadoColor = (estado) => {
    switch (estado) {
      case 'pendiente':
        return 'warning';
      case 'recibido':
        return 'success';
      case 'cancelado':
        return 'error';
      default:
        return 'default';
    }
  };

  const pedidosPorEstado = (estado) => {
    return pedidos.filter((p) => p.estado === estado);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Pedidos a Proveedores
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gestión de pedidos de inventario
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenDialog}
        >
          Nuevo Pedido
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

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label={`Pendientes (${pedidosPorEstado('pendiente').length})`} />
          <Tab label={`Recibidos (${pedidosPorEstado('recibido').length})`} />
          <Tab label={`Todos (${pedidos.length})`} />
        </Tabs>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'primary.light' }}>
              <TableCell>Folio</TableCell>
              <TableCell>Fecha</TableCell>
              <TableCell>Proveedor</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell align="center">Estado</TableCell>
              <TableCell align="center">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : (
              (tabValue === 0 ? pedidosPorEstado('pendiente') :
               tabValue === 1 ? pedidosPorEstado('recibido') :
               pedidos).map((pedido) => (
                <TableRow key={pedido.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {pedido.folio}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {format(new Date(pedido.fecha_pedido), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell>{pedido.proveedor_nombre}</TableCell>
                  <TableCell align="right">
                    <Typography fontWeight="bold">
                      Q{parseFloat(pedido.total).toFixed(2)}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={pedido.estado}
                      size="small"
                      color={getEstadoColor(pedido.estado)}
                      sx={{ textTransform: 'capitalize' }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => handleVerDetalle(pedido.id)}
                    >
                      <VisibilityIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Dialog para crear pedido */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>Nuevo Pedido a Proveedor</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <Autocomplete
                options={proveedores.filter((p) => p.activo)}
                getOptionLabel={(option) => option.nombre}
                value={proveedorSeleccionado}
                onChange={(event, newValue) => setProveedorSeleccionado(newValue)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Proveedor"
                    required
                    InputLabelProps={{ shrink: true }}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} md={9}>
              <Autocomplete
                options={productos}
                getOptionLabel={(option) => `${option.nombre} - Q${parseFloat(option.precio_compra).toFixed(2)}`}
                value={productoSeleccionado}
                onChange={(event, newValue) => setProductoSeleccionado(newValue)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Buscar producto..."
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                      ),
                    }}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Button
                fullWidth
                variant="contained"
                onClick={agregarProducto}
                disabled={!productoSeleccionado}
                sx={{ height: '56px' }}
              >
                Agregar
              </Button>
            </Grid>

            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Productos del Pedido
              </Typography>
              {carrito.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 3, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <ShoppingCartIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    Agrega productos al pedido
                  </Typography>
                </Box>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Producto</TableCell>
                        <TableCell align="center">Cantidad</TableCell>
                        <TableCell align="right">Precio</TableCell>
                        <TableCell align="right">Subtotal</TableCell>
                        <TableCell align="center"></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {carrito.map((item) => (
                        <TableRow key={item.producto_id}>
                          <TableCell>{item.nombre}</TableCell>
                          <TableCell align="center">
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                              <IconButton
                                size="small"
                                onClick={() => modificarCantidad(item.producto_id, item.cantidad - 1)}
                              >
                                <RemoveIcon />
                              </IconButton>
                              <TextField
                                type="number"
                                value={item.cantidad}
                                onChange={(e) => {
                                  const nuevaCantidad = parseInt(e.target.value) || 0;
                                  if (nuevaCantidad >= 0) {
                                    modificarCantidad(item.producto_id, nuevaCantidad);
                                  }
                                }}
                                size="small"
                                inputProps={{ 
                                  min: 1,
                                  style: { textAlign: 'center', fontWeight: 'bold' }
                                }}
                                sx={{ 
                                  width: 80,
                                  '& .MuiOutlinedInput-root': {
                                    '& fieldset': {
                                      borderColor: 'primary.main',
                                    },
                                  }
                                }}
                              />
                              <IconButton
                                size="small"
                                onClick={() => modificarCantidad(item.producto_id, item.cantidad + 1)}
                              >
                                <AddIcon />
                              </IconButton>
                            </Box>
                          </TableCell>
                          <TableCell align="right">Q{item.precio_compra.toFixed(2)}</TableCell>
                          <TableCell align="right">
                            Q{(item.precio_compra * item.cantidad).toFixed(2)}
                          </TableCell>
                          <TableCell align="center">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => eliminarProducto(item.producto_id)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Grid>

            {carrito.length > 0 && (
              <Grid item xs={12}>
                <Box sx={{ bgcolor: 'primary.light', p: 2, borderRadius: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="h6">Total del Pedido:</Typography>
                    <Typography variant="h5" color="primary.dark" fontWeight="bold">
                      Q{calcularTotal().toFixed(2)}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            )}

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notas"
                multiline
                rows={3}
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Información adicional sobre el pedido..."
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                select
                fullWidth
                label="Forma de Pago"
                value={formaPago}
                onChange={(e) => setFormaPago(e.target.value)}
                required
                InputLabelProps={{ shrink: true }}
              >
                <MenuItem value="contado">Contado (Pago Inmediato)</MenuItem>
                <MenuItem value="credito">Crédito (Pago Diferido)</MenuItem>
              </TextField>
            </Grid>

            {formaPago === 'credito' && (
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Días de Crédito"
                  type="number"
                  value={diasCredito}
                  onChange={(e) => setDiasCredito(e.target.value)}
                  inputProps={{ min: 1, max: 180 }}
                  required
                  helperText="Plazo para pagar (Ej: 30, 60, 90 días)"
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button
            onClick={handleCrearPedido}
            variant="contained"
            disabled={!proveedorSeleccionado || carrito.length === 0}
          >
            Crear Pedido
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog para ver detalle del pedido */}
      <Dialog open={openDetalle} onClose={() => setOpenDetalle(false)} maxWidth="md" fullWidth>
        {pedidoDetalle && (
          <>
            <DialogTitle>
              Detalle del Pedido {pedidoDetalle.pedido.folio}
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Proveedor:
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {pedidoDetalle.pedido.proveedor_nombre}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Estado:
                  </Typography>
                  <Chip
                    label={pedidoDetalle.pedido.estado}
                    color={getEstadoColor(pedidoDetalle.pedido.estado)}
                    sx={{ textTransform: 'capitalize' }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Fecha de Pedido:
                  </Typography>
                  <Typography variant="body1">
                    {format(new Date(pedidoDetalle.pedido.fecha_pedido), 'dd/MM/yyyy HH:mm')}
                  </Typography>
                </Grid>
                {pedidoDetalle.pedido.fecha_recepcion && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Fecha de Recepción:
                    </Typography>
                    <Typography variant="body1">
                      {format(new Date(pedidoDetalle.pedido.fecha_recepcion), 'dd/MM/yyyy HH:mm')}
                    </Typography>
                  </Grid>
                )}

                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                    Productos
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Producto</TableCell>
                          <TableCell align="right">Cantidad</TableCell>
                          <TableCell align="right">Precio</TableCell>
                          <TableCell align="right">Subtotal</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {pedidoDetalle.productos.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.producto_nombre}</TableCell>
                            <TableCell align="right">{item.cantidad}</TableCell>
                            <TableCell align="right">
                              Q{parseFloat(item.precio_unitario).toFixed(2)}
                            </TableCell>
                            <TableCell align="right">
                              Q{(parseFloat(item.precio_unitario) * item.cantidad).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>

                <Grid item xs={12}>
                  <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="h6">Total:</Typography>
                      <Typography variant="h6" color="primary" fontWeight="bold">
                        Q{parseFloat(pedidoDetalle.pedido.total).toFixed(2)}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>

                {pedidoDetalle.pedido.notas && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Notas:
                    </Typography>
                    <Typography variant="body2">
                      {pedidoDetalle.pedido.notas}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </DialogContent>
            <DialogActions>
              {pedidoDetalle.pedido.estado === 'pendiente' && (
                <>
                  <Button
                    onClick={() => handleCancelar(pedidoDetalle.pedido)}
                    color="error"
                  >
                    Cancelar Pedido
                  </Button>
                  <Button
                    onClick={() => handleMarcarRecibido(pedidoDetalle.pedido)}
                    variant="contained"
                    startIcon={<CheckIcon />}
                  >
                    Marcar como Recibido
                  </Button>
                </>
              )}
              <Button onClick={() => setOpenDetalle(false)}>Cerrar</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Diálogo de Confirmación - Marcar como Recibido */}
      <Dialog open={openConfirmRecibir} onClose={() => setOpenConfirmRecibir(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: 'success.main', color: 'white' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircleIcon />
            <Typography variant="h6">Confirmar Recepción de Pedido</Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            ¿Confirmar que el pedido ha sido recibido?
          </Alert>
          
          {pedidoSeleccionado && (
            <Box>
              <Typography variant="body1" gutterBottom>
                <strong>Folio:</strong> {pedidoSeleccionado.folio}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                <strong>Proveedor:</strong> {pedidoSeleccionado.proveedor_nombre}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Total:</strong> Q{parseFloat(pedidoSeleccionado.total).toFixed(2)}
              </Typography>
            </Box>
          )}

          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2">
              ⚠️ Esta acción actualizará el inventario automáticamente sumando los productos del pedido al stock.
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenConfirmRecibir(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={confirmarMarcarRecibido} 
            variant="contained" 
            color="success"
            startIcon={<CheckCircleIcon />}
          >
            Confirmar Recepción
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo de Confirmación - Cancelar Pedido */}
      <Dialog open={openConfirmCancelar} onClose={() => setOpenConfirmCancelar(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: 'error.main', color: 'white' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WarningIcon />
            <Typography variant="h6">Cancelar Pedido</Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            ¿Estás seguro de cancelar este pedido?
          </Alert>
          
          {pedidoSeleccionado && (
            <Box>
              <Typography variant="body1" gutterBottom>
                <strong>Folio:</strong> {pedidoSeleccionado.folio}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                <strong>Proveedor:</strong> {pedidoSeleccionado.proveedor_nombre}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Total:</strong> Q{parseFloat(pedidoSeleccionado.total).toFixed(2)}
              </Typography>
            </Box>
          )}

          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2">
              ⚠️ Esta acción no se puede deshacer. El pedido quedará marcado como cancelado.
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenConfirmCancelar(false)}>
            No, mantener pedido
          </Button>
          <Button 
            onClick={confirmarCancelar} 
            variant="contained" 
            color="error"
            startIcon={<CancelIcon />}
          >
            Sí, cancelar pedido
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo: Recepción de Pedido con Ajustes */}
      <Dialog 
        open={openDialogRecepcion} 
        onClose={() => setOpenDialogRecepcion(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircleIcon />
            <Typography variant="h6">Recepcionar Pedido</Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {pedidoParaRecibir && (
            <>
              <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="body2">
                  <strong>Pedido:</strong> {pedidoParaRecibir.folio} - {pedidoParaRecibir.proveedor_nombre}
                </Typography>
                <Typography variant="body2">
                  Ajusta las cantidades recibidas si hay diferencias con lo pedido.
                </Typography>
              </Alert>

              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Producto</strong></TableCell>
                      <TableCell align="center"><strong>Pedido</strong></TableCell>
                      <TableCell align="center"><strong>Recibido</strong></TableCell>
                      <TableCell align="center"><strong>Diferencia</strong></TableCell>
                      <TableCell><strong>Motivo</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {productosRecepcion.map((producto) => {
                      const diferencia = producto.cantidad_recibida - producto.cantidad;
                      return (
                        <TableRow key={producto.producto_id}>
                          <TableCell>{producto.producto_nombre}</TableCell>
                          <TableCell align="center">
                            <Chip label={producto.cantidad} size="small" />
                          </TableCell>
                          <TableCell align="center">
                            <TextField
                              type="number"
                              value={producto.cantidad_recibida}
                              onChange={(e) => actualizarCantidadRecibida(producto.producto_id, e.target.value)}
                              size="small"
                              sx={{ width: 80 }}
                              inputProps={{ min: 0 }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            {diferencia !== 0 && (
                              <Chip 
                                label={`${diferencia > 0 ? '+' : ''}${diferencia}`}
                                color={diferencia < 0 ? 'error' : 'success'}
                                size="small"
                              />
                            )}
                            {diferencia === 0 && (
                              <Chip label="OK" color="default" size="small" />
                            )}
                          </TableCell>
                          <TableCell>
                            {diferencia !== 0 && (
                              <TextField
                                placeholder="Ej: Cajas dañadas"
                                value={producto.motivo}
                                onChange={(e) => actualizarMotivo(producto.producto_id, e.target.value)}
                                size="small"
                                fullWidth
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>

              <TextField
                label="Notas de recepción (opcional)"
                multiline
                rows={2}
                fullWidth
                value={notasRecepcion}
                onChange={(e) => setNotasRecepcion(e.target.value)}
                placeholder="Ej: Producto llegó en buenas condiciones"
                sx={{ mt: 3 }}
              />

              <Alert severity="warning" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  ⚠️ El inventario se actualizará con las cantidades <strong>recibidas</strong>, no las pedidas.
                </Typography>
              </Alert>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={() => setOpenDialogRecepcion(false)}
            color="inherit"
          >
            Cancelar
          </Button>
          <Button 
            onClick={confirmarRecepcion}
            variant="contained"
            color="success"
            startIcon={<CheckCircleIcon />}
          >
            Confirmar Recepción
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Pedidos;