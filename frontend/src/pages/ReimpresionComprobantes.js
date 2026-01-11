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
} from '@mui/material';
import {
  Print as PrintIcon,
  Search as SearchIcon,
  Visibility as VisibilityIcon,
  Refresh as RefreshIcon,
  PictureAsPdf as PdfIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';

const ReimpresionComprobantes = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [ventas, setVentas] = useState([]);
  const [ventaSeleccionada, setVentaSeleccionada] = useState(null);
  const [openDetalle, setOpenDetalle] = useState(false);
  
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
      
      console.log('🔍 Cargando detalle de venta:', venta.id);
      
      const response = await api.get(`/api/ventas/${venta.id}`);
      
      console.log('✅ Respuesta completa del servidor:', response.data);
      console.log('📦 Productos recibidos:', response.data.productos);
      console.log('📊 Cantidad de productos:', response.data.productos?.length || 0);
      
      // Validar que productos existe y es un array
      const productos = Array.isArray(response.data.productos) ? response.data.productos : [];
      
      if (productos.length === 0) {
        console.warn('⚠️ No se recibieron productos para esta venta');
        setError('Esta venta no tiene productos registrados');
      }
      
      const ventaCompleta = {
        ...response.data.venta,
        productos: productos,
        envio: response.data.envio || null
      };
      
      console.log('✅ Venta completa preparada:', ventaCompleta);
      
      setVentaSeleccionada(ventaCompleta);
      setOpenDetalle(true);
      
    } catch (err) {
      console.error('❌ Error al cargar detalle:', err);
      console.error('❌ Respuesta de error:', err.response?.data);
      setError('Error al cargar detalle de venta: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleImprimirDirecto = async (venta) => {
    try {
      setLoading(true);
      
      console.log('🖨️ Imprimiendo venta:', venta.id);
      
      const response = await api.get(`/api/ventas/${venta.id}`);
      
      console.log('✅ Datos para imprimir:', response.data);
      
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
      
      console.log('📄 Generando comprobante con productos:', productos.length);
      
      // Generar comprobante y abrir para imprimir
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
      console.error('❌ Error al imprimir:', err);
      setError('Error al imprimir comprobante: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDescargarPDF = async (venta) => {
    try {
      setLoading(true);
      
      console.log('📄 Descargando PDF de venta:', venta.id);
      
      // Importar dinámicamente jsPDF y html2canvas
      const jsPDF = (await import('jspdf')).default;
      const html2canvas = (await import('html2canvas')).default;
      
      const response = await api.get(`/api/ventas/${venta.id}`);
      
      console.log('✅ Datos para PDF:', response.data);
      
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
      
      console.log('📦 Generando PDF con productos:', productos.length);
      
      // Crear elemento temporal con el comprobante
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.innerHTML = generarComprobante(ventaCompleta);
      document.body.appendChild(tempDiv);
      
      // Esperar a que se renderice
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Capturar como imagen
      const canvas = await html2canvas(tempDiv.querySelector('.ticket'), {
        scale: 2,
        backgroundColor: '#ffffff'
      });
      
      // Crear PDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [80, 200] // Ancho de ticket térmico
      });
      
      const imgWidth = 80;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`Comprobante_${ventaCompleta.folio}.pdf`);
      
      // Limpiar
      document.body.removeChild(tempDiv);
      
      console.log('✅ PDF generado exitosamente');
      setSuccess('PDF descargado exitosamente');
    } catch (err) {
      console.error('❌ Error al generar PDF:', err);
      setError('Error al generar PDF: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImprimir = () => {
    if (!ventaSeleccionada) return;

    const ventanaImpresion = window.open('', '', 'width=800,height=600');
    const contenidoHTML = generarComprobante(ventaSeleccionada);
    
    ventanaImpresion.document.write(contenidoHTML);
    ventanaImpresion.document.close();
    ventanaImpresion.focus();
    
    // Dar tiempo para que cargue el contenido
    setTimeout(() => {
      ventanaImpresion.print();
      ventanaImpresion.close();
    }, 250);

    setSuccess('Comprobante enviado a impresora');
  };

  const generarComprobante = (venta) => {
    const fecha = format(new Date(venta.fecha_venta), 'dd/MM/yyyy HH:mm');
    const productos = venta.productos || [];
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Comprobante ${venta.folio}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            padding: 20px;
            max-width: 300px;
            margin: 0 auto;
          }
          
          .ticket {
            border: 2px solid #000;
            padding: 15px;
          }
          
          .header {
            text-align: center;
            margin-bottom: 15px;
            border-bottom: 2px dashed #000;
            padding-bottom: 10px;
          }
          
          .header h1 {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 5px;
          }
          
          .header p {
            font-size: 11px;
            margin: 2px 0;
          }
          
          .info-venta {
            margin-bottom: 15px;
            border-bottom: 1px dashed #000;
            padding-bottom: 10px;
          }
          
          .info-venta p {
            margin: 3px 0;
            font-size: 11px;
          }
          
          .info-venta strong {
            display: inline-block;
            width: 80px;
          }
          
          .productos {
            margin-bottom: 15px;
          }
          
          .productos table {
            width: 100%;
            border-collapse: collapse;
          }
          
          .productos th {
            text-align: left;
            border-bottom: 1px solid #000;
            padding: 5px 0;
            font-size: 11px;
          }
          
          .productos td {
            padding: 5px 0;
            font-size: 11px;
          }
          
          .producto-nombre {
            font-weight: bold;
          }
          
          .totales {
            border-top: 2px solid #000;
            padding-top: 10px;
            margin-top: 10px;
          }
          
          .totales p {
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
            font-size: 12px;
          }
          
          .total-final {
            font-size: 16px;
            font-weight: bold;
            border-top: 2px double #000;
            margin-top: 8px;
            padding-top: 8px;
          }
          
          .footer {
            text-align: center;
            margin-top: 15px;
            border-top: 2px dashed #000;
            padding-top: 10px;
            font-size: 10px;
          }
          
          .reimpresion {
            text-align: center;
            margin-top: 10px;
            font-size: 10px;
            font-style: italic;
            color: #666;
          }
          
          @media print {
            body {
              padding: 0;
            }
            
            .ticket {
              border: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="ticket">
          <!-- HEADER -->
          <div class="header">
            <h1>POS ABARROTES</h1>
            <p>Sistema de Punto de Venta</p>
            <p>Tel: (502) 1234-5678</p>
          </div>
          
          <!-- INFORMACIÓN DE VENTA -->
          <div class="info-venta">
            <p><strong>Folio:</strong> ${venta.folio}</p>
            <p><strong>Fecha:</strong> ${fecha}</p>
            <p><strong>Vendedor:</strong> ${venta.usuario_nombre || venta.vendedor_nombre || 'N/A'}</p>
            <p><strong>Cliente:</strong> ${venta.cliente_nombre || 'Público General'}</p>
            <p><strong>Pago:</strong> ${venta.metodo_pago}</p>
          </div>
          
          <!-- PRODUCTOS -->
          <div class="productos">
            <table>
              <thead>
                <tr>
                  <th>Cant</th>
                  <th>Producto</th>
                  <th style="text-align: right">Precio</th>
                  <th style="text-align: right">Total</th>
                </tr>
              </thead>
              <tbody>
                ${productos.length > 0 ? productos.map(p => `
                  <tr>
                    <td>${p.cantidad}</td>
                    <td class="producto-nombre">${p.producto_nombre}</td>
                    <td style="text-align: right">Q${parseFloat(p.precio_unitario).toFixed(2)}</td>
                    <td style="text-align: right">Q${parseFloat(p.subtotal).toFixed(2)}</td>
                  </tr>
                `).join('') : '<tr><td colspan="4" style="text-align: center;">Sin productos</td></tr>'}
              </tbody>
            </table>
          </div>
          
          <!-- TOTALES -->
          <div class="totales">
            <p>
              <span>Subtotal:</span>
              <span>Q${parseFloat(venta.subtotal || venta.total).toFixed(2)}</span>
            </p>
            ${venta.descuento_monto && venta.descuento_monto > 0 ? `
              <p>
                <span>Descuento (${venta.descuento_porcentaje}%):</span>
                <span>-Q${parseFloat(venta.descuento_monto).toFixed(2)}</span>
              </p>
            ` : ''}
            ${venta.iva && venta.iva > 0 ? `
              <p>
                <span>IVA:</span>
                <span>Q${parseFloat(venta.iva).toFixed(2)}</span>
              </p>
            ` : ''}
            <p class="total-final">
              <span>TOTAL:</span>
              <span>Q${parseFloat(venta.total).toFixed(2)}</span>
            </p>
            ${venta.metodo_pago === 'efectivo' && venta.monto_pagado ? `
              <p style="margin-top: 10px;">
                <span>Pagado:</span>
                <span>Q${parseFloat(venta.monto_pagado).toFixed(2)}</span>
              </p>
              <p>
                <span>Cambio:</span>
                <span>Q${parseFloat(venta.cambio || 0).toFixed(2)}</span>
              </p>
            ` : ''}
          </div>
          
          <!-- FOOTER -->
          <div class="footer">
            <p>¡GRACIAS POR SU COMPRA!</p>
            <p>www.posabarrotes.com</p>
          </div>
          
          <!-- REIMPRESIÓN -->
          <div class="reimpresion">
            <p>*** REIMPRESIÓN ***</p>
            <p>Impreso: ${format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  // Filtrar ventas
  const ventasFiltradas = ventas.filter(venta => {
    const matchBusqueda = !busqueda || 
      venta.folio.toLowerCase().includes(busqueda.toLowerCase()) ||
      (venta.cliente_nombre && venta.cliente_nombre.toLowerCase().includes(busqueda.toLowerCase()));
    
    const fechaVenta = new Date(venta.fecha_venta).toISOString().split('T')[0];
    const matchFecha = fechaVenta >= fechaInicio && fechaVenta <= fechaFin;
    
    return matchBusqueda && matchFecha && venta.estado === 'completada';
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            🖨️ Reimpresión de Comprobantes
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Busca y reimprime comprobantes de ventas realizadas
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

      {/* Filtros */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Buscar por Folio o Cliente"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Ej: VTA-000001"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                type="date"
                label="Fecha Inicio"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                type="date"
                label="Fecha Fin"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Tabla de Ventas */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Ventas Completadas ({ventasFiltradas.length})
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Folio</TableCell>
                  <TableCell>Fecha</TableCell>
                  <TableCell>Cliente</TableCell>
                  <TableCell>Vendedor</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell>Método Pago</TableCell>
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
                ) : ventasFiltradas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography color="text.secondary">
                        No se encontraron ventas
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  ventasFiltradas.map((venta) => (
                    <TableRow key={venta.id} hover>
                      <TableCell>
                        <Chip label={venta.folio} size="small" color="primary" />
                      </TableCell>
                      <TableCell>
                        {format(new Date(venta.fecha_venta), 'dd/MM/yyyy HH:mm')}
                      </TableCell>
                      <TableCell>{venta.cliente_nombre || 'Público General'}</TableCell>
                      <TableCell>{venta.vendedor_nombre || '-'}</TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="bold">
                          Q{parseFloat(venta.total).toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={venta.metodo_pago} 
                          size="small"
                          color={venta.metodo_pago === 'efectivo' ? 'success' : 'info'}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
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
                            color="error"
                            onClick={() => handleImprimirDirecto(venta)}
                            title="Imprimir comprobante"
                          >
                            <PrintIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="success"
                            onClick={() => handleDescargarPDF(venta)}
                            title="Descargar PDF"
                          >
                            <PdfIcon />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Diálogo de Detalle */}
      <Dialog open={openDetalle} onClose={() => setOpenDetalle(false)} maxWidth="sm" fullWidth>
        {ventaSeleccionada && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PrintIcon />
                <Typography variant="h6">
                  Comprobante {ventaSeleccionada.folio}
                </Typography>
              </Box>
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Fecha</Typography>
                  <Typography variant="body1">
                    {format(new Date(ventaSeleccionada.fecha_venta), 'dd/MM/yyyy HH:mm')}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Cliente</Typography>
                  <Typography variant="body1">
                    {ventaSeleccionada.cliente_nombre || 'Público General'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Vendedor</Typography>
                  <Typography variant="body1">
                    {ventaSeleccionada.usuario_nombre || ventaSeleccionada.vendedor_nombre || '-'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Método de Pago</Typography>
                  <Typography variant="body1">{ventaSeleccionada.metodo_pago}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Productos
                  </Typography>
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
                              <TableCell align="right">
                                Q{parseFloat(p.subtotal).toFixed(2)}
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={3} align="center">
                              <Typography color="text.secondary">Sin productos</Typography>
                            </TableCell>
                          </TableRow>
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
                    {ventaSeleccionada.descuento_monto > 0 && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography>Descuento ({ventaSeleccionada.descuento_porcentaje}%):</Typography>
                        <Typography>-Q{parseFloat(ventaSeleccionada.descuento_monto).toFixed(2)}</Typography>
                      </Box>
                    )}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
                      <Typography variant="h6">TOTAL:</Typography>
                      <Typography variant="h6" color="primary">
                        Q{parseFloat(ventaSeleccionada.total).toFixed(2)}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpenDetalle(false)}>
                Cerrar
              </Button>
              <Button
                variant="contained"
                startIcon={<PrintIcon />}
                onClick={handleImprimir}
                color="primary"
              >
                Imprimir Comprobante
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default ReimpresionComprobantes;