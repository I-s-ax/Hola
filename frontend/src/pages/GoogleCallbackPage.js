import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const GoogleCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state'); // user_id
      const error = searchParams.get('error');

      if (error) {
        toast.error('Error al conectar con Google: ' + error);
        navigate('/cards');
        return;
      }

      if (!code) {
        toast.error('No se recibió código de autorización');
        navigate('/cards');
        return;
      }

      const userId = state || user?.user_id;

      if (!userId) {
        toast.error('Usuario no identificado');
        navigate('/login');
        return;
      }

      try {
        await axios.post(`${API}/google/callback`, {
          code,
          user_id: userId
        });

        toast.success('Google Drive conectado exitosamente');
        
        // Redirigir a la última tarjeta visitada o a la lista de tarjetas
        const lastCardId = localStorage.getItem('last_card_id');
        if (lastCardId) {
          localStorage.removeItem('last_card_id');
          navigate(`/cards/${lastCardId}`);
        } else {
          navigate('/cards');
        }
      } catch (error) {
        console.error('Callback error:', error);
        toast.error('Error al conectar Google Drive');
        navigate('/cards');
      }
    };

    handleCallback();
  }, [searchParams, navigate, user]);

  return (
    <div className="min-h-screen bg-[#09090B] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Conectando con Google Drive...</h2>
        <p className="text-zinc-400">Por favor espera mientras completamos la conexión</p>
      </div>
    </div>
  );
};

export default GoogleCallbackPage;
