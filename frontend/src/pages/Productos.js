// src/pages/Productos.js
import React, { useState, useEffect } from 'react';
import api from '../services/api';
import GestionLotes from '../components/GestionLotes';
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
  Paper,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  MenuItem,
  CircularProgress,
  Alert,
  InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Inventory as InventoryIcon,
  Event as EventIcon,
} from '@mui/icons-material';

const Productos = () => {
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingProducto, setEditingProducto] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [gestionandoLotes, setGestionandoLotes] = useState(null);

  // Formulario
  const [formData, setFormData] = useState({
    codigo_barras: '',
    nombre: '',
    descripcion: '',
    categoria_id: '',
    precio_compra: '',
    precio_venta: '',
    stock_actual: 0,
    stock_minimo: 10,
    stock_maximo: 1000,
    unidad_medida: 'pieza',
    requiere_vencimiento: false,
    dias_alerta_vencimiento: 30,
  });

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const [productosRes, categoriasRes] = await Promise.all([
        api.get('/api/productos?activo=true'), // Solo productos activos
        api.get('/api/categorias'),
      ]);
      setProductos(productosRes.data.productos);
      setCategorias(categoriasRes.data.categorias);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (producto = null) => {
    if (producto) {
      setEditingProducto(producto);
      setFormData({
        codigo_barras: producto.codigo_barras || '',
        nombre: producto.nombre,
        descripcion: producto.descripcion || '',
        categoria_id: producto.categoria_id || '',
        precio_compra: producto.precio_compra,
        precio_venta: producto.precio_venta,
        stock_actual: producto.stock_actual,
        stock_minimo: producto.stock_minimo,
        stock_maximo: producto.stock_maximo,
        unidad_medida: producto.unidad_medida || 'pieza',
        requiere_vencimiento: producto.requiere_vencimiento || false,
        dias_alerta_vencimiento: producto.dias_alerta_vencimiento || 30,
      });
    } else {
      setEditingProducto(null);
      setFormData({
        codigo_barras: '',
        nombre: '',
        descripcion: '',
        categoria_id: '',
        precio_compra: '',
        precio_venta: '',
        stock_actual: 0,
        stock_minimo: 10,
        stock_maximo: 1000,
        unidad_medida: 'pieza',
        requiere_vencimiento: false,
        dias_alerta_vencimiento: 30,
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingProducto(null);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleSubmit = async () => {
    try {
      if (editingProducto) {
        await api.put(`/api/productos/${editingProducto.id}`, formData);
      } else {
        await api.post('/api/productos', formData);
      }
      handleCloseDialog();
      cargarDatos();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar producto');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Estás seguro de eliminar este producto?')) {
      try {
        await api.delete(`/api/productos/${id}`);
        cargarDatos();
      } catch (err) {
        setError(err.response?.data?.error || 'Error al eliminar producto');
      }
    }
  };

  const productosFiltrados = productos.filter((producto) => {
    const matchSearch = producto.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (producto.codigo_barras && producto.codigo_barras.includes(searchTerm));
    const matchCategoria = !categoriaFiltro || producto.categoria_id === parseInt(categoriaFiltro);
    return matchSearch && matchCategoria;
  });

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Productos
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gestión de inventario de productos
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Nuevo Producto
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Buscar por nombre o código de barras..."
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
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                select
                label="Filtrar por categoría"
                value={categoriaFiltro}
                onChange={(e) => setCategoriaFiltro(e.target.value)}
              >
                <MenuItem value="">Todas las categorías</MenuItem>
                {categorias.map((cat) => (
                  <MenuItem key={cat.id} value={cat.id}>
                    {cat.nombre}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={3}>
              <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                <Typography variant="body2" color="text.secondary">
                  Total: {productosFiltrados.length} productos
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'primary.light' }}>
              <TableCell>Código</TableCell>
              <TableCell>Nombre</TableCell>
              <TableCell>Categoría</TableCell>
              <TableCell align="right">Precio Venta</TableCell>
              <TableCell align="right">Stock</TableCell>
              <TableCell align="center">Estado</TableCell>
              <TableCell align="center">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {productosFiltrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Box sx={{ py: 3 }}>
                    <InventoryIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      No hay productos registrados
                    </Typography>
                    <Button
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={() => handleOpenDialog()}
                      sx={{ mt: 2 }}
                    >
                      Agregar primer producto
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              productosFiltrados.map((producto) => (
                <TableRow key={producto.id} hover>
                  <TableCell>{producto.codigo_barras || '-'}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {producto.nombre}
                    </Typography>
                    {producto.descripcion && (
                      <Typography variant="caption" color="text.secondary">
                        {producto.descripcion}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{producto.categoria_nombre || '-'}</TableCell>
                  <TableCell align="right">
                    Q{parseFloat(producto.precio_venta).toFixed(2)}
                  </TableCell>
                  <TableCell align="right">
                    <Chip
                      label={producto.stock_actual}
                      size="small"
                      color={producto.stock_actual <= producto.stock_minimo ? 'error' : 'success'}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={producto.activo ? 'Activo' : 'Inactivo'}
                      size="small"
                      color={producto.activo ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell align="center">
                    {producto.requiere_vencimiento && (
                      <IconButton
                        size="small"
                        color="info"
                        onClick={() => setGestionandoLotes(producto)}
                        title="Gestionar Lotes"
                      >
                        <EventIcon />
                      </IconButton>
                    )}
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => handleOpenDialog(producto)}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDelete(producto.id)}
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

      {/* Dialog para agregar/editar producto */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingProducto ? 'Editar Producto' : 'Nuevo Producto'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Código de Barras"
                name="codigo_barras"
                value={formData.codigo_barras}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                required
                label="Nombre"
                name="nombre"
                value={formData.nombre}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Descripción"
                name="descripcion"
                value={formData.descripcion}
                onChange={handleChange}
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                select
                label="Categoría"
                name="categoria_id"
                value={formData.categoria_id}
                onChange={handleChange}
                SelectProps={{
                  displayEmpty: true,
                }}
                InputLabelProps={{
                  shrink: true,
                }}
              >
                <MenuItem value="">Sin categoría</MenuItem>
                {categorias.map((cat) => (
                  <MenuItem key={cat.id} value={cat.id}>
                    {cat.nombre}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Unidad de Medida"
                name="unidad_medida"
                value={formData.unidad_medida}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                required
                label="Precio de Compra"
                name="precio_compra"
                type="number"
                value={formData.precio_compra}
                onChange={handleChange}
                InputProps={{
                  startAdornment: <InputAdornment position="start">Q</InputAdornment>,
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                required
                label="Precio de Venta"
                name="precio_venta"
                type="number"
                value={formData.precio_venta}
                onChange={handleChange}
                InputProps={{
                  startAdornment: <InputAdornment position="start">Q</InputAdornment>,
                }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Stock Actual"
                name="stock_actual"
                type="number"
                value={formData.stock_actual}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Stock Mínimo"
                name="stock_minimo"
                type="number"
                value={formData.stock_minimo}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Stock Máximo"
                name="stock_maximo"
                type="number"
                value={formData.stock_maximo}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                select
                label="Requiere fecha de vencimiento"
                name="requiere_vencimiento"
                value={String(formData.requiere_vencimiento)}
                onChange={(e) => {
                  setFormData({
                    ...formData,
                    requiere_vencimiento: e.target.value === 'true'
                  });
                }}
                InputLabelProps={{
                  shrink: true,
                }}
                helperText="Indica si el producto tiene fecha de caducidad"
              >
                <MenuItem value="false">No</MenuItem>
                <MenuItem value="true">Sí</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Días de alerta antes de vencer"
                name="dias_alerta_vencimiento"
                type="number"
                value={formData.dias_alerta_vencimiento}
                onChange={handleChange}
                helperText="Días antes de la fecha de vencimiento para mostrar alerta"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingProducto ? 'Guardar Cambios' : 'Crear Producto'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog para gestionar lotes */}
      {gestionandoLotes && (
        <Dialog 
          open={!!gestionandoLotes} 
          onClose={() => setGestionandoLotes(null)} 
          maxWidth="md" 
          fullWidth
        >
          <DialogContent>
            <GestionLotes
              productoId={gestionandoLotes.id}
              nombreProducto={gestionandoLotes.nombre}
              onClose={() => setGestionandoLotes(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </Box>
  );
};

export default Productos;
