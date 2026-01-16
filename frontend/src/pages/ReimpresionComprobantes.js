// src/pages/ReimpresionComprobantes.js
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
  Grid,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  InputAdornment,
  IconButton,
  Tabs,
  Tab,
  TablePagination,
} from '@mui/material';
import {
  Print as PrintIcon,
  Search as SearchIcon,
  Visibility as VisibilityIcon,
  Refresh as RefreshIcon,
  PictureAsPdf as PdfIcon,
  Receipt as ReceiptIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';

const ReimpresionComprobantes = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [ventas, setVentas] = useState([]);
  const [ventaSeleccionada, setVentaSeleccionada] = useState(null);
  const [openDetalle, setOpenDetalle] = useState(false);
  const [openCancelar, setOpenCancelar] = useState(false);
  const [ventaACancelar, setVentaACancelar] = useState(null);
  const [tabActual, setTabActual] = useState(0);
  
  // Paginación
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [fechaInicio, setFechaInicio] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [fechaFin, setFechaFin] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    cargarVentas();
  }, []);

  const cargarVentas = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/ventas');
      setVentas(response.data.ventas || []);
    } catch (err) {
      setError('Error al cargar ventas');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerDetalle = async (venta) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get(`/api/ventas/${venta.id}`);
      const productos = Array.isArray(response.data.productos) ? response.data.productos : [];
      
      if (productos.length === 0) {
        setError('Esta venta no tiene productos registrados');
      }
      
      const ventaCompleta = {
        ...response.data.venta,
        productos: productos,
        envio: response.data.envio || null
      };
      
      setVentaSeleccionada(ventaCompleta);
      setOpenDetalle(true);
      
    } catch (err) {
      setError('Error al cargar detalle de venta: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCancelar = (venta) => {
    setVentaACancelar(venta);
    setOpenCancelar(true);
  };

  const handleCancelarVenta = async () => {
    if (!ventaACancelar) return;

    try {
      setLoading(true);
      setError(null);
      
      await api.delete(`/api/ventas/${ventaACancelar.id}`);
      
      setSuccess(`Venta ${ventaACancelar.folio} cancelada exitosamente. Stock devuelto.`);
      setOpenCancelar(false);
      setVentaACancelar(null);
      
      await cargarVentas();
      
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cancelar venta');
    } finally {
      setLoading(false);
    }
  };

  const handleImprimirDirecto = async (venta) => {
    try {
      setLoading(true);
      
      const response = await api.get(`/api/ventas/${venta.id}`);
      const productos = Array.isArray(response.data.productos) ? response.data.productos : [];
      
      if (productos.length === 0) {
        setError('Esta venta no tiene productos para imprimir');
        setLoading(false);
        return;
      }
      
      const ventaCompleta = {
        ...response.data.venta,
        productos: productos
      };
      
      const ventanaImpresion = window.open('', '', 'width=800,height=600');
      const contenidoHTML = generarComprobante(ventaCompleta);
      
      ventanaImpresion.document.write(contenidoHTML);
      ventanaImpresion.document.close();
      ventanaImpresion.focus();
      
      setTimeout(() => {
        ventanaImpresion.print();
        ventanaImpresion.close();
      }, 250);

      setSuccess('Comprobante enviado a impresora');
    } catch (err) {
      setError('Error al imprimir comprobante: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDescargarPDF = async (venta) => {
    try {
      setLoading(true);
      
      const jsPDF = (await import('jspdf')).default;
      const html2canvas = (await import('html2canvas')).default;
      
      const response = await api.get(`/api/ventas/${venta.id}`);
      const productos = Array.isArray(response.data.productos) ? response.data.productos : [];
      
      if (productos.length === 0) {
        setError('Esta venta no tiene productos para generar PDF');
        setLoading(false);
        return;
      }
      
      const ventaCompleta = {
        ...response.data.venta,
        productos: productos
      };
      
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.innerHTML = generarComprobante(ventaCompleta);
      document.body.appendChild(tempDiv);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const canvas = await html2canvas(tempDiv.querySelector('.ticket'), {
        scale: 2,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [80, 200]
      });
      
      const imgWidth = 80;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`Comprobante_${ventaCompleta.folio}.pdf`);
      
      document.body.removeChild(tempDiv);
      
      setSuccess('PDF descargado exitosamente');
    } catch (err) {
      setError('Error al generar PDF: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleImprimir = () => {
    if (ventaSeleccionada) {
      handleImprimirDirecto(ventaSeleccionada);
      setOpenDetalle(false);
    }
  };

  const generarComprobante = (venta) => {
    const productos = venta.productos || [];
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Courier New', monospace; padding: 10px; background: white; }
          .ticket { width: 300px; margin: 0 auto; }
          .header { text-align: center; margin-bottom: 15px; border-bottom: 2px dashed #000; padding-bottom: 10px; }
          .empresa { font-size: 18px; font-weight: bold; margin-bottom: 5px; }
          .info { font-size: 11px; }
          .section { margin: 10px 0; font-size: 12px; }
          .productos { margin: 15px 0; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 10px 0; }
          .producto-item { margin: 8px 0; font-size: 11px; }
          .producto-nombre { font-weight: bold; }
          .producto-detalle { display: flex; justify-content: space-between; margin-top: 2px; }
          .totales { margin: 15px 0; }
          .total-line { display: flex; justify-content: space-between; margin: 5px 0; font-size: 12px; }
          .total-final { font-size: 16px; font-weight: bold; border-top: 2px solid #000; padding-top: 8px; margin-top: 8px; }
          .footer { text-align: center; margin-top: 20px; font-size: 11px; border-top: 2px dashed #000; padding-top: 10px; }
          ${venta.estado === 'cancelada' ? '.cancelada { color: #d32f2f; font-weight: bold; text-align: center; font-size: 20px; margin: 10px 0; border: 2px solid #d32f2f; padding: 10px; }' : ''}
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="ticket">
          <div class="header">
            <div class="empresa">TU EMPRESA</div>
            <div class="info">NIT: 123456789</div>
            <div class="info">Tel: 1234-5678</div>
          </div>
          ${venta.estado === 'cancelada' ? '<div class="cancelada">VENTA CANCELADA</div>' : ''}
          <div class="section">
            <div><strong>Folio:</strong> ${venta.folio}</div>
            <div><strong>Fecha:</strong> ${format(new Date(venta.fecha_venta), 'dd/MM/yyyy HH:mm')}</div>
            <div><strong>Cliente:</strong> ${venta.cliente_nombre || 'Público General'}</div>
            <div><strong>Vendedor:</strong> ${venta.usuario_nombre || venta.vendedor_nombre || '-'}</div>
            <div><strong>Método:</strong> ${venta.metodo_pago}</div>
            <div><strong>Estado:</strong> ${venta.estado === 'cancelada' ? 'CANCELADA' : 'COMPLETADA'}</div>
          </div>
          <div class="productos">
            <div style="font-weight: bold; margin-bottom: 5px;">PRODUCTOS</div>
            ${productos.map(p => `
              <div class="producto-item">
                <div class="producto-nombre">${p.producto_nombre}</div>
                <div class="producto-detalle">
                  <span>${p.cantidad} x Q${parseFloat(p.precio_unitario).toFixed(2)}</span>
                  <span>Q${parseFloat(p.subtotal).toFixed(2)}</span>
                </div>
              </div>
            `).join('')}
          </div>
          <div class="totales">
            <div class="total-line">
              <span>Subtotal:</span>
              <span>Q${parseFloat(venta.subtotal || venta.total).toFixed(2)}</span>
            </div>
            <div class="total-line total-final">
              <span>TOTAL:</span>
              <span>Q${parseFloat(venta.total).toFixed(2)}</span>
            </div>
          </div>
          <div class="footer">
            <div>¡Gracias por su compra!</div>
            <div>www.tuempresa.com</div>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  // Filtrar ventas
  const ventasFiltradas = ventas.filter((venta) => {
    let pasaFiltroTab = true;
    if (tabActual === 1) pasaFiltroTab = venta.estado === 'completada';
    if (tabActual === 2) pasaFiltroTab = venta.estado === 'cancelada';
    if (tabActual === 3) pasaFiltroTab = venta.metodo_pago === 'efectivo' && venta.estado !== 'cancelada';
    if (tabActual === 4) pasaFiltroTab = venta.metodo_pago === 'tarjeta' && venta.estado !== 'cancelada';
    if (tabActual === 5) pasaFiltroTab = venta.metodo_pago === 'transferencia' && venta.estado !== 'cancelada';

    let pasaFiltroBusqueda = true;
    if (busqueda.trim()) {
      const termino = busqueda.toLowerCase();
      pasaFiltroBusqueda = 
        venta.folio?.toLowerCase().includes(termino) ||
        venta.cliente_nombre?.toLowerCase().includes(termino) ||
        venta.vendedor_nombre?.toLowerCase().includes(termino);
    }

    let pasaFiltroFecha = true;
    if (fechaInicio || fechaFin) {
      const fechaVenta = new Date(venta.fecha_venta);
      if (fechaInicio) {
        const inicio = new Date(fechaInicio);
        inicio.setHours(0, 0, 0, 0);
        pasaFiltroFecha = pasaFiltroFecha && fechaVenta >= inicio;
      }
      if (fechaFin) {
        const fin = new Date(fechaFin);
        fin.setHours(23, 59, 59, 999);
        pasaFiltroFecha = pasaFiltroFecha && fechaVenta <= fin;
      }
    }

    return pasaFiltroTab && pasaFiltroBusqueda && pasaFiltroFecha;
  });

  const ventasPaginadas = ventasFiltradas.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const handleChangePage = (event, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  const handleChangeTab = (event, newValue) => {
    setTabActual(newValue);
    setPage(0);
  };

  const contarVentas = (filtro) => {
    if (filtro === 'todas') return ventas.length;
    if (filtro === 'completadas') return ventas.filter(v => v.estado === 'completada').length;
    if (filtro === 'canceladas') return ventas.filter(v => v.estado === 'cancelada').length;
    if (filtro === 'efectivo') return ventas.filter(v => v.metodo_pago === 'efectivo' && v.estado !== 'cancelada').length;
    if (filtro === 'tarjeta') return ventas.filter(v => v.metodo_pago === 'tarjeta' && v.estado !== 'cancelada').length;
    if (filtro === 'transferencia') return ventas.filter(v => v.metodo_pago === 'transferencia' && v.estado !== 'cancelada').length;
    return 0;
  };

  return (
    <Box sx={{ p: 3 }}>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom>Reimpresión de Comprobantes</Typography>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Buscar"
                placeholder="Folio, cliente o vendedor..."
                value={busqueda}
                onChange={(e) => { setBusqueda(e.target.value); setPage(0); }}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField fullWidth type="date" label="Fecha Inicio" value={fechaInicio}
                onChange={(e) => { setFechaInicio(e.target.value); setPage(0); }}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField fullWidth type="date" label="Fecha Fin" value={fechaFin}
                onChange={(e) => { setFechaFin(e.target.value); setPage(0); }}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <Button variant="outlined" startIcon={<RefreshIcon />} onClick={cargarVentas}>
                Actualizar Lista
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>Ventas ({ventasFiltradas.length})</Typography>

          <Tabs value={tabActual} onChange={handleChangeTab} sx={{ mb: 2 }} variant="scrollable" scrollButtons="auto">
            <Tab label={`Todas (${contarVentas('todas')})`} icon={<ReceiptIcon />} iconPosition="start" />
            <Tab label={`Completadas (${contarVentas('completadas')})`} icon={<Chip label="C" size="small" color="success" />} iconPosition="start" />
            <Tab label={`Canceladas (${contarVentas('canceladas')})`} icon={<Chip label="X" size="small" color="error" />} iconPosition="start" />
            <Tab label={`Efectivo (${contarVentas('efectivo')})`} icon={<Chip label="E" size="small" color="success" />} iconPosition="start" />
            <Tab label={`Tarjeta (${contarVentas('tarjeta')})`} icon={<Chip label="T" size="small" color="info" />} iconPosition="start" />
            <Tab label={`Transferencia (${contarVentas('transferencia')})`} icon={<Chip label="TR" size="small" color="primary" />} iconPosition="start" />
          </Tabs>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Folio</TableCell>
                  <TableCell>Fecha</TableCell>
                  <TableCell>Cliente</TableCell>
                  <TableCell>Vendedor</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell>Método</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell align="center">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} align="center">Cargando...</TableCell></TableRow>
                ) : ventasPaginadas.length === 0 ? (
                  <TableRow><TableCell colSpan={8} align="center"><Typography color="text.secondary">No se encontraron ventas</Typography></TableCell></TableRow>
                ) : (
                  ventasPaginadas.map((venta) => (
                    <TableRow key={venta.id} hover>
                      <TableCell><Chip label={venta.folio} size="small" color="primary" /></TableCell>
                      <TableCell>{format(new Date(venta.fecha_venta), 'dd/MM/yyyy HH:mm')}</TableCell>
                      <TableCell>{venta.cliente_nombre || 'Público General'}</TableCell>
                      <TableCell>{venta.vendedor_nombre || '-'}</TableCell>
                      <TableCell align="right"><Typography fontWeight="bold">Q{parseFloat(venta.total).toFixed(2)}</Typography></TableCell>
                      <TableCell>
                        <Chip label={venta.metodo_pago} size="small"
                          color={venta.metodo_pago === 'efectivo' ? 'success' : venta.metodo_pago === 'tarjeta' ? 'info' : 'primary'}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip label={venta.estado === 'cancelada' ? 'Cancelada' : 'Completada'} size="small"
                          color={venta.estado === 'cancelada' ? 'error' : 'success'}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                          <IconButton size="small" color="primary" onClick={() => handleVerDetalle(venta)} title="Ver detalle">
                            <VisibilityIcon />
                          </IconButton>
                          {venta.estado !== 'cancelada' && (
                            <>
                              <IconButton size="small" color="error" onClick={() => handleImprimirDirecto(venta)} title="Imprimir">
                                <PrintIcon />
                              </IconButton>
                              <IconButton size="small" color="success" onClick={() => handleDescargarPDF(venta)} title="PDF">
                                <PdfIcon />
                              </IconButton>
                              <IconButton size="small" color="warning" onClick={() => handleOpenCancelar(venta)} title="Cancelar venta">
                                <CancelIcon />
                              </IconButton>
                            </>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={ventasFiltradas.length}
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

      {/* Diálogo Cancelar */}
      <Dialog open={openCancelar} onClose={() => setOpenCancelar(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
            <CancelIcon />
            <Typography variant="h6">Cancelar Venta</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2" gutterBottom><strong>¿Estás seguro de cancelar esta venta?</strong></Typography>
            <Typography variant="body2">Esta acción devolverá el stock y marcará la venta como cancelada.</Typography>
          </Alert>
          {ventaACancelar && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2"><strong>Folio:</strong> {ventaACancelar.folio}</Typography>
              <Typography variant="body2"><strong>Cliente:</strong> {ventaACancelar.cliente_nombre || 'Público General'}</Typography>
              <Typography variant="body2"><strong>Total:</strong> Q{parseFloat(ventaACancelar.total).toFixed(2)}</Typography>
              <Typography variant="body2"><strong>Fecha:</strong> {format(new Date(ventaACancelar.fecha_venta), 'dd/MM/yyyy HH:mm')}</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCancelar(false)} color="inherit">No, mantener venta</Button>
          <Button onClick={handleCancelarVenta} variant="contained" color="error" disabled={loading}>
            Sí, cancelar venta
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo Detalle */}
      <Dialog open={openDetalle} onClose={() => setOpenDetalle(false)} maxWidth="sm" fullWidth>
        {ventaSeleccionada && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PrintIcon />
                <Typography variant="h6">Comprobante {ventaSeleccionada.folio}</Typography>
                {ventaSeleccionada.estado === 'cancelada' && <Chip label="CANCELADA" color="error" size="small" />}
              </Box>
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Fecha</Typography>
                  <Typography variant="body1">{format(new Date(ventaSeleccionada.fecha_venta), 'dd/MM/yyyy HH:mm')}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Cliente</Typography>
                  <Typography variant="body1">{ventaSeleccionada.cliente_nombre || 'Público General'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Vendedor</Typography>
                  <Typography variant="body1">{ventaSeleccionada.usuario_nombre || ventaSeleccionada.vendedor_nombre || '-'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Método</Typography>
                  <Typography variant="body1">{ventaSeleccionada.metodo_pago}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Estado</Typography>
                  <Chip label={ventaSeleccionada.estado === 'cancelada' ? 'Cancelada' : 'Completada'} size="small"
                    color={ventaSeleccionada.estado === 'cancelada' ? 'error' : 'success'}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>Productos</Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Producto</TableCell>
                          <TableCell align="center">Cant.</TableCell>
                          <TableCell align="right">Total</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {ventaSeleccionada.productos?.length > 0 ? (
                          ventaSeleccionada.productos.map((p, index) => (
                            <TableRow key={index}>
                              <TableCell>{p.producto_nombre}</TableCell>
                              <TableCell align="center">{p.cantidad}</TableCell>
                              <TableCell align="right">Q{parseFloat(p.subtotal).toFixed(2)}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow><TableCell colSpan={3} align="center"><Typography color="text.secondary">Sin productos</Typography></TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>
                <Grid item xs={12}>
                  <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography>Subtotal:</Typography>
                      <Typography>Q{parseFloat(ventaSeleccionada.subtotal || ventaSeleccionada.total).toFixed(2)}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
                      <Typography variant="h6">TOTAL:</Typography>
                      <Typography variant="h6" color="primary">Q{parseFloat(ventaSeleccionada.total).toFixed(2)}</Typography>
                    </Box>
                  </Box>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpenDetalle(false)}>Cerrar</Button>
              {ventaSeleccionada.estado !== 'cancelada' && (
                <Button variant="contained" startIcon={<PrintIcon />} onClick={handleImprimir} color="primary">
                  Imprimir Comprobante
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default ReimpresionComprobantes;