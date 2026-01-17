// src/pages/Envios.js
import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Box, Card, CardContent, Typography, Button, Grid, Alert, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Stepper, Step, StepLabel, Tabs, Tab, Avatar,
  Select, MenuItem, FormControl, InputLabel, Paper,
  InputAdornment, TablePagination, CircularProgress,
} from '@mui/material';
import {
  LocalShipping as ShippingIcon, CheckCircle as CheckIcon,
  Cancel as CancelIcon, Refresh as RefreshIcon, Info as InfoIcon,
  Phone as PhoneIcon, Place as PlaceIcon, AccessTime as TimeIcon,
  Person as PersonIcon, Receipt as ReceiptIcon, Search as SearchIcon,
  Print as PrintIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';

const Envios = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [envios, setEnvios] = useState([]);
  const [envioSeleccionado, setEnvioSeleccionado] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [tabActual, setTabActual] = useState(0);
  const [filtroEstado, setFiltroEstado] = useState('todos');
  
  // Paginación
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [totalEnvios, setTotalEnvios] = useState(0);
  
  // Búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estados para confirmar entrega
  const [openDialogEntrega, setOpenDialogEntrega] = useState(false);
  const [envioParaEntregar, setEnvioParaEntregar] = useState(null);
  const [datosEntrega, setDatosEntrega] = useState({
    firma_cliente: '',
    notas_piloto: ''
  });
  
  const [configuracion, setConfiguracion] = useState(null);
  
  const usuario = JSON.parse(localStorage.getItem('usuario'));
  const esPiloto = usuario?.rol === 'Piloto';
  const esGerente = usuario?.rol === 'Administrador' || usuario?.rol === 'Gerente';

  useEffect(() => {
    cargarEnvios();
    cargarConfiguracion();
    
    // Auto-refresh cada 30 segundos
    const interval = setInterval(cargarEnvios, 30000);
    return () => clearInterval(interval);
  }, [filtroEstado, page, rowsPerPage, searchTerm]);

  const cargarConfiguracion = async () => {
    try {
      const response = await api.get('/api/configuracion');
      const config = {};
      Object.keys(response.data.configuracion).forEach(key => {
        config[key] = response.data.configuracion[key].valor;
      });
      setConfiguracion(config);
    } catch (err) {
      console.error('Error al cargar configuración:', err);
    }
  };

  const cargarEnvios = async () => {
    try {
      setLoading(true);
      const params = {
        page: page + 1,
        limit: rowsPerPage
      };
      
      if (filtroEstado !== 'todos') {
        params.estado = filtroEstado;
      }
      
      if (searchTerm.trim()) {
        params.buscar = searchTerm.trim();
      }
      
      const response = await api.get('/api/envios', { params });
      setEnvios(response.data.envios || []);
      setTotalEnvios(response.data.total || 0);
    } catch (err) {
      setError('Error al cargar envíos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Paginación
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setPage(0);
  };

  const handleImprimirNotaEnvio = async (envioId) => {
    if (!configuracion) {
      setError('Configuración no cargada');
      return;
    }

    try {
      setLoading(true);
      
      // Obtener detalles completos del envío y productos
      const response = await api.get(`/api/envios/${envioId}`);
      const envio = response.data.envio;
      const productos = response.data.productos || [];
      
      if (!envio) {
        setError('No se pudo cargar el envío');
        return;
      }

      const contenidoHTML = generarNotaEnvioHTML(envio, productos);
      
      const ventanaImpresion = window.open('', '', 'width=800,height=600');
      ventanaImpresion.document.write(contenidoHTML);
      ventanaImpresion.document.close();
      ventanaImpresion.focus();
      
      setTimeout(() => {
        ventanaImpresion.print();
        ventanaImpresion.close();
      }, 250);

      setSuccess('Nota de envío enviada a impresora');
    } catch (err) {
      setError('Error al imprimir nota de envío: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const generarNotaEnvioHTML = (envio, productos) => {
    const moneda = configuracion.moneda || 'Q';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Courier New', monospace; padding: 10px; background: white; }
          .nota { width: 300px; margin: 0 auto; }
          .header { text-align: center; margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 10px; }
          .titulo { font-size: 16px; font-weight: bold; margin-bottom: 5px; }
          .empresa { font-size: 14px; margin-bottom: 3px; }
          .info { font-size: 11px; margin: 2px 0; }
          .section { margin: 10px 0; font-size: 11px; }
          .section-title { font-weight: bold; font-size: 12px; margin-bottom: 5px; }
          .section-line { margin: 3px 0; }
          .divider { border-top: 1px dashed #000; margin: 10px 0; }
          .divider-solid { border-top: 2px solid #000; margin: 10px 0; }
          .productos { margin: 15px 0; }
          table { width: 100%; border-collapse: collapse; font-size: 10px; }
          th { text-align: left; padding: 3px 0; border-bottom: 1px solid #000; }
          td { padding: 5px 0; border-bottom: 1px dashed #ccc; }
          .totales { margin: 15px 0; font-size: 11px; }
          .total-line { display: flex; justify-content: space-between; margin: 5px 0; }
          .total-final { font-size: 13px; font-weight: bold; border-top: 2px solid #000; padding-top: 8px; margin-top: 8px; }
          .firma { text-align: center; margin-top: 15px; font-size: 10px; }
          @media print { 
            body { padding: 0; }
            @page { size: 80mm auto; margin: 0; }
          }
        </style>
      </head>
      <body>
        <div class="nota">
          <div class="header">
            <div class="titulo">NOTA DE ENVÍO</div>
            <div class="empresa">${configuracion.nombre_negocio || 'TU EMPRESA'}</div>
            <div class="info">Tel: ${configuracion.telefono || ''}</div>
          </div>

          <div class="section">
            <div class="section-title">📦 INFORMACIÓN DEL PEDIDO</div>
            <div class="section-line">Folio: ${envio.venta_folio}</div>
            <div class="section-line">Fecha: ${format(new Date(envio.fecha_pedido), 'dd/MM/yyyy HH:mm')}</div>
            <div class="section-line">Vendedor: ${envio.vendedor_nombre || 'N/A'}</div>
            <div class="section-line">Piloto: ${envio.piloto_nombre || 'Sin asignar'}</div>
          </div>

          <div class="divider"></div>

          <div class="section">
            <div class="section-title">👤 DATOS DEL CLIENTE</div>
            <div class="section-line"><strong>Nombre:</strong> ${envio.nombre_contacto || envio.cliente_nombre || 'N/A'}</div>
            <div class="section-line"><strong>Teléfono:</strong> ${envio.telefono_contacto || envio.cliente_telefono || 'N/A'}</div>
          </div>

          <div class="divider"></div>

          <div class="section">
            <div class="section-title">📍 DIRECCIÓN DE ENTREGA</div>
            <div class="section-line">${envio.direccion_entrega || 'N/A'}</div>
            ${envio.referencia_direccion ? `<div class="section-line" style="margin-top: 5px; font-style: italic;"><strong>Referencia:</strong> ${envio.referencia_direccion}</div>` : ''}
          </div>

          ${envio.notas_cliente ? `
            <div class="divider"></div>
            <div class="section">
              <div class="section-title">📝 INDICACIONES ADICIONALES</div>
              <div class="section-line">${envio.notas_cliente}</div>
            </div>
          ` : ''}

          <div class="divider"></div>

          <div class="productos">
            <div class="section-title">📦 PRODUCTOS A ENTREGAR</div>
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th style="text-align: center;">Cant</th>
                </tr>
              </thead>
              <tbody>
                ${productos.map(p => `
                  <tr>
                    <td>${p.producto_nombre}</td>
                    <td style="text-align: center;"><strong>${p.cantidad}</strong></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="divider-solid"></div>

          <div class="totales">
            <div class="total-line">
              <span>Total del pedido:</span>
              <span><strong>${moneda}${parseFloat(envio.venta_total || 0).toFixed(2)}</strong></span>
            </div>
            <div class="total-line">
              <span>Costo de envío:</span>
              <span><strong>${moneda}${parseFloat(envio.costo_envio || 0).toFixed(2)}</strong></span>
            </div>
            <div class="total-line total-final">
              <span>TOTAL A COBRAR:</span>
              <span>${moneda}${(parseFloat(envio.venta_total || 0) + parseFloat(envio.costo_envio || 0)).toFixed(2)}</span>
            </div>
          </div>

          <div class="divider"></div>

          <div class="firma">
            <div style="margin-bottom: 5px;">✓ Firma del cliente: _________________</div>
            <div style="margin-top: 10px; font-style: italic;">Gracias por preferir ${configuracion.nombre_negocio || 'nuestro servicio'}</div>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  const handleVerDetalle = async (envioId) => {
    try {
      const response = await api.get(`/api/envios/${envioId}`);
      setEnvioSeleccionado(response.data);
      setOpenDialog(true);
    } catch (err) {
      setError('Error al cargar detalle');
    }
  };

  const handleCambiarEstado = async (envioId, nuevoEstado) => {
    try {
      await api.put(`/api/envios/${envioId}/estado`, {
        estado: nuevoEstado
      });
      
      setSuccess(`Estado cambiado a: ${getTextoEstado(nuevoEstado)}`);
      cargarEnvios();
      
      // Recargar detalle si está abierto
      if (openDialog) {
        const response = await api.get(`/api/envios/${envioId}`);
        setEnvioSeleccionado(response.data);
      }
    } catch (err) {
      setError('Error al cambiar estado');
      console.error(err);
    }
  };

  const handleMarcarEntregado = async (envioId) => {
    setEnvioParaEntregar(envioId);
    setDatosEntrega({
      firma_cliente: '',
      notas_piloto: ''
    });
    setOpenDialogEntrega(true);
  };

  const handleConfirmarEntrega = async () => {
    try {
      await api.put(`/api/envios/${envioParaEntregar}/entregar`, datosEntrega);
      setSuccess('Entrega registrada exitosamente');
      setOpenDialogEntrega(false);
      setOpenDialog(false);
      cargarEnvios();
    } catch (err) {
      setError('Error al registrar entrega');
      console.error(err);
    }
  };

  const getColorEstado = (estado) => {
    const colores = {
      pendiente: 'default',
      asignado: 'info',
      preparando: 'info',
      cargado: 'primary',
      en_ruta: 'warning',
      entregado: 'success',
      cancelado: 'error',
      fallido: 'error'
    };
    return colores[estado] || 'default';
  };

  const getTextoEstado = (estado) => {
    const textos = {
      pendiente: 'Pendiente',
      asignado: 'Asignado',
      preparando: 'Preparando',
      cargado: 'Cargado',
      en_ruta: 'En Ruta',
      entregado: 'Entregado',
      cancelado: 'Cancelado',
      fallido: 'Fallido'
    };
    return textos[estado] || estado;
  };

  const filtrarPorTab = (envio) => {
    if (tabActual === 0) return true; // Todos
    if (tabActual === 1) return envio.estado === 'pendiente'; // Pendientes
    if (tabActual === 2) return envio.estado === 'asignado'; // Asignados
    if (tabActual === 3) return ['preparando', 'cargado'].includes(envio.estado); // En Preparación
    if (tabActual === 4) return envio.estado === 'en_ruta'; // En Ruta
    if (tabActual === 5) return envio.estado === 'entregado'; // Entregados
    if (tabActual === 6) return ['cancelado', 'fallido'].includes(envio.estado); // Cancelados/Fallidos
    return true;
  };

  const contarEnviosPorEstado = (filtro) => {
    if (filtro === 'todos') return totalEnvios;
    if (filtro === 'pendiente') return envios.filter(e => e.estado === 'pendiente').length;
    if (filtro === 'asignado') return envios.filter(e => e.estado === 'asignado').length;
    if (filtro === 'preparacion') return envios.filter(e => ['preparando', 'cargado'].includes(e.estado)).length;
    if (filtro === 'en_ruta') return envios.filter(e => e.estado === 'en_ruta').length;
    if (filtro === 'entregado') return envios.filter(e => e.estado === 'entregado').length;
    if (filtro === 'cancelado') return envios.filter(e => ['cancelado', 'fallido'].includes(e.estado)).length;
    return 0;
  };

  const enviosFiltrados = envios.filter(filtrarPorTab);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            🚚 Envíos
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gestión de entregas y seguimiento
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={cargarEnvios}
        >
          Actualizar
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      <Card>
        <Tabs value={tabActual} onChange={(e, v) => setTabActual(v)} variant="scrollable" scrollButtons="auto">
          <Tab label={`📋 Todos (${contarEnviosPorEstado('todos')})`} />
          <Tab label={`⏳ Pendientes (${contarEnviosPorEstado('pendiente')})`} />
          <Tab label={`👤 Asignados (${contarEnviosPorEstado('asignado')})`} />
          <Tab label={`📦 En Preparación (${contarEnviosPorEstado('preparacion')})`} />
          <Tab label={`🚚 En Ruta (${contarEnviosPorEstado('en_ruta')})`} />
          <Tab label={`✅ Entregados (${contarEnviosPorEstado('entregado')})`} />
          <Tab label={`❌ Cancelados (${contarEnviosPorEstado('cancelado')})`} />
        </Tabs>

        <CardContent>
          {/* Filtros */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Buscar por folio, cliente, teléfono, dirección..."
                value={searchTerm}
                onChange={handleSearchChange}
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
              <FormControl fullWidth>
                <InputLabel>Estado</InputLabel>
                <Select
                  value={filtroEstado}
                  label="Estado"
                  onChange={(e) => {
                    setFiltroEstado(e.target.value);
                    setPage(0);
                  }}
                >
                  <MenuItem value="todos">Todos</MenuItem>
                  <MenuItem value="pendiente">Pendiente</MenuItem>
                  <MenuItem value="asignado">Asignado</MenuItem>
                  <MenuItem value="preparando">Preparando</MenuItem>
                  <MenuItem value="cargado">Cargado</MenuItem>
                  <MenuItem value="en_ruta">En Ruta</MenuItem>
                  <MenuItem value="entregado">Entregado</MenuItem>
                  <MenuItem value="cancelado">Cancelado</MenuItem>
                  <MenuItem value="fallido">Fallido</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                {totalEnvios} envío{totalEnvios !== 1 ? 's' : ''} encontrado{totalEnvios !== 1 ? 's' : ''}
              </Typography>
            </Grid>
          </Grid>

          {/* Tabla de Envíos */}
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Folio</TableCell>
                  <TableCell>Cliente</TableCell>
                  <TableCell>Dirección</TableCell>
                  <TableCell>Piloto</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell>Fecha Pedido</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell align="center">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <CircularProgress size={30} sx={{ my: 2 }} />
                    </TableCell>
                  </TableRow>
                ) : enviosFiltrados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                        No hay envíos para mostrar
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  enviosFiltrados.map((envio) => (
                    <TableRow key={envio.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {envio.venta_folio}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2">{envio.cliente_nombre || 'Sin nombre'}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {envio.cliente_telefono}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {envio.direccion_entrega}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {envio.piloto_nombre || 'Sin asignar'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getTextoEstado(envio.estado)}
                          size="small"
                          color={getColorEstado(envio.estado)}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {format(new Date(envio.fecha_pedido), 'dd/MM/yyyy HH:mm')}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="medium">
                          Q{parseFloat(envio.venta_total).toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleVerDetalle(envio.id)}
                          title="Ver detalle"
                        >
                          <InfoIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="secondary"
                          onClick={() => handleImprimirNotaEnvio(envio.id)}
                          title="Imprimir nota de envío"
                        >
                          <PrintIcon />
                        </IconButton>
                        {esPiloto && envio.estado === 'en_ruta' && (
                          <IconButton
                            size="small"
                            color="success"
                            onClick={() => handleMarcarEntregado(envio.id)}
                            title="Marcar como entregado"
                          >
                            <CheckIcon />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Paginación */}
          {!loading && (
            <TablePagination
              component="div"
              count={totalEnvios}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[10, 25, 50, 100]}
              labelRowsPerPage="Envíos por página:"
              labelDisplayedRows={({ from, to, count }) => 
                `${from}-${to} de ${count !== -1 ? count : `más de ${to}`}`
              }
            />
          )}
        </CardContent>
      </Card>

      {/* DIÁLOGO: DETALLE DEL ENVÍO */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        {envioSeleccionado && (
          <>
            <DialogTitle>
              Detalle del Envío - {envioSeleccionado.envio.venta_folio}
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                {/* Información del Cliente */}
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    👤 Cliente
                  </Typography>
                  <Typography variant="body2">
                    <strong>Nombre:</strong> {envioSeleccionado.envio.cliente_nombre}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Teléfono:</strong> {envioSeleccionado.envio.cliente_telefono}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Dirección:</strong> {envioSeleccionado.envio.direccion_entrega}
                  </Typography>
                  {envioSeleccionado.envio.referencia_direccion && (
                    <Typography variant="body2">
                      <strong>Referencia:</strong> {envioSeleccionado.envio.referencia_direccion}
                    </Typography>
                  )}
                </Grid>

                {/* Información del Piloto */}
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    🚗 Piloto
                  </Typography>
                  <Typography variant="body2">
                    <strong>Nombre:</strong> {envioSeleccionado.envio.piloto_nombre || 'Sin asignar'}
                  </Typography>
                  {envioSeleccionado.envio.piloto_telefono && (
                    <Typography variant="body2">
                      <strong>Teléfono:</strong> {envioSeleccionado.envio.piloto_telefono}
                    </Typography>
                  )}
                </Grid>

                {/* Estado Actual */}
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    📊 Estado
                  </Typography>
                  <Chip
                    label={getTextoEstado(envioSeleccionado.envio.estado)}
                    color={getColorEstado(envioSeleccionado.envio.estado)}
                    sx={{ mb: 2 }}
                  />
                </Grid>

                {/* Productos */}
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    📦 Productos
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Producto</TableCell>
                          <TableCell align="right">Cantidad</TableCell>
                          <TableCell align="right">Precio</TableCell>
                          <TableCell align="right">Total</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {envioSeleccionado.productos.map((prod) => (
                          <TableRow key={prod.id}>
                            <TableCell>{prod.producto_nombre}</TableCell>
                            <TableCell align="right">{prod.cantidad}</TableCell>
                            <TableCell align="right">Q{parseFloat(prod.precio_unitario).toFixed(2)}</TableCell>
                            <TableCell align="right">Q{parseFloat(prod.subtotal).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>

                {/* Acciones rápidas para piloto */}
                {esPiloto && envioSeleccionado.envio.estado !== 'entregado' && (
                  <Grid item xs={12}>
                    <Typography variant="h6" gutterBottom>
                      ⚡ Acciones Rápidas
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {envioSeleccionado.envio.estado === 'asignado' && (
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => handleCambiarEstado(envioSeleccionado.envio.id, 'preparando')}
                        >
                          Iniciar Preparación
                        </Button>
                      )}
                      {envioSeleccionado.envio.estado === 'preparando' && (
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => handleCambiarEstado(envioSeleccionado.envio.id, 'cargado')}
                        >
                          Marcar Cargado
                        </Button>
                      )}
                      {envioSeleccionado.envio.estado === 'cargado' && (
                        <Button
                          size="small"
                          variant="contained"
                          color="warning"
                          onClick={() => handleCambiarEstado(envioSeleccionado.envio.id, 'en_ruta')}
                        >
                          Salir a Ruta
                        </Button>
                      )}
                      {envioSeleccionado.envio.estado === 'en_ruta' && (
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          onClick={() => handleMarcarEntregado(envioSeleccionado.envio.id)}
                        >
                          Marcar Entregado
                        </Button>
                      )}
                    </Box>
                  </Grid>
                )}

                {/* Acciones de gestión para administradores/gerentes */}
                {esGerente && envioSeleccionado.envio.estado !== 'entregado' && (
                  <Grid item xs={12}>
                    <Typography variant="h6" gutterBottom>
                      🎛️ Gestión de Estado
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {envioSeleccionado.envio.estado === 'pendiente' && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleCambiarEstado(envioSeleccionado.envio.id, 'asignado')}
                        >
                          Marcar como Asignado
                        </Button>
                      )}
                      {['pendiente', 'asignado'].includes(envioSeleccionado.envio.estado) && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleCambiarEstado(envioSeleccionado.envio.id, 'preparando')}
                        >
                          Iniciar Preparación
                        </Button>
                      )}
                      {['pendiente', 'asignado', 'preparando'].includes(envioSeleccionado.envio.estado) && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleCambiarEstado(envioSeleccionado.envio.id, 'cargado')}
                        >
                          Marcar Cargado
                        </Button>
                      )}
                      {['pendiente', 'asignado', 'preparando', 'cargado'].includes(envioSeleccionado.envio.estado) && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="warning"
                          onClick={() => handleCambiarEstado(envioSeleccionado.envio.id, 'en_ruta')}
                        >
                          Enviar a Ruta
                        </Button>
                      )}
                      {envioSeleccionado.envio.estado === 'en_ruta' && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="success"
                          onClick={() => handleMarcarEntregado(envioSeleccionado.envio.id)}
                        >
                          Marcar Entregado
                        </Button>
                      )}
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        onClick={() => handleCambiarEstado(envioSeleccionado.envio.id, 'cancelado')}
                      >
                        Cancelar Envío
                      </Button>
                    </Box>
                  </Grid>
                )}
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpenDialog(false)}>Cerrar</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* DIÁLOGO: CONFIRMAR ENTREGA */}
      <Dialog open={openDialogEntrega} onClose={() => setOpenDialogEntrega(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: 'success.main', color: 'white' }}>
          ✅ Confirmar Entrega
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Nombre del que recibe (opcional)"
                value={datosEntrega.firma_cliente}
                onChange={(e) => setDatosEntrega({ ...datosEntrega, firma_cliente: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Notas del piloto (opcional)"
                value={datosEntrega.notas_piloto}
                onChange={(e) => setDatosEntrega({ ...datosEntrega, notas_piloto: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialogEntrega(false)}>Cancelar</Button>
          <Button onClick={handleConfirmarEntrega} variant="contained" color="success">
            Confirmar Entrega
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Envios;