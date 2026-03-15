import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authRoutes } from './routes/auth';
import type { Env } from './types';

const app = new Hono<{ Bindings: Env }>();

// CORS - permite todas las origenes (ajustar en producción)
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Health check
app.get('/api', (c) => c.json({ message: 'Auth Template API - Cloudflare Workers' }));
app.get('/api/health', (c) => c.json({ status: 'healthy' }));

// Rutas de autenticación
app.route('/api/auth', authRoutes);

// 404 handler
app.notFound((c) => c.json({ detail: 'Not found' }, 404));

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({ detail: 'Internal server error' }, 500);
});

export default app;
