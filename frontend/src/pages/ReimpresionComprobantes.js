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
  Paper,
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
  const [configuracion, setConfiguracion] = useState(null);
  
  // Paginación
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  // Filtros
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    cargarVentas();
    cargarConfiguracion();
  }, []);

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
    if (!configuracion) {
      setError('Configuración no cargada');
      return;
    }

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
      const contenidoHTML = generarComprobanteParametrizado(ventaCompleta, configuracion);
      
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
    if (!configuracion) {
      setError('Configuración no cargada');
      return;
    }

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
      tempDiv.innerHTML = generarComprobanteParametrizado(ventaCompleta, configuracion);
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
      pdf.save(`${ventaCompleta.folio}.pdf`);
      
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

  const generarComprobanteParametrizado = (venta, config) => {
    const productos = venta.productos || [];
    const moneda = config.moneda || 'Q';
    
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
          .empresa { font-size: 16px; font-weight: bold; margin-bottom: 5px; }
          .info { font-size: 11px; margin: 2px 0; }
          .section { margin: 10px 0; font-size: 11px; }
          .section-line { margin: 3px 0; }
          .productos { margin: 15px 0; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 10px 0; }
          .productos-header { font-weight: bold; margin-bottom: 8px; font-size: 11px; display: flex; justify-content: space-between; }
          .producto-item { margin: 8px 0; font-size: 10px; }
          .producto-nombre { font-weight: bold; margin-bottom: 2px; }
          .producto-detalle { display: flex; justify-content: space-between; }
          .totales { margin: 15px 0; font-size: 11px; }
          .total-line { display: flex; justify-content: space-between; margin: 5px 0; }
          .total-final { font-size: 13px; font-weight: bold; border-top: 2px solid #000; padding-top: 8px; margin-top: 8px; }
          .footer { text-align: center; margin-top: 20px; font-size: 11px; border-top: 2px dashed #000; padding-top: 10px; }
          .footer-line { margin: 3px 0; }
          ${venta.estado === 'cancelada' ? `
            .cancelada { 
              color: #d32f2f; 
              font-weight: bold; 
              text-align: center; 
              font-size: 16px; 
              margin: 10px 0; 
              border: 2px solid #d32f2f; 
              padding: 8px; 
              background: #ffebee;
            }
          ` : ''}
          @media print { 
            body { padding: 0; }
            @page { size: 80mm auto; margin: 0; }
          }
        </style>
      </head>
      <body>
        <div class="ticket">
          <!-- ENCABEZADO -->
          <div class="header">
            <div class="empresa">${config.nombre_negocio || 'TU EMPRESA'}</div>
            <div class="info">${config.direccion || ''}</div>
            <div class="info">Tel: ${config.telefono || ''}</div>
            <div class="info">NIT: ${config.nit || 'CF'}</div>
          </div>
          
          ${venta.estado === 'cancelada' ? '<div class="cancelada">⚠️ VENTA CANCELADA ⚠️</div>' : ''}
          
          <!-- INFORMACIÓN DE LA VENTA -->
          <div class="section">
            <div class="section-line"><strong>Folio:</strong> ${venta.folio}</div>
            <div class="section-line"><strong>Fecha:</strong> ${venta.fecha_venta ? format(new Date(venta.fecha_venta), 'dd/MM/yyyy HH:mm') : format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
            <div class="section-line"><strong>Vendedor:</strong> ${venta.usuario_nombre || venta.vendedor_nombre || 'N/A'}</div>
            <div class="section-line"><strong>Cliente:</strong> ${venta.cliente_nombre || 'Público General'}</div>
            <div class="section-line"><strong>Método:</strong> ${venta.metodo_pago ? venta.metodo_pago.charAt(0).toUpperCase() + venta.metodo_pago.slice(1) : 'N/A'}</div>
            ${venta.estado === 'cancelada' ? `<div class="section-line"><strong>Estado:</strong> <span style="color: #d32f2f;">CANCELADA</span></div>` : ''}
          </div>
          
          <!-- PRODUCTOS -->
          <div class="productos">
            <div class="productos-header">
              <span>Producto</span>
              <span>Total</span>
            </div>
            ${productos.map(p => `
              <div class="producto-item">
                <div class="producto-nombre">${p.producto_nombre}</div>
                <div class="producto-detalle">
                  <span>${p.cantidad} x ${moneda}${parseFloat(p.precio_unitario).toFixed(2)}</span>
                  <span>${moneda}${parseFloat(p.subtotal).toFixed(2)}</span>
                </div>
              </div>
            `).join('')}
          </div>
          
          <!-- TOTALES -->
          <div class="totales">
            <div class="total-line">
              <span>Subtotal:</span>
              <span>${moneda}${parseFloat(venta.subtotal || venta.total).toFixed(2)}</span>
            </div>
            <div class="total-line total-final">
              <span>TOTAL:</span>
              <span>${moneda}${parseFloat(venta.total).toFixed(2)}</span>
            </div>
          </div>
          
          <!-- PIE DE PÁGINA -->
          <div class="footer">
            <div class="footer-line">${config.ticket_mensaje || '¡Gracias por su compra!'}</div>
            <div class="footer-line">${config.ticket_pie || 'Vuelva pronto'}</div>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  // Filtrado de ventas
  const ventasFiltradas = ventas.filter((venta) => {
    // Filtro por tab
    let pasaFiltroTab = true;
    if (tabActual === 1) pasaFiltroTab = venta.estado === 'completada';
    if (tabActual === 2) pasaFiltroTab = venta.estado === 'cancelada';
    if (tabActual === 3) pasaFiltroTab = venta.metodo_pago === 'efectivo' && venta.estado === 'completada';
    if (tabActual === 4) pasaFiltroTab = venta.metodo_pago === 'tarjeta' && venta.estado === 'completada';
    if (tabActual === 5) pasaFiltroTab = venta.metodo_pago === 'transferencia' && venta.estado === 'completada';

    // Filtro por búsqueda
    let pasaFiltroBusqueda = true;
    if (busqueda.trim()) {
      const termino = busqueda.toLowerCase();
      pasaFiltroBusqueda = 
        venta.folio?.toLowerCase().includes(termino) ||
        venta.cliente_nombre?.toLowerCase().includes(termino) ||
        venta.vendedor_nombre?.toLowerCase().includes(termino);
    }

    return pasaFiltroTab && pasaFiltroBusqueda;
  });

  // Paginación
  const ventasPaginadas = ventasFiltradas.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

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
    if (filtro === 'efectivo') return ventas.filter(v => v.metodo_pago === 'efectivo' && v.estado === 'completada').length;
    if (filtro === 'tarjeta') return ventas.filter(v => v.metodo_pago === 'tarjeta' && v.estado === 'completada').length;
    if (filtro === 'transferencia') return ventas.filter(v => v.metodo_pago === 'transferencia' && v.estado === 'completada').length;
    return 0;
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            <ReceiptIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Reimpresión de Comprobantes
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Reimprimir o descargar comprobantes de ventas
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={cargarVentas}
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
        <CardContent>
          {/* Búsqueda */}
          <TextField
            fullWidth
            size="small"
            placeholder="Buscar por folio, cliente o vendedor..."
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPage(0);
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2 }}
          />

          {/* Tabs */}
          <Tabs value={tabActual} onChange={handleChangeTab} sx={{ mb: 2 }} variant="scrollable">
            <Tab label={`Todas (${contarVentas('todas')})`} />
            <Tab label={`Completadas (${contarVentas('completadas')})`} />
            <Tab label={`Canceladas (${contarVentas('canceladas')})`} />
            <Tab label={`Efectivo (${contarVentas('efectivo')})`} />
            <Tab label={`Tarjeta (${contarVentas('tarjeta')})`} />
            <Tab label={`Transferencia (${contarVentas('transferencia')})`} />
          </Tabs>

          {/* Tabla */}
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Folio</TableCell>
                  <TableCell>Fecha</TableCell>
                  <TableCell>Cliente</TableCell>
                  <TableCell>Vendedor</TableCell>
                  <TableCell>Método</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell align="center">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">Cargando...</TableCell>
                  </TableRow>
                ) : ventasPaginadas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <Typography color="text.secondary">No hay ventas</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  ventasPaginadas.map((venta) => (
                    <TableRow key={venta.id} hover>
                      <TableCell>
                        <Chip label={venta.folio} size="small" color="primary" />
                      </TableCell>
                      <TableCell>
                        {venta.fecha_venta ? format(new Date(venta.fecha_venta), 'dd/MM/yyyy HH:mm') : 'N/A'}
                      </TableCell>
                      <TableCell>{venta.cliente_nombre || 'Público'}</TableCell>
                      <TableCell>{venta.vendedor_nombre || venta.usuario_nombre || 'N/A'}</TableCell>
                      <TableCell>
                        <Chip
                          label={venta.metodo_pago}
                          size="small"
                          color={
                            venta.metodo_pago === 'efectivo' ? 'success' :
                            venta.metodo_pago === 'tarjeta' ? 'info' : 'primary'
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={venta.estado}
                          size="small"
                          color={venta.estado === 'completada' ? 'success' : 'error'}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="bold">
                          Q{parseFloat(venta.total).toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleVerDetalle(venta)}
                          title="Ver detalle"
                        >
                          <VisibilityIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="secondary"
                          onClick={() => handleImprimirDirecto(venta)}
                          title="Imprimir"
                          disabled={venta.estado === 'cancelada'}
                        >
                          <PrintIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="info"
                          onClick={() => handleDescargarPDF(venta)}
                          title="Descargar PDF"
                          disabled={venta.estado === 'cancelada'}
                        >
                          <PdfIcon />
                        </IconButton>
                        {venta.estado === 'completada' && (
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleOpenCancelar(venta)}
                            title="Cancelar venta"
                          >
                            <CancelIcon />
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
          <TablePagination
            component="div"
            count={ventasFiltradas.length}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            labelRowsPerPage="Filas:"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
            rowsPerPageOptions={[5, 10, 25, 50, 100]}
          />
        </CardContent>
      </Card>

      {/* Diálogo: Detalle de Venta */}
      <Dialog open={openDetalle} onClose={() => setOpenDetalle(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Detalle de Venta - {ventaSeleccionada?.folio}
        </DialogTitle>
        <DialogContent>
          {ventaSeleccionada && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary">Fecha:</Typography>
                <Typography variant="body1">
                  {ventaSeleccionada.fecha_venta ? format(new Date(ventaSeleccionada.fecha_venta), 'dd/MM/yyyy HH:mm') : 'N/A'}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary">Cliente:</Typography>
                <Typography variant="body1">{ventaSeleccionada.cliente_nombre || 'Público General'}</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary">Vendedor:</Typography>
                <Typography variant="body1">{ventaSeleccionada.vendedor_nombre || ventaSeleccionada.usuario_nombre || 'N/A'}</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary">Método de Pago:</Typography>
                <Chip label={ventaSeleccionada.metodo_pago} size="small" color="primary" />
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary">Estado:</Typography>
                <Chip 
                  label={ventaSeleccionada.estado} 
                  size="small" 
                  color={ventaSeleccionada.estado === 'completada' ? 'success' : 'error'} 
                />
              </Grid>

              <Grid item xs={12}>
                <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>Productos</Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Producto</TableCell>
                        <TableCell align="center">Cantidad</TableCell>
                        <TableCell align="right">Precio Unit.</TableCell>
                        <TableCell align="right">Subtotal</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {ventaSeleccionada.productos?.map((producto, index) => (
                        <TableRow key={index}>
                          <TableCell>{producto.producto_nombre}</TableCell>
                          <TableCell align="center">{producto.cantidad}</TableCell>
                          <TableCell align="right">Q{parseFloat(producto.precio_unitario).toFixed(2)}</TableCell>
                          <TableCell align="right">Q{parseFloat(producto.subtotal).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>

              <Grid item xs={12}>
                <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                  <Typography variant="h6" align="right">
                    Total: Q{parseFloat(ventaSeleccionada.total).toFixed(2)}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDetalle(false)}>Cerrar</Button>
          <Button 
            onClick={handleImprimir} 
            variant="contained" 
            startIcon={<PrintIcon />}
            disabled={ventaSeleccionada?.estado === 'cancelada'}
          >
            Imprimir
          </Button>
          <Button 
            onClick={() => {
              handleDescargarPDF(ventaSeleccionada);
              setOpenDetalle(false);
            }} 
            variant="contained" 
            color="secondary"
            startIcon={<PdfIcon />}
            disabled={ventaSeleccionada?.estado === 'cancelada'}
          >
            Descargar PDF
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo: Confirmar Cancelación */}
      <Dialog open={openCancelar} onClose={() => setOpenCancelar(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: 'error.main', color: 'white' }}>
          ⚠️ Cancelar Venta
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {ventaACancelar && (
            <>
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  Esta acción cancelará la venta y devolverá el stock de los productos.
                </Typography>
              </Alert>
              <Typography variant="body1">
                <strong>Folio:</strong> {ventaACancelar.folio}
              </Typography>
              <Typography variant="body1">
                <strong>Cliente:</strong> {ventaACancelar.cliente_nombre || 'Público General'}
              </Typography>
              <Typography variant="body1">
                <strong>Total:</strong> Q{parseFloat(ventaACancelar.total).toFixed(2)}
              </Typography>
              <Typography variant="body1">
                <strong>Fecha:</strong> {ventaACancelar.fecha_venta ? format(new Date(ventaACancelar.fecha_venta), 'dd/MM/yyyy HH:mm') : 'N/A'}
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCancelar(false)}>No, mantener</Button>
          <Button onClick={handleCancelarVenta} variant="contained" color="error">
            Sí, cancelar venta
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ReimpresionComprobantes;