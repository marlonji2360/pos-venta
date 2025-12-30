// src/components/GestionLotes.js
import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
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
  TextField,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';

const GestionLotes = ({ productoId, nombreProducto, onClose }) => {
  const [lotes, setLotes] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [formData, setFormData] = useState({
    numero_lote: '',
    cantidad: '',
    fecha_vencimiento: '',
    precio_compra: '',
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    cargarLotes();
  }, [productoId]);

  const cargarLotes = async () => {
    try {
      const response = await api.get(`/api/productos/${productoId}`);
      setLotes(response.data.lotes || []);
    } catch (err) {
      setError('Error al cargar lotes');
    }
  };

  const handleOpenDialog = () => {
    setFormData({
      numero_lote: `LOTE-${Date.now()}`,
      cantidad: '',
      fecha_vencimiento: '',
      precio_compra: '',
    });
    setOpenDialog(true);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async () => {
    try {
      await api.post('/api/lotes', {
        ...formData,
        producto_id: productoId,
      });
      setOpenDialog(false);
      cargarLotes();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear lote');
    }
  };

  const getEstadoVencimiento = (fechaVencimiento) => {
    const hoy = new Date();
    const vencimiento = new Date(fechaVencimiento);
    const diasRestantes = Math.ceil((vencimiento - hoy) / (1000 * 60 * 60 * 24));

    if (diasRestantes < 0) return { texto: 'Vencido', color: 'error' };
    if (diasRestantes <= 7) return { texto: 'Urgente', color: 'error' };
    if (diasRestantes <= 30) return { texto: 'Próximo', color: 'warning' };
    return { texto: 'Normal', color: 'success' };
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Lotes de: {nombreProducto}
        </Typography>
        <Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenDialog}
            size="small"
            sx={{ mr: 1 }}
          >
            Nuevo Lote
          </Button>
          <Button onClick={onClose} size="small">
            Cerrar
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Número de Lote</TableCell>
              <TableCell align="right">Cantidad</TableCell>
              <TableCell>Fecha Vencimiento</TableCell>
              <TableCell>Días Restantes</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell align="center">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {lotes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Box sx={{ py: 2 }}>
                    <WarningIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      No hay lotes registrados para este producto
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              lotes.map((lote) => {
                const estado = getEstadoVencimiento(lote.fecha_vencimiento);
                const diasRestantes = Math.ceil(
                  (new Date(lote.fecha_vencimiento) - new Date()) / (1000 * 60 * 60 * 24)
                );
                
                return (
                  <TableRow key={lote.id}>
                    <TableCell>{lote.numero_lote}</TableCell>
                    <TableCell align="right">{lote.cantidad}</TableCell>
                    <TableCell>
                      {format(new Date(lote.fecha_vencimiento), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell>
                      {diasRestantes > 0 ? `${diasRestantes} días` : 'Vencido'}
                    </TableCell>
                    <TableCell>
                      <Chip label={estado.texto} size="small" color={estado.color} />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton size="small" color="error">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Dialog para crear lote */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nuevo Lote</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                label="Número de Lote"
                name="numero_lote"
                value={formData.numero_lote}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                required
                label="Cantidad"
                name="cantidad"
                type="number"
                value={formData.cantidad}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Precio Compra"
                name="precio_compra"
                type="number"
                value={formData.precio_compra}
                onChange={handleChange}
                InputProps={{
                  startAdornment: 'Q',
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                label="Fecha de Vencimiento"
                name="fecha_vencimiento"
                type="date"
                value={formData.fecha_vencimiento}
                onChange={handleChange}
                InputLabelProps={{
                  shrink: true,
                }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} variant="contained">
            Crear Lote
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GestionLotes;
