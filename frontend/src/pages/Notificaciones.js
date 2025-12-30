// src/pages/Notificaciones.js
import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Grid,
  Divider,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Schedule as ScheduleIcon,
  LocalShipping as LocalShippingIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const Notificaciones = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notificaciones, setNotificaciones] = useState([]);
  const [resumen, setResumen] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    cargarNotificaciones();
  }, []);

  const cargarNotificaciones = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/notificaciones');
      setNotificaciones(response.data.notificaciones);
      setResumen(response.data.resumen);
    } catch (err) {
      setError('Error al cargar notificaciones');
    } finally {
      setLoading(false);
    }
  };

  const getIcono = (tipo) => {
    switch (tipo) {
      case 'stock_bajo':
        return <WarningIcon />;
      case 'producto_vencer':
        return <ScheduleIcon />;
      case 'pedido_pendiente':
        return <LocalShippingIcon />;
      case 'sin_stock':
        return <ErrorIcon />;
      default:
        return <WarningIcon />;
    }
  };

  const getColorPrioridad = (prioridad) => {
    switch (prioridad) {
      case 'alta':
        return 'error';
      case 'media':
        return 'warning';
      case 'baja':
        return 'info';
      default:
        return 'default';
    }
  };

  const handleNotificacionClick = (notificacion) => {
    // Redirigir según el tipo de notificación
    switch (notificacion.tipo) {
      case 'stock_bajo':
      case 'sin_stock':
        navigate('/productos');
        break;
      case 'producto_vencer':
        navigate('/productos');
        break;
      case 'pedido_pendiente':
        navigate('/pedidos');
        break;
      default:
        break;
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Notificaciones
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Alertas y avisos importantes del sistema
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Resumen */}
      {resumen && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">Total</Typography>
                <Typography variant="h3" color="primary">{resumen.total}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">Prioridad Alta</Typography>
                <Typography variant="h3" color="error.main">{resumen.por_prioridad.alta}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">Prioridad Media</Typography>
                <Typography variant="h3" color="warning.main">{resumen.por_prioridad.media}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">Stock Bajo</Typography>
                <Typography variant="h3">{resumen.por_tipo.stock_bajo}</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Lista de notificaciones */}
      <Card>
        <CardContent>
          {notificaciones.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 5 }}>
              <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                ¡Todo en orden!
              </Typography>
              <Typography variant="body2" color="text.secondary">
                No hay notificaciones pendientes
              </Typography>
            </Box>
          ) : (
            <List>
              {notificaciones.map((notif, index) => (
                <React.Fragment key={notif.id}>
                  <ListItem
                    button
                    onClick={() => handleNotificacionClick(notif)}
                    sx={{
                      '&:hover': {
                        bgcolor: 'action.hover',
                      },
                      borderRadius: 1,
                      mb: 1,
                    }}
                  >
                    <ListItemIcon>
                      {getIcono(notif.tipo)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle1">
                            {notif.titulo}
                          </Typography>
                          <Chip
                            label={notif.prioridad}
                            size="small"
                            color={getColorPrioridad(notif.prioridad)}
                          />
                        </Box>
                      }
                      secondary={notif.mensaje}
                    />
                  </ListItem>
                  {index < notificaciones.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default Notificaciones;
