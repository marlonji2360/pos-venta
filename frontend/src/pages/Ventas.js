// src/pages/Ventas.js - Layout Vertical con Historial, Autorización e Impresión
import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { 
  Checkbox, FormControlLabel, Chip, Divider, Tabs, Tab,
  TablePagination, Collapse
} from '@mui/material';
import { 
  Percent as PercentIcon,
  History as HistoryIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  HourglassEmpty as HourglassEmptyIcon,
} from '@mui/icons-material';
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
  IconButton,
  Grid,
  Alert,
  Autocomplete,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  Delete as DeleteIcon,
  ShoppingCart as ShoppingCartIcon,
  Print as PrintIcon,
  Check as CheckIcon,
  Search as SearchIcon,
  Person as PersonIcon,
  Warning as WarningIcon,
  Visibility as VisibilityIcon,
  Refresh as RefreshIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';

// Estilos para impresión térmica
const printStyles = `
  @media print {
    body * {
      visibility: hidden;
    }
    #ticket-print, #ticket-print * {
      visibility: visible;
    }
    #ticket-print {
      position: absolute;
      left: 0;
      top: 0;
      width: 300px;
    }
    .no-print {
      display: none !important;
    }
    @page {
      size: 80mm auto;
      margin: 0;
    }
  }
`;

const Ventas = () => {
  const [productos, setProductos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [carrito, setCarrito] = useState([]);
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [cantidadTemporal, setCantidadTemporal] = useState(1);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [montoPagado, setMontoPagado] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [openConfirmar, setOpenConfirmar] = useState(false);
  const [ventaCompletada, setVentaCompletada] = useState(null);
  const [productosVendidos, setProductosVendidos] = useState([]);
  const [infoVenta, setInfoVenta] = useState(null);
  const [advertenciasStock, setAdvertenciasStock] = useState([]);
  const [openAdvertencias, setOpenAdvertencias] = useState(false);
  const [aplicarDescuentosVolumen, setAplicarDescuentosVolumen] = useState(true);
  const [descuentosCalculados, setDescuentosCalculados] = useState({});
  const [descuentoAdicional, setDescuentoAdicional] = useState(0);
  const [porcentajeDescuentoAdicional, setPorcentajeDescuentoAdicional] = useState(0);
  const [motivoDescuento, setMotivoDescuento] = useState('');
  const [openDialogDescuento, setOpenDialogDescuento] = useState(false);
  
  // Estados para autorización de descuentos
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [autorizacionPendiente, setAutorizacionPendiente] = useState(null);
  const [esperandoAutorizacion, setEsperandoAutorizacion] = useState(false);
  const [openDialogEsperando, setOpenDialogEsperando] = useState(false);
  
  // Estados para envíos a domicilio
  const [esEnvio, setEsEnvio] = useState(false);
  const [datosEnvio, setDatosEnvio] = useState({
    direccion_entrega: '',
    referencia_direccion: '',
    telefono_contacto: '',
    nombre_contacto: '',
    notas_cliente: '',
    costo_envio: 0,
    asignar_piloto_auto: true
  });
  const [openDialogEnvio, setOpenDialogEnvio] = useState(false);

  // Estados para historial de ventas
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [ventas, setVentas] = useState([]);
  const [loadingVentas, setLoadingVentas] = useState(false);
  const [tabHistorial, setTabHistorial] = useState(0);
  const [pageHistorial, setPageHistorial] = useState(0);
  const [rowsPerPageHistorial, setRowsPerPageHistorial] = useState(5);
  const [busquedaHistorial, setBusquedaHistorial] = useState('');

  // Estados para configuración e impresión
  const [configuracion, setConfiguracion] = useState(null);
  const ticketRef = useRef(null);

  useEffect(() => {
    cargarDatos();
    cargarUsuarioActual();
    cargarConfiguracion();
  }, []);

  // Pre-cargar datos del cliente en el formulario de envío
  useEffect(() => {
    if (esEnvio && clienteSeleccionado && openDialogEnvio) {
      setDatosEnvio(prev => ({
        ...prev,
        direccion_entrega: clienteSeleccionado.direccion || prev.direccion_entrega,
        telefono_contacto: clienteSeleccionado.telefono || prev.telefono_contacto,
        nombre_contacto: clienteSeleccionado.nombre || prev.nombre_contacto
      }));
    }
  }, [esEnvio, clienteSeleccionado, openDialogEnvio]);

  // Calcular descuentos cuando cambia el carrito o el checkbox
  useEffect(() => {
    if (carrito.length > 0 && aplicarDescuentosVolumen) {
      calcularDescuentosVolumen(carrito);
    } else if (!aplicarDescuentosVolumen) {
      setDescuentosCalculados({});
    }
  }, [carrito, aplicarDescuentosVolumen]);

  // Cargar historial cuando se muestra
  useEffect(() => {
    if (mostrarHistorial) {
      cargarHistorialVentas();
    }
  }, [mostrarHistorial]);

  // Polling para verificar autorización pendiente
  useEffect(() => {
    let interval;
    if (esperandoAutorizacion && autorizacionPendiente) {
      interval = setInterval(async () => {
        await verificarAutorizacion();
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [esperandoAutorizacion, autorizacionPendiente]);

  const cargarDatos = async () => {
    try {
      const [productosRes, clientesRes] = await Promise.all([
        api.get('/api/productos?activo=true'),
        api.get('/api/clientes'),
      ]);
      setProductos(productosRes.data.productos);
      setClientes(clientesRes.data.clientes || []);
    } catch (err) {
      setError('Error al cargar datos');
    }
  };

  const cargarUsuarioActual = async () => {
    try {
      const response = await api.get('/api/auth/me');
      setUsuarioActual(response.data.usuario);
    } catch (err) {
      console.error('Error al cargar usuario:', err);
    }
  };

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

  const cargarHistorialVentas = async () => {
    try {
      setLoadingVentas(true);
      const response = await api.get('/api/ventas');
      setVentas(response.data.ventas || []);
    } catch (err) {
      console.error('Error al cargar historial:', err);
    } finally {
      setLoadingVentas(false);
    }
  };

  // Función para calcular descuentos por volumen
  const calcularDescuentosVolumen = async (carritoActual) => {
    if (!aplicarDescuentosVolumen || carritoActual.length === 0) {
      setDescuentosCalculados({});
      return;
    }

    try {
      const productosParaCalcular = carritoActual.map(item => ({
        producto_id: item.producto_id,
        cantidad: item.cantidad
      }));

      const response = await api.post('/api/descuentos/calcular', {
        productos: productosParaCalcular
      });

      const descuentosMap = {};
      response.data.productos.forEach(item => {
        descuentosMap[item.producto_id] = {
          porcentaje: item.porcentaje_descuento,
          cantidad_minima: item.cantidad_minima
        };
      });

      setDescuentosCalculados(descuentosMap);
    } catch (error) {
      console.error('❌ Error al calcular descuentos:', error);
      setDescuentosCalculados({});
    }
  };

  const agregarAlCarrito = () => {
    if (!productoSeleccionado || cantidadTemporal <= 0) return;

    const productoEnCarrito = carrito.find(
      (item) => item.producto_id === productoSeleccionado.id
    );

    let nuevoCarrito;
    if (productoEnCarrito) {
      nuevoCarrito = carrito.map((item) =>
        item.producto_id === productoSeleccionado.id
          ? { ...item, cantidad: item.cantidad + cantidadTemporal }
          : item
      );
    } else {
      nuevoCarrito = [
        ...carrito,
        {
          producto_id: productoSeleccionado.id,
          nombre: productoSeleccionado.nombre,
          precio_unitario: parseFloat(productoSeleccionado.precio_venta),
          cantidad: cantidadTemporal,
        },
      ];
    }

    setCarrito(nuevoCarrito);
    setProductoSeleccionado(null);
    setCantidadTemporal(1);
  };

  const modificarCantidad = (productoId, cantidad) => {
    const cantidadNumerica = parseInt(cantidad) || 0;
    
    if (cantidadNumerica <= 0) {
      eliminarDelCarrito(productoId);
      return;
    }

    const nuevoCarrito = carrito.map((item) =>
      item.producto_id === productoId ? { ...item, cantidad: cantidadNumerica } : item
    );
    
    setCarrito(nuevoCarrito);
  };

  const eliminarDelCarrito = (productoId) => {
    const nuevoCarrito = carrito.filter((item) => item.producto_id !== productoId);
    setCarrito(nuevoCarrito);
  };

  const limpiarCarrito = () => {
    setCarrito([]);
    setDescuentosCalculados({});
    setDescuentoAdicional(0);
    setPorcentajeDescuentoAdicional(0);
    setMotivoDescuento('');
    setMontoPagado('');
    setAutorizacionPendiente(null);
    setEsperandoAutorizacion(false);
  };

  const calcularSubtotal = () => {
    return carrito.reduce((total, item) => {
      const precioBase = item.precio_unitario * item.cantidad;
      const descuento = descuentosCalculados[item.producto_id];
      
      if (descuento && aplicarDescuentosVolumen) {
        const precioConDescuento = precioBase * (1 - descuento.porcentaje / 100);
        return total + precioConDescuento;
      }
      
      return total + precioBase;
    }, 0);
  };

  const calcularTotalDescuentosVolumen = () => {
    if (!aplicarDescuentosVolumen) return 0;
    
    return carrito.reduce((total, item) => {
      const precioBase = item.precio_unitario * item.cantidad;
      const descuento = descuentosCalculados[item.producto_id];
      
      if (descuento) {
        const montoDescuento = precioBase * (descuento.porcentaje / 100);
        return total + montoDescuento;
      }
      
      return total;
    }, 0);
  };

  const calcularTotal = () => {
    const subtotal = calcularSubtotal();
    const totalConDescuentoAdicional = subtotal - descuentoAdicional;
    return totalConDescuentoAdicional + (esEnvio ? parseFloat(datosEnvio.costo_envio || 0) : 0);
  };

  const calcularCambio = () => {
    const total = calcularTotal();
    const pagado = parseFloat(montoPagado) || 0;
    return pagado - total;
  };

  const handleMontoDescuentoAdicionalChange = (valor) => {
    const monto = parseFloat(valor) || 0;
    const subtotal = calcularSubtotal();
    
    if (monto > subtotal) {
      setDescuentoAdicional(subtotal);
      setPorcentajeDescuentoAdicional(100);
    } else {
      setDescuentoAdicional(monto);
      setPorcentajeDescuentoAdicional(subtotal > 0 ? (monto / subtotal) * 100 : 0);
    }
  };

  const handlePorcentajeDescuentoAdicionalChange = (valor) => {
    const porcentaje = parseFloat(valor) || 0;
    const subtotal = calcularSubtotal();
    
    if (porcentaje > 100) {
      setPorcentajeDescuentoAdicional(100);
      setDescuentoAdicional(subtotal);
    } else {
      setPorcentajeDescuentoAdicional(porcentaje);
      setDescuentoAdicional((subtotal * porcentaje) / 100);
    }
  };

  const handleSolicitarDescuento = async () => {
    if (!motivoDescuento || descuentoAdicional <= 0) {
      setError('Ingresa el motivo y el monto del descuento');
      return;
    }

    if (usuarioActual?.rol === 'Vendedor') {
      try {
        const response = await api.post('/api/descuentos/solicitar-autorizacion', {
          monto_descuento: descuentoAdicional,
          porcentaje_descuento: porcentajeDescuentoAdicional,
          motivo: motivoDescuento
        });

        setAutorizacionPendiente(response.data.autorizacion);
        setEsperandoAutorizacion(true);
        setOpenDialogDescuento(false);
        setOpenDialogEsperando(true);
        setSuccess('Solicitud de descuento enviada. Esperando autorización...');
      } catch (err) {
        setError('Error al solicitar autorización de descuento');
        console.error(err);
      }
    } else {
      setOpenDialogDescuento(false);
      setSuccess(`Descuento adicional de Q${descuentoAdicional.toFixed(2)} aplicado`);
    }
  };

  const verificarAutorizacion = async () => {
    if (!autorizacionPendiente) return;

    try {
      const response = await api.get('/api/descuentos/autorizaciones', {
        params: { estado: 'pendiente' }
      });

      const autorizacion = response.data.autorizaciones.find(
        a => a.id === autorizacionPendiente.id
      );

      if (autorizacion) {
        if (autorizacion.estado === 'aprobado') {
          setEsperandoAutorizacion(false);
          setOpenDialogEsperando(false);
          setSuccess('¡Descuento autorizado! Ahora puedes procesar la venta.');
        } else if (autorizacion.estado === 'rechazado') {
          setEsperandoAutorizacion(false);
          setOpenDialogEsperando(false);
          setDescuentoAdicional(0);
          setPorcentajeDescuentoAdicional(0);
          setMotivoDescuento('');
          setAutorizacionPendiente(null);
          setError('Descuento rechazado por el supervisor. ' + (autorizacion.notas_autorizacion || ''));
        }
      } else {
        const responseHistorial = await api.get('/api/descuentos/autorizaciones');
        const autorizacionCompleta = responseHistorial.data.autorizaciones.find(
          a => a.id === autorizacionPendiente.id
        );

        if (autorizacionCompleta) {
          if (autorizacionCompleta.estado === 'aprobado') {
            setEsperandoAutorizacion(false);
            setOpenDialogEsperando(false);
            setSuccess('¡Descuento autorizado! Ahora puedes procesar la venta.');
          } else if (autorizacionCompleta.estado === 'rechazado') {
            setEsperandoAutorizacion(false);
            setOpenDialogEsperando(false);
            setDescuentoAdicional(0);
            setPorcentajeDescuentoAdicional(0);
            setMotivoDescuento('');
            setAutorizacionPendiente(null);
            setError('Descuento rechazado por el supervisor. ' + (autorizacionCompleta.notas_autorizacion || ''));
          }
        }
      }
    } catch (err) {
      console.error('Error al verificar autorización:', err);
    }
  };

  const handleCancelarAutorizacion = () => {
    setEsperandoAutorizacion(false);
    setOpenDialogEsperando(false);
    setDescuentoAdicional(0);
    setPorcentajeDescuentoAdicional(0);
    setMotivoDescuento('');
    setAutorizacionPendiente(null);
  };

  const imprimirTicket = () => {
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const procesarVenta = async () => {
    try {
      if (carrito.length === 0) {
        setError('El carrito está vacío');
        return;
      }

      if (descuentoAdicional > 0 && usuarioActual?.rol === 'Vendedor' && esperandoAutorizacion) {
        setError('Debes esperar la autorización del descuento antes de procesar la venta');
        return;
      }

      if (metodoPago === 'efectivo') {
        const pagado = parseFloat(montoPagado) || 0;
        const total = calcularTotal();
        
        if (pagado < total) {
          setError(`Monto insuficiente. Falta: Q${(total - pagado).toFixed(2)}`);
          return;
        }
      }

      const subtotal = calcularSubtotal();
      const total = calcularTotal();

      const ventaData = {
        cliente_id: clienteSeleccionado?.id || null,
        metodo_pago: metodoPago,
        subtotal: subtotal.toFixed(2),
        iva: 0,
        total: total.toFixed(2),
        productos: carrito,
        es_envio: esEnvio
      };

      if (esEnvio) {
        ventaData.envio = {
          ...datosEnvio,
          costo_envio: parseFloat(datosEnvio.costo_envio || 0)
        };
      }

      const response = await api.post('/api/ventas', ventaData);

      setVentaCompletada(response.data.venta);
      setProductosVendidos([...carrito]);
      setInfoVenta({
        subtotal,
        total,
        cliente: clienteSeleccionado,
        metodoPago,
        montoPagado: parseFloat(montoPagado) || total,
        cambio: metodoPago === 'efectivo' ? calcularCambio() : 0,
        descuentoVolumen: calcularTotalDescuentosVolumen(),
        descuentoAdicional,
        motivoDescuento
      });

      // Imprimir ticket automáticamente
      setTimeout(() => {
        imprimirTicket();
      }, 500);

      if (response.data.advertencias && response.data.advertencias.length > 0) {
        setAdvertenciasStock(response.data.advertencias);
        setOpenAdvertencias(true);
      } else {
        setSuccess('Venta registrada exitosamente');
      }

      limpiarCarrito();
      setClienteSeleccionado(null);
      setOpenConfirmar(false);
      setEsEnvio(false);
      
      if (mostrarHistorial) {
        cargarHistorialVentas();
      }

    } catch (err) {
      setError(err.response?.data?.error || 'Error al procesar venta');
      setOpenConfirmar(false);
    }
  };

  // Funciones para historial
  const ventasFiltradasHistorial = ventas.filter((venta) => {
    let pasaFiltroTab = true;
    if (tabHistorial === 1) pasaFiltroTab = venta.metodo_pago === 'efectivo';
    if (tabHistorial === 2) pasaFiltroTab = venta.metodo_pago === 'tarjeta';
    if (tabHistorial === 3) pasaFiltroTab = venta.metodo_pago === 'transferencia';

    let pasaFiltroBusqueda = true;
    if (busquedaHistorial.trim()) {
      const termino = busquedaHistorial.toLowerCase();
      pasaFiltroBusqueda = 
        venta.folio?.toLowerCase().includes(termino) ||
        venta.cliente_nombre?.toLowerCase().includes(termino);
    }

    return pasaFiltroTab && pasaFiltroBusqueda && venta.estado === 'completada';
  });

  const ventasPaginadasHistorial = ventasFiltradasHistorial.slice(
    pageHistorial * rowsPerPageHistorial,
    pageHistorial * rowsPerPageHistorial + rowsPerPageHistorial
  );

  const handleChangePageHistorial = (event, newPage) => {
    setPageHistorial(newPage);
  };

  const handleChangeRowsPerPageHistorial = (event) => {
    setRowsPerPageHistorial(parseInt(event.target.value, 10));
    setPageHistorial(0);
  };

  const handleChangeTabHistorial = (event, newValue) => {
    setTabHistorial(newValue);
    setPageHistorial(0);
  };

  const contarVentasHistorial = (metodo) => {
    const completadas = ventas.filter(v => v.estado === 'completada');
    if (!metodo) return completadas.length;
    return completadas.filter(v => v.metodo_pago === metodo).length;
  };

  return (
    <Box sx={{ p: 3 }}>
      <style>{printStyles}</style>

      {/* Ticket oculto para impresión */}
      {ventaCompletada && infoVenta && configuracion && (
        <>
          {/* TICKET DE VENTA */}
          <Box
            ref={ticketRef}
            id="ticket-print"
            sx={{
              display: 'none',
              '@media print': {
                display: 'block',
                width: '300px',
                fontFamily: 'Courier New, monospace',
                fontSize: '12px',
                padding: '10px',
              }
            }}
          >
          <Box sx={{ textAlign: 'center', marginBottom: '10px' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', fontSize: '14px' }}>
              {configuracion.nombre_negocio}
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '11px' }}>
              {configuracion.direccion}
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '11px' }}>
              Tel: {configuracion.telefono}
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '11px' }}>
              NIT: {configuracion.nit}
            </Typography>
          </Box>

          <Divider sx={{ borderStyle: 'dashed', my: 1 }} />

          <Box sx={{ fontSize: '11px', marginBottom: '5px' }}>
            <Typography variant="body2">Folio: {ventaCompletada.folio}</Typography>
            <Typography variant="body2">
              Fecha: {ventaCompletada.fecha_venta ? format(new Date(ventaCompletada.fecha_venta), 'dd/MM/yyyy HH:mm') : format(new Date(), 'dd/MM/yyyy HH:mm')}
            </Typography>
            <Typography variant="body2">
              Vendedor: {usuarioActual?.nombre || 'N/A'}
            </Typography>
            {infoVenta.cliente && (
              <Typography variant="body2">Cliente: {infoVenta.cliente.nombre}</Typography>
            )}
            <Typography variant="body2">
              Método: {infoVenta.metodoPago.charAt(0).toUpperCase() + infoVenta.metodoPago.slice(1)}
            </Typography>
          </Box>

          <Divider sx={{ borderStyle: 'dashed', my: 1 }} />

          <Box sx={{ fontSize: '11px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '2px' }}>Producto</th>
                  <th style={{ textAlign: 'center', padding: '2px' }}>Cant</th>
                  <th style={{ textAlign: 'right', padding: '2px' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {productosVendidos.map((item, index) => {
                  const descuento = descuentosCalculados[item.producto_id];
                  const precioBase = item.precio_unitario * item.cantidad;
                  const tieneDescuento = descuento && aplicarDescuentosVolumen;
                  const montoDescuento = tieneDescuento ? precioBase * (descuento.porcentaje / 100) : 0;
                  const precioFinal = precioBase - montoDescuento;

                  return (
                    <tr key={index}>
                      <td style={{ padding: '2px', fontSize: '10px' }}>
                        {item.nombre}
                        {tieneDescuento && (
                          <div style={{ fontSize: '9px', color: '#666' }}>
                            (-{descuento.porcentaje}% desc)
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', padding: '2px' }}>{item.cantidad}</td>
                      <td style={{ textAlign: 'right', padding: '2px' }}>
                        {configuracion.moneda}{precioFinal.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Box>

          <Divider sx={{ borderStyle: 'dashed', my: 1 }} />

          <Box sx={{ fontSize: '11px' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
              <span>Subtotal:</span>
              <span>{configuracion.moneda}{infoVenta.subtotal.toFixed(2)}</span>
            </Box>

            {infoVenta.descuentoVolumen > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: '#666' }}>
                <span>Descuento por volumen:</span>
                <span>-{configuracion.moneda}{infoVenta.descuentoVolumen.toFixed(2)}</span>
              </Box>
            )}

            {infoVenta.descuentoAdicional > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: '#666' }}>
                <span>Descuento adicional:</span>
                <span>-{configuracion.moneda}{infoVenta.descuentoAdicional.toFixed(2)}</span>
              </Box>
            )}

            {esEnvio && datosEnvio.costo_envio > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                <span>Costo de envío:</span>
                <span>{configuracion.moneda}{parseFloat(datosEnvio.costo_envio).toFixed(2)}</span>
              </Box>
            )}

            <Divider sx={{ borderStyle: 'solid', my: 1 }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontWeight: 'bold', fontSize: '13px' }}>
              <span>TOTAL:</span>
              <span>{configuracion.moneda}{infoVenta.total.toFixed(2)}</span>
            </Box>

            {infoVenta.metodoPago === 'efectivo' && (
              <>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                  <span>Efectivo:</span>
                  <span>{configuracion.moneda}{infoVenta.montoPagado.toFixed(2)}</span>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontWeight: 'bold' }}>
                  <span>Cambio:</span>
                  <span>{configuracion.moneda}{infoVenta.cambio.toFixed(2)}</span>
                </Box>
              </>
            )}
          </Box>

          <Divider sx={{ borderStyle: 'dashed', my: 1 }} />

          <Box sx={{ textAlign: 'center', fontSize: '11px', marginTop: '10px' }}>
            <Typography variant="body2" sx={{ fontSize: '11px', marginBottom: '5px' }}>
              {configuracion.ticket_mensaje || '¡Gracias por su compra!'}
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '10px' }}>
              {configuracion.ticket_pie || 'Vuelva pronto'}
            </Typography>
          </Box>
        </Box>
        </>
      )}

      {/* Mensajes */}
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

      {/* Alerta de autorización pendiente */}
      {esperandoAutorizacion && autorizacionPendiente && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <HourglassEmptyIcon />
            <Typography variant="body2">
              <strong>Esperando autorización de descuento</strong> - 
              Monto: Q{descuentoAdicional.toFixed(2)} ({porcentajeDescuentoAdicional.toFixed(1)}%)
            </Typography>
          </Box>
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* COLUMNA IZQUIERDA: Productos y Carrito */}
        <Grid item xs={12} md={8}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h5" gutterBottom>
                <ShoppingCartIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Punto de Venta
              </Typography>

              {/* Selector de Producto con Cantidad y Botón */}
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} md={7}>
                  <Autocomplete
                    value={productoSeleccionado}
                    onChange={(e, newValue) => setProductoSeleccionado(newValue)}
                    options={productos}
                    getOptionLabel={(option) => `${option.nombre} - Q${option.precio_venta}`}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Buscar producto"
                        placeholder="Escanea o busca un producto..."
                        InputProps={{
                          ...params.InputProps,
                          startAdornment: (
                            <InputAdornment position="start">
                              <SearchIcon />
                            </InputAdornment>
                          ),
                        }}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Cantidad"
                    value={cantidadTemporal}
                    onChange={(e) => setCantidadTemporal(parseInt(e.target.value) || 1)}
                    inputProps={{ min: 1, step: 1 }}
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <Button
                    fullWidth
                    variant="contained"
                    color="primary"
                    onClick={agregarAlCarrito}
                    disabled={!productoSeleccionado}
                    sx={{ height: '56px' }}
                  >
                    <AddIcon />
                  </Button>
                </Grid>
              </Grid>

              {/* Checkbox Aplicar Descuentos por Volumen */}
              <FormControlLabel
                control={
                  <Checkbox
                    checked={aplicarDescuentosVolumen}
                    onChange={(e) => setAplicarDescuentosVolumen(e.target.checked)}
                  />
                }
                label="Aplicar descuentos por volumen automáticamente"
                sx={{ mb: 2 }}
              />

              {/* Carrito */}
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Producto</TableCell>
                      <TableCell align="center">Cantidad</TableCell>
                      <TableCell align="right">Precio Unit.</TableCell>
                      <TableCell align="right">Descuento</TableCell>
                      <TableCell align="right">Subtotal</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {carrito.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          <Typography color="text.secondary">
                            El carrito está vacío
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      carrito.map((item) => {
                        const descuento = descuentosCalculados[item.producto_id];
                        const precioBase = item.precio_unitario * item.cantidad;
                        const tieneDescuento = descuento && aplicarDescuentosVolumen;
                        const montoDescuento = tieneDescuento ? precioBase * (descuento.porcentaje / 100) : 0;
                        const precioConDescuento = precioBase - montoDescuento;

                        return (
                          <TableRow key={item.producto_id}>
                            <TableCell>
                              <Box>
                                <Typography variant="body2" fontWeight="medium">
                                  {item.nombre}
                                </Typography>
                                {tieneDescuento && (
                                  <Chip
                                    label={`${descuento.cantidad_minima}+ und = -${descuento.porcentaje}%`}
                                    size="small"
                                    color="success"
                                    sx={{ mt: 0.5 }}
                                  />
                                )}
                              </Box>
                            </TableCell>
                            <TableCell align="center">
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                                <IconButton
                                  size="small"
                                  onClick={() => modificarCantidad(item.producto_id, item.cantidad - 1)}
                                >
                                  <RemoveIcon fontSize="small" />
                                </IconButton>
                                <TextField
                                  type="number"
                                  value={item.cantidad}
                                  onChange={(e) => modificarCantidad(item.producto_id, e.target.value)}
                                  inputProps={{ min: 1, style: { textAlign: 'center' } }}
                                  sx={{ width: 60 }}
                                  size="small"
                                />
                                <IconButton
                                  size="small"
                                  onClick={() => modificarCantidad(item.producto_id, item.cantidad + 1)}
                                >
                                  <AddIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2">
                                Q{item.precio_unitario.toFixed(2)}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              {tieneDescuento ? (
                                <Box>
                                  <Typography variant="caption" color="success.main" fontWeight="bold">
                                    -{descuento.porcentaje}%
                                  </Typography>
                                  <Typography variant="caption" display="block" color="success.main">
                                    -Q{montoDescuento.toFixed(2)}
                                  </Typography>
                                </Box>
                              ) : (
                                <Typography variant="caption" color="text.secondary">
                                  -
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell align="right">
                              {tieneDescuento && (
                                <Typography
                                  variant="caption"
                                  sx={{ textDecoration: 'line-through', display: 'block' }}
                                  color="text.secondary"
                                >
                                  Q{precioBase.toFixed(2)}
                                </Typography>
                              )}
                              <Typography variant="body2" fontWeight="bold" color={tieneDescuento ? 'success.main' : 'inherit'}>
                                Q{precioConDescuento.toFixed(2)}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => eliminarDelCarrito(item.producto_id)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {carrito.length > 0 && (
                <Button
                  variant="outlined"
                  color="error"
                  onClick={limpiarCarrito}
                  sx={{ mt: 2 }}
                  startIcon={<DeleteIcon />}
                >
                  Limpiar Carrito
                </Button>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* COLUMNA DERECHA: Resumen y Pago */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Resumen de Venta</Typography>

              {/* Cliente */}
              <Autocomplete
                value={clienteSeleccionado}
                onChange={(e, newValue) => setClienteSeleccionado(newValue)}
                options={clientes}
                getOptionLabel={(option) => option.nombre}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Cliente (Opcional)"
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <InputAdornment position="start">
                          <PersonIcon />
                        </InputAdornment>
                      ),
                    }}
                  />
                )}
                sx={{ mb: 2 }}
              />

              {/* Método de Pago */}
              <TextField
                select
                fullWidth
                label="Método de Pago"
                value={metodoPago}
                onChange={(e) => setMetodoPago(e.target.value)}
                sx={{ mb: 2 }}
                SelectProps={{ native: true }}
              >
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="transferencia">Transferencia</option>
              </TextField>

              {/* Monto Pagado (solo si es efectivo) */}
              {metodoPago === 'efectivo' && (
                <TextField
                  fullWidth
                  type="number"
                  label="Monto Recibido (Q)"
                  value={montoPagado}
                  onChange={(e) => setMontoPagado(e.target.value)}
                  inputProps={{ min: 0, step: 0.01 }}
                  sx={{ mb: 2 }}
                  helperText={montoPagado && calcularCambio() >= 0 
                    ? `Cambio: Q${calcularCambio().toFixed(2)}`
                    : montoPagado ? `Falta: Q${Math.abs(calcularCambio()).toFixed(2)}` : ''
                  }
                  error={montoPagado && calcularCambio() < 0}
                />
              )}

              {/* Checkbox Envío */}
              <FormControlLabel
                control={
                  <Checkbox
                    checked={esEnvio}
                    onChange={(e) => {
                      setEsEnvio(e.target.checked);
                      if (e.target.checked) {
                        setOpenDialogEnvio(true);
                      }
                    }}
                  />
                }
                label="Es envío a domicilio"
                sx={{ mb: 2 }}
              />

              <Divider sx={{ my: 2 }} />

              {/* Totales */}
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography>Subtotal:</Typography>
                  <Typography>Q{calcularSubtotal().toFixed(2)}</Typography>
                </Box>

                {calcularTotalDescuentosVolumen() > 0 && aplicarDescuentosVolumen && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography color="success.main" variant="body2">
                      💰 Descuento por volumen:
                    </Typography>
                    <Typography color="success.main" fontWeight="bold" variant="body2">
                      -Q{calcularTotalDescuentosVolumen().toFixed(2)}
                    </Typography>
                  </Box>
                )}

                {descuentoAdicional > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography color="warning.main" variant="body2">
                      🎁 Descuento adicional ({porcentajeDescuentoAdicional.toFixed(1)}%):
                      {esperandoAutorizacion && ' ⏳'}
                    </Typography>
                    <Typography color="warning.main" fontWeight="bold" variant="body2">
                      -Q{descuentoAdicional.toFixed(2)}
                    </Typography>
                  </Box>
                )}

                {esEnvio && datosEnvio.costo_envio > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Costo de envío:</Typography>
                    <Typography variant="body2">Q{parseFloat(datosEnvio.costo_envio).toFixed(2)}</Typography>
                  </Box>
                )}

                <Divider sx={{ my: 1 }} />

                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="h6">TOTAL:</Typography>
                  <Typography variant="h6" color="primary">
                    Q{calcularTotal().toFixed(2)}
                  </Typography>
                </Box>

                {metodoPago === 'efectivo' && montoPagado && calcularCambio() >= 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
                    <Typography variant="h6" color="success.main">CAMBIO:</Typography>
                    <Typography variant="h6" color="success.main">
                      Q{calcularCambio().toFixed(2)}
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* Botones */}
              <Button
                fullWidth
                variant="outlined"
                color="warning"
                startIcon={<PercentIcon />}
                onClick={() => setOpenDialogDescuento(true)}
                sx={{ mb: 1 }}
                disabled={carrito.length === 0 || esperandoAutorizacion}
              >
                Aplicar Descuento Adicional
              </Button>

              <Button
                fullWidth
                variant="contained"
                color="primary"
                startIcon={esperandoAutorizacion ? <HourglassEmptyIcon /> : <CheckIcon />}
                onClick={() => setOpenConfirmar(true)}
                disabled={carrito.length === 0 || (esperandoAutorizacion && usuarioActual?.rol === 'Vendedor')}
                size="large"
              >
                {esperandoAutorizacion && usuarioActual?.rol === 'Vendedor' 
                  ? 'Esperando Autorización...'
                  : 'Procesar Venta'
                }
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Sección de Historial de Ventas */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
            }}
            onClick={() => setMostrarHistorial(!mostrarHistorial)}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <HistoryIcon />
              <Typography variant="h6">Historial de Ventas de Hoy</Typography>
              <Chip label={contarVentasHistorial(null)} size="small" color="primary" />
            </Box>
            <IconButton>
              {mostrarHistorial ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>

          <Collapse in={mostrarHistorial}>
            <Box sx={{ mt: 2 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Buscar por folio o cliente..."
                value={busquedaHistorial}
                onChange={(e) => {
                  setBusquedaHistorial(e.target.value);
                  setPageHistorial(0);
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

              <Tabs value={tabHistorial} onChange={handleChangeTabHistorial} sx={{ mb: 2 }}>
                <Tab label={`Todas (${contarVentasHistorial(null)})`} />
                <Tab label={`Efectivo (${contarVentasHistorial('efectivo')})`} />
                <Tab label={`Tarjeta (${contarVentasHistorial('tarjeta')})`} />
                <Tab label={`Transferencia (${contarVentasHistorial('transferencia')})`} />
              </Tabs>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Folio</TableCell>
                      <TableCell>Hora</TableCell>
                      <TableCell>Cliente</TableCell>
                      <TableCell>Método</TableCell>
                      <TableCell align="right">Total</TableCell>
                      <TableCell align="center">
                        <IconButton size="small" onClick={cargarHistorialVentas}>
                          <RefreshIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loadingVentas ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center">Cargando...</TableCell>
                      </TableRow>
                    ) : ventasPaginadasHistorial.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          <Typography color="text.secondary">No hay ventas</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      ventasPaginadasHistorial.map((venta) => (
                        <TableRow key={venta.id} hover>
                          <TableCell>
                            <Chip label={venta.folio} size="small" color="primary" />
                          </TableCell>
                          <TableCell>
                            {format(new Date(venta.fecha_venta), 'HH:mm')}
                          </TableCell>
                          <TableCell>{venta.cliente_nombre || 'Público'}</TableCell>
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
                          <TableCell align="right">
                            <Typography fontWeight="bold">
                              Q{parseFloat(venta.total).toFixed(2)}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => window.open(`/reimpresion-comprobantes`, '_blank')}
                            >
                              <VisibilityIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <TablePagination
                component="div"
                count={ventasFiltradasHistorial.length}
                page={pageHistorial}
                onPageChange={handleChangePageHistorial}
                rowsPerPage={rowsPerPageHistorial}
                onRowsPerPageChange={handleChangeRowsPerPageHistorial}
                labelRowsPerPage="Filas:"
                labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
                rowsPerPageOptions={[5, 10, 25]}
              />
            </Box>
          </Collapse>
        </CardContent>
      </Card>

      {/* Diálogo: Esperando Autorización */}
      <Dialog open={openDialogEsperando} onClose={() => {}} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: 'warning.main', color: 'white' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <HourglassEmptyIcon />
            <Typography variant="h6">⏳ Esperando Autorización de Descuento</Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <CircularProgress size={60} sx={{ mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Solicitud enviada al supervisor
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              El descuento de <strong>Q{descuentoAdicional.toFixed(2)}</strong> está pendiente de autorización
            </Typography>
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                Un Administrador o Gerente debe aprobar este descuento antes de que puedas procesar la venta.
                La ventana se actualizará automáticamente cuando sea aprobado o rechazado.
              </Typography>
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelarAutorizacion} color="error" startIcon={<CancelIcon />}>
            Cancelar Solicitud
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo: Confirmar Venta */}
      <Dialog open={openConfirmar} onClose={() => setOpenConfirmar(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Confirmar Venta</DialogTitle>
        <DialogContent>
          <Box sx={{ my: 2 }}>
            <Typography variant="h6" gutterBottom>
              Total a cobrar: <strong>Q{calcularTotal().toFixed(2)}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Método de pago: <strong>{metodoPago}</strong>
            </Typography>
            {clienteSeleccionado && (
              <Typography variant="body2" color="text.secondary">
                Cliente: <strong>{clienteSeleccionado.nombre}</strong>
              </Typography>
            )}
            {metodoPago === 'efectivo' && montoPagado && (
              <>
                <Typography variant="body2" color="text.secondary">
                  Monto recibido: <strong>Q{parseFloat(montoPagado).toFixed(2)}</strong>
                </Typography>
                {calcularCambio() >= 0 && (
                  <Typography variant="body1" color="success.main" sx={{ mt: 1 }}>
                    Cambio: <strong>Q{calcularCambio().toFixed(2)}</strong>
                  </Typography>
                )}
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenConfirmar(false)}>Cancelar</Button>
          <Button onClick={procesarVenta} variant="contained" color="primary" startIcon={<PrintIcon />}>
            Confirmar y Imprimir
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo: Datos de Envío */}
      <Dialog open={openDialogEnvio} onClose={() => setOpenDialogEnvio(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Datos de Envío a Domicilio</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Dirección de Entrega *"
                value={datosEnvio.direccion_entrega}
                onChange={(e) => setDatosEnvio({ ...datosEnvio, direccion_entrega: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Referencia (opcional)"
                value={datosEnvio.referencia_direccion}
                onChange={(e) => setDatosEnvio({ ...datosEnvio, referencia_direccion: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Nombre de Contacto"
                value={datosEnvio.nombre_contacto}
                onChange={(e) => setDatosEnvio({ ...datosEnvio, nombre_contacto: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Teléfono de Contacto"
                value={datosEnvio.telefono_contacto}
                onChange={(e) => setDatosEnvio({ ...datosEnvio, telefono_contacto: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Costo de Envío (Q)"
                type="number"
                value={datosEnvio.costo_envio}
                onChange={(e) => setDatosEnvio({ ...datosEnvio, costo_envio: parseFloat(e.target.value) || 0 })}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notas Adicionales"
                multiline
                rows={2}
                value={datosEnvio.notas_cliente}
                onChange={(e) => setDatosEnvio({ ...datosEnvio, notas_cliente: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={datosEnvio.asignar_piloto_auto}
                    onChange={(e) => setDatosEnvio({ ...datosEnvio, asignar_piloto_auto: e.target.checked })}
                  />
                }
                label="Asignar piloto automáticamente"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setEsEnvio(false); setOpenDialogEnvio(false); }}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (!datosEnvio.direccion_entrega) {
                setError('Ingresa la dirección de entrega');
                return;
              }
              setOpenDialogEnvio(false);
            }}
            variant="contained"
          >
            Guardar Datos
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo: Descuento Adicional */}
      <Dialog open={openDialogDescuento} onClose={() => setOpenDialogDescuento(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: 'warning.main', color: 'white' }}>
          🎁 Aplicar Descuento Adicional
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {usuarioActual?.rol === 'Vendedor' && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>⚠️ Requiere Autorización</strong>
              </Typography>
              <Typography variant="caption">
                Este descuento debe ser aprobado por un Administrador o Gerente antes de completar la venta.
              </Typography>
            </Alert>
          )}

          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="caption">
              Subtotal actual: <strong>Q{calcularSubtotal().toFixed(2)}</strong>
            </Typography>
          </Alert>

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Monto (Q)"
                type="number"
                value={descuentoAdicional}
                onChange={(e) => handleMontoDescuentoAdicionalChange(e.target.value)}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Porcentaje (%)"
                type="number"
                value={porcentajeDescuentoAdicional}
                onChange={(e) => handlePorcentajeDescuentoAdicionalChange(e.target.value)}
                inputProps={{ min: 0, max: 100, step: 0.01 }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Motivo del Descuento"
                multiline
                rows={2}
                value={motivoDescuento}
                onChange={(e) => setMotivoDescuento(e.target.value)}
                placeholder="Ej: Cliente frecuente, promoción..."
                required
              />
            </Grid>
            {descuentoAdicional > 0 && (
              <Grid item xs={12}>
                <Alert severity="success">
                  <Typography variant="body2">
                    Total con descuento: <strong>Q{(calcularSubtotal() - descuentoAdicional).toFixed(2)}</strong>
                  </Typography>
                </Alert>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { 
            setOpenDialogDescuento(false); 
            setDescuentoAdicional(0); 
            setPorcentajeDescuentoAdicional(0); 
            setMotivoDescuento(''); 
          }}>
            Cancelar
          </Button>
          <Button onClick={handleSolicitarDescuento} variant="contained" disabled={!motivoDescuento || descuentoAdicional <= 0}>
            {usuarioActual?.rol === 'Vendedor' ? 'Solicitar Autorización' : 'Aplicar Descuento'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo de Advertencias de Stock */}
      <DialogAdvertenciasStock
        open={openAdvertencias}
        onClose={() => setOpenAdvertencias(false)}
        advertencias={advertenciasStock}
        onConfirm={() => {
          setOpenAdvertencias(false);
          setSuccess('Venta registrada. Revisar notificaciones para productos con stock negativo.');
        }}
      />
    </Box>
  );
};

// Diálogo de Advertencias de Stock
const DialogAdvertenciasStock = ({ open, onClose, advertencias, onConfirm }) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ bgcolor: 'warning.main', color: 'white' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon />
          <Typography variant="h6">⚠️ Advertencia: Stock Insuficiente</Typography>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ mt: 2 }}>
        <Alert severity="warning" sx={{ mb: 2 }}>
          Los siguientes productos se vendieron sin stock suficiente. El stock quedará en negativo.
        </Alert>
        
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Producto</TableCell>
                <TableCell align="center">Stock Antes</TableCell>
                <TableCell align="center">Vendido</TableCell>
                <TableCell align="center">Faltante</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {advertencias.map((adv, index) => (
                <TableRow key={index}>
                  <TableCell>{adv.producto_nombre}</TableCell>
                  <TableCell align="center">
                    <Chip label={adv.stock_actual} size="small" color="error" />
                  </TableCell>
                  <TableCell align="center">{adv.cantidad_solicitada}</TableCell>
                  <TableCell align="center">
                    <Chip label={`-${adv.faltante}`} size="small" color="warning" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            ✅ Se ha creado una notificación automática para reabastecer estos productos.
          </Typography>
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={onConfirm} variant="contained" color="warning" fullWidth>
          Entendido
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default Ventas;