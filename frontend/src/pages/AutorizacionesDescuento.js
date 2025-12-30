// src/pages/AutorizacionesDescuento.js
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
  IconButton,
  Alert,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Tabs,
  Tab,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';

const AutorizacionesDescuento = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [autorizaciones, setAutorizaciones] = useState([]);
  const [tabActual, setTabActual] = useState(0); // 0=Pendientes, 1=Historial
  
  const [openDialog, setOpenDialog] = useState(false);
  const [autorizacionSeleccionada, setAutorizacionSeleccionada] = useState(null);
  const [aprobar, setAprobar] = useState(true);
  const [notas, setNotas] = useState('');

  useEffect(() => {
    cargarAutorizaciones();
    
    // Auto-refresh cada 5 segundos si hay pendientes
    const interval = setInterval(() => {
      if (tabActual === 0) {
        cargarAutorizaciones();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [tabActual]);

  const cargarAutorizaciones = async () => {
    try {
      setLoading(true);
      const estado = tabActual === 0 ? 'pendiente' : undefined;
      const response = await api.get('/api/descuentos/autorizaciones', {
        params: { estado }
      });
      
      setAutorizaciones(response.data.autorizaciones);
    } catch (err) {
      setError('Error al cargar autorizaciones');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAbrirDialog = (autorizacion, aprobarDescuento) => {
    setAutorizacionSeleccionada(autorizacion);
    setAprobar(aprobarDescuento);
    setNotas('');
    setOpenDialog(true);
  };

  const handleProcesarAutorizacion = async () => {
    try {
      await api.post(`/api/descuentos/autorizar/${autorizacionSeleccionada.id}`, {
        aprobar,
        notas
      });

      setSuccess(`Descuento ${aprobar ? 'aprobado' : 'rechazado'} exitosamente`);
      setOpenDialog(false);
      cargarAutorizaciones();
    } catch (err) {
      setError('Error al procesar autorización');
      console.error(err);
    }
  };

  const autorizacionesFiltradas = autorizaciones.filter(a => 
    tabActual === 0 ? a.estado === 'pendiente' : a.estado !== 'pendiente'
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Autorizaciones de Descuento
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Aprobar o rechazar solicitudes de descuentos adicionales
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={cargarAutorizaciones}
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
          <Tab label="Pendientes" />
          <Tab label="Historial" />
        </Tabs>

        <CardContent>
          {autorizacionesFiltradas.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 5 }}>
              <InfoIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                {tabActual === 0 
                  ? 'No hay autorizaciones pendientes'
                  : 'No hay historial de autorizaciones'
                }
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Fecha Solicitud</TableCell>
                    <TableCell>Solicitado Por</TableCell>
                    <TableCell>Monto</TableCell>
                    <TableCell>Porcentaje</TableCell>
                    <TableCell>Motivo</TableCell>
                    <TableCell>Estado</TableCell>
                    {tabActual === 0 && <TableCell align="center">Acciones</TableCell>}
                    {tabActual === 1 && <TableCell>Autorizado Por</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {autorizacionesFiltradas.map((autorizacion) => (
                    <TableRow key={autorizacion.id}>
                      <TableCell>
                        {format(new Date(autorizacion.fecha_solicitud), 'dd/MM/yyyy HH:mm')}
                      </TableCell>
                      <TableCell>{autorizacion.solicitado_por_nombre}</TableCell>
                      <TableCell>
                        <Typography fontWeight="bold" color="error">
                          Q{parseFloat(autorizacion.monto_descuento).toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {autorizacion.porcentaje_descuento && (
                          <Chip 
                            label={`${parseFloat(autorizacion.porcentaje_descuento).toFixed(1)}%`}
                            size="small"
                            color="warning"
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ maxWidth: 200 }}>
                          {autorizacion.motivo}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={autorizacion.estado}
                          size="small"
                          color={
                            autorizacion.estado === 'pendiente' ? 'warning' :
                            autorizacion.estado === 'aprobado' ? 'success' : 'error'
                          }
                        />
                      </TableCell>
                      {tabActual === 0 && (
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            color="success"
                            onClick={() => handleAbrirDialog(autorizacion, true)}
                            title="Aprobar"
                          >
                            <CheckCircleIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleAbrirDialog(autorizacion, false)}
                            title="Rechazar"
                          >
                            <CancelIcon />
                          </IconButton>
                        </TableCell>
                      )}
                      {tabActual === 1 && (
                        <TableCell>
                          {autorizacion.autorizado_por_nombre && (
                            <>
                              <Typography variant="body2">
                                {autorizacion.autorizado_por_nombre}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {format(new Date(autorizacion.fecha_respuesta), 'dd/MM/yyyy HH:mm')}
                              </Typography>
                            </>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Diálogo de Confirmación */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: aprobar ? 'success.main' : 'error.main', color: 'white' }}>
          {aprobar ? '✅ Aprobar Descuento' : '❌ Rechazar Descuento'}
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {autorizacionSeleccionada && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Alert severity={aprobar ? 'success' : 'warning'}>
                  <Typography variant="body2">
                    <strong>Monto:</strong> Q{parseFloat(autorizacionSeleccionada.monto_descuento).toFixed(2)}
                    {autorizacionSeleccionada.porcentaje_descuento && 
                      ` (${parseFloat(autorizacionSeleccionada.porcentaje_descuento).toFixed(1)}%)`
                    }
                  </Typography>
                  <Typography variant="body2">
                    <strong>Solicitado por:</strong> {autorizacionSeleccionada.solicitado_por_nombre}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Motivo:</strong> {autorizacionSeleccionada.motivo}
                  </Typography>
                </Alert>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Notas (opcional)"
                  multiline
                  rows={3}
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder={aprobar 
                    ? "Ej: Aprobado por cliente frecuente"
                    : "Ej: Descuento muy alto, solicitar autorización de gerencia"
                  }
                />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancelar</Button>
          <Button
            onClick={handleProcesarAutorizacion}
            variant="contained"
            color={aprobar ? 'success' : 'error'}
          >
            {aprobar ? 'Aprobar' : 'Rechazar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AutorizacionesDescuento;
