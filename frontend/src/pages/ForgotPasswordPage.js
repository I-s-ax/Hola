import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthLayout } from '../components/AuthLayout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Loader2, Mail, ArrowLeft } from 'lucide-react';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { forgotPassword } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await forgotPassword(email);
      toast.success('Si el email existe, se envió un código de recuperación');
      navigate('/reset-password', { state: { email } });
    } catch (error) {
      const message = error.response?.data?.detail || 'Error al enviar código';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout 
      title="Recuperar Contraseña" 
      subtitle="Ingresa tu email para recibir un código de recuperación"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
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
              data-testid="forgot-email-input"
            />
          </div>
        </div>

        <Button
          type="submit"
          className="w-full h-11 bg-primary text-white hover:bg-primary/90 primary-glow active-scale"
          disabled={loading}
          data-testid="forgot-submit-btn"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Enviando...
            </>
          ) : (
            'Enviar Código'
          )}
        </Button>
      </form>

      <div className="mt-6 pt-6 border-t border-zinc-800">
        <Link 
          to="/login" 
          className="flex items-center justify-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm"
          data-testid="back-to-login-link"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al inicio de sesión
        </Link>
      </div>
    </AuthLayout>
  );
};

export default ForgotPasswordPage;
