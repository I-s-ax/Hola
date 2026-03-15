import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthLayout } from '../components/AuthLayout';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { Loader2, ArrowLeft } from 'lucide-react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '../components/ui/input-otp';

const VerifyCodePage = () => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const { verifyCode, resendCode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || '';

  useEffect(() => {
    if (!email) {
      navigate('/login');
    }
  }, [email, navigate]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleVerify = async () => {
    if (code.length !== 6) {
      toast.error('Ingresa el código completo de 6 dígitos');
      return;
    }

    setLoading(true);

    try {
      await verifyCode(email, code);
      toast.success('Email verificado correctamente');
      navigate('/home');
    } catch (error) {
      const message = error.response?.data?.detail || 'Código inválido';
      toast.error(message);
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendLoading(true);

    try {
      await resendCode(email);
      toast.success('Código reenviado');
      setCountdown(60);
    } catch (error) {
      const message = error.response?.data?.detail || 'Error al reenviar código';
      toast.error(message);
    } finally {
      setResendLoading(false);
    }
  };

  useEffect(() => {
    if (code.length === 6) {
      handleVerify();
    }
  }, [code]);

  return (
    <AuthLayout 
      title="Verificar Email" 
      subtitle={`Ingresa el código enviado a ${email}`}
    >
      <div className="space-y-6">
        <div className="flex justify-center">
          <InputOTP
            maxLength={6}
            value={code}
            onChange={setCode}
            data-testid="otp-input"
          >
            <InputOTPGroup className="gap-2">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <InputOTPSlot 
                  key={index} 
                  index={index}
                  className="w-12 h-12 text-xl font-mono bg-zinc-900/50 border-zinc-800 text-white rounded-lg focus-visible:ring-1 focus-visible:ring-primary"
                />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>

        <Button
          onClick={handleVerify}
          className="w-full h-11 bg-primary text-white hover:bg-primary/90 primary-glow active-scale"
          disabled={loading || code.length !== 6}
          data-testid="verify-submit-btn"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Verificando...
            </>
          ) : (
            'Verificar Código'
          )}
        </Button>

        <div className="text-center">
          <p className="text-zinc-400 text-sm mb-2">¿No recibiste el código?</p>
          <Button
            variant="ghost"
            onClick={handleResend}
            disabled={resendLoading || countdown > 0}
            className="text-primary hover:text-primary/80"
            data-testid="resend-code-btn"
          >
            {resendLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Reenviando...
              </>
            ) : countdown > 0 ? (
              `Reenviar en ${countdown}s`
            ) : (
              'Reenviar Código'
            )}
          </Button>
        </div>

        <div className="pt-4 border-t border-zinc-800">
          <Link 
            to="/login" 
            className="flex items-center justify-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm"
            data-testid="back-to-login-link"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al inicio de sesión
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
};

export default VerifyCodePage;
