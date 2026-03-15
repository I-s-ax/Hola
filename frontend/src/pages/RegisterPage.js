import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthLayout } from '../components/AuthLayout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Loader2, Mail, Lock, User, Eye, EyeOff } from 'lucide-react';

const RegisterPage = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    if (password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      await register(email, password, name);
      toast.success('Código de verificación enviado a tu email');
      navigate('/verify', { state: { email } });
    } catch (error) {
      const message = error.response?.data?.detail || 'Error al registrarse';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout 
      title="Crear Cuenta" 
      subtitle="Completa el formulario para registrarte"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-zinc-300">Nombre</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              id="name"
              type="text"
              placeholder="Tu nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="pl-10 h-11 bg-zinc-900/50 border-zinc-800 text-white placeholder:text-zinc-600 focus-visible:ring-1 focus-visible:ring-primary"
              required
              data-testid="register-name-input"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-zinc-300">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              id="email"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-11 bg-zinc-900/50 border-zinc-800 text-white placeholder:text-zinc-600 focus-visible:ring-1 focus-visible:ring-primary"
              required
              data-testid="register-email-input"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-zinc-300">Contraseña</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 pr-10 h-11 bg-zinc-900/50 border-zinc-800 text-white placeholder:text-zinc-600 focus-visible:ring-1 focus-visible:ring-primary"
              required
              data-testid="register-password-input"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-zinc-300">Confirmar Contraseña</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-10 h-11 bg-zinc-900/50 border-zinc-800 text-white placeholder:text-zinc-600 focus-visible:ring-1 focus-visible:ring-primary"
              required
              data-testid="register-confirm-password-input"
            />
          </div>
        </div>

        <Button
          type="submit"
          className="w-full h-11 bg-primary text-white hover:bg-primary/90 primary-glow active-scale"
          disabled={loading}
          data-testid="register-submit-btn"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Registrando...
            </>
          ) : (
            'Crear Cuenta'
          )}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-zinc-400 text-sm">
          ¿Ya tienes una cuenta?{' '}
          <Link 
            to="/login" 
            className="text-primary hover:text-primary/80 font-medium transition-colors"
            data-testid="login-link"
          >
            Inicia Sesión
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
};

export default RegisterPage;
