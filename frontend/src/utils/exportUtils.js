// src/utils/exportUtils.js
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

// Configuración general
const CONFIG = {
  empresa: 'POS Abarrotes',
  direccion: 'Ciudad de Guatemala, Guatemala',
  telefono: '(502) 1234-5678',
  nit: 'CF',
};

// Exportar a PDF
export const exportarPDF = (tipo, datos, opciones = {}) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  
  // Encabezado
  doc.setFontSize(18);
  doc.setTextColor(33, 150, 243); // Azul
  doc.text(CONFIG.empresa, pageWidth / 2, 15, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(CONFIG.direccion, pageWidth / 2, 22, { align: 'center' });
  doc.text(`Tel: ${CONFIG.telefono} | NIT: ${CONFIG.nit}`, pageWidth / 2, 27, { align: 'center' });
  
  // Línea separadora
  doc.setDrawColor(200);
  doc.line(14, 30, pageWidth - 14, 30);
  
  // Título del reporte
  doc.setFontSize(14);
  doc.setTextColor(0);
  const titulo = opciones.titulo || 'Reporte';
  doc.text(titulo, pageWidth / 2, 38, { align: 'center' });
  
  // Fecha del reporte
  doc.setFontSize(9);
  doc.setTextColor(100);
  const fecha = `Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`;
  doc.text(fecha, pageWidth / 2, 44, { align: 'center' });
  
  let startY = 50;
  
  // Generar contenido según el tipo
  switch (tipo) {
    case 'ventas':
      generarPDFVentas(doc, datos, startY);
      break;
    case 'productos':
      generarPDFProductos(doc, datos, startY);
      break;
    case 'inventario':
      generarPDFInventario(doc, datos, startY);
      break;
    case 'ganancias':
      generarPDFGanancias(doc, datos, startY);
      break;
    case 'vendedores':
      generarPDFVendedores(doc, datos, startY);
      break;
    case 'movimientos':
      generarPDFMovimientos(doc, datos, startY);
      break;
    default:
      doc.text('Tipo de reporte no soportado', 14, startY);
  }
  
  // Pie de página
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Página ${i} de ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }
  
  // Guardar PDF
  const nombreArchivo = `${tipo}_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`;
  doc.save(nombreArchivo);
};

// Generar PDF de Ventas
const generarPDFVentas = (doc, datos, startY) => {
  // Resumen
  if (datos.resumen) {
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text('Resumen del Período', 14, startY);
    
    const resumenData = [
      ['Total de Ventas:', datos.resumen.total_ventas],
      ['Monto Total:', `Q${parseFloat(datos.resumen.monto_total).toFixed(2)}`],
      ['Promedio por Venta:', `Q${parseFloat(datos.resumen.promedio_venta).toFixed(2)}`],
    ];
    
    autoTable(doc, {
      startY: startY + 5,
      body: resumenData,
      theme: 'plain',
      styles: { fontSize: 10 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 50 },
        1: { halign: 'right', cellWidth: 50 }
      },
    });
    
    startY = doc.lastAutoTable.finalY + 10;
  }
  
  // Ventas por método de pago
  if (datos.ventasPorMetodo && datos.ventasPorMetodo.length > 0) {
    doc.text('Ventas por Método de Pago', 14, startY);
    
    autoTable(doc, {
      startY: startY + 5,
      head: [['Método', 'Cantidad', 'Monto']],
      body: datos.ventasPorMetodo.map(m => [
        m.metodo_pago.charAt(0).toUpperCase() + m.metodo_pago.slice(1),
        m.num_ventas,
        `Q${parseFloat(m.monto_total).toFixed(2)}`
      ]),
      theme: 'striped',
      headStyles: { fillColor: [33, 150, 243] },
    });
    
    startY = doc.lastAutoTable.finalY + 10;
  }
  
  // Detalle de ventas
  if (datos.ventasDetalle && datos.ventasDetalle.length > 0) {
    doc.text('Detalle de Ventas', 14, startY);
    
    autoTable(doc, {
      startY: startY + 5,
      head: [['Folio', 'Fecha', 'Cliente', 'Total']],
      body: datos.ventasDetalle.slice(0, 50).map(v => [
        v.folio,
        format(new Date(v.fecha_venta), 'dd/MM/yyyy'),
        v.cliente_nombre || 'Sin cliente',
        `Q${parseFloat(v.total).toFixed(2)}`
      ]),
      theme: 'striped',
      headStyles: { fillColor: [33, 150, 243] },
      styles: { fontSize: 9 },
    });
  }
};

// Generar PDF de Productos
const generarPDFProductos = (doc, datos, startY) => {
  if (datos.productos && datos.productos.length > 0) {
    autoTable(doc, {
      startY: startY,
      head: [['#', 'Producto', 'Categoría', 'Vendidos', 'Monto']],
      body: datos.productos.map((p, i) => [
        i + 1,
        p.nombre,
        p.categoria_id || '-',
        p.total_vendido,
        `Q${parseFloat(p.monto_total).toFixed(2)}`
      ]),
      theme: 'striped',
      headStyles: { fillColor: [33, 150, 243] },
      styles: { fontSize: 9 },
    });
  }
};

// Generar PDF de Inventario
const generarPDFInventario = (doc, datos, startY) => {
  // Resumen
  if (datos.valorTotal) {
    const resumenData = [
      ['Total de Productos:', datos.valorTotal.total_productos],
      ['Valor del Inventario:', `Q${parseFloat(datos.valorTotal.valor_total_inventario).toFixed(2)}`],
    ];
    
    autoTable(doc, {
      startY: startY,
      body: resumenData,
      theme: 'plain',
      styles: { fontSize: 10 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 60 },
        1: { halign: 'right', cellWidth: 60 }
      },
    });
    
    startY = doc.lastAutoTable.finalY + 10;
  }
  
  // Lista de productos
  if (datos.productos && datos.productos.length > 0) {
    autoTable(doc, {
      startY: startY,
      head: [['Producto', 'Stock', 'Mín', 'Precio', 'Valor', 'Estado']],
      body: datos.productos.slice(0, 100).map(p => [
        p.nombre,
        p.stock_actual,
        p.stock_minimo,
        `Q${parseFloat(p.precio_compra).toFixed(2)}`,
        `Q${parseFloat(p.valor_inventario).toFixed(2)}`,
        p.estado_stock
      ]),
      theme: 'striped',
      headStyles: { fillColor: [33, 150, 243] },
      styles: { fontSize: 8 },
    });
  }
};

// Generar PDF de Ganancias
const generarPDFGanancias = (doc, datos, startY) => {
  // Resumen
  if (datos.resumen) {
    const resumenData = [
      ['Ingresos Totales:', `Q${parseFloat(datos.resumen.ingreso_total).toFixed(2)}`],
      ['Costos Totales:', `Q${parseFloat(datos.resumen.costo_total).toFixed(2)}`],
      ['Ganancia Total:', `Q${parseFloat(datos.resumen.ganancia_total).toFixed(2)}`],
      ['Margen de Ganancia:', `${datos.resumen.margen_ganancia.toFixed(2)}%`],
    ];
    
    autoTable(doc, {
      startY: startY,
      body: resumenData,
      theme: 'plain',
      styles: { fontSize: 10 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 60 },
        1: { halign: 'right', cellWidth: 60 }
      },
    });
    
    startY = doc.lastAutoTable.finalY + 10;
  }
  
  // Detalle por producto
  if (datos.productos && datos.productos.length > 0) {
    doc.text('Ganancias por Producto', 14, startY);
    
    autoTable(doc, {
      startY: startY + 5,
      head: [['Producto', 'Vendidos', 'Ingreso', 'Costo', 'Ganancia']],
      body: datos.productos.slice(0, 50).map(p => [
        p.nombre,
        p.cantidad_vendida,
        `Q${parseFloat(p.ingreso_total).toFixed(2)}`,
        `Q${parseFloat(p.costo_total).toFixed(2)}`,
        `Q${parseFloat(p.ganancia_total).toFixed(2)}`
      ]),
      theme: 'striped',
      headStyles: { fillColor: [33, 150, 243] },
      styles: { fontSize: 8 },
    });
  }
};

// Generar PDF de Vendedores
const generarPDFVendedores = (doc, datos, startY) => {
  if (datos.vendedores && datos.vendedores.length > 0) {
    autoTable(doc, {
      startY: startY,
      head: [['Vendedor', 'Ventas', 'Monto Total', 'Promedio']],
      body: datos.vendedores.map(v => [
        v.vendedor,
        v.total_ventas,
        `Q${parseFloat(v.monto_total).toFixed(2)}`,
        `Q${parseFloat(v.promedio_venta).toFixed(2)}`
      ]),
      theme: 'striped',
      headStyles: { fillColor: [33, 150, 243] },
      styles: { fontSize: 10 },
    });
  }
};

// Generar PDF de Movimientos
const generarPDFMovimientos = (doc, datos, startY) => {
  if (datos.movimientos && datos.movimientos.length > 0) {
    autoTable(doc, {
      startY: startY,
      head: [['Fecha', 'Producto', 'Tipo', 'Cantidad', 'Motivo']],
      body: datos.movimientos.map(m => [
        format(new Date(m.fecha), 'dd/MM/yyyy HH:mm'),
        m.producto_nombre,
        m.tipo_movimiento,
        m.cantidad,
        m.motivo
      ]),
      theme: 'striped',
      headStyles: { fillColor: [33, 150, 243] },
      styles: { fontSize: 8 },
    });
  }
};

// Exportar a Excel
export const exportarExcel = (tipo, datos, opciones = {}) => {
  let worksheetData = [];
  let worksheetName = 'Datos';
  
  switch (tipo) {
    case 'ventas':
      worksheetData = prepararExcelVentas(datos);
      worksheetName = 'Ventas';
      break;
    case 'productos':
      worksheetData = prepararExcelProductos(datos);
      worksheetName = 'Productos';
      break;
    case 'inventario':
      worksheetData = prepararExcelInventario(datos);
      worksheetName = 'Inventario';
      break;
    case 'ganancias':
      worksheetData = prepararExcelGanancias(datos);
      worksheetName = 'Ganancias';
      break;
    case 'vendedores':
      worksheetData = prepararExcelVendedores(datos);
      worksheetName = 'Vendedores';
      break;
    case 'movimientos':
      worksheetData = prepararExcelMovimientos(datos);
      worksheetName = 'Movimientos';
      break;
    default:
      worksheetData = [['Tipo de reporte no soportado']];
  }
  
  const ws = XLSX.utils.aoa_to_sheet(worksheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, worksheetName);
  
  const nombreArchivo = `${tipo}_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`;
  XLSX.writeFile(wb, nombreArchivo);
};

// Preparar datos de Ventas para Excel
const prepararExcelVentas = (datos) => {
  const rows = [];
  
  // Encabezado
  rows.push([CONFIG.empresa]);
  rows.push([`Reporte de Ventas - ${format(new Date(), 'dd/MM/yyyy')}`]);
  rows.push([]);
  
  // Resumen
  if (datos.resumen) {
    rows.push(['RESUMEN']);
    rows.push(['Total de Ventas:', datos.resumen.total_ventas]);
    rows.push(['Monto Total:', `Q${parseFloat(datos.resumen.monto_total).toFixed(2)}`]);
    rows.push(['Promedio:', `Q${parseFloat(datos.resumen.promedio_venta).toFixed(2)}`]);
    rows.push([]);
  }
  
  // Detalle
  if (datos.ventasDetalle && datos.ventasDetalle.length > 0) {
    rows.push(['DETALLE DE VENTAS']);
    rows.push(['Folio', 'Fecha', 'Cliente', 'Método Pago', 'Total']);
    
    datos.ventasDetalle.forEach(v => {
      rows.push([
        v.folio,
        format(new Date(v.fecha_venta), 'dd/MM/yyyy HH:mm'),
        v.cliente_nombre || 'Sin cliente',
        v.metodo_pago,
        parseFloat(v.total).toFixed(2)
      ]);
    });
  }
  
  return rows;
};

// Preparar datos de Productos para Excel
const prepararExcelProductos = (datos) => {
  const rows = [];
  
  rows.push([CONFIG.empresa]);
  rows.push([`Productos Más Vendidos - ${format(new Date(), 'dd/MM/yyyy')}`]);
  rows.push([]);
  rows.push(['#', 'Producto', 'Código', 'Categoría', 'Cantidad Vendida', 'Núm. Ventas', 'Monto Total']);
  
  if (datos.productos) {
    datos.productos.forEach((p, i) => {
      rows.push([
        i + 1,
        p.nombre,
        p.codigo_barras,
        p.categoria_id || '-',
        p.total_vendido,
        p.num_ventas,
        parseFloat(p.monto_total).toFixed(2)
      ]);
    });
  }
  
  return rows;
};

