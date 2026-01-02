// src/pages/DevolucionesClientes.js
import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Box, Card, CardContent, Typography, Button, TextField, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton, Grid, Alert,
  Chip, Dialog, DialogTitle, DialogContent, DialogActions, Tabs, Tab,
  FormControl, InputLabel, Select, MenuItem, Autocomplete, Checkbox,
  FormControlLabel, Paper, InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon, Delete as DeleteIcon, Visibility as VisibilityIcon,
  Refresh as RefreshIcon, Search as SearchIcon, SwapHoriz as SwapIcon,
  Undo as UndoIcon, ShoppingCart as CartIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';

const DevolucionesClientes = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [devoluciones, setDevoluciones] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [ventas, setVentas] = useState([]);
  
  const [openDialog, setOpenDialog] = useState(false);
  const [openDetalle, setOpenDetalle] = useState(false);
  const [devolucionDetalle, setDevolucionDetalle] = useState(null);
  const [tabActual, setTabActual] = useState(0); // 0=Devolución, 1=Cambio
  
  // Formulario
  const [tipo, setTipo] = useState('devolucion');
  const [ventaSeleccionada, setVentaSeleccionada] = useState(null);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [notas, setNotas] = useState('');
  const [productosDevolucion, setProductosDevolucion] = useState([]);
  
  // Búsqueda de venta
  const [folioVenta, setFolioVenta] = useState('');

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const [devolucionesRes, clientesRes, productosRes] = await Promise.all([
        api.get('/api/devoluciones-clientes'),
        api.get('/api/clientes'),
        api.get('/api/productos?activo=true'),
      ]);
      setDevoluciones(devolucionesRes.data.devoluciones);
      setClientes(clientesRes.data.clientes);
      setProductos(productosRes.data.productos);
    } catch (err) {
      setError('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (tipoDevolucion) => {
    setTipo(tipoDevolucion);
    setVentaSeleccionada(null);
    setClienteSeleccionado(null);
    setMotivo('');
    setNotas('');
    setProductosDevolucion([]);
    setFolioVenta('');
    setOpenDialog(true);
  };

  const buscarVenta = async () => {
    try {
      if (!folioVenta.trim()) {
        setError('Ingresa un folio de venta');
        return;
      }

      const ventasRes = await api.get('/api/ventas');
      const venta = ventasRes.data.ventas.find(v => v.folio === folioVenta.trim());
      
      if (!venta) {
        setError('Venta no encontrada');
        return;
      }

      // Cargar productos de la venta
      const productosRes = await api.get(`/api/devoluciones-clientes/venta/${venta.id}/productos`);
      
      setVentaSeleccionada(venta);
      
      // Inicializar productos
      const productosIniciales = productosRes.data.productos.map(p => ({
        producto_id: p.producto_id,
        producto_nombre: p.producto_nombre,
        cantidad_original: p.cantidad,
        cantidad: 0,
        precio_unitario: p.precio_unitario,
        afecta_inventario: true,
        motivo_producto: '',
        // Para cambios
        producto_cambio_id: null,
        cantidad_cambio: 0,
        precio_cambio: 0
      }));
      
      setProductosDevolucion(productosIniciales);
      setSuccess('Venta encontrada');

    } catch (err) {
      setError('Error al buscar venta');
    }
  };

  const actualizarProducto = (index, campo, valor) => {
    setProductosDevolucion(prev => {
      const nuevos = [...prev];
      nuevos[index] = { ...nuevos[index], [campo]: valor };
      return nuevos;
    });
  };

  const agregarProductoManual = () => {
    setProductosDevolucion(prev => [...prev, {
      producto_id: null,
      producto_nombre: '',
      cantidad: 0,
      precio_unitario: 0,
      afecta_inventario: true,
      motivo_producto: '',
      producto_cambio_id: null,
      cantidad_cambio: 0,
      precio_cambio: 0
    }]);
  };

  const eliminarProducto = (index) => {
    setProductosDevolucion(prev => prev.filter((_, i) => i !== index));
  };

  const handleGuardar = async () => {
    try {
      // Validaciones
      const productosConCantidad = productosDevolucion.filter(p => p.cantidad > 0);
      
      if (productosConCantidad.length === 0) {
        setError('Agrega al menos un producto con cantidad mayor a 0');
        return;
      }

      if (!motivo.trim()) {
        setError('Ingresa el motivo de la devolución');
        return;
      }

      // Para cambios, verificar que tengan producto de cambio
      if (tipo === 'cambio') {
        const sinProductoCambio = productosConCantidad.some(p => !p.producto_cambio_id || p.cantidad_cambio <= 0);
        if (sinProductoCambio) {
          setError('Para cambios, todos los productos deben tener un producto de cambio y cantidad');
          return;
        }
      }

      await api.post('/api/devoluciones-clientes', {
        venta_id: ventaSeleccionada?.id || null,
        cliente_id: clienteSeleccionado?.id || ventaSeleccionada?.cliente_id || null,
        tipo,
        motivo,
        notas,
        productos: productosConCantidad
      });

      setSuccess(
        tipo === 'devolucion' 
          ? 'Devolución procesada exitosamente'
          : 'Cambio procesado exitosamente'
      );
      setOpenDialog(false);
      cargarDatos();

    } catch (err) {
      setError(err.response?.data?.error || 'Error al procesar');
    }
  };

  const handleVerDetalle = async (id) => {
    try {
      const response = await api.get(`/api/devoluciones-clientes/${id}`);
      setDevolucionDetalle(response.data);
      setOpenDetalle(true);
    } catch (err) {
      setError('Error al cargar detalle');
    }
  };

  const calcularTotal = () => {
    return productosDevolucion.reduce((sum, p) => {
      const devuelto = p.cantidad * p.precio_unitario;
      const entregado = (p.cantidad_cambio || 0) * (p.precio_cambio || 0);
      return sum + devuelto - entregado;
    }, 0);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            🔄 Devoluciones de Clientes
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gestiona devoluciones y cambios de productos
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
            color="error"
            startIcon={<UndoIcon />}
            onClick={() => handleOpenDialog('devolucion')}
          >
            Nueva Devolución
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<SwapIcon />}
            onClick={() => handleOpenDialog('cambio')}
          >
            Nuevo Cambio
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

      <Card>
        <CardContent>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Folio</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Cliente</TableCell>
                  <TableCell>Venta</TableCell>
                  <TableCell>Monto</TableCell>
                  <TableCell>Fecha</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell align="center">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {devoluciones.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <Typography color="text.secondary">No hay devoluciones registradas</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  devoluciones.map((dev) => (
                    <TableRow key={dev.id}>
                      <TableCell>
                        <Chip label={dev.folio} size="small" />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={dev.tipo === 'devolucion' ? 'Devolución' : 'Cambio'} 
                          size="small"
                          color={dev.tipo === 'devolucion' ? 'error' : 'primary'}
                        />
                      </TableCell>
                      <TableCell>{dev.cliente_nombre || '-'}</TableCell>
                      <TableCell>{dev.venta_folio || '-'}</TableCell>
                      <TableCell>Q{parseFloat(dev.monto_devuelto).toFixed(2)}</TableCell>
                      <TableCell>
                        {format(new Date(dev.fecha_devolucion), 'dd/MM/yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={dev.estado} 
                          size="small" 
                          color="success"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={() => handleVerDetalle(dev.id)}
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
        </CardContent>
      </Card>

      {/* Diálogo: Nueva Devolución/Cambio */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ bgcolor: tipo === 'devolucion' ? 'error.main' : 'primary.main', color: 'white' }}>
          {tipo === 'devolucion' ? '🔄 Nueva Devolución' : '🔁 Nuevo Cambio'}
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            {/* Búsqueda de venta */}
            <Grid item xs={12}>
              <Alert severity="info">
                Busca la venta por folio o crea una devolución manual
              </Alert>
            </Grid>

            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                label="Folio de Venta"
                value={folioVenta}
                onChange={(e) => setFolioVenta(e.target.value)}
                placeholder="Ej: VTA-000001"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={buscarVenta}>
                        <SearchIcon />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <Button
                fullWidth
                variant="outlined"
                onClick={agregarProductoManual}
                startIcon={<AddIcon />}
                sx={{ height: '56px' }}
              >
                Agregar Manual
              </Button>
            </Grid>

            {/* Información de venta */}
            {ventaSeleccionada && (
              <Grid item xs={12}>
                <Paper sx={{ p: 2, bgcolor: 'success.light' }}>
                  <Typography variant="body2">
                    <strong>Venta:</strong> {ventaSeleccionada.folio} | 
                    <strong> Total:</strong> Q{parseFloat(ventaSeleccionada.total).toFixed(2)} | 
                    <strong> Fecha:</strong> {format(new Date(ventaSeleccionada.fecha_venta), 'dd/MM/yyyy')}
                  </Typography>
                </Paper>
              </Grid>
            )}

            {/* Productos */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Productos
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Producto</TableCell>
                      <TableCell align="center">Cantidad</TableCell>
                      <TableCell align="center">Precio Unit.</TableCell>
                      {tipo === 'cambio' && <TableCell>Producto Cambio</TableCell>}
                      {tipo === 'cambio' && <TableCell align="center">Cant. Cambio</TableCell>}
                      <TableCell align="center">Inv.</TableCell>
                      <TableCell>Motivo</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {productosDevolucion.map((prod, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          {ventaSeleccionada ? (
                            <Typography variant="body2">{prod.producto_nombre}</Typography>
                          ) : (
                            <Autocomplete
                              size="small"
                              options={productos}
                              getOptionLabel={(option) => option.nombre}
                              onChange={(e, value) => {
                                if (value) {
                                  actualizarProducto(index, 'producto_id', value.id);
                                  actualizarProducto(index, 'producto_nombre', value.nombre);
                                  actualizarProducto(index, 'precio_unitario', value.precio_venta);
                                }
                              }}
                              renderInput={(params) => <TextField {...params} placeholder="Buscar..." />}
                              sx={{ minWidth: 200 }}
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <TextField
                            type="number"
                            size="small"
                            value={prod.cantidad}
                            onChange={(e) => actualizarProducto(index, 'cantidad', parseInt(e.target.value) || 0)}
                            inputProps={{ min: 0, max: prod.cantidad_original }}
                            sx={{ width: 80 }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            type="number"
                            size="small"
                            value={prod.precio_unitario}
                            onChange={(e) => actualizarProducto(index, 'precio_unitario', parseFloat(e.target.value) || 0)}
                            inputProps={{ min: 0, step: 0.01 }}
                            sx={{ width: 100 }}
                          />
                        </TableCell>
                        {tipo === 'cambio' && (
                          <TableCell>
                            <Autocomplete
                              size="small"
                              options={productos}
                              getOptionLabel={(option) => option.nombre}
                              onChange={(e, value) => {
                                if (value) {
                                  actualizarProducto(index, 'producto_cambio_id', value.id);
                                  actualizarProducto(index, 'precio_cambio', value.precio_venta);
                                }
                              }}
                              renderInput={(params) => <TextField {...params} placeholder="Producto..." />}
                              sx={{ minWidth: 200 }}
                            />
                          </TableCell>
                        )}
                        {tipo === 'cambio' && (
                          <TableCell>
                            <TextField
                              type="number"
                              size="small"
                              value={prod.cantidad_cambio}
                              onChange={(e) => actualizarProducto(index, 'cantidad_cambio', parseInt(e.target.value) || 0)}
                              inputProps={{ min: 0 }}
                              sx={{ width: 80 }}
                            />
                          </TableCell>
                        )}
                        <TableCell align="center">
                          <Checkbox
                            checked={prod.afecta_inventario}
                            onChange={(e) => actualizarProducto(index, 'afecta_inventario', e.target.checked)}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            value={prod.motivo_producto}
                            onChange={(e) => actualizarProducto(index, 'motivo_producto', e.target.value)}
                            placeholder="Motivo..."
                            fullWidth
                          />
                        </TableCell>
                        <TableCell>
                          <IconButton size="small" onClick={() => eliminarProducto(index)}>
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>

            {/* Motivo general */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Motivo de la devolución *"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                multiline
                rows={2}
                required
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notas adicionales"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                multiline
                rows={2}
              />
            </Grid>

            {/* Total */}
            <Grid item xs={12}>
              <Paper sx={{ p: 2, bgcolor: 'grey.100' }}>
                <Typography variant="h6">
                  Total: Q{calcularTotal().toFixed(2)}
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancelar</Button>
          <Button onClick={handleGuardar} variant="contained" color={tipo === 'devolucion' ? 'error' : 'primary'}>
            Procesar {tipo === 'devolucion' ? 'Devolución' : 'Cambio'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo: Detalle */}
      <Dialog open={openDetalle} onClose={() => setOpenDetalle(false)} maxWidth="md" fullWidth>
        {devolucionDetalle && (
          <>
            <DialogTitle>
              Detalle - {devolucionDetalle.devolucion.folio}
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography><strong>Tipo:</strong> {devolucionDetalle.devolucion.tipo}</Typography>
                  <Typography><strong>Cliente:</strong> {devolucionDetalle.devolucion.cliente_nombre || '-'}</Typography>
                  <Typography><strong>Motivo:</strong> {devolucionDetalle.devolucion.motivo}</Typography>
                  <Typography><strong>Total:</strong> Q{parseFloat(devolucionDetalle.devolucion.monto_devuelto).toFixed(2)}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <TableContainer component={Paper}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Producto</TableCell>
                          <TableCell>Cantidad</TableCell>
                          <TableCell>Precio</TableCell>
                          <TableCell>Inv.</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {devolucionDetalle.productos.map((prod) => (
                          <TableRow key={prod.id}>
                            <TableCell>{prod.producto_nombre}</TableCell>
                            <TableCell>{prod.cantidad}</TableCell>
                            <TableCell>Q{parseFloat(prod.precio_unitario).toFixed(2)}</TableCell>
                            <TableCell>
                              <Chip 
                                label={prod.afecta_inventario ? 'Sí' : 'No'} 
                                size="small"
                                color={prod.afecta_inventario ? 'success' : 'default'}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpenDetalle(false)}>Cerrar</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default DevolucionesClientes;
