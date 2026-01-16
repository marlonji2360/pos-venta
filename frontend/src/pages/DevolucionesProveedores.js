// src/pages/DevolucionesProveedores.js
import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Box, Card, CardContent, Typography, Button, TextField, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton, Grid, Alert,
  Chip, Dialog, DialogTitle, DialogContent, DialogActions, Tabs, Tab,
  FormControl, InputLabel, Select, MenuItem, Autocomplete, Checkbox,
  FormControlLabel, Paper, InputAdornment, TablePagination,
} from '@mui/material';
import {
  Add as AddIcon, Delete as DeleteIcon, Visibility as VisibilityIcon,
  Refresh as RefreshIcon, Search as SearchIcon, SwapHoriz as SwapIcon,
  Undo as UndoIcon, CheckCircle as CheckIcon, Cancel as CancelIcon,
  LocalShipping as ShippingIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';

const DevolucionesProveedores = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [devoluciones, setDevoluciones] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [productos, setProductos] = useState([]);
  
  const [openDialog, setOpenDialog] = useState(false);
  const [openDetalle, setOpenDetalle] = useState(false);
  const [devolucionDetalle, setDevolucionDetalle] = useState(null);
  const [tabActual, setTabActual] = useState(0); // 0=Todas, 1=Pendientes, 2=Aprobadas, 3=Completadas, 4=Rechazadas
  
  // Paginación
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  // Búsqueda
  const [busqueda, setBusqueda] = useState('');
  
  // Formulario
  const [tipo, setTipo] = useState('devolucion');
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null);
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [notas, setNotas] = useState('');
  const [productosDevolucion, setProductosDevolucion] = useState([]);
  
  // Búsqueda de pedido
  const [folioPedido, setFolioPedido] = useState('');

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const [devolucionesRes, proveedoresRes, productosRes] = await Promise.all([
        api.get('/api/devoluciones-proveedores'),
        api.get('/api/proveedores'),
        api.get('/api/productos?activo=true'),
      ]);
      setDevoluciones(devolucionesRes.data.devoluciones);
      setProveedores(proveedoresRes.data.proveedores);
      setProductos(productosRes.data.productos);
    } catch (err) {
      setError('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (tipoDevolucion) => {
    setTipo(tipoDevolucion);
    setPedidoSeleccionado(null);
    setProveedorSeleccionado(null);
    setMotivo('');
    setNotas('');
    setProductosDevolucion([]);
    setFolioPedido('');
    setOpenDialog(true);
  };

  const buscarPedido = async () => {
    try {
      if (!folioPedido.trim()) {
        setError('Ingresa un folio de pedido');
        return;
      }

      const pedidosRes = await api.get('/api/pedidos');
      const pedido = pedidosRes.data.pedidos.find(p => p.folio === folioPedido.trim());
      
      if (!pedido) {
        setError('Pedido no encontrado');
        return;
      }

      // Cargar productos del pedido
      const productosRes = await api.get(`/api/devoluciones-proveedores/pedido/${pedido.id}/productos`);
      
      setPedidoSeleccionado(pedido);
      
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
      setSuccess('Pedido encontrado');

    } catch (err) {
      setError('Error al buscar pedido');
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

      if (!proveedorSeleccionado && !pedidoSeleccionado) {
        setError('Selecciona un proveedor');
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

      await api.post('/api/devoluciones-proveedores', {
        pedido_id: pedidoSeleccionado?.id || null,
        proveedor_id: proveedorSeleccionado?.id || pedidoSeleccionado?.proveedor_id,
        tipo,
        motivo,
        notas,
        productos: productosConCantidad
      });

      setSuccess(
        tipo === 'devolucion' 
          ? 'Devolución registrada exitosamente'
          : 'Cambio registrado exitosamente'
      );
      setOpenDialog(false);
      cargarDatos();

    } catch (err) {
      setError(err.response?.data?.error || 'Error al procesar');
    }
  };

  const handleVerDetalle = async (id) => {
    try {
      const response = await api.get(`/api/devoluciones-proveedores/${id}`);
      setDevolucionDetalle(response.data);
      setOpenDetalle(true);
    } catch (err) {
      setError('Error al cargar detalle');
    }
  };

  const handleCambiarEstado = async (id, nuevoEstado) => {
    try {
      await api.patch(`/api/devoluciones-proveedores/${id}/estado`, {
        estado: nuevoEstado
      });
      setSuccess(`Estado actualizado a: ${nuevoEstado}`);
      cargarDatos();
    } catch (err) {
      setError('Error al actualizar estado');
    }
  };

  const calcularTotal = () => {
    return productosDevolucion.reduce((sum, p) => {
      const devuelto = p.cantidad * p.precio_unitario;
      const recibido = (p.cantidad_cambio || 0) * (p.precio_cambio || 0);
      return sum + devuelto - recibido;
    }, 0);
  };

  const getColorEstado = (estado) => {
    switch (estado) {
      case 'pendiente': return 'warning';
      case 'aprobada': return 'info';
      case 'completada': return 'success';
      case 'rechazada': return 'error';
      default: return 'default';
    }
  };

  // Filtrar devoluciones según tab y búsqueda
  const devolucionesFiltradas = devoluciones.filter(dev => {
    // Filtro por tab (estado)
    let pasaFiltroTab = true;
    if (tabActual === 1) pasaFiltroTab = dev.estado === 'pendiente';
    if (tabActual === 2) pasaFiltroTab = dev.estado === 'aprobada';
    if (tabActual === 3) pasaFiltroTab = dev.estado === 'completada';
    if (tabActual === 4) pasaFiltroTab = dev.estado === 'rechazada';

    // Filtro por búsqueda
    let pasaFiltroBusqueda = true;
    if (busqueda.trim()) {
      const termino = busqueda.toLowerCase();
      pasaFiltroBusqueda = 
        dev.folio?.toLowerCase().includes(termino) ||
        dev.proveedor_nombre?.toLowerCase().includes(termino) ||
        dev.pedido_folio?.toLowerCase().includes(termino) ||
        dev.tipo?.toLowerCase().includes(termino);
    }

    return pasaFiltroTab && pasaFiltroBusqueda;
  });

  // Paginación
  const devolucionesPaginadas = devolucionesFiltradas.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleChangeTab = (event, newValue) => {
    setTabActual(newValue);
    setPage(0); // Reset a primera página al cambiar tab
  };

  // Contar por estado
  const contarPorEstado = (estado) => {
    if (!estado) return devoluciones.length;
    return devoluciones.filter(d => d.estado === estado).length;
  };

  return (
    <Box sx={{ p: 3 }}>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h5">Devoluciones a Proveedores</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
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

          {/* Mensajes */}
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

          {/* Barra de búsqueda */}
          <TextField
            fullWidth
            placeholder="Buscar por folio, proveedor, pedido o tipo..."
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPage(0); // Reset a primera página al buscar
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2 }}
          />

          {/* Tabs de estado */}
          <Tabs value={tabActual} onChange={handleChangeTab} sx={{ mb: 2 }}>
            <Tab 
              label={`Todas (${contarPorEstado(null)})`} 
              icon={<ShippingIcon />} 
              iconPosition="start"
            />
            <Tab 
              label={`Pendientes (${contarPorEstado('pendiente')})`}
              icon={<Chip label="P" size="small" color="warning" />}
              iconPosition="start"
            />
            <Tab 
              label={`Aprobadas (${contarPorEstado('aprobada')})`}
              icon={<Chip label="A" size="small" color="info" />}
              iconPosition="start"
            />
            <Tab 
              label={`Completadas (${contarPorEstado('completada')})`}
              icon={<Chip label="C" size="small" color="success" />}
              iconPosition="start"
            />
            <Tab 
              label={`Rechazadas (${contarPorEstado('rechazada')})`}
              icon={<Chip label="R" size="small" color="error" />}
              iconPosition="start"
            />
          </Tabs>

          {/* Tabla */}
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Folio</TableCell>
                  <TableCell>Fecha</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Proveedor</TableCell>
                  <TableCell>Pedido</TableCell>
                  <TableCell align="right">Monto</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell>Usuario</TableCell>
                  <TableCell align="center">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center">Cargando...</TableCell>
                  </TableRow>
                ) : devolucionesPaginadas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center">
                      No hay devoluciones {tabActual > 0 ? 'en este estado' : 'registradas'}
                    </TableCell>
                  </TableRow>
                ) : (
                  devolucionesPaginadas.map((dev) => (
                    <TableRow key={dev.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {dev.folio}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {dev.fecha_devolucion ? format(new Date(dev.fecha_devolucion), 'dd/MM/yyyy HH:mm') : '-'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={dev.tipo === 'devolucion' ? 'Devolución' : 'Cambio'}
                          color={dev.tipo === 'devolucion' ? 'error' : 'primary'}
                          size="small"
                          icon={dev.tipo === 'devolucion' ? <UndoIcon /> : <SwapIcon />}
                        />
                      </TableCell>
                      <TableCell>{dev.proveedor_nombre || '-'}</TableCell>
                      <TableCell>{dev.pedido_folio || '-'}</TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="bold">
                          Q{parseFloat(dev.monto_devuelto || 0).toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={
                            dev.estado === 'pendiente' ? 'Pendiente' :
                            dev.estado === 'aprobada' ? 'Aprobada' :
                            dev.estado === 'completada' ? 'Completada' :
                            dev.estado === 'rechazada' ? 'Rechazada' : dev.estado
                          }
                          color={getColorEstado(dev.estado)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{dev.usuario_nombre}</TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleVerDetalle(dev.id)}
                          title="Ver detalle"
                        >
                          <VisibilityIcon />
                        </IconButton>
                        {dev.estado === 'pendiente' && (
                          <>
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() => handleCambiarEstado(dev.id, 'aprobada')}
                              title="Aprobar"
                            >
                              <CheckIcon />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleCambiarEstado(dev.id, 'rechazada')}
                              title="Rechazar"
                            >
                              <CancelIcon />
                            </IconButton>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Paginación */}
          <TablePagination
            component="div"
            count={devolucionesFiltradas.length}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            labelRowsPerPage="Filas por página:"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
            rowsPerPageOptions={[5, 10, 25, 50, 100]}
          />
        </CardContent>
      </Card>

      {/* Diálogo: Nueva Devolución/Cambio */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          Nueva {tipo === 'devolucion' ? 'Devolución' : 'Cambio'} a Proveedor
          <Typography variant="body2" color="text.secondary">
            {tipo === 'devolucion' 
              ? 'Registra productos que devuelves al proveedor' 
              : 'Registra el cambio de productos con el proveedor'}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            {/* Buscar pedido */}
            <Grid item xs={12}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" gutterBottom>
                    Buscar Pedido (Opcional)
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                      fullWidth
                      label="Folio de pedido"
                      value={folioPedido}
                      onChange={(e) => setFolioPedido(e.target.value)}
                      placeholder="Ej: PED-000001"
                    />
                    <Button variant="contained" onClick={buscarPedido}>
                      <SearchIcon />
                    </Button>
                  </Box>
                  {pedidoSeleccionado && (
                    <Alert severity="success" sx={{ mt: 1 }}>
                      Pedido {pedidoSeleccionado.folio} cargado - Total: Q{parseFloat(pedidoSeleccionado.total || 0).toFixed(2)}
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Proveedor */}
            <Grid item xs={12} md={6}>
              <Autocomplete
                options={proveedores}
                getOptionLabel={(option) => `${option.nombre} - ${option.telefono || 'Sin tel.'}`}
                value={proveedorSeleccionado}
                onChange={(e, value) => setProveedorSeleccionado(value)}
                renderInput={(params) => <TextField {...params} label="Proveedor *" required />}
                disabled={!!pedidoSeleccionado}
              />
            </Grid>

            {/* Agregar producto manual */}
            {!pedidoSeleccionado && (
              <Grid item xs={12} md={6}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={agregarProductoManual}
                  sx={{ height: '56px' }}
                >
                  Agregar Producto Manual
                </Button>
              </Grid>
            )}

            {/* Tabla de productos */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
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
                          {pedidoSeleccionado ? (
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
                                  actualizarProducto(index, 'precio_unitario', value.precio_compra || value.precio_venta);
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
                                  actualizarProducto(index, 'precio_cambio', value.precio_compra || value.precio_venta);
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
                            placeholder="Defectuoso, dañado..."
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
                placeholder="Ej: Producto defectuoso, no cumple especificaciones..."
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
                  Total Devolución: Q{calcularTotal().toFixed(2)}
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancelar</Button>
          <Button onClick={handleGuardar} variant="contained" color={tipo === 'devolucion' ? 'error' : 'primary'}>
            Registrar {tipo === 'devolucion' ? 'Devolución' : 'Cambio'}
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
                  <Typography><strong>Proveedor:</strong> {devolucionDetalle.devolucion.proveedor_nombre}</Typography>
                  <Typography><strong>Estado:</strong> <Chip label={devolucionDetalle.devolucion.estado} size="small" color={getColorEstado(devolucionDetalle.devolucion.estado)} /></Typography>
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
                          {devolucionDetalle.devolucion.tipo === 'cambio' && <TableCell>Producto Cambio</TableCell>}
                          {devolucionDetalle.devolucion.tipo === 'cambio' && <TableCell>Cant. Cambio</TableCell>}
                          <TableCell>Inv.</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {devolucionDetalle.productos.map((prod) => (
                          <TableRow key={prod.id}>
                            <TableCell>{prod.producto_nombre}</TableCell>
                            <TableCell>{prod.cantidad}</TableCell>
                            <TableCell>Q{parseFloat(prod.precio_unitario).toFixed(2)}</TableCell>
                            {devolucionDetalle.devolucion.tipo === 'cambio' && (
                              <>
                                <TableCell>{prod.producto_cambio_nombre || '-'}</TableCell>
                                <TableCell>{prod.cantidad_cambio || 0}</TableCell>
                              </>
                            )}
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

export default DevolucionesProveedores;