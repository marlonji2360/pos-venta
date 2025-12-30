// src/pages/Configuracion.js
import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Grid,
  Alert,
  Divider,
  InputAdornment,
} from '@mui/material';
import {
  Save as SaveIcon,
  Store as StoreIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Business as BusinessIcon,
  AttachMoney as AttachMoneyIcon,
  Receipt as ReceiptIcon,
} from '@mui/icons-material';

const Configuracion = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [formData, setFormData] = useState({
    nombre_negocio: '',
    direccion: '',
    telefono: '',
    email: '',
    nit: '',
    moneda: 'Q',
    iva: '12',
    ticket_mensaje: '',
    ticket_pie: '',
  });

  useEffect(() => {
    cargarConfiguracion();
  }, []);

  const cargarConfiguracion = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/configuracion');
      
      // Convertir el objeto de configuración a formData
      const config = response.data.configuracion;
      const newFormData = {};
      
      Object.keys(config).forEach(key => {
        newFormData[key] = config[key].valor || '';
      });
      
      setFormData(newFormData);
    } catch (err) {
      setError('Error al cargar configuración');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      setError(null);
      
      await api.put('/api/configuracion', {
        configuracion: formData
      });
      
      setSuccess('Configuración guardada exitosamente');
      
      // Limpiar mensaje después de 3 segundos
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        Cargando...
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Configuración del Sistema
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Personaliza la información de tu negocio
      </Typography>

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

      <form onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          {/* Información del Negocio */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <StoreIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6">Información del Negocio</Typography>
                </Box>
                <Divider sx={{ mb: 3 }} />
                
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      required
                      label="Nombre del Negocio"
                      name="nombre_negocio"
                      value={formData.nombre_negocio}
                      onChange={handleChange}
                      InputLabelProps={{ shrink: true }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <StoreIcon />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="NIT"
                      name="nit"
                      value={formData.nit}
                      onChange={handleChange}
                      InputLabelProps={{ shrink: true }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <BusinessIcon />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Dirección"
                      name="direccion"
                      value={formData.direccion}
                      onChange={handleChange}
                      multiline
                      rows={2}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Teléfono"
                      name="telefono"
                      value={formData.telefono}
                      onChange={handleChange}
                      InputLabelProps={{ shrink: true }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <PhoneIcon />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      InputLabelProps={{ shrink: true }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <EmailIcon />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Configuración de Moneda e Impuestos */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <AttachMoneyIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6">Moneda e Impuestos</Typography>
                </Box>
                <Divider sx={{ mb: 3 }} />
                
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Símbolo de Moneda"
                      name="moneda"
                      value={formData.moneda}
                      onChange={handleChange}
                      InputLabelProps={{ shrink: true }}
                      helperText="Ej: Q, $, €"
                    />
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="IVA (%)"
                      name="iva"
                      type="number"
                      value={formData.iva}
                      onChange={handleChange}
                      InputLabelProps={{ shrink: true }}
                      inputProps={{ min: 0, max: 100, step: 0.01 }}
                      helperText="Porcentaje de IVA aplicado"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Configuración de Tickets */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <ReceiptIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6">Configuración de Tickets</Typography>
                </Box>
                <Divider sx={{ mb: 3 }} />
                
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Mensaje de Agradecimiento"
                      name="ticket_mensaje"
                      value={formData.ticket_mensaje}
                      onChange={handleChange}
                      InputLabelProps={{ shrink: true }}
                      helperText="Mensaje que aparece en el ticket después del total"
                    />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Pie de Página"
                      name="ticket_pie"
                      value={formData.ticket_pie}
                      onChange={handleChange}
                      InputLabelProps={{ shrink: true }}
                      helperText="Texto al final del ticket"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Vista Previa del Ticket */}
          <Grid item xs={12}>
            <Card sx={{ bgcolor: 'grey.50' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Vista Previa del Ticket
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                <Box sx={{ 
                  bgcolor: 'white', 
                  p: 3, 
                  border: '2px dashed',
                  borderColor: 'grey.300',
                  borderRadius: 1,
                  fontFamily: 'monospace',
                  maxWidth: 400,
                  mx: 'auto'
                }}>
                  <Typography align="center" fontWeight="bold" gutterBottom>
                    {formData.nombre_negocio || '[Nombre del Negocio]'}
                  </Typography>
                  <Typography align="center" variant="body2" gutterBottom>
                    {formData.direccion || '[Dirección]'}
                  </Typography>
                  <Typography align="center" variant="body2" gutterBottom>
                    Tel: {formData.telefono || '[Teléfono]'}
                  </Typography>
                  <Typography align="center" variant="body2" gutterBottom>
                    NIT: {formData.nit || '[NIT]'}
                  </Typography>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Typography variant="body2" gutterBottom>
                    Folio: VTA-000001
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    Fecha: 27/12/2025 15:30
                  </Typography>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Typography variant="body2">Producto Ejemplo x 2</Typography>
                  <Typography variant="body2" align="right">
                    {formData.moneda}50.00
                  </Typography>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Typography variant="body1" fontWeight="bold" align="right">
                    TOTAL: {formData.moneda}50.00
                  </Typography>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Typography align="center" variant="body2" sx={{ mt: 2 }}>
                    {formData.ticket_mensaje || '[Mensaje de agradecimiento]'}
                  </Typography>
                  <Typography align="center" variant="body2">
                    {formData.ticket_pie || '[Pie de página]'}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Botón Guardar */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button
                variant="outlined"
                onClick={cargarConfiguracion}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="contained"
                size="large"
                startIcon={<SaveIcon />}
                disabled={saving}
              >
                {saving ? 'Guardando...' : 'Guardar Configuración'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </form>
    </Box>
  );
};

export default Configuracion;
