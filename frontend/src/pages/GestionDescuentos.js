// src/pages/GestionDescuentos.js
import React, { useState, useEffect } from 'react';
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
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Alert,
  Chip,
  Switch,
  Autocomplete,
  TablePagination,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Percent as PercentIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';

const GestionDescuentos = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Estados de paginación
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [totalDescuentos, setTotalDescuentos] = useState(0);
  
  const [descuentos, setDescuentos] = useState([]);
  const [productos, setProductos] = useState([]);
  
  const [openDialog, setOpenDialog] = useState(false);
  const [editando, setEditando] = useState(false);
  const [descuentoSeleccionado, setDescuentoSeleccionado] = useState(null);
  
  // Formulario
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [cantidadMinima, setCantidadMinima] = useState('');
  const [porcentajeDescuento, setPorcentajeDescuento] = useState('');
  const [montoDescuento, setMontoDescuento] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  useEffect(() => {
    cargarDatos();
  }, [page, rowsPerPage]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        limit: rowsPerPage,
        offset: page * rowsPerPage,
      });
      
      const [descuentosRes, productosRes] = await Promise.all([
        api.get(`/api/descuentos/volumen?${params.toString()}`),
        api.get('/api/productos?activo=true&limit=1000'),
      ]);
      
      setDescuentos(descuentosRes.data.descuentos);
      setTotalDescuentos(descuentosRes.data.total);
      setProductos(productosRes.data.productos);
    } catch (err) {
      setError('Error al cargar datos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleOpenDialog = (descuento = null) => {
    if (descuento) {
      setEditando(true);
      setDescuentoSeleccionado(descuento);
      
      // Buscar el producto en la lista
      const producto = productos.find(p => p.id === descuento.producto_id);
      setProductoSeleccionado(producto);
      
      setCantidadMinima(descuento.cantidad_minima);
      setPorcentajeDescuento(descuento.porcentaje_descuento);
      setFechaInicio(descuento.fecha_inicio || '');
      setFechaFin(descuento.fecha_fin || '');
    } else {
      setEditando(false);
      setDescuentoSeleccionado(null);
      limpiarFormulario();
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    limpiarFormulario();
  };

  const limpiarFormulario = () => {
    setProductoSeleccionado(null);
    setCantidadMinima('');
    setPorcentajeDescuento('');
    setMontoDescuento('');
    setFechaInicio('');
    setFechaFin('');
  };

  // Calcular porcentaje cuando cambia el monto
  const handleMontoChange = (valor) => {
    setMontoDescuento(valor);
    
    if (productoSeleccionado && valor) {
      const precioOriginal = parseFloat(productoSeleccionado.precio_venta);
      const monto = parseFloat(valor);
      
      if (monto >= 0 && monto <= precioOriginal) {
        const porcentaje = (monto / precioOriginal) * 100;
        setPorcentajeDescuento(porcentaje.toFixed(2));
      } else if (monto > precioOriginal) {
        setError('El monto de descuento no puede ser mayor al precio del producto');
        setMontoDescuento('');
        setPorcentajeDescuento('');
      }
    } else {
      setPorcentajeDescuento('');
    }
  };

  // Calcular monto cuando cambia el porcentaje
  const handlePorcentajeChange = (valor) => {
    setPorcentajeDescuento(valor);
    
    if (productoSeleccionado && valor) {
      const precioOriginal = parseFloat(productoSeleccionado.precio_venta);
      const porcentaje = parseFloat(valor);
      
      if (porcentaje >= 0 && porcentaje <= 100) {
        const monto = (precioOriginal * porcentaje) / 100;
        setMontoDescuento(monto.toFixed(2));
      } else if (porcentaje > 100) {
        setError('El porcentaje no puede ser mayor a 100%');
        setPorcentajeDescuento('');
        setMontoDescuento('');
      }
    } else {
      setMontoDescuento('');
    }
  };

  const handleGuardar = async () => {
    try {
      if (!productoSeleccionado || !cantidadMinima || !porcentajeDescuento) {
        setError('Completa todos los campos obligatorios');
        return;
      }

      if (parseFloat(porcentajeDescuento) <= 0 || parseFloat(porcentajeDescuento) > 100) {
        setError('El porcentaje debe estar entre 0 y 100');
        return;
      }

      const descuentoData = {
        producto_id: productoSeleccionado.id,
        cantidad_minima: parseInt(cantidadMinima),
        porcentaje_descuento: parseFloat(porcentajeDescuento),
        fecha_inicio: fechaInicio || null,
        fecha_fin: fechaFin || null,
      };

      if (editando) {
        await api.put(`/api/descuentos/volumen/${descuentoSeleccionado.id}`, {
          porcentaje_descuento: descuentoData.porcentaje_descuento,
          fecha_inicio: descuentoData.fecha_inicio,
          fecha_fin: descuentoData.fecha_fin,
        });
        setSuccess('Descuento actualizado exitosamente');
      } else {
        await api.post('/api/descuentos/volumen', descuentoData);
        setSuccess('Descuento creado exitosamente');
      }

      handleCloseDialog();
      cargarDatos();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar descuento');
    }
  };

  const handleToggleActivo = async (descuento) => {
    try {
      await api.put(`/api/descuentos/volumen/${descuento.id}`, {
        activo: !descuento.activo,
      });
      setSuccess(`Descuento ${!descuento.activo ? 'activado' : 'desactivado'}`);
      cargarDatos();
    } catch (err) {
      setError('Error al cambiar estado del descuento');
    }
  };

  const handleEliminar = async (id) => {
    if (window.confirm('¿Estás seguro de eliminar este descuento?')) {
      try {
        await api.delete(`/api/descuentos/volumen/${id}`);
        setSuccess('Descuento eliminado exitosamente');
        cargarDatos();
      } catch (err) {
        setError('Error al eliminar descuento');
      }
    }
  };

  // Agrupar descuentos por producto
  const descuentosAgrupados = descuentos.reduce((acc, desc) => {
    if (!acc[desc.producto_id]) {
      acc[desc.producto_id] = {
        producto_nombre: desc.producto_nombre,
        producto_codigo: desc.producto_codigo,
        producto_precio: desc.producto_precio,
        descuentos: []
      };
    }
    acc[desc.producto_id].descuentos.push(desc);
    return acc;
  }, {});

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Gestión de Descuentos por Volumen
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Configura descuentos automáticos según cantidad comprada
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
            onClick={() => handleOpenDialog()}
          >
            Nuevo Descuento
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

      {/* Información */}
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>Ejemplo:</strong> Si configuras un descuento del 10% para 20+ unidades, 
          cuando un cliente compre 20 o más unidades de ese producto, automáticamente 
          recibirá el 10% de descuento en el precio unitario.
        </Typography>
      </Alert>

      {/* Lista de descuentos agrupados por producto */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
          <CircularProgress />
        </Box>
      ) : Object.keys(descuentosAgrupados).length === 0 ? (
        <Card>
          <CardContent>
            <Box sx={{ textAlign: 'center', py: 5 }}>
              <PercentIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No hay descuentos configurados
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Crea tu primer descuento por volumen
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => handleOpenDialog()}
                sx={{ mt: 2 }}
              >
                Crear Descuento
              </Button>
            </Box>
          </CardContent>
        </Card>
      ) : (
        Object.entries(descuentosAgrupados).map(([productoId, data]) => (
          <Card key={productoId} sx={{ mb: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                  <Typography variant="h6">
                    {data.producto_nombre}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Código: {data.producto_codigo} | Precio: Q{parseFloat(data.producto_precio).toFixed(2)}
                  </Typography>
                </Box>
              </Box>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Cantidad Mínima</TableCell>
                      <TableCell>Descuento</TableCell>
                      <TableCell>Precio con Descuento</TableCell>
                      <TableCell>Vigencia</TableCell>
                      <TableCell>Estado</TableCell>
                      <TableCell align="center">Acciones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.descuentos
                      .sort((a, b) => a.cantidad_minima - b.cantidad_minima)
                      .map((desc) => {
                        const precioConDescuento = data.producto_precio * (1 - desc.porcentaje_descuento / 100);
                        return (
                          <TableRow key={desc.id}>
                            <TableCell>
                              <Chip 
                                label={`${desc.cantidad_minima}+`} 
                                size="small" 
                                color="primary"
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={`${desc.porcentaje_descuento}%`} 
                                size="small" 
                                color="success"
                              />
                            </TableCell>
                            <TableCell>
                              <Typography fontWeight="bold">
                                Q{precioConDescuento.toFixed(2)}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Ahorro: Q{(data.producto_precio - precioConDescuento).toFixed(2)}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              {desc.fecha_inicio || desc.fecha_fin ? (
                                <>
                                  {desc.fecha_inicio && (
                                    <Typography variant="caption" display="block">
                                      Desde: {format(new Date(desc.fecha_inicio), 'dd/MM/yyyy')}
                                    </Typography>
                                  )}
                                  {desc.fecha_fin && (
                                    <Typography variant="caption" display="block">
                                      Hasta: {format(new Date(desc.fecha_fin), 'dd/MM/yyyy')}
                                    </Typography>
                                  )}
                                </>
                              ) : (
                                <Typography variant="caption" color="text.secondary">
                                  Sin límite
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              <Switch
                                checked={desc.activo}
                                onChange={() => handleToggleActivo(desc)}
                                size="small"
                              />
                              <Typography variant="caption" display="block">
                                {desc.activo ? 'Activo' : 'Inactivo'}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleOpenDialog(desc)}
                                title="Editar"
                              >
                                <EditIcon />
                              </IconButton>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleEliminar(desc.id)}
                                title="Eliminar"
                              >
                                <DeleteIcon />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        ))
      )}

      {/* Paginación */}
      {descuentos.length > 0 && (
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
          <TablePagination
            component="div"
            count={totalDescuentos}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[10, 25, 50, 100]}
            labelRowsPerPage="Descuentos por página:"
            labelDisplayedRows={({ from, to, count }) => 
              `${from}-${to} de ${count !== -1 ? count : `más de ${to}`}`
            }
          />
        </Box>
      )}

      {/* Diálogo: Crear/Editar Descuento */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editando ? 'Editar Descuento' : 'Nuevo Descuento por Volumen'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <Autocomplete
                options={productos}
                getOptionLabel={(option) => `${option.nombre} - Q${parseFloat(option.precio_venta).toFixed(2)}`}
                value={productoSeleccionado}
                onChange={(event, newValue) => setProductoSeleccionado(newValue)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Producto"
                    required
                    disabled={editando}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Cantidad Mínima"
                type="number"
                value={cantidadMinima}
                onChange={(e) => setCantidadMinima(e.target.value)}
                required
                disabled={editando}
                inputProps={{ min: 1 }}
                helperText="Unidades necesarias para el descuento"
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Ingresa el descuento de cualquier forma (se calculará automáticamente el otro valor)
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Monto de Descuento (Q)"
                type="number"
                value={montoDescuento}
                onChange={(e) => handleMontoChange(e.target.value)}
                required
                disabled={!productoSeleccionado}
                inputProps={{ min: 0.01, step: 0.01 }}
                helperText={
                  productoSeleccionado 
                    ? `Máximo: Q${parseFloat(productoSeleccionado.precio_venta).toFixed(2)}`
                    : "Primero selecciona un producto"
                }
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Porcentaje de Descuento (%)"
                type="number"
                value={porcentajeDescuento}
                onChange={(e) => handlePorcentajeChange(e.target.value)}
                required
                disabled={!productoSeleccionado}
                inputProps={{ min: 0.01, max: 100, step: 0.01 }}
                helperText="Ej: 10 para 10%"
              />
            </Grid>

            {productoSeleccionado && porcentajeDescuento && montoDescuento && (
              <Grid item xs={12}>
                <Alert severity="success">
                  <Typography variant="body2" fontWeight="bold" gutterBottom>
                    📊 Vista Previa del Descuento
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Precio Normal:</Typography>
                      <Typography variant="body1" fontWeight="bold">
                        Q{parseFloat(productoSeleccionado.precio_venta).toFixed(2)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Descuento:</Typography>
                      <Typography variant="body1" fontWeight="bold" color="error">
                        -{porcentajeDescuento}% (Q{montoDescuento})
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Precio Final:</Typography>
                      <Typography variant="body1" fontWeight="bold" color="success.main">
                        Q{(productoSeleccionado.precio_venta - parseFloat(montoDescuento)).toFixed(2)}
                      </Typography>
                    </Box>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    El cliente ahorrará Q{montoDescuento} por cada unidad
                  </Typography>
                </Alert>
              </Grid>
            )}

            {productoSeleccionado && !porcentajeDescuento && !montoDescuento && (
              <Grid item xs={12}>
                <Alert severity="info">
                  <Typography variant="body2">
                    💡 <strong>Tip:</strong> Ingresa el monto de descuento en quetzales O el porcentaje. 
                    El otro valor se calculará automáticamente.
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Precio del producto: <strong>Q{parseFloat(productoSeleccionado.precio_venta).toFixed(2)}</strong>
                  </Typography>
                </Alert>
              </Grid>
            )}

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Fecha Inicio (Opcional)"
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                InputLabelProps={{ shrink: true }}
                helperText="Dejar vacío para activar inmediatamente"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Fecha Fin (Opcional)"
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                InputLabelProps={{ shrink: true }}
                helperText="Dejar vacío para sin límite"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button onClick={handleGuardar} variant="contained">
            {editando ? 'Actualizar' : 'Crear'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GestionDescuentos;