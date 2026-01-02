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
import ReceiptIcon from '@mui/icons-material/Receipt';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import UndoIcon from '@mui/icons-material/Undo';
import ReplyIcon from '@mui/icons-material/Reply';
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

  // Auto-refresh cada 30 segundos
  const interval = setInterval(cargarContador, 30000);

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
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/', roles: ['Administrador', 'Gerente'] },
    { text: 'Productos', icon: <InventoryIcon />, path: '/productos', roles: ['Administrador', 'Gerente', 'Vendedor'] },
    { text: 'Ventas', icon: <PointOfSaleIcon />, path: '/ventas', roles: ['Administrador', 'Gerente', 'Vendedor'] },
    { text: 'Clientes', icon: <PeopleIcon />, path: '/clientes', roles: ['Administrador', 'Gerente', 'Vendedor'] },
    { text: 'Proveedores', icon: <BusinessIcon />, path: '/proveedores', roles: ['Administrador', 'Gerente'] },
    { text: 'Pedidos', icon: <LocalShippingIcon />, path: '/pedidos', roles: ['Administrador', 'Gerente'] },
    { text: 'Reportes', icon: <AssessmentIcon />, path: '/reportes', roles: ['Administrador', 'Gerente'] },
    { text: 'Historial Precios', icon: <HistoryIcon />, path: '/historial-precios', roles: ['Administrador', 'Gerente'] },
    { text: 'Backup', icon: <BackupIcon />, path: '/backup', roles: ['Administrador'] },
    { text: 'Cuentas por Pagar', icon: <AccountBalanceIcon />, path: '/cuentas-por-pagar', roles: ['Administrador', 'Gerente'] },
    { text: 'Descuentos', icon: <LocalOfferIcon />, path: '/gestion-descuentos', roles: ['Administrador', 'Gerente'] },
    { text: 'Autorizaciones', icon: <ApprovalIcon />, path: '/autorizaciones-descuento', roles: ['Administrador', 'Gerente'] },
    { text: 'Gastos Fijos', icon: <ReceiptIcon />, path: '/gastos-fijos', roles: ['Administrador', 'Gerente'] },
    { text: 'Envíos', icon: <LocalShippingIcon />, path: '/envios', roles: ['Administrador', 'Gerente', 'Piloto'] },
    { text: 'Devoluciones Clientes', icon: <UndoIcon />, path: '/devoluciones-clientes', roles: ['Administrador', 'Gerente', 'Vendedor'] },
    { text: 'Devoluciones Proveedores', icon: <ReplyIcon />, path: '/devoluciones-proveedores', roles: ['Administrador', 'Gerente'] },
    { text: 'Configuración', icon: <SettingsIcon />, path: '/configuracion', roles: ['Administrador'] },
    { text: 'Usuarios', icon: <ManageAccountsIcon />, path: '/usuarios', roles: ['Administrador'] },
  ];

  // Filtrar menú según rol del usuario
  const menuItemsFiltrados = menuItems.filter(item => {
    // Si el item no tiene roles definidos, mostrarlo a todos
    if (!item.roles || item.roles.length === 0) {
      return true;
    }
    // Verificar si el rol del usuario está en la lista de roles permitidos
    return item.roles.includes(usuario?.rol);
  });

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
        {menuItemsFiltrados.map((item) => (
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
            {menuItemsFiltrados.find(item => item.path === location.pathname)?.text || nombreNegocio}
          </Typography>
          <IconButton 
            color="inherit" 
            onClick={() => setBusquedaOpen(true)}
            sx={{ mr: 2 }}
          >
            <SearchIcon />
          </IconButton>
          <IconButton 
            color="inherit" 
            onClick={() => navigate('/notificaciones')}
            sx={{ mr: 2 }}
          >
            <Badge badgeContent={contadorNotificaciones} color="error">
              <NotificationsIcon />
            </Badge>
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