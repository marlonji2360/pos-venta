// src/components/BusquedaGlobal.js
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  Box,
  TextField,
  InputAdornment,
  IconButton,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  CircularProgress,
  Dialog,
  DialogContent,
} from '@mui/material';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  Inventory as InventoryIcon,
  Person as PersonIcon,
  Receipt as ReceiptIcon,
  Business as BusinessIcon,
} from '@mui/icons-material';

const BusquedaGlobal = ({ open, onClose }) => {
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef(null);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    const delaySearch = setTimeout(() => {
      if (query.trim().length >= 2) {
        buscar();
      } else {
        setResultados([]);
      }
    }, 300); // Debounce de 300ms

    return () => clearTimeout(delaySearch);
  }, [query]);

  const buscar = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/busqueda', {
        params: { q: query }
      });
      setResultados(response.data.resultados);
    } catch (error) {
      console.error('Error en búsqueda:', error);
      setResultados([]);
    } finally {
      setLoading(false);
    }
  };

  const handleResultClick = (resultado) => {
    navigate(resultado.ruta);
    handleClose();
  };

  const handleClose = () => {
    setQuery('');
    setResultados([]);
    onClose();
  };

  const getIcono = (tipo) => {
    switch (tipo) {
      case 'producto':
        return <InventoryIcon color="primary" />;
      case 'cliente':
        return <PersonIcon color="success" />;
      case 'venta':
        return <ReceiptIcon color="warning" />;
      case 'proveedor':
        return <BusinessIcon color="info" />;
      default:
        return <SearchIcon />;
    }
  };

  const getTipoLabel = (tipo) => {
    const labels = {
      producto: 'Producto',
      cliente: 'Cliente',
      venta: 'Venta',
      proveedor: 'Proveedor'
    };
    return labels[tipo] || tipo;
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          position: 'fixed',
          top: 100,
          m: 0,
        }
      }}
    >
      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <TextField
            fullWidth
            inputRef={inputRef}
            placeholder="Buscar productos, clientes, ventas..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  {loading && <CircularProgress size={20} />}
                  <IconButton onClick={handleClose} edge="end">
                    <CloseIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
            autoComplete="off"
          />
        </Box>

        {query.trim().length < 2 && (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <SearchIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              Escribe al menos 2 caracteres para buscar
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Puedes buscar por: nombre, código, folio, teléfono, email
            </Typography>
          </Box>
        )}

        {query.trim().length >= 2 && resultados.length === 0 && !loading && (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No se encontraron resultados para "{query}"
            </Typography>
          </Box>
        )}

        {resultados.length > 0 && (
          <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
            <List sx={{ p: 0 }}>
              {resultados.map((resultado, index) => (
                <React.Fragment key={`${resultado.tipo}-${resultado.id}`}>
                  <ListItem
                    button
                    onClick={() => handleResultClick(resultado)}
                    sx={{
                      '&:hover': {
                        bgcolor: 'action.hover',
                      },
                    }}
                  >
                    <ListItemIcon>
                      {getIcono(resultado.tipo)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body1" fontWeight="medium">
                            {resultado.titulo}
                          </Typography>
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              bgcolor: 'primary.light',
                              color: 'primary.contrastText',
                              px: 1,
                              py: 0.25,
                              borderRadius: 1,
                            }}
                          >
                            {getTipoLabel(resultado.tipo)}
                          </Typography>
                        </Box>
                      }
                      secondary={resultado.subtitulo}
                    />
                  </ListItem>
                  {index < resultados.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          </Box>
        )}

        <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider', bgcolor: 'grey.50' }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            💡 Tip: Presiona <kbd style={{ padding: '2px 6px', background: '#fff', border: '1px solid #ddd', borderRadius: '3px' }}>Ctrl+K</kbd> para abrir la búsqueda desde cualquier lugar
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default BusquedaGlobal;
