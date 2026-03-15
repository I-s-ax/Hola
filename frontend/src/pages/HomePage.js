import React from 'react';
import { useAuth } from '../context/AuthContext';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Shield, Mail, Calendar, CheckCircle } from 'lucide-react';

const HomePage = () => {
  const { user } = useAuth();

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-8" data-testid="home-dashboard">
        {/* Welcome Header */}
        <div className="hero-glow rounded-2xl p-8 lg:p-12">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center">
              <span className="text-3xl font-bold text-primary">{user?.name?.charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-white">
                ¡Bienvenido, {user?.name}!
              </h1>
              <p className="text-zinc-400 mt-1">
                Tu sesión está activa por 5 días
              </p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="bg-[#18181B] border-zinc-800 hover:border-zinc-700 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Estado</CardTitle>
              <CheckCircle className="w-5 h-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">Verificado</div>
              <p className="text-xs text-zinc-500 mt-1">Email confirmado</p>
            </CardContent>
          </Card>

          <Card className="bg-[#18181B] border-zinc-800 hover:border-zinc-700 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Email</CardTitle>
              <Mail className="w-5 h-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-white truncate">{user?.email}</div>
              <p className="text-xs text-zinc-500 mt-1">Cuenta principal</p>
            </CardContent>
          </Card>

          <Card className="bg-[#18181B] border-zinc-800 hover:border-zinc-700 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Registro</CardTitle>
              <Calendar className="w-5 h-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-white">{formatDate(user?.created_at)}</div>
              <p className="text-xs text-zinc-500 mt-1">Fecha de creación</p>
            </CardContent>
          </Card>
        </div>

        {/* Info Card */}
        <Card className="bg-[#18181B] border-zinc-800">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-white">Plantilla de Autenticación</CardTitle>
                <CardDescription className="text-zinc-400">Sistema completo y seguro</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800">
                <h3 className="font-semibold text-white mb-2">Características</h3>
                <ul className="text-sm text-zinc-400 space-y-1">
                  <li>• Registro con verificación por email</li>
                  <li>• Inicio de sesión seguro</li>
                  <li>• Recuperación de contraseña</li>
                  <li>• Sesión persistente (5 días)</li>
                </ul>
              </div>
              <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800">
                <h3 className="font-semibold text-white mb-2">Tecnologías</h3>
                <ul className="text-sm text-zinc-400 space-y-1">
                  <li>• React + Tailwind CSS</li>
                  <li>• FastAPI Backend</li>
                  <li>• JWT Authentication</li>
                  <li>• Resend Email Service</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Placeholder Pages */}
        <div className="p-6 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/30 text-center">
          <p className="text-zinc-400">
            Las demás páginas del menú (Perfil, Documentos, Notificaciones, Configuración, Ayuda) 
            están preparadas como plantillas para que puedas expandir tu aplicación.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default HomePage;
