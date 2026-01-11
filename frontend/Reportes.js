// src/pages/Reportes.js
import React, { useState } from 'react';
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
  Tabs,
  Tab,
  CircularProgress,
  Chip,
  ButtonGroup,
} from '@mui/material';
import {
  Assessment as AssessmentIcon,
  TrendingUp as TrendingUpIcon,
  Inventory as InventoryIcon,
  People as PeopleIcon,
  AttachMoney as AttachMoneyIcon,
  SwapVert as SwapVertIcon,
  AccountBalance as AccountBalanceIcon,
  FileDownload as FileDownloadIcon,
  PictureAsPdf as PdfIcon,
  TableChart as ExcelIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { exportarAExcel, exportarAPDF, formatearMoneda, formatearFecha, formatearNumero } from '../utils/exportUtils';

const Reportes = () => {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fechaInicio, setFechaInicio] = useState(format(new Date(), 'yyyy-MM-01'));
  const [fechaFin, setFechaFin] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Estados para cada reporte
  const [reporteVentas, setReporteVentas] = useState(null);
  const [reporteProductos, setReporteProductos] = useState(null);
  const [reporteInventario, setReporteInventario] = useState(null);
  const [reporteVendedores, setReporteVendedores] = useState(null);
  const [reporteGanancias, setReporteGanancias] = useState(null);
  const [reporteMovimientos, setReporteMovimientos] = useState(null);
  const [reporteCuentasPorPagar, setReporteCuentasPorPagar] = useState(null);

  const generarReporteVentas = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/reportes/ventas', {
        params: { fecha_inicio: fechaInicio, fecha_fin: fechaFin }
      });
      setReporteVentas(response.data);
    } catch (err) {
      setError('Error al generar reporte de ventas');
    } finally {
      setLoading(false);
    }
  };

  const generarReporteProductos = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/reportes/productos-vendidos', {
        params: { fecha_inicio: fechaInicio, fecha_fin: fechaFin, limit: 20 }
      });
      setReporteProductos(response.data);
    } catch (err) {
      setError('Error al generar reporte de productos');
    } finally {
      setLoading(false);
    }
  };

  const generarReporteInventario = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/reportes/inventario');
      setReporteInventario(response.data);
    } catch (err) {
      setError('Error al generar reporte de inventario');
    } finally {
      setLoading(false);
    }
  };

  const generarReporteVendedores = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/reportes/vendedores', {
        params: { fecha_inicio: fechaInicio, fecha_fin: fechaFin }
      });
      setReporteVendedores(response.data);
    } catch (err) {
      setError('Error al generar reporte de vendedores');
    } finally {
      setLoading(false);
    }
  };

  const generarReporteGanancias = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/reportes/ganancias', {
        params: { fecha_inicio: fechaInicio, fecha_fin: fechaFin }
      });
      setReporteGanancias(response.data);
    } catch (err) {
      setError('Error al generar reporte de ganancias');
    } finally {
      setLoading(false);
    }
  };

  const generarReporteMovimientos = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/reportes/movimientos', {
        params: { fecha_inicio: fechaInicio, fecha_fin: fechaFin, limit: 50 }
      });
      setReporteMovimientos(response.data);
    } catch (err) {
      setError('Error al generar reporte de movimientos');
    } finally {
      setLoading(false);
    }
  };

  const generarReporteCuentasPorPagar = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/reportes/cuentas-por-pagar', {
        params: { fecha_inicio: fechaInicio, fecha_fin: fechaFin }
      });
      setReporteCuentasPorPagar(response.data);
    } catch (err) {
      setError('Error al generar reporte de cuentas por pagar');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    setError(null);
  };

  const handleGenerar = () => {
    switch (tabValue) {
      case 0:
        generarReporteVentas();
        break;
      case 1:
        generarReporteProductos();
        break;
      case 2:
        generarReporteInventario();
        break;
      case 3:
        generarReporteVendedores();
        break;
      case 4:
        generarReporteGanancias();
        break;
      case 5:
        generarReporteMovimientos();
        break;
      case 6:
        generarReporteCuentasPorPagar();
        break;
      default:
        break;
    }
  };

  // Funciones de exportación
  const exportarVentasExcel = () => {
    if (!reporteVentas) return;
    
    const datos = reporteVentas.ventasDetalle.map(v => ({
      'Folio': v.folio,
      'Fecha': formatearFecha(v.fecha_venta),
      'Cliente': v.cliente_nombre || 'Público General',
      'Vendedor': v.vendedor_nombre,
      'Método de Pago': v.metodo_pago,
      'Total': parseFloat(v.total).toFixed(2)
    }));

    // Agregar fila de totales
    const totalVentas = reporteVentas.ventasDetalle.reduce((sum, v) => sum + parseFloat(v.total), 0);
    datos.push({
      'Folio': '',
      'Fecha': '',
      'Cliente': '',
      'Vendedor': '',
      'Método de Pago': 'TOTAL',
      'Total': totalVentas.toFixed(2)
    });
    
    exportarAExcel(datos, `Ventas_${fechaInicio}_${fechaFin}`, 'Ventas');
  };

  const exportarVentasPDF = () => {
    if (!reporteVentas) return;
    
    const columnas = [
      { header: 'Folio', dataKey: 'folio' },
      { header: 'Fecha', dataKey: 'fecha_venta', format: formatearFecha },
      { header: 'Cliente', dataKey: 'cliente_nombre', format: (v) => v || 'Público General' },
      { header: 'Vendedor', dataKey: 'vendedor_nombre' },
      { header: 'Método', dataKey: 'metodo_pago' },
      { header: 'Total', dataKey: 'total', format: formatearMoneda, align: 'right' }
    ];

    // Calcular totales
    const totalVentas = reporteVentas.ventasDetalle.reduce((sum, v) => sum + parseFloat(v.total), 0);
    const totales = {
      total: totalVentas
    };
    
    exportarAPDF(reporteVentas.ventasDetalle, `Ventas_${fechaInicio}_${fechaFin}`, 
                 `Reporte de Ventas (${fechaInicio} - ${fechaFin})`, columnas, totales);
  };

  const exportarProductosExcel = () => {
    if (!reporteProductos) return;
    
    const datos = reporteProductos.productos.map(p => ({
      'Código': p.codigo_barras,
      'Producto': p.nombre,
      'Categoría': p.categoria_nombre || '-',
      'Cantidad Vendida': p.total_vendido,
      'Número de Ventas': p.num_ventas,
      'Monto Total': parseFloat(p.monto_total).toFixed(2),
      'Stock Actual': p.stock_actual
    }));

    // Agregar totales
    const totalCantidad = reporteProductos.productos.reduce((sum, p) => sum + parseInt(p.total_vendido), 0);
    const totalMonto = reporteProductos.productos.reduce((sum, p) => sum + parseFloat(p.monto_total), 0);
    datos.push({
      'Código': '',
      'Producto': '',
      'Categoría': '',
      'Cantidad Vendida': totalCantidad,
      'Número de Ventas': '',
      'Monto Total': totalMonto.toFixed(2),
      'Stock Actual': ''
    });
    
    exportarAExcel(datos, `Productos_Mas_Vendidos_${fechaInicio}_${fechaFin}`, 'Productos');
  };

  const exportarProductosPDF = () => {
    if (!reporteProductos) return;
    
    const columnas = [
      { header: 'Código', dataKey: 'codigo_barras' },
      { header: 'Producto', dataKey: 'nombre' },
      { header: 'Categoría', dataKey: 'categoria_nombre' },
      { header: 'Cant. Vendida', dataKey: 'total_vendido', align: 'right' },
      { header: 'Núm. Ventas', dataKey: 'num_ventas', align: 'right' },
      { header: 'Monto Total', dataKey: 'monto_total', format: formatearMoneda, align: 'right' }
    ];

    // Calcular totales
    const totalCantidad = reporteProductos.productos.reduce((sum, p) => sum + parseInt(p.total_vendido), 0);
    const totalMonto = reporteProductos.productos.reduce((sum, p) => sum + parseFloat(p.monto_total), 0);
    const totales = {
      total_vendido: totalCantidad,
      monto_total: totalMonto
    };
    
    exportarAPDF(reporteProductos.productos, `Productos_${fechaInicio}_${fechaFin}`, 
                 `Productos Más Vendidos (${fechaInicio} - ${fechaFin})`, columnas, totales);
  };

  const exportarInventarioExcel = () => {
    if (!reporteInventario) return;
    
    const datos = reporteInventario.productos.map(p => ({
      'Código': p.codigo_barras,
      'Producto': p.nombre,
      'Categoría': p.categoria_nombre || '-',
      'Stock Actual': p.stock_actual,
      'Stock Mínimo': p.stock_minimo,
      'Estado': p.estado_stock,
      'Precio Compra': parseFloat(p.precio_compra).toFixed(2),
      'Precio Venta': parseFloat(p.precio_venta).toFixed(2),
      'Valor Inventario': parseFloat(p.valor_inventario).toFixed(2)
    }));

    // Agregar totales
    const totalValor = reporteInventario.productos.reduce((sum, p) => sum + parseFloat(p.valor_inventario), 0);
    datos.push({
      'Código': '',
      'Producto': '',
      'Categoría': '',
      'Stock Actual': '',
      'Stock Mínimo': '',
      'Estado': '',
      'Precio Compra': '',
      'Precio Venta': 'TOTAL',
      'Valor Inventario': totalValor.toFixed(2)
    });
    
    exportarAExcel(datos, `Inventario_${format(new Date(), 'yyyy-MM-dd')}`, 'Inventario');
  };

  const exportarInventarioPDF = () => {
    if (!reporteInventario) return;
    
    const columnas = [
      { header: 'Código', dataKey: 'codigo_barras' },
      { header: 'Producto', dataKey: 'nombre' },
      { header: 'Stock', dataKey: 'stock_actual', align: 'right' },
      { header: 'Mín', dataKey: 'stock_minimo', align: 'right' },
      { header: 'Estado', dataKey: 'estado_stock' },
      { header: 'Precio Venta', dataKey: 'precio_venta', format: formatearMoneda, align: 'right' },
      { header: 'Valor', dataKey: 'valor_inventario', format: formatearMoneda, align: 'right' }
    ];

    // Calcular totales
    const totalValor = reporteInventario.productos.reduce((sum, p) => sum + parseFloat(p.valor_inventario), 0);
    const totales = {
      valor_inventario: totalValor
    };
    
    exportarAPDF(reporteInventario.productos, `Inventario_${format(new Date(), 'yyyy-MM-dd')}`, 
                 'Reporte de Inventario', columnas, totales);
  };

  const exportarGananciasExcel = () => {
    if (!reporteGanancias) return;
    
    const datos = reporteGanancias.productos.map(p => ({
      'Producto': p.nombre,
      'Categoría': p.categoria_nombre || '-',
      'Cantidad Vendida': p.cantidad_vendida,
      'Precio Compra': parseFloat(p.precio_compra).toFixed(2),
      'Precio Venta': parseFloat(p.precio_venta).toFixed(2),
      'Ganancia Unitaria': parseFloat(p.ganancia_unitaria).toFixed(2),
      'Ingreso Total': parseFloat(p.ingreso_total).toFixed(2),
      'Costo Total': parseFloat(p.costo_total).toFixed(2),
      'Ganancia Total': parseFloat(p.ganancia_total).toFixed(2)
    }));

    // Agregar totales
    datos.push({
      'Producto': '',
      'Categoría': '',
      'Cantidad Vendida': '',
      'Precio Compra': '',
      'Precio Venta': '',
      'Ganancia Unitaria': 'TOTAL',
      'Ingreso Total': parseFloat(reporteGanancias.resumen.ingreso_total).toFixed(2),
      'Costo Total': parseFloat(reporteGanancias.resumen.costo_total).toFixed(2),
      'Ganancia Total': parseFloat(reporteGanancias.resumen.ganancia_total).toFixed(2)
    });
    
    exportarAExcel(datos, `Ganancias_${fechaInicio}_${fechaFin}`, 'Ganancias');
  };

  const exportarGananciasPDF = () => {
    if (!reporteGanancias) return;
    
    const columnas = [
      { header: 'Producto', dataKey: 'nombre' },
      { header: 'Cant.', dataKey: 'cantidad_vendida', align: 'right' },
      { header: 'P. Compra', dataKey: 'precio_compra', format: formatearMoneda, align: 'right' },
      { header: 'P. Venta', dataKey: 'precio_venta', format: formatearMoneda, align: 'right' },
      { header: 'Ingreso', dataKey: 'ingreso_total', format: formatearMoneda, align: 'right' },
      { header: 'Ganancia', dataKey: 'ganancia_total', format: formatearMoneda, align: 'right' }
    ];

    // Totales del resumen
    const totales = {
      ingreso_total: parseFloat(reporteGanancias.resumen.ingreso_total),
      ganancia_total: parseFloat(reporteGanancias.resumen.ganancia_total)
    };
    
    exportarAPDF(reporteGanancias.productos, `Ganancias_${fechaInicio}_${fechaFin}`, 
                 `Reporte de Ganancias (${fechaInicio} - ${fechaFin})`, columnas, totales);
  };

  const exportarMovimientosExcel = () => {
    if (!reporteMovimientos) return;
    
    const datos = reporteMovimientos.movimientos.map(m => ({
      'Fecha': formatearFecha(m.fecha),
      'Tipo': m.tipo_movimiento,
      'Producto': m.producto_nombre,
      'Código': m.codigo_barras,
      'Cantidad': m.cantidad,
      'Motivo': m.motivo,
      'Usuario': m.usuario_nombre || '-',
      'Referencia': m.referencia || '-'
    }));
    
    exportarAExcel(datos, `Movimientos_${fechaInicio}_${fechaFin}`, 'Movimientos');
  };

  const exportarMovimientosPDF = () => {
    if (!reporteMovimientos) return;
    
    const columnas = [
      { header: 'Fecha', dataKey: 'fecha', format: formatearFecha },
      { header: 'Tipo', dataKey: 'tipo_movimiento' },
      { header: 'Producto', dataKey: 'producto_nombre' },
      { header: 'Cantidad', dataKey: 'cantidad', align: 'right' },
      { header: 'Motivo', dataKey: 'motivo' },
      { header: 'Usuario', dataKey: 'usuario_nombre' }
    ];
    
    exportarAPDF(reporteMovimientos.movimientos, `Movimientos_${fechaInicio}_${fechaFin}`, 
                 `Movimientos de Inventario (${fechaInicio} - ${fechaFin})`, columnas);
  };

  const exportarCuentasPorPagarExcel = () => {
    if (!reporteCuentasPorPagar) return;
    
    const datos = reporteCuentasPorPagar.cuentas.map(c => ({
      'Folio': c.folio,
      'Proveedor': c.proveedor_nombre,
      'Fecha Emisión': formatearFecha(c.fecha_emision),
      'Fecha Vencimiento': formatearFecha(c.fecha_vencimiento),
      'Monto Total': parseFloat(c.monto_total).toFixed(2),
      'Monto Pagado': parseFloat(c.monto_pagado).toFixed(2),
      'Saldo Pendiente': parseFloat(c.saldo_pendiente).toFixed(2),
      'Estado': c.estado_actual,
      'Días para Vencer': c.dias_para_vencer
    }));

    // Agregar totales
    if (reporteCuentasPorPagar.totales) {
      datos.push({
        'Folio': '',
        'Proveedor': '',
        'Fecha Emisión': '',
        'Fecha Vencimiento': '',
        'Monto Total': parseFloat(reporteCuentasPorPagar.totales.monto_total).toFixed(2),
        'Monto Pagado': parseFloat(reporteCuentasPorPagar.totales.monto_pagado).toFixed(2),
        'Saldo Pendiente': parseFloat(reporteCuentasPorPagar.totales.saldo_pendiente).toFixed(2),
        'Estado': 'TOTAL',
        'Días para Vencer': ''
      });
    }
    
    exportarAExcel(datos, `Cuentas_Por_Pagar_${fechaInicio}_${fechaFin}`, 'Cuentas por Pagar');
  };

  const exportarCuentasPorPagarPDF = () => {
    if (!reporteCuentasPorPagar) return;
    
    const columnas = [
      { header: 'Folio', dataKey: 'folio' },
      { header: 'Proveedor', dataKey: 'proveedor_nombre' },
      { header: 'F. Vencimiento', dataKey: 'fecha_vencimiento', format: formatearFecha },
      { header: 'Monto Total', dataKey: 'monto_total', format: formatearMoneda, align: 'right' },
      { header: 'Pagado', dataKey: 'monto_pagado', format: formatearMoneda, align: 'right' },
      { header: 'Saldo', dataKey: 'saldo_pendiente', format: formatearMoneda, align: 'right' },
      { header: 'Estado', dataKey: 'estado_actual' }
    ];

    // Calcular totales
    const totales = reporteCuentasPorPagar.totales ? {
      monto_total: parseFloat(reporteCuentasPorPagar.totales.monto_total),
      monto_pagado: parseFloat(reporteCuentasPorPagar.totales.monto_pagado),
      saldo_pendiente: parseFloat(reporteCuentasPorPagar.totales.saldo_pendiente)
    } : null;
    
    exportarAPDF(reporteCuentasPorPagar.cuentas, `Cuentas_Por_Pagar_${fechaInicio}_${fechaFin}`, 
                 `Cuentas por Pagar (${fechaInicio} - ${fechaFin})`, columnas, totales);
  };

  // Renderizar botones de exportación
  const renderBotonesExportacion = (tipoReporte, datosReporte) => {
    if (!datosReporte) return null;
    
    const exportadores = {
      ventas: { excel: exportarVentasExcel, pdf: exportarVentasPDF },
      productos: { excel: exportarProductosExcel, pdf: exportarProductosPDF },
      inventario: { excel: exportarInventarioExcel, pdf: exportarInventarioPDF },
      ganancias: { excel: exportarGananciasExcel, pdf: exportarGananciasPDF },
      movimientos: { excel: exportarMovimientosExcel, pdf: exportarMovimientosPDF },
      cuentasPorPagar: { excel: exportarCuentasPorPagarExcel, pdf: exportarCuentasPorPagarPDF }
    };
    
    const exp = exportadores[tipoReporte];
    if (!exp) return null;
    
    return (
      <ButtonGroup variant="outlined" size="small">
        <Button
          startIcon={<ExcelIcon />}
          onClick={exp.excel}
          color="success"
        >
          Excel
        </Button>
        <Button
          startIcon={<PdfIcon />}
          onClick={exp.pdf}
          color="error"
        >
          PDF
        </Button>
      </ButtonGroup>
    );
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Reportes
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Análisis y estadísticas del negocio
          </Typography>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Filtros de fecha */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Fecha Inicio"
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Fecha Fin"
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Button
                fullWidth
                variant="contained"
                onClick={handleGenerar}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : <AssessmentIcon />}
                sx={{ height: '56px' }}
              >
                {loading ? 'Generando...' : 'Generar Reporte'}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Tabs de reportes */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab icon={<AttachMoneyIcon />} label="Ventas" />
          <Tab icon={<TrendingUpIcon />} label="Productos" />
          <Tab icon={<InventoryIcon />} label="Inventario" />
          <Tab icon={<PeopleIcon />} label="Vendedores" />
          <Tab icon={<AttachMoneyIcon />} label="Ganancias" />
          <Tab icon={<SwapVertIcon />} label="Movimientos" />
          <Tab icon={<AccountBalanceIcon />} label="Cuentas por Pagar" />
        </Tabs>
      </Box>

      {/* Reporte de Ventas */}
      {tabValue === 0 && reporteVentas && (
        <Box>
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">Total Ventas</Typography>
                  <Typography variant="h4">{reporteVentas.resumen.total_ventas}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">Monto Total</Typography>
                  <Typography variant="h4" color="primary">
                    Q{parseFloat(reporteVentas.resumen.monto_total).toFixed(2)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">Promedio</Typography>
                  <Typography variant="h4">
                    Q{parseFloat(reporteVentas.resumen.promedio_venta).toFixed(2)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Ventas por Día</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={reporteVentas.ventasPorDia}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fecha" tickFormatter={(fecha) => format(new Date(fecha), 'dd/MM')} />
                  <YAxis />
                  <Tooltip labelFormatter={(fecha) => format(new Date(fecha), 'dd/MM/yyyy')} />
                  <Legend />
                  <Bar dataKey="monto_total" fill="#1976d2" name="Ventas (Q)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Por Método de Pago</Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Método</TableCell>
                          <TableCell align="right">Ventas</TableCell>
                          <TableCell align="right">Monto</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {reporteVentas.ventasPorMetodo.map((metodo) => (
                          <TableRow key={metodo.metodo_pago}>
                            <TableCell sx={{ textTransform: 'capitalize' }}>{metodo.metodo_pago}</TableCell>
                            <TableCell align="right">{metodo.num_ventas}</TableCell>
                            <TableCell align="right">Q{parseFloat(metodo.monto_total).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">Detalle de Ventas</Typography>
                    {renderBotonesExportacion('ventas', reporteVentas)}
                  </Box>
                  <TableContainer sx={{ maxHeight: 400 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>Folio</TableCell>
                          <TableCell>Cliente</TableCell>
                          <TableCell align="right">Total</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {reporteVentas.ventasDetalle.slice(0, 10).map((venta) => (
                          <TableRow key={venta.id}>
                            <TableCell>{venta.folio}</TableCell>
                            <TableCell>{venta.cliente_nombre || 'Sin cliente'}</TableCell>
                            <TableCell align="right">Q{parseFloat(venta.total).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Reporte de Productos */}
      {tabValue === 1 && reporteProductos && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Productos Más Vendidos</Typography>
              {renderBotonesExportacion('productos', reporteProductos)}
            </Box>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Producto</TableCell>
                    <TableCell>Categoría</TableCell>
                    <TableCell align="right">Cantidad</TableCell>
                    <TableCell align="right">Ventas</TableCell>
                    <TableCell align="right">Monto Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reporteProductos.productos.map((producto, index) => (
                    <TableRow key={producto.id}>
                      <TableCell>
                        <Chip label={`#${index + 1}`} size="small" sx={{ mr: 1 }} />
                        {producto.nombre}
                      </TableCell>
                      <TableCell>{producto.categoria_nombre || producto.categoria_id || '-'}</TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="bold">{producto.total_vendido}</Typography>
                      </TableCell>
                      <TableCell align="right">{producto.num_ventas}</TableCell>
                      <TableCell align="right">
                        <Typography color="primary" fontWeight="bold">
                          Q{parseFloat(producto.monto_total).toFixed(2)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Reporte de Inventario */}
      {tabValue === 2 && reporteInventario && (
        <Box>
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">Total Productos</Typography>
                  <Typography variant="h4">{reporteInventario.valorTotal.total_productos}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">Valor Inventario</Typography>
                  <Typography variant="h4" color="success.main">
                    Q{parseFloat(reporteInventario.valorTotal.valor_total_inventario).toFixed(2)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Productos en Inventario</Typography>
                {renderBotonesExportacion('inventario', reporteInventario)}
              </Box>
              <TableContainer sx={{ maxHeight: 500 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Producto</TableCell>
                      <TableCell>Categoría</TableCell>
                      <TableCell align="right">Stock</TableCell>
                      <TableCell align="right">Mín</TableCell>
                      <TableCell align="right">Precio</TableCell>
                      <TableCell align="right">Valor</TableCell>
                      <TableCell align="center">Estado</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {reporteInventario.productos.map((producto) => (
                      <TableRow key={producto.id}>
                        <TableCell>{producto.nombre}</TableCell>
                        <TableCell>{producto.categoria_nombre || producto.categoria_id || '-'}</TableCell>
                        <TableCell align="right">{producto.stock_actual}</TableCell>
                        <TableCell align="right">{producto.stock_minimo}</TableCell>
                        <TableCell align="right">Q{parseFloat(producto.precio_compra).toFixed(2)}</TableCell>
                        <TableCell align="right">Q{parseFloat(producto.valor_inventario).toFixed(2)}</TableCell>
                        <TableCell align="center">
                          <Chip
                            label={producto.estado_stock}
                            size="small"
                            color={
                              producto.estado_stock === 'bajo' ? 'error' :
                              producto.estado_stock === 'alto' ? 'warning' : 'success'
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Reporte de Vendedores */}
      {tabValue === 3 && reporteVendedores && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Ventas por Vendedor</Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Vendedor</TableCell>
                    <TableCell>Rol ID</TableCell>
                    <TableCell align="right">Ventas</TableCell>
                    <TableCell align="right">Monto Total</TableCell>
                    <TableCell align="right">Promedio</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reporteVendedores.vendedores.map((vendedor) => (
                    <TableRow key={vendedor.id}>
                      <TableCell>{vendedor.vendedor}</TableCell>
                      <TableCell>
                        <Chip 
                          label={vendedor.rol_id === 1 ? 'Admin' : vendedor.rol_id === 2 ? 'Gerente' : 'Vendedor'} 
                          size="small"
                          color={vendedor.rol_id === 1 ? 'error' : vendedor.rol_id === 2 ? 'warning' : 'default'}
                        />
                      </TableCell>
                      <TableCell align="right">{vendedor.total_ventas}</TableCell>
                      <TableCell align="right">
                        <Typography color="primary" fontWeight="bold">
                          Q{parseFloat(vendedor.monto_total).toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">Q{parseFloat(vendedor.promedio_venta).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Reporte de Ganancias */}
      {tabValue === 4 && reporteGanancias && (
        <Box>
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">Ingresos</Typography>
                  <Typography variant="h5" color="primary">
                    Q{parseFloat(reporteGanancias.resumen.ingreso_total).toFixed(2)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">Costos</Typography>
                  <Typography variant="h5" color="error">
                    Q{parseFloat(reporteGanancias.resumen.costo_total).toFixed(2)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">Ganancia</Typography>
                  <Typography variant="h5" color="success.main">
                    Q{parseFloat(reporteGanancias.resumen.ganancia_total).toFixed(2)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Margen: {reporteGanancias.resumen.margen_ganancia.toFixed(2)}%
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Ganancias por Producto</Typography>
                {renderBotonesExportacion('ganancias', reporteGanancias)}
              </Box>
              <TableContainer sx={{ maxHeight: 500 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Producto</TableCell>
                      <TableCell align="right">Vendidos</TableCell>
                      <TableCell align="right">Ingreso</TableCell>
                      <TableCell align="right">Costo</TableCell>
                      <TableCell align="right">Ganancia</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {reporteGanancias.productos.map((producto) => (
                      <TableRow key={producto.id}>
                        <TableCell>{producto.nombre}</TableCell>
                        <TableCell align="right">{producto.cantidad_vendida}</TableCell>
                        <TableCell align="right">Q{parseFloat(producto.ingreso_total).toFixed(2)}</TableCell>
                        <TableCell align="right">Q{parseFloat(producto.costo_total).toFixed(2)}</TableCell>
                        <TableCell align="right">
                          <Typography color="success.main" fontWeight="bold">
                            Q{parseFloat(producto.ganancia_total).toFixed(2)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Reporte de Movimientos */}
      {tabValue === 5 && reporteMovimientos && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Movimientos de Inventario</Typography>
              {renderBotonesExportacion('movimientos', reporteMovimientos)}
            </Box>
            <TableContainer sx={{ maxHeight: 500 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Fecha</TableCell>
                    <TableCell>Producto</TableCell>
                    <TableCell>Tipo</TableCell>
                    <TableCell align="right">Cantidad</TableCell>
                    <TableCell>Motivo</TableCell>
                    <TableCell>Usuario</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reporteMovimientos.movimientos.map((mov) => (
                    <TableRow key={mov.id}>
                      <TableCell>{format(new Date(mov.fecha), 'dd/MM/yyyy HH:mm')}</TableCell>
                      <TableCell>{mov.producto_nombre}</TableCell>
                      <TableCell>
                        <Chip
                          label={mov.tipo_movimiento}
                          size="small"
                          color={mov.tipo_movimiento === 'entrada' ? 'success' : 'error'}
                        />
                      </TableCell>
                      <TableCell align="right">{mov.cantidad}</TableCell>
                      <TableCell>{mov.motivo}</TableCell>
                      <TableCell>{mov.usuario_nombre}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Tab 6: Cuentas por Pagar */}
      {tabValue === 6 && reporteCuentasPorPagar && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Reporte de Cuentas por Pagar</Typography>
              {renderBotonesExportacion('cuentasPorPagar', reporteCuentasPorPagar)}
            </Box>
            
            {/* Totales */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">Total Cuentas</Typography>
                    <Typography variant="h4">{reporteCuentasPorPagar.totales.total_cuentas}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">Monto Total</Typography>
                    <Typography variant="h4">Q{parseFloat(reporteCuentasPorPagar.totales.monto_total).toFixed(2)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">Monto Pagado</Typography>
                    <Typography variant="h4" color="success.main">Q{parseFloat(reporteCuentasPorPagar.totales.monto_pagado).toFixed(2)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">Saldo Pendiente</Typography>
                    <Typography variant="h4" color="error.main">Q{parseFloat(reporteCuentasPorPagar.totales.saldo_pendiente).toFixed(2)}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Vencido: Q{parseFloat(reporteCuentasPorPagar.totales.total_vencido).toFixed(2)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Tabla */}
            <TableContainer sx={{ maxHeight: 500 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Folio</TableCell>
                    <TableCell>Proveedor</TableCell>
                    <TableCell>F. Emisión</TableCell>
                    <TableCell>F. Vencimiento</TableCell>
                    <TableCell align="right">Monto Total</TableCell>
                    <TableCell align="right">Pagado</TableCell>
                    <TableCell align="right">Saldo</TableCell>
                    <TableCell>Estado</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reporteCuentasPorPagar.cuentas.map((cuenta) => (
                    <TableRow key={cuenta.id}>
                      <TableCell>{cuenta.folio}</TableCell>
                      <TableCell>{cuenta.proveedor_nombre}</TableCell>
                      <TableCell>{format(new Date(cuenta.fecha_emision), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>
                        {format(new Date(cuenta.fecha_vencimiento), 'dd/MM/yyyy')}
                        {cuenta.dias_para_vencer !== null && (
                          <Typography variant="caption" display="block" color={cuenta.dias_para_vencer < 0 ? 'error' : 'text.secondary'}>
                            {cuenta.dias_para_vencer >= 0 
                              ? `En ${cuenta.dias_para_vencer} días`
                              : `Vencido hace ${Math.abs(cuenta.dias_para_vencer)} días`
                            }
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">Q{parseFloat(cuenta.monto_total).toFixed(2)}</TableCell>
                      <TableCell align="right">
                        <Typography color="success.main">Q{parseFloat(cuenta.monto_pagado).toFixed(2)}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography color="error.main" fontWeight="bold">
                          Q{parseFloat(cuenta.saldo_pendiente).toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={cuenta.estado_actual || cuenta.estado}
                          size="small"
                          color={
                            (cuenta.estado_actual || cuenta.estado) === 'vencido' ? 'error' :
                            (cuenta.estado_actual || cuenta.estado) === 'pendiente' ? 'warning' :
                            (cuenta.estado_actual || cuenta.estado) === 'parcial' ? 'info' : 'success'
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default Reportes;