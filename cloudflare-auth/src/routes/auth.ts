import { Hono } from 'hono';
import { SignJWT, jwtVerify } from 'jose';
import { Resend } from 'resend';
import type { Env, User, RegisterInput, LoginInput, VerifyInput, ResetPasswordInput } from '../types';

export const authRoutes = new Hono<{ Bindings: Env }>();

// ============ UTILIDADES ============

// Hash de contraseña usando Web Crypto API (compatible con Workers)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  // Añadir salt para mayor seguridad
  const salt = 'auth_template_salt_2024';
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const newHash = await hashPassword(password);
  return newHash === hash;
}

// Generar código de 6 dígitos
function generateCode(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(100000 + (array[0] % 900000));
}

// Crear JWT token
async function createToken(userId: string, email: string, secret: string, days: number): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);
  return await new SignJWT({ user_id: userId, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${days}d`)
    .sign(secretKey);
}

// Verificar JWT token
async function verifyToken(token: string, secret: string): Promise<{ user_id: string; email: string } | null> {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey);
    return payload as { user_id: string; email: string };
  } catch {
    return null;
  }
}

// Enviar email con Resend
async function sendVerificationEmail(
  apiKey: string,
  from: string,
  to: string,
  code: string,
  type: 'verification' | 'reset'
): Promise<boolean> {
  const resend = new Resend(apiKey);
  
  const subject = type === 'verification' ? 'Verifica tu cuenta' : 'Recupera tu contraseña';
  const title = type === 'verification' ? 'Verificación de cuenta' : 'Recuperación de contraseña';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #09090B;">
        <h2 style="color: #6366f1; margin-bottom: 20px; font-size: 24px;">${title}</h2>
        <p style="color: #FAFAFA; margin-bottom: 20px; font-size: 16px;">Tu código de verificación es:</p>
        <div style="background-color: #18181B; padding: 24px; border-radius: 12px; text-align: center; margin-bottom: 24px;">
          <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #6366f1; font-family: monospace;">${code}</span>
        </div>
        <p style="color: #A1A1AA; font-size: 14px; margin-bottom: 8px;">Este código expira en 15 minutos.</p>
        <p style="color: #A1A1AA; font-size: 14px;">Si no solicitaste este código, ignora este correo.</p>
        <hr style="border: none; border-top: 1px solid #27272A; margin: 32px 0;">
        <p style="color: #71717A; font-size: 12px; text-align: center;">AuthTemplate - Autenticación segura</p>
      </div>
    </body>
    </html>
  `;
  
  try {
    await resend.emails.send({
      from,
      to: [to],
      subject,
      html
    });
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

// ============ RUTAS ============

// POST /api/auth/register - Registrar nuevo usuario
authRoutes.post('/register', async (c) => {
  try {
    const body: RegisterInput = await c.req.json();
    const { email, password, name } = body;
    
    if (!email || !password || !name) {
      return c.json({ detail: 'Email, password and name are required' }, 400);
    }
    
    // Verificar si el usuario ya existe
    const existing = await c.env.DB.prepare(
      'SELECT user_id, is_verified FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first<User>();
    
    if (existing && existing.is_verified) {
      return c.json({ detail: 'Email already registered' }, 400);
    }
    
    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    const code = generateCode();
    const expiration = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const createdAt = new Date().toISOString();
    
    if (existing) {
      // Actualizar usuario existente no verificado
      await c.env.DB.prepare(
        'UPDATE users SET verification_code = ?, code_expiration = ?, password_hash = ?, name = ? WHERE email = ?'
      ).bind(code, expiration, passwordHash, name, email.toLowerCase()).run();
    } else {
      // Crear nuevo usuario
      await c.env.DB.prepare(
        'INSERT INTO users (user_id, email, name, password_hash, is_verified, verification_code, code_expiration, created_at) VALUES (?, ?, ?, ?, 0, ?, ?, ?)'
      ).bind(userId, email.toLowerCase(), name, passwordHash, code, expiration, createdAt).run();
    }
    
    // Enviar email de verificación
    await sendVerificationEmail(c.env.RESEND_API_KEY, c.env.SENDER_EMAIL, email, code, 'verification');
    
    return c.json({ message: 'Verification code sent to your email', success: true });
  } catch (error) {
    console.error('Register error:', error);
    return c.json({ detail: 'Registration failed' }, 500);
  }
});

// POST /api/auth/verify - Verificar código de email
authRoutes.post('/verify', async (c) => {
  try {
    const body: VerifyInput = await c.req.json();
    const { email, code } = body;
    
    if (!email || !code) {
      return c.json({ detail: 'Email and code are required' }, 400);
    }
    
    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first<User>();
    
    if (!user) {
      return c.json({ detail: 'User not found' }, 404);
    }
    
    if (user.is_verified) {
      return c.json({ detail: 'Email already verified' }, 400);
    }
    
    if (user.verification_code !== code) {
      return c.json({ detail: 'Invalid verification code' }, 400);
    }
    
    if (!user.code_expiration || new Date() > new Date(user.code_expiration)) {
      return c.json({ detail: 'Verification code expired' }, 400);
    }
    
    // Marcar como verificado
    await c.env.DB.prepare(
      'UPDATE users SET is_verified = 1, verification_code = NULL, code_expiration = NULL WHERE email = ?'
    ).bind(email.toLowerCase()).run();
    
    // Crear token
    const token = await createToken(
      user.user_id,
      user.email,
      c.env.JWT_SECRET,
      parseInt(c.env.JWT_EXPIRATION_DAYS)
    );
    
    return c.json({
      access_token: token,
      token_type: 'bearer',
      user: {
        user_id: user.user_id,
        email: user.email,
        name: user.name,
        is_verified: true,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('Verify error:', error);
    return c.json({ detail: 'Verification failed' }, 500);
  }
});

// POST /api/auth/login - Iniciar sesión
authRoutes.post('/login', async (c) => {
  try {
    const body: LoginInput = await c.req.json();
    const { email, password } = body;
    
    if (!email || !password) {
      return c.json({ detail: 'Email and password are required' }, 400);
    }
    
    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first<User>();
    
    if (!user) {
      return c.json({ detail: 'Invalid credentials' }, 401);
    }
    
    const validPassword = await verifyPassword(password, user.password_hash);
    if (!validPassword) {
      return c.json({ detail: 'Invalid credentials' }, 401);
    }
    
    if (!user.is_verified) {
      // Reenviar código de verificación
      const code = generateCode();
      const expiration = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      
      await c.env.DB.prepare(
        'UPDATE users SET verification_code = ?, code_expiration = ? WHERE email = ?'
      ).bind(code, expiration, email.toLowerCase()).run();
      
      await sendVerificationEmail(c.env.RESEND_API_KEY, c.env.SENDER_EMAIL, email, code, 'verification');
      
      return c.json({ detail: 'Email not verified. New code sent.' }, 403);
    }
    
    // Crear token
    const token = await createToken(
      user.user_id,
      user.email,
      c.env.JWT_SECRET,
      parseInt(c.env.JWT_EXPIRATION_DAYS)
    );
    
    return c.json({
      access_token: token,
      token_type: 'bearer',
      user: {
        user_id: user.user_id,
        email: user.email,
        name: user.name,
        is_verified: true,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ detail: 'Login failed' }, 500);
  }
});

// POST /api/auth/forgot-password - Solicitar código de recuperación
authRoutes.post('/forgot-password', async (c) => {
  try {
    const body: { email: string } = await c.req.json();
    const { email } = body;
    
    if (!email) {
      return c.json({ detail: 'Email is required' }, 400);
    }
    
    const user = await c.env.DB.prepare(
      'SELECT user_id FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first<User>();
    
    // Siempre responder igual para no revelar si el email existe
    if (user) {
      const code = generateCode();
      const expiration = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      
      await c.env.DB.prepare(
        'UPDATE users SET reset_code = ?, reset_code_expiration = ? WHERE email = ?'
      ).bind(code, expiration, email.toLowerCase()).run();
      
      await sendVerificationEmail(c.env.RESEND_API_KEY, c.env.SENDER_EMAIL, email, code, 'reset');
    }
    
    return c.json({ message: 'If the email exists, a reset code has been sent', success: true });
  } catch (error) {
    console.error('Forgot password error:', error);
    return c.json({ detail: 'Request failed' }, 500);
  }
});

// POST /api/auth/reset-password - Restablecer contraseña
authRoutes.post('/reset-password', async (c) => {
  try {
    const body: ResetPasswordInput = await c.req.json();
    const { email, code, new_password } = body;
    
    if (!email || !code || !new_password) {
      return c.json({ detail: 'Email, code and new password are required' }, 400);
    }
    
    if (new_password.length < 6) {
      return c.json({ detail: 'Password must be at least 6 characters' }, 400);
    }
    
    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first<User>();
    
    if (!user) {
      return c.json({ detail: 'User not found' }, 404);
    }
    
    if (user.reset_code !== code) {
      return c.json({ detail: 'Invalid reset code' }, 400);
    }
    
    if (!user.reset_code_expiration || new Date() > new Date(user.reset_code_expiration)) {
      return c.json({ detail: 'Reset code expired' }, 400);
    }
    
    const passwordHash = await hashPassword(new_password);
    
    await c.env.DB.prepare(
      'UPDATE users SET password_hash = ?, reset_code = NULL, reset_code_expiration = NULL WHERE email = ?'
    ).bind(passwordHash, email.toLowerCase()).run();
    
    return c.json({ message: 'Password reset successfully', success: true });
  } catch (error) {
    console.error('Reset password error:', error);
    return c.json({ detail: 'Reset failed' }, 500);
  }
});

// POST /api/auth/resend-code - Reenviar código de verificación
authRoutes.post('/resend-code', async (c) => {
  try {
    const body: { email: string } = await c.req.json();
    const { email } = body;
    
    if (!email) {
      return c.json({ detail: 'Email is required' }, 400);
    }
    
    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first<User>();
    
    if (!user) {
      return c.json({ detail: 'User not found' }, 404);
    }
    
    if (user.is_verified) {
      return c.json({ detail: 'Email already verified' }, 400);
    }
    
    const code = generateCode();
    const expiration = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    
    await c.env.DB.prepare(
      'UPDATE users SET verification_code = ?, code_expiration = ? WHERE email = ?'
    ).bind(code, expiration, email.toLowerCase()).run();
    
    await sendVerificationEmail(c.env.RESEND_API_KEY, c.env.SENDER_EMAIL, email, code, 'verification');
    
    return c.json({ message: 'Verification code sent', success: true });
  } catch (error) {
    console.error('Resend code error:', error);
    return c.json({ detail: 'Failed to resend code' }, 500);
  }
});

// GET /api/auth/me - Obtener usuario actual (protegido)
authRoutes.get('/me', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ detail: 'Authentication required' }, 401);
    }
    
    const token = authHeader.substring(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    
    if (!payload) {
      return c.json({ detail: 'Invalid or expired token' }, 401);
    }
    
    const user = await c.env.DB.prepare(
      'SELECT user_id, email, name, is_verified, created_at FROM users WHERE user_id = ?'
    ).bind(payload.user_id).first<User>();
    
    if (!user) {
      return c.json({ detail: 'User not found' }, 401);
    }
    
    return c.json({
      user_id: user.user_id,
      email: user.email,
      name: user.name,
      is_verified: Boolean(user.is_verified),
      created_at: user.created_at
    });
  } catch (error) {
    console.error('Get me error:', error);
    return c.json({ detail: 'Failed to get user' }, 500);
  }
});
