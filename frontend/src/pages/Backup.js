// src/pages/Backup.js
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Alert,
  Chip,
  TextField,
  LinearProgress,
} from '@mui/material';
import {
  Backup as BackupIcon,
  CloudDownload as CloudDownloadIcon,
  Delete as DeleteIcon,
  Restore as RestoreIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';

const Backup = () => {
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [backups, setBackups] = useState([]);
  const [info, setInfo] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogType, setDialogType] = useState('');
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [descripcion, setDescripcion] = useState('');

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const [backupsRes, infoRes] = await Promise.all([
        api.get('/api/backup/listar'),
        api.get('/api/backup/info')
      ]);
      
      setBackups(backupsRes.data.backups);
      setInfo(infoRes.data);
    } catch (err) {
      setError('Error al cargar datos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const crearBackup = async () => {
    try {
      setCreating(true);
      setError(null);
      
      const response = await api.post('/api/backup/crear', {
        descripcion: descripcion || 'Backup manual'
      });
      
      setSuccess(`Backup creado exitosamente: ${response.data.backup.nombre}`);
      setDescripcion('');
      handleCloseDialog();
      cargarDatos();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear backup');
    } finally {
      setCreating(false);
    }
  };

  const descargarBackup = async (nombre) => {
    try {
      const response = await api.get(`/api/backup/descargar/${nombre}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', nombre);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      setSuccess('Backup descargado exitosamente');
    } catch (err) {
      setError('Error al descargar backup');
    }
  };

  const eliminarBackup = async () => {
    try {
      await api.delete(`/api/backup/eliminar/${selectedBackup.nombre}`);
      setSuccess('Backup eliminado exitosamente');
      handleCloseDialog();
      cargarDatos();
    } catch (err) {
      setError('Error al eliminar backup');
    }
  };

  const restaurarBackup = async () => {
    try {
      setCreating(true);
      await api.post(`/api/backup/restaurar/${selectedBackup.nombre}`);
      setSuccess('Backup restaurado exitosamente. Se recomienda reiniciar el sistema.');
      handleCloseDialog();
      cargarDatos();
    } catch (err) {
      setError('Error al restaurar backup');
    } finally {
      setCreating(false);
    }
  };

  const handleOpenDialog = (type, backup = null) => {
    setDialogType(type);
    setSelectedBackup(backup);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setDialogType('');
    setSelectedBackup(null);
    setDescripcion('');
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Backup de Base de Datos
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gestión de respaldos del sistema
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
            startIcon={<BackupIcon />}
            onClick={() => handleOpenDialog('crear')}
          >
            Crear Backup
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

      {creating && (
        <Box sx={{ mb: 2 }}>
          <Alert severity="info">
            Procesando... Esto puede tomar unos momentos.
          </Alert>
          <LinearProgress sx={{ mt: 1 }} />
        </Box>
      )}

      {/* Información del Sistema */}
      {info && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Tamaño Base de Datos
                </Typography>
                <Typography variant="h4" color="primary">
                  {info.tamano_base_datos}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Total de Backups
                </Typography>
                <Typography variant="h4">
                  {backups.length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Último Backup
                </Typography>
                <Typography variant="h6">
                  {backups.length > 0 
                    ? format(new Date(backups[0].fecha), 'dd/MM/yyyy HH:mm')
                    : 'Sin backups'
                  }
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Advertencias */}
      <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 3 }}>
        <Typography variant="body2" fontWeight="bold" gutterBottom>
          Importante:
        </Typography>
        <Typography variant="body2">
          • Los backups se almacenan en el servidor. Descárgalos periódicamente para mayor seguridad.
        </Typography>
        <Typography variant="body2">
          • Restaurar un backup eliminará TODOS los datos actuales y los reemplazará con el backup.
        </Typography>
        <Typography variant="body2">
          • Se recomienda crear un backup antes de hacer cambios importantes.
        </Typography>
      </Alert>

      {/* Lista de Backups */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Backups Disponibles
          </Typography>
          
          {loading ? (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              Cargando...
            </Box>
          ) : backups.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 5 }}>
              <BackupIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="body1" color="text.secondary">
                No hay backups disponibles
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Crea tu primer backup para comenzar
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Nombre del Archivo</TableCell>
                    <TableCell>Fecha de Creación</TableCell>
                    <TableCell align="right">Tamaño</TableCell>
                    <TableCell align="center">Estado</TableCell>
                    <TableCell align="center">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {backups.map((backup) => (
                    <TableRow key={backup.nombre} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {backup.nombre}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {format(new Date(backup.fecha), 'dd/MM/yyyy HH:mm:ss')}
                      </TableCell>
                      <TableCell align="right">
                        {formatBytes(backup.tamano)}
                      </TableCell>
                      <TableCell align="center">
                        <Chip 
                          label="Disponible" 
                          size="small" 
                          color="success"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => descargarBackup(backup.nombre)}
                          title="Descargar"
                        >
                          <CloudDownloadIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="warning"
                          onClick={() => handleOpenDialog('restaurar', backup)}
                          title="Restaurar"
                        >
                          <RestoreIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleOpenDialog('eliminar', backup)}
                          title="Eliminar"
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
        </CardContent>
      </Card>

      {/* Información de Tablas */}
      {info && info.tablas_grandes && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Tablas Más Grandes
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Tabla</TableCell>
                    <TableCell align="right">Tamaño</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {info.tablas_grandes.map((tabla) => (
                    <TableRow key={tabla.tablename}>
                      <TableCell>{tabla.tablename}</TableCell>
                      <TableCell align="right">{tabla.size}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Configuración de Backups Automáticos */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Backups Automáticos (Cron)
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            Los backups automáticos requieren configuración en el servidor. Sigue las instrucciones para configurar cron.
          </Alert>
          
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="primary" gutterBottom>
                    Backup Diario
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Todos los días a las 2:00 AM
                  </Typography>
                  <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                    Cron: 0 2 * * *
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="success.main" gutterBottom>
                    Backup Semanal
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Domingos a las 3:00 AM
                  </Typography>
                  <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                    Cron: 0 3 * * 0
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="warning.main" gutterBottom>
                    Backup Mensual
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Día 1 de cada mes a las 4:00 AM
                  </Typography>
                  <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                    Cron: 0 4 1 * *
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" gutterBottom>
              <strong>Pasos para configurar:</strong>
            </Typography>
            <Typography variant="body2" component="div">
              1. Descarga el script de backup automático<br/>
              2. Colócalo en: <code>backend/scripts/backup-automatico.sh</code><br/>
              3. Da permisos: <code>chmod +x backup-automatico.sh</code><br/>
              4. Configura cron: <code>crontab -e</code><br/>
              5. Agrega las líneas de los horarios deseados
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Dialog para Crear Backup */}
      <Dialog open={openDialog && dialogType === 'crear'} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Crear Nuevo Backup</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Descripción (opcional)"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej: Backup antes de actualización"
              multiline
              rows={2}
            />
            <Alert severity="info" sx={{ mt: 2 }}>
              Se creará un backup completo de la base de datos. Este proceso puede tomar algunos minutos dependiendo del tamaño.
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={creating}>
            Cancelar
          </Button>
          <Button 
            onClick={crearBackup} 
            variant="contained" 
            disabled={creating}
            startIcon={<BackupIcon />}
          >
            {creating ? 'Creando...' : 'Crear Backup'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog para Eliminar */}
      <Dialog open={openDialog && dialogType === 'eliminar'} onClose={handleCloseDialog}>
        <DialogTitle>Eliminar Backup</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            ¿Estás seguro de eliminar este backup?
          </Alert>
          <Typography>
            <strong>Archivo:</strong> {selectedBackup?.nombre}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Esta acción no se puede deshacer.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button onClick={eliminarBackup} color="error" variant="contained">
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog para Restaurar */}
      <Dialog open={openDialog && dialogType === 'restaurar'} onClose={handleCloseDialog}>
        <DialogTitle>Restaurar Backup</DialogTitle>
        <DialogContent>
          <Alert severity="error" icon={<WarningIcon />} sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight="bold">
              ⚠️ ADVERTENCIA CRÍTICA
            </Typography>
            <Typography variant="body2">
              Restaurar este backup eliminará TODOS los datos actuales de la base de datos y los reemplazará con el backup seleccionado.
            </Typography>
          </Alert>
          <Typography gutterBottom>
            <strong>Archivo:</strong> {selectedBackup?.nombre}
          </Typography>
          <Typography gutterBottom>
            <strong>Fecha:</strong> {selectedBackup && format(new Date(selectedBackup.fecha), 'dd/MM/yyyy HH:mm')}
          </Typography>
          <Alert severity="info" sx={{ mt: 2 }}>
            Se recomienda crear un backup actual antes de restaurar.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={creating}>
            Cancelar
          </Button>
          <Button 
            onClick={restaurarBackup} 
            color="warning" 
            variant="contained"
            disabled={creating}
          >
            {creating ? 'Restaurando...' : 'Confirmar Restauración'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Backup;