// Preparar datos de Inventario para Excel
const prepararExcelInventario = (datos) => {
  const rows = [];
  
  rows.push([CONFIG.empresa]);
  rows.push([`Inventario - ${format(new Date(), 'dd/MM/yyyy')}`]);
  rows.push([]);
  
  if (datos.valorTotal) {
    rows.push(['Total Productos:', datos.valorTotal.total_productos]);
    rows.push(['Valor Total:', `Q${parseFloat(datos.valorTotal.valor_total_inventario).toFixed(2)}`]);
    rows.push([]);
  }
  
  rows.push(['Producto', 'Código', 'Stock Actual', 'Stock Mínimo', 'Precio Compra', 'Valor Total', 'Estado']);
  
  if (datos.productos) {
    datos.productos.forEach(p => {
      rows.push([
        p.nombre,
        p.codigo_barras,
        p.stock_actual,
        p.stock_minimo,
        parseFloat(p.precio_compra).toFixed(2),
        parseFloat(p.valor_inventario).toFixed(2),
        p.estado_stock
      ]);
    });
  }
  
  return rows;
};

// Preparar datos de Ganancias para Excel
const prepararExcelGanancias = (datos) => {
  const rows = [];
  
  rows.push([CONFIG.empresa]);
  rows.push([`Reporte de Ganancias - ${format(new Date(), 'dd/MM/yyyy')}`]);
  rows.push([]);
  
  if (datos.resumen) {
    rows.push(['RESUMEN']);
    rows.push(['Ingresos:', `Q${parseFloat(datos.resumen.ingreso_total).toFixed(2)}`]);
    rows.push(['Costos:', `Q${parseFloat(datos.resumen.costo_total).toFixed(2)}`]);
    rows.push(['Ganancia:', `Q${parseFloat(datos.resumen.ganancia_total).toFixed(2)}`]);
    rows.push(['Margen:', `${datos.resumen.margen_ganancia.toFixed(2)}%`]);
    rows.push([]);
  }
  
  rows.push(['Producto', 'Cantidad Vendida', 'Ingresos', 'Costos', 'Ganancia']);
  
  if (datos.productos) {
    datos.productos.forEach(p => {
      rows.push([
        p.nombre,
        p.cantidad_vendida,
        parseFloat(p.ingreso_total).toFixed(2),
        parseFloat(p.costo_total).toFixed(2),
        parseFloat(p.ganancia_total).toFixed(2)
      ]);
    });
  }
  
  return rows;
};

// Preparar datos de Vendedores para Excel
const prepararExcelVendedores = (datos) => {
  const rows = [];
  
  rows.push([CONFIG.empresa]);
  rows.push([`Ventas por Vendedor - ${format(new Date(), 'dd/MM/yyyy')}`]);
  rows.push([]);
  rows.push(['Vendedor', 'Total Ventas', 'Monto Total', 'Promedio por Venta']);
  
  if (datos.vendedores) {
    datos.vendedores.forEach(v => {
      rows.push([
        v.vendedor,
        v.total_ventas,
        parseFloat(v.monto_total).toFixed(2),
        parseFloat(v.promedio_venta).toFixed(2)
      ]);
    });
  }
  
  return rows;
};

// Preparar datos de Movimientos para Excel
const prepararExcelMovimientos = (datos) => {
  const rows = [];
  
  rows.push([CONFIG.empresa]);
  rows.push([`Movimientos de Inventario - ${format(new Date(), 'dd/MM/yyyy')}`]);
  rows.push([]);
  rows.push(['Fecha', 'Producto', 'Código', 'Tipo', 'Cantidad', 'Motivo', 'Usuario']);
  
  if (datos.movimientos) {
    datos.movimientos.forEach(m => {
      rows.push([
        format(new Date(m.fecha), 'dd/MM/yyyy HH:mm'),
        m.producto_nombre,
        m.codigo_barras,
        m.tipo_movimiento,
        m.cantidad,
        m.motivo,
        m.usuario_nombre || '-'
      ]);
    });
  }
  
  return rows;
};
