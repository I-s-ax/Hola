import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthLayout } from '../components/AuthLayout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Loader2, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '../components/ui/input-otp';

const ResetPasswordPage = () => {
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || '';

  useEffect(() => {
    if (!email) {
      navigate('/forgot-password');
    }
  }, [email, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (code.length !== 6) {
      toast.error('Ingresa el código completo de 6 dígitos');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      await resetPassword(email, code, newPassword);
      toast.success('Contraseña actualizada correctamente');
      navigate('/login', { state: { message: 'Contraseña actualizada. Inicia sesión.' } });
    } catch (error) {
      const message = error.response?.data?.detail || 'Error al restablecer contraseña';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout 
      title="Nueva Contraseña" 
      subtitle="Ingresa el código y tu nueva contraseña"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label className="text-zinc-300">Código de Verificación</Label>
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={code}
              onChange={setCode}
              data-testid="reset-otp-input"
            >
              <InputOTPGroup className="gap-2">
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <InputOTPSlot 
                    key={index} 
                    index={index}
                    className="w-10 h-10 text-lg font-mono bg-zinc-900/50 border-zinc-800 text-white rounded-lg focus-visible:ring-1 focus-visible:ring-primary"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="newPassword" className="text-zinc-300">Nueva Contraseña</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              id="newPassword"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="pl-10 pr-10 h-11 bg-zinc-900/50 border-zinc-800 text-white placeholder:text-zinc-600 focus-visible:ring-1 focus-visible:ring-primary"
              required
              data-testid="reset-new-password-input"
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
              data-testid="reset-confirm-password-input"
            />
          </div>
        </div>

        <Button
          type="submit"
          className="w-full h-11 bg-primary text-white hover:bg-primary/90 primary-glow active-scale"
          disabled={loading}
          data-testid="reset-submit-btn"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Actualizando...
            </>
          ) : (
            'Restablecer Contraseña'
          )}
        </Button>
      </form>

      <div className="mt-6 pt-6 border-t border-zinc-800">
        <Link 
          to="/forgot-password" 
          className="flex items-center justify-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm"
          data-testid="back-link"
        >
          <ArrowLeft className="w-4 h-4" />
          Solicitar nuevo código
        </Link>
      </div>
    </AuthLayout>
  );
};

export default ResetPasswordPage;
