// src/pages/ReporteCuentasPorPagar.js
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
  MenuItem,
  Chip,
  Alert,
  Autocomplete,
  Divider,
} from '@mui/material';
import {
  Download as DownloadIcon,
  PictureAsPdf as PdfIcon,
  Refresh as RefreshIcon,
  AttachMoney as AttachMoneyIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const ReporteCuentasPorPagar = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cuentas, setCuentas] = useState([]);
  const [totales, setTotales] = useState(null);
  const [proveedores, setProveedores] = useState([]);

  // Filtros
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState(null);
  const [estadoFiltro, setEstadoFiltro] = useState('');

  useEffect(() => {
    cargarProveedores();
    generarReporte();
  }, []);

  const cargarProveedores = async () => {
    try {
      const response = await api.get('/api/proveedores');
      setProveedores(response.data.proveedores || []);
    } catch (err) {
      console.error('Error al cargar proveedores:', err);
    }
  };

  const generarReporte = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (fechaInicio) params.append('fecha_inicio', fechaInicio);
      if (fechaFin) params.append('fecha_fin', fechaFin);
      if (proveedorSeleccionado) params.append('proveedor_id', proveedorSeleccionado.id);
      if (estadoFiltro) params.append('estado', estadoFiltro);

      const response = await api.get(`/api/reportes/cuentas-por-pagar?${params.toString()}`);
      setCuentas(response.data.cuentas);
      setTotales(response.data.totales);
    } catch (err) {
      setError('Error al generar reporte');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const limpiarFiltros = () => {
    setFechaInicio('');
    setFechaFin('');
    setProveedorSeleccionado(null);
    setEstadoFiltro('');
  };

  const getEstadoColor = (estado) => {
    switch (estado) {
      case 'pendiente': return 'warning';
      case 'parcial': return 'info';
      case 'pagado': return 'success';
      case 'vencido': return 'error';
      default: return 'default';
    }
  };

  const getEstadoTexto = (estado) => {
    switch (estado) {
      case 'pendiente': return 'Pendiente';
      case 'parcial': return 'Pago Parcial';
      case 'pagado': return 'Pagado';
      case 'vencido': return 'Vencido';
      default: return estado;
    }
  };

  const exportarExcel = () => {
    // Preparar datos para Excel
    const datosExcel = cuentas.map(cuenta => ({
      'Folio': cuenta.folio,
      'Proveedor': cuenta.proveedor_nombre,
      'Teléfono': cuenta.proveedor_telefono || '',
      'Email': cuenta.proveedor_email || '',
      'Fecha Emisión': format(new Date(cuenta.fecha_emision), 'dd/MM/yyyy'),
      'Fecha Vencimiento': format(new Date(cuenta.fecha_vencimiento), 'dd/MM/yyyy'),
      'Días Crédito': cuenta.dias_credito,
      'Días para Vencer': cuenta.dias_para_vencer,
      'Monto Total': parseFloat(cuenta.monto_total).toFixed(2),
      'Monto Pagado': parseFloat(cuenta.monto_pagado).toFixed(2),
      'Saldo Pendiente': parseFloat(cuenta.saldo_pendiente).toFixed(2),
      'Estado': getEstadoTexto(cuenta.estado_actual || cuenta.estado),
      'Número de Pagos': cuenta.num_pagos,
      'Concepto': cuenta.concepto || '',
      'Notas': cuenta.notas || '',
    }));

    // Agregar fila de totales
    datosExcel.push({
      'Folio': 'TOTALES',
      'Proveedor': `${totales.total_cuentas} cuentas`,
      'Teléfono': '',
      'Email': '',
      'Fecha Emisión': '',
      'Fecha Vencimiento': '',
      'Días Crédito': '',
      'Días para Vencer': '',
      'Monto Total': parseFloat(totales.monto_total).toFixed(2),
      'Monto Pagado': parseFloat(totales.monto_pagado).toFixed(2),
      'Saldo Pendiente': parseFloat(totales.saldo_pendiente).toFixed(2),
      'Estado': '',
      'Número de Pagos': '',
      'Concepto': '',
      'Notas': `Saldo Vencido: Q${parseFloat(totales.total_vencido).toFixed(2)}`,
    });

    // Crear libro de Excel
    const ws = XLSX.utils.json_to_sheet(datosExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cuentas por Pagar');

    // Ajustar ancho de columnas
    const colWidths = [
      { wch: 12 }, // Folio
      { wch: 25 }, // Proveedor
      { wch: 12 }, // Teléfono
      { wch: 25 }, // Email
      { wch: 15 }, // Fecha Emisión
      { wch: 18 }, // Fecha Vencimiento
      { wch: 12 }, // Días Crédito
      { wch: 15 }, // Días para Vencer
      { wch: 12 }, // Monto Total
      { wch: 12 }, // Monto Pagado
      { wch: 15 }, // Saldo Pendiente
      { wch: 12 }, // Estado
      { wch: 15 }, // Número de Pagos
      { wch: 30 }, // Concepto
      { wch: 30 }, // Notas
    ];
    ws['!cols'] = colWidths;

    // Descargar archivo
    const fecha = format(new Date(), 'yyyyMMdd_HHmmss');
    XLSX.writeFile(wb, `Reporte_Cuentas_Por_Pagar_${fecha}.xlsx`);
  };

  const exportarPDF = () => {
    const doc = new jsPDF('landscape');
    
    // Título
    doc.setFontSize(18);
    doc.text('Reporte de Cuentas por Pagar', 14, 20);
    
    // Información del reporte
    doc.setFontSize(10);
    doc.text(`Fecha de generación: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 28);
    
    if (fechaInicio || fechaFin) {
      let filtroTexto = 'Período: ';
      if (fechaInicio) filtroTexto += `Desde ${format(new Date(fechaInicio), 'dd/MM/yyyy')} `;
      if (fechaFin) filtroTexto += `Hasta ${format(new Date(fechaFin), 'dd/MM/yyyy')}`;
      doc.text(filtroTexto, 14, 34);
    }
    
    if (proveedorSeleccionado) {
      doc.text(`Proveedor: ${proveedorSeleccionado.nombre}`, 14, 40);
    }
    
    if (estadoFiltro) {
      doc.text(`Estado: ${getEstadoTexto(estadoFiltro)}`, 14, 46);
    }

    // Tabla de datos
    const tableData = cuentas.map(cuenta => [
      cuenta.folio,
      cuenta.proveedor_nombre,
      format(new Date(cuenta.fecha_emision), 'dd/MM/yyyy'),
      format(new Date(cuenta.fecha_vencimiento), 'dd/MM/yyyy'),
      `Q${parseFloat(cuenta.monto_total).toFixed(2)}`,
      `Q${parseFloat(cuenta.monto_pagado).toFixed(2)}`,
      `Q${parseFloat(cuenta.saldo_pendiente).toFixed(2)}`,
      getEstadoTexto(cuenta.estado_actual || cuenta.estado),
    ]);

    doc.autoTable({
      startY: estadoFiltro ? 52 : (proveedorSeleccionado ? 46 : (fechaInicio || fechaFin ? 40 : 34)),
      head: [['Folio', 'Proveedor', 'F. Emisión', 'F. Vencimiento', 'Total', 'Pagado', 'Saldo', 'Estado']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 139, 202] },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
      foot: [[
        'TOTALES',
        `${totales.total_cuentas} cuentas`,
        '',
        '',
        `Q${parseFloat(totales.monto_total).toFixed(2)}`,
        `Q${parseFloat(totales.monto_pagado).toFixed(2)}`,
        `Q${parseFloat(totales.saldo_pendiente).toFixed(2)}`,
        `Vencido: Q${parseFloat(totales.total_vencido).toFixed(2)}`,
      ]],
    });

    // Descargar
    const fecha = format(new Date(), 'yyyyMMdd_HHmmss');
    doc.save(`Reporte_Cuentas_Por_Pagar_${fecha}.pdf`);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Reporte de Cuentas por Pagar
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Detalle de créditos con proveedores
          </Typography>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Filtros */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Filtros
          </Typography>
          <Grid container spacing={2}>
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
              <Autocomplete
                options={proveedores}
                getOptionLabel={(option) => option.nombre}
                value={proveedorSeleccionado}
                onChange={(event, newValue) => setProveedorSeleccionado(newValue)}
                renderInput={(params) => (
                  <TextField {...params} label="Proveedor" />
                )}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                select
                fullWidth
                label="Estado"
                value={estadoFiltro}
                onChange={(e) => setEstadoFiltro(e.target.value)}
              >
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value="pendiente">Pendiente</MenuItem>
                <MenuItem value="parcial">Pago Parcial</MenuItem>
                <MenuItem value="pagado">Pagado</MenuItem>
                <MenuItem value="vencido">Vencido</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<RefreshIcon />}
                  onClick={generarReporte}
                  disabled={loading}
                >
                  Generar Reporte
                </Button>
                <Button
                  variant="outlined"
                  onClick={limpiarFiltros}
                >
                  Limpiar Filtros
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Totales */}
      {totales && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: 'info.main', color: 'white' }}>
              <CardContent>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Total Cuentas
                </Typography>
                <Typography variant="h4" fontWeight="bold">
                  {totales.total_cuentas}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: 'primary.main', color: 'white' }}>
              <CardContent>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Monto Total
                </Typography>
                <Typography variant="h4" fontWeight="bold">
                  Q{parseFloat(totales.monto_total).toFixed(2)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: 'success.main', color: 'white' }}>
              <CardContent>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Monto Pagado
                </Typography>
                <Typography variant="h4" fontWeight="bold">
                  Q{parseFloat(totales.monto_pagado).toFixed(2)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: 'error.main', color: 'white' }}>
              <CardContent>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Saldo Pendiente
                </Typography>
                <Typography variant="h4" fontWeight="bold">
                  Q{parseFloat(totales.saldo_pendiente).toFixed(2)}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.9 }}>
                  Vencido: Q{parseFloat(totales.total_vencido).toFixed(2)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Botones de exportación */}
      {cuentas.length > 0 && (
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <Button
            variant="contained"
            color="success"
            startIcon={<DownloadIcon />}
            onClick={exportarExcel}
          >
            Exportar a Excel
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<PdfIcon />}
            onClick={exportarPDF}
          >
            Exportar a PDF
          </Button>
        </Box>
      )}

      {/* Tabla de resultados */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Detalle de Cuentas ({cuentas.length})
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Folio</TableCell>
                  <TableCell>Proveedor</TableCell>
                  <TableCell>Fecha Emisión</TableCell>
                  <TableCell>Fecha Vencimiento</TableCell>
                  <TableCell>Días</TableCell>
                  <TableCell align="right">Monto Total</TableCell>
                  <TableCell align="right">Pagado</TableCell>
                  <TableCell align="right">Saldo</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell align="center"># Pagos</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {cuentas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center">
                      <Box sx={{ py: 3 }}>
                        <AttachMoneyIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                        <Typography variant="body2" color="text.secondary">
                          No hay datos para mostrar con los filtros seleccionados
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {cuentas.map((cuenta) => (
                      <TableRow key={cuenta.id} hover>
                        <TableCell>{cuenta.folio}</TableCell>
                        <TableCell>{cuenta.proveedor_nombre}</TableCell>
                        <TableCell>
                          {format(new Date(cuenta.fecha_emision), 'dd/MM/yyyy')}
                        </TableCell>
                        <TableCell>
                          {format(new Date(cuenta.fecha_vencimiento), 'dd/MM/yyyy')}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={
                              cuenta.dias_para_vencer >= 0
                                ? `${cuenta.dias_para_vencer}d`
                                : `${Math.abs(cuenta.dias_para_vencer)}d atraso`
                            }
                            size="small"
                            color={
                              cuenta.dias_para_vencer < 0
                                ? 'error'
                                : cuenta.dias_para_vencer <= 7
                                ? 'warning'
                                : 'default'
                            }
                          />
                        </TableCell>
                        <TableCell align="right">
                          Q{parseFloat(cuenta.monto_total).toFixed(2)}
                        </TableCell>
                        <TableCell align="right">
                          <Typography color="success.main">
                            Q{parseFloat(cuenta.monto_pagado).toFixed(2)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography color="error.main" fontWeight="bold">
                            Q{parseFloat(cuenta.saldo_pendiente).toFixed(2)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={getEstadoTexto(cuenta.estado_actual || cuenta.estado)}
                            size="small"
                            color={getEstadoColor(cuenta.estado_actual || cuenta.estado)}
                          />
                        </TableCell>
                        <TableCell align="center">{cuenta.num_pagos}</TableCell>
                      </TableRow>
                    ))}
                    {/* Fila de totales */}
                    <TableRow sx={{ bgcolor: 'grey.100' }}>
                      <TableCell colSpan={5}>
                        <Typography fontWeight="bold">TOTALES</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="bold">
                          Q{parseFloat(totales.monto_total).toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="bold" color="success.main">
                          Q{parseFloat(totales.monto_pagado).toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="bold" color="error.main">
                          Q{parseFloat(totales.saldo_pendiente).toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell colSpan={2}>
                        <Typography variant="caption" color="text.secondary">
                          {totales.total_cuentas} cuentas
                        </Typography>
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ReporteCuentasPorPagar;
