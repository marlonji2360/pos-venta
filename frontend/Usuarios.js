// src/pages/Usuarios.js
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Person as PersonIcon,
  Lock as LockIcon,
  Refresh as RefreshIcon,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import { format } from 'date-fns';

const Usuarios = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);  // ← Cargar dinámicamente
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [openPasswordDialog, setOpenPasswordDialog] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: '',
    telefono: '',
    rol_id: 3, // Por defecto Vendedor
  });

  const [passwordData, setPasswordData] = useState({
    nueva_password: '',
    confirmar_password: '',
  });

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const cargarUsuarios = async () => {
    try {
      setLoading(true);
      const [usuariosRes, rolesRes] = await Promise.all([
        api.get('/api/usuarios'),
        api.get('/api/usuarios/roles')
      ]);
      setUsuarios(usuariosRes.data.usuarios);
      setRoles(rolesRes.data.roles || []);
    } catch (err) {
      setError('Error al cargar usuarios');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (usuario = null) => {
    if (usuario) {
      setEditingUsuario(usuario);
      setFormData({
        nombre: usuario.nombre,
        email: usuario.email,
        password: '',
        telefono: usuario.telefono || '',
        rol_id: usuario.rol_id,
      });
    } else {
      setEditingUsuario(null);
      setFormData({
        nombre: '',
        email: '',
        password: '',
        telefono: '',
        rol_id: 3,
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingUsuario(null);
  };

  const handleOpenPasswordDialog = (usuario) => {
    setEditingUsuario(usuario);
    setPasswordData({
      nueva_password: '',
      confirmar_password: '',
    });
    setOpenPasswordDialog(true);
  };

  const handleClosePasswordDialog = () => {
    setOpenPasswordDialog(false);
    setEditingUsuario(null);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handlePasswordChange = (e) => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async () => {
    try {
      if (!formData.nombre.trim() || !formData.email.trim()) {
        setError('Nombre y email son requeridos');
        return;
      }

      if (!editingUsuario && !formData.password) {
        setError('La contraseña es requerida para nuevos usuarios');
        return;
      }

      if (editingUsuario) {
        await api.put(`/api/usuarios/${editingUsuario.id}`, {
          nombre: formData.nombre,
          email: formData.email,
          telefono: formData.telefono,
          rol_id: formData.rol_id,
        });
        setSuccess('Usuario actualizado exitosamente');
      } else {
        await api.post('/api/usuarios', formData);
        setSuccess('Usuario creado exitosamente');
      }
      
      handleCloseDialog();
      cargarUsuarios();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar usuario');
    }
  };

  const handleChangePassword = async () => {
    try {
      if (passwordData.nueva_password !== passwordData.confirmar_password) {
        setError('Las contraseñas no coinciden');
        return;
      }

      if (passwordData.nueva_password.length < 6) {
        setError('La contraseña debe tener al menos 6 caracteres');
        return;
      }

      await api.patch(`/api/usuarios/${editingUsuario.id}/password`, {
        nueva_password: passwordData.nueva_password,
      });
      
      setSuccess('Contraseña actualizada exitosamente');
      handleClosePasswordDialog();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cambiar contraseña');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Estás seguro de desactivar este usuario?')) {
      try {
        await api.delete(`/api/usuarios/${id}`);
        setSuccess('Usuario desactivado exitosamente');
        cargarUsuarios();
      } catch (err) {
        setError(err.response?.data?.error || 'Error al desactivar usuario');
      }
    }
  };

  const handleReactivar = async (id) => {
    if (window.confirm('¿Estás seguro de reactivar este usuario?')) {
      try {
        await api.patch(`/api/usuarios/${id}/reactivar`);
        setSuccess('Usuario reactivado exitosamente');
        cargarUsuarios();
      } catch (err) {
        setError(err.response?.data?.error || 'Error al reactivar usuario');
      }
    }
  };

  const getColorPorDefecto = (nombreRol) => {
    const coloresPorDefecto = {
      'Administrador': 'error',
      'Gerente': 'warning',
      'Vendedor': 'info',
      'Piloto': 'secondary'
    };
    return coloresPorDefecto[nombreRol] || 'default';
  };

  const getRolInfo = (rol_id) => {
    const rol = roles.find(r => r.id === rol_id);
    if (!rol) return { nombre: 'Desconocido', color: 'default' };
    
    return {
      nombre: rol.nombre,
      color: rol.color || getColorPorDefecto(rol.nombre)
    };
  };

  const usuariosFiltrados = usuarios.filter((usuario) =>
    usuario.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (usuario.email && usuario.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (usuario.telefono && usuario.telefono.includes(searchTerm))
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Usuarios
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gestión de usuarios del sistema
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Nuevo Usuario
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

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <TextField
            fullWidth
            placeholder="Buscar por nombre, email o teléfono..."
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
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Total: {usuariosFiltrados.length} usuarios
          </Typography>
        </CardContent>
      </Card>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'primary.light' }}>
              <TableCell>Nombre</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Teléfono</TableCell>
              <TableCell align="center">Rol</TableCell>
              <TableCell align="center">Estado</TableCell>
              <TableCell>Último Acceso</TableCell>
              <TableCell align="center">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : usuariosFiltrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Box sx={{ py: 3 }}>
                    <PersonIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      {searchTerm ? 'No se encontraron usuarios' : 'No hay usuarios registrados'}
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              usuariosFiltrados.map((usuario) => {
                const rolInfo = getRolInfo(usuario.rol_id);
                return (
                  <TableRow key={usuario.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PersonIcon color="primary" />
                        <Typography variant="body2" fontWeight="medium">
                          {usuario.nombre}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{usuario.email}</TableCell>
                    <TableCell>{usuario.telefono || '-'}</TableCell>
                    <TableCell align="center">
                      <Chip
                        label={rolInfo.nombre}
                        size="small"
                        color={rolInfo.color}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={usuario.activo ? 'Activo' : 'Inactivo'}
                        size="small"
                        color={usuario.activo ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      {usuario.ultimo_acceso 
                        ? format(new Date(usuario.ultimo_acceso), 'dd/MM/yyyy HH:mm')
                        : 'Nunca'
                      }
                    </TableCell>
                    <TableCell align="center">
                      {usuario.activo ? (
                        <>
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleOpenDialog(usuario)}
                            title="Editar"
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="secondary"
                            onClick={() => handleOpenPasswordDialog(usuario)}
                            title="Cambiar contraseña"
                          >
                            <LockIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDelete(usuario.id)}
                            title="Desactivar"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </>
                      ) : (
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() => handleReactivar(usuario.id)}
                          title="Reactivar"
                        >
                          <RefreshIcon />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Dialog para agregar/editar usuario */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingUsuario ? 'Editar Usuario' : 'Nuevo Usuario'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                label="Nombre Completo"
                name="nombre"
                value={formData.nombre}
                onChange={handleChange}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                label="Email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            {!editingUsuario && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  label="Contraseña"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleChange}
                  InputLabelProps={{ shrink: true }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  helperText="Mínimo 6 caracteres"
                />
              </Grid>
            )}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Teléfono"
                name="telefono"
                value={formData.telefono}
                onChange={handleChange}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel shrink>Rol</InputLabel>
                <Select
                  name="rol_id"
                  value={formData.rol_id}
                  onChange={handleChange}
                  label="Rol"
                >
                  {roles.map((rol) => (
                    <MenuItem key={rol.id} value={rol.id}>
                      {rol.nombre}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingUsuario ? 'Guardar Cambios' : 'Crear Usuario'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog para cambiar contraseña */}
      <Dialog open={openPasswordDialog} onClose={handleClosePasswordDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          Cambiar Contraseña - {editingUsuario?.nombre}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                label="Nueva Contraseña"
                name="nueva_password"
                type={showPassword ? 'text' : 'password'}
                value={passwordData.nueva_password}
                onChange={handlePasswordChange}
                InputLabelProps={{ shrink: true }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                helperText="Mínimo 6 caracteres"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                label="Confirmar Contraseña"
                name="confirmar_password"
                type={showPassword ? 'text' : 'password'}
                value={passwordData.confirmar_password}
                onChange={handlePasswordChange}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePasswordDialog}>Cancelar</Button>
          <Button onClick={handleChangePassword} variant="contained">
            Cambiar Contraseña
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Usuarios;
