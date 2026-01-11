// src/utils/exportUtils.js
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Exportar a Excel
export const exportarAExcel = (datos, nombreArchivo, nombreHoja = 'Reporte') => {
  try {
    // Crear workbook
    const wb = XLSX.utils.book_new();
    
    // Convertir datos a worksheet
    const ws = XLSX.utils.json_to_sheet(datos);
    
    // Agregar worksheet al workbook
    XLSX.utils.book_append_sheet(wb, ws, nombreHoja);
    
    // Generar archivo
    XLSX.writeFile(wb, `${nombreArchivo}.xlsx`);
    
    return true;
  } catch (error) {
    console.error('Error al exportar a Excel:', error);
    alert('Error al exportar a Excel: ' + error.message);
    return false;
  }
};

// Exportar a PDF
export const exportarAPDF = (datos, nombreArchivo, titulo, columnas, totales = null) => {
  try {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });
    
    // Título
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text(titulo, 14, 22);
    
    // Fecha del reporte
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100);
    const fechaActual = new Date().toLocaleString('es-GT', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    doc.text(`Generado: ${fechaActual}`, 14, 30);
    
    // Preparar datos del body
    const bodyData = datos.map(row => columnas.map(col => {
      const valor = row[col.dataKey];
      if (col.format) {
        return col.format(valor);
      }
      return valor !== null && valor !== undefined ? String(valor) : '-';
    }));

    // Agregar fila de totales si existe
    if (totales) {
      const totalesRow = columnas.map(col => {
        if (totales[col.dataKey] !== undefined) {
          return col.format ? col.format(totales[col.dataKey]) : String(totales[col.dataKey]);
        }
        return col.dataKey === columnas[0].dataKey ? 'TOTAL' : '';
      });
      bodyData.push(totalesRow);
    }
    
    // Generar tabla usando autoTable
    autoTable(doc, {
      startY: 35,
      head: [columnas.map(col => col.header)],
      body: bodyData,
      theme: 'grid',
      headStyles: { 
        fillColor: [43, 87, 154],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10
      },
      styles: { 
        fontSize: 9,
        cellPadding: 2
      },
      columnStyles: columnas.reduce((acc, col, index) => {
        if (col.align) {
          acc[index] = { halign: col.align };
        }
        return acc;
      }, {}),
      // Estilo especial para fila de totales
      didParseCell: function(data) {
        if (totales && data.row.index === bodyData.length - 1 && data.section === 'body') {
          data.cell.styles.fillColor = [240, 240, 240];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });
    
    // Guardar
    doc.save(`${nombreArchivo}.pdf`);
    
    return true;
  } catch (error) {
    console.error('Error al exportar a PDF:', error);
    alert('Error al exportar a PDF: ' + error.message);
    return false;
  }
};

// Formatear moneda
export const formatearMoneda = (valor) => {
  return `Q${parseFloat(valor || 0).toFixed(2)}`;
};

// Formatear fecha
export const formatearFecha = (fecha) => {
  if (!fecha) return '-';
  try {
    return new Date(fecha).toLocaleDateString('es-GT');
  } catch (e) {
    return '-';
  }
};

// Formatear número
export const formatearNumero = (valor) => {
  return parseFloat(valor || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
