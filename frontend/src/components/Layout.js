// src/components/Layout.js
import React, { useState, useEffect } from 'react';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import BusquedaGlobal from './BusquedaGlobal';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import NotificationsIcon from '@mui/icons-material/Notifications';
import SettingsIcon from '@mui/icons-material/Settings';
import HistoryIcon from '@mui/icons-material/History';
import BackupIcon from '@mui/icons-material/Backup';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import ApprovalIcon from '@mui/icons-material/Approval';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  Badge,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Inventory as InventoryIcon,
  ShoppingCart as ShoppingCartIcon,
  People as PeopleIcon,
  LocalShipping as LocalShippingIcon,
  Business as BusinessIcon,
  PointOfSale as PointOfSaleIcon,
  Logout as LogoutIcon,
  Search as SearchIcon,
} from '@mui/icons-material';

const drawerWidth = 240;

const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { usuario, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [contadorNotificaciones, setContadorNotificaciones] = useState(0);
  const [nombreNegocio, setNombreNegocio] = useState('POS Abarrotes');
  const [busquedaOpen, setBusquedaOpen] = useState(false);

  // Cargar contador de notificaciones
  useEffect(() => {
    const cargarContador = async () => {
      try {
        const response = await api.get('/api/notificaciones/contador');
        setContadorNotificaciones(response.data.total);
      } catch (error) {
        console.error('Error al cargar contador de notificaciones:', error);
      }
    };

    cargarContador();
    const interval = setInterval(cargarContador, 60000); // Actualizar cada 60 segundos

    return () => clearInterval(interval);
  }, []);

  // Cargar nombre del negocio
  useEffect(() => {
    const cargarConfiguracion = async () => {
      try {
        const response = await api.get('/api/configuracion');
        const config = response.data.configuracion;
        if (config.nombre_negocio) {
          setNombreNegocio(config.nombre_negocio.valor);
        }
      } catch (error) {
        console.error('Error al cargar configuración:', error);
      }
    };

    cargarConfiguracion();
  }, []);

  // Atajo de teclado Ctrl+K para búsqueda
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setBusquedaOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
    { text: 'Productos', icon: <InventoryIcon />, path: '/productos' },
    { text: 'Ventas', icon: <PointOfSaleIcon />, path: '/ventas' },
    { text: 'Clientes', icon: <PeopleIcon />, path: '/clientes' },
    { text: 'Proveedores', icon: <BusinessIcon />, path: '/proveedores' },
    { text: 'Pedidos', icon: <LocalShippingIcon />, path: '/pedidos' },
    { text: 'Reportes', icon: <AssessmentIcon />, path: '/reportes' },
    { text: 'Historial Precios', icon: <HistoryIcon />, path: '/historial-precios' },
    { text: 'Backup', icon: <BackupIcon />, path: '/backup' },
    { text: 'Cuentas por Pagar', icon: <AccountBalanceIcon />, path: '/cuentas-por-pagar',roles: ['Administrador', 'Gerente']},
    { text: 'Descuentos', icon: <LocalOfferIcon />, path: '/gestion-descuentos',roles: ['Administrador', 'Gerente']},
    { text: 'Autorizaciones', icon: <ApprovalIcon />, path: '/autorizaciones-descuento',roles: ['Administrador', 'Gerente']},
    { 
      text: 'Notificaciones', 
      icon: (
        <Badge badgeContent={contadorNotificaciones} color="error">
          <NotificationsIcon />
        </Badge>
      ), 
      path: '/notificaciones' 
    },
    { text: 'Configuración', icon: <SettingsIcon />, path: '/configuracion' },
    { text: 'Usuarios', icon: <ManageAccountsIcon />, path: '/usuarios' },
  ];

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenuClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleMenuClose();
    logout();
    navigate('/login');
  };

  const drawer = (
    <Box>
      <Toolbar sx={{ bgcolor: 'primary.main', color: 'white' }}>
        <ShoppingCartIcon sx={{ mr: 1 }} />
        <Typography variant="h6" noWrap>
          {nombreNegocio}
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => {
                navigate(item.path);
                if (mobileOpen) handleDrawerToggle();
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {menuItems.find(item => item.path === location.pathname)?.text || nombreNegocio}
          </Typography>
          <IconButton 
            color="inherit" 
            onClick={() => setBusquedaOpen(true)}
            sx={{ mr: 2 }}
          >
            <SearchIcon />
          </IconButton>
          <IconButton onClick={handleMenuClick} sx={{ p: 0 }}>
            <Avatar sx={{ bgcolor: 'secondary.main' }}>
              {usuario?.nombre?.charAt(0).toUpperCase()}
            </Avatar>
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem disabled>
              <Typography variant="body2">{usuario?.nombre}</Typography>
            </MenuItem>
            <MenuItem disabled>
              <Typography variant="caption" color="text.secondary">
                {usuario?.email}
              </Typography>
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              Cerrar Sesión
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          mt: 8,
        }}
      >
        <Outlet />
      </Box>
      
      {/* Búsqueda Global */}
      <BusquedaGlobal 
        open={busquedaOpen} 
        onClose={() => setBusquedaOpen(false)} 
      />
    </Box>
  );
};

export default Layout;
