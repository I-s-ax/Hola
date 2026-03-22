import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { 
  Home, 
  Settings, 
  User, 
  LogOut, 
  Menu, 
  X, 
  ChevronLeft,
  ChevronRight,
  Shield,
  LayoutGrid,
  Bell,
  HelpCircle
} from 'lucide-react';

const menuItems = [
  { icon: Home, label: 'Inicio', path: '/home' },
  { icon: LayoutGrid, label: 'Tarjetas', path: '/cards' },
  { icon: User, label: 'Perfil', path: '/profile' },
  { icon: Bell, label: 'Notificaciones', path: '/notifications' },
  { icon: Settings, label: 'Configuración', path: '/settings' },
  { icon: HelpCircle, label: 'Ayuda', path: '/help' },
];

export const DashboardLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Persist sidebar state
  useEffect(() => {
    const savedState = localStorage.getItem('sidebar_open');
    if (savedState !== null) {
      setSidebarOpen(JSON.parse(savedState));
    }
  }, []);

  const toggleSidebar = () => {
    const newState = !sidebarOpen;
    setSidebarOpen(newState);
    localStorage.setItem('sidebar_open', JSON.stringify(newState));
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleNavigation = (path) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen bg-[#09090B]">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#18181B] border-b border-zinc-800 flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <span className="font-semibold text-white">AuthTemplate</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="text-zinc-400 hover:text-white"
          data-testid="mobile-menu-btn"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Mobile Menu */}
      <div className={`lg:hidden fixed top-16 right-0 bottom-0 w-64 bg-[#18181B] border-l border-zinc-800 z-50 transform transition-transform duration-300 ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/50 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-primary font-semibold">{user?.name?.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium truncate">{user?.name}</p>
              <p className="text-zinc-400 text-sm truncate">{user?.email}</p>
            </div>
          </div>

          <nav className="space-y-1">
            {menuItems.map((item) => (
              <button
                key={item.path}
                onClick={() => handleNavigation(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive(item.path)
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white'
                }`}
                data-testid={`mobile-nav-${item.label.toLowerCase()}`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="mt-6 pt-6 border-t border-zinc-800">
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-500/10"
              data-testid="mobile-logout-btn"
            >
              <LogOut className="w-5 h-5 mr-3" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div 
        className={`hidden lg:flex fixed top-0 left-0 bottom-0 flex-col bg-[#18181B] border-r border-zinc-800 transition-all duration-300 z-40 ${
          sidebarOpen ? 'w-60' : 'w-16'
        }`}
      >
        {/* Sidebar Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-zinc-800">
          {sidebarOpen && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <Shield className="w-4 h-4 text-primary" />
              </div>
              <span className="font-semibold text-white">AuthTemplate</span>
            </div>
          )}
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
            data-testid="sidebar-toggle-btn"
          >
            {sidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>
        </div>

        {/* User Info */}
        <div className={`p-4 border-b border-zinc-800 ${!sidebarOpen && 'flex justify-center'}`}>
          {sidebarOpen ? (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/50">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-semibold">{user?.name?.charAt(0).toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{user?.name}</p>
                <p className="text-zinc-400 text-sm truncate">{user?.email}</p>
              </div>
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-primary font-semibold">{user?.name?.charAt(0).toUpperCase()}</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive(item.path)
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white'
              } ${!sidebarOpen && 'justify-center'}`}
              title={!sidebarOpen ? item.label : undefined}
              data-testid={`nav-${item.label.toLowerCase()}`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && item.label}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-zinc-800">
          <Button
            variant="ghost"
            onClick={handleLogout}
            className={`w-full text-red-400 hover:text-red-300 hover:bg-red-500/10 ${
              sidebarOpen ? 'justify-start' : 'justify-center'
            }`}
            title={!sidebarOpen ? 'Cerrar Sesión' : undefined}
            data-testid="logout-btn"
          >
            <LogOut className="w-5 h-5" />
            {sidebarOpen && <span className="ml-3">Cerrar Sesión</span>}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className={`min-h-screen transition-all duration-300 pt-16 lg:pt-0 ${sidebarOpen ? 'lg:ml-60' : 'lg:ml-16'}`}>
        <div className="p-6 lg:p-8">
          {children}
        </div>
      </div>
    </div>
  );
};
