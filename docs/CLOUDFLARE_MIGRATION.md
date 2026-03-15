# Guía de Migración a Cloudflare

## Arquitectura Actual vs Cloudflare

| Actual | Cloudflare |
|--------|------------|
| FastAPI (Python) | Workers (JavaScript/TypeScript) |
| MongoDB | D1 (SQLite) |
| React en servidor | Pages (estático) |
| Resend | Resend (mismo) |

---

## Paso 1: Configuración Inicial

### 1.1 Instalar Wrangler CLI
```bash
npm install -g wrangler
wrangler login
```

### 1.2 Crear proyecto
```bash
mkdir auth-template-cloudflare
cd auth-template-cloudflare
npm init -y
npm install hono @cloudflare/workers-types bcryptjs jose resend
```

---

## Paso 2: Crear Base de Datos D1

### 2.1 Crear la base de datos
```bash
wrangler d1 create auth-db
```

Esto te dará un ID, guárdalo para el `wrangler.toml`.

### 2.2 Schema SQL (`schema.sql`)
```sql
-- Crear tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    is_verified INTEGER DEFAULT 0,
    verification_code TEXT,
    code_expiration TEXT,
    reset_code TEXT,
    reset_code_expiration TEXT,
    created_at TEXT NOT NULL
);

-- Índice para búsquedas por email
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
```

### 2.3 Aplicar schema
```bash
wrangler d1 execute auth-db --file=./schema.sql
```

---

## Paso 3: Configurar wrangler.toml

```toml
name = "auth-template"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
JWT_SECRET = "tu_secret_key_muy_seguro_aqui"
JWT_EXPIRATION_DAYS = "5"
SENDER_EMAIL = "noreply@updates.isadev.icu"

# Base de datos D1
[[d1_databases]]
binding = "DB"
database_name = "auth-db"
database_id = "TU_DATABASE_ID_AQUI"

# Variables secretas (agregar con: wrangler secret put RESEND_API_KEY)
# RESEND_API_KEY se agrega como secret, no aquí
```

---

## Paso 4: Backend con Hono (Workers)

### 4.1 Estructura de archivos
```
src/
├── index.ts          # Entry point
├── routes/
│   └── auth.ts       # Rutas de autenticación
├── middleware/
│   └── auth.ts       # Middleware JWT
├── utils/
│   ├── jwt.ts        # Funciones JWT
│   ├── password.ts   # Hash de contraseñas
│   └── email.ts      # Envío de emails
└── types.ts          # Tipos TypeScript
```

### 4.2 Entry Point (`src/index.ts`)
```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authRoutes } from './routes/auth';

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  JWT_EXPIRATION_DAYS: string;
  RESEND_API_KEY: string;
  SENDER_EMAIL: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Health check
app.get('/api/health', (c) => c.json({ status: 'healthy' }));

// Auth routes
app.route('/api/auth', authRoutes);

export default app;
```

### 4.3 Rutas de Auth (`src/routes/auth.ts`)
```typescript
import { Hono } from 'hono';
import { SignJWT, jwtVerify } from 'jose';
import { Resend } from 'resend';

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  JWT_EXPIRATION_DAYS: string;
  RESEND_API_KEY: string;
  SENDER_EMAIL: string;
};

export const authRoutes = new Hono<{ Bindings: Bindings }>();

// Función para hashear (bcryptjs no funciona en Workers, usar Web Crypto)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const newHash = await hashPassword(password);
  return newHash === hash;
}

// Generar código de 6 dígitos
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Crear JWT
async function createToken(userId: string, email: string, secret: string, days: number): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);
  return await new SignJWT({ user_id: userId, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${days}d`)
    .sign(secretKey);
}

// Enviar email
async function sendEmail(apiKey: string, from: string, to: string, subject: string, html: string) {
  const resend = new Resend(apiKey);
  await resend.emails.send({ from, to: [to], subject, html });
}

// ============ RUTAS ============

// Registro
authRoutes.post('/register', async (c) => {
  const { email, password, name } = await c.req.json();
  
  // Verificar si existe
  const existing = await c.env.DB.prepare(
    'SELECT * FROM users WHERE email = ?'
  ).bind(email).first();
  
  if (existing && existing.is_verified) {
    return c.json({ detail: 'Email already registered' }, 400);
  }
  
  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  const code = generateCode();
  const expiration = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const createdAt = new Date().toISOString();
  
  if (existing) {
    // Actualizar usuario no verificado
    await c.env.DB.prepare(
      'UPDATE users SET verification_code = ?, code_expiration = ?, password_hash = ?, name = ? WHERE email = ?'
    ).bind(code, expiration, passwordHash, name, email).run();
  } else {
    // Crear nuevo usuario
    await c.env.DB.prepare(
      'INSERT INTO users (user_id, email, name, password_hash, is_verified, verification_code, code_expiration, created_at) VALUES (?, ?, ?, ?, 0, ?, ?, ?)'
    ).bind(userId, email, name, passwordHash, code, expiration, createdAt).run();
  }
  
  // Enviar email
  const html = `
    <div style="font-family: Arial; padding: 20px; background: #09090B; color: #FAFAFA;">
      <h2 style="color: #6366f1;">Verificación de cuenta</h2>
      <p>Tu código es:</p>
      <div style="background: #18181B; padding: 20px; text-align: center; border-radius: 8px;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #6366f1;">${code}</span>
      </div>
      <p style="color: #A1A1AA; font-size: 14px;">Expira en 15 minutos.</p>
    </div>
  `;
  
  await sendEmail(c.env.RESEND_API_KEY, c.env.SENDER_EMAIL, email, 'Verifica tu cuenta', html);
  
  return c.json({ message: 'Verification code sent to your email', success: true });
});

// Verificar código
authRoutes.post('/verify', async (c) => {
  const { email, code } = await c.req.json();
  
  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE email = ?'
  ).bind(email).first();
  
  if (!user) {
    return c.json({ detail: 'User not found' }, 404);
  }
  
  if (user.is_verified) {
    return c.json({ detail: 'Email already verified' }, 400);
  }
  
  if (user.verification_code !== code) {
    return c.json({ detail: 'Invalid verification code' }, 400);
  }
  
  if (new Date() > new Date(user.code_expiration as string)) {
    return c.json({ detail: 'Verification code expired' }, 400);
  }
  
  // Marcar como verificado
  await c.env.DB.prepare(
    'UPDATE users SET is_verified = 1, verification_code = NULL, code_expiration = NULL WHERE email = ?'
  ).bind(email).run();
  
  // Crear token
  const token = await createToken(
    user.user_id as string, 
    email, 
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
});

// Login
authRoutes.post('/login', async (c) => {
  const { email, password } = await c.req.json();
  
  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE email = ?'
  ).bind(email).first();
  
  if (!user) {
    return c.json({ detail: 'Invalid credentials' }, 401);
  }
  
  const validPassword = await verifyPassword(password, user.password_hash as string);
  if (!validPassword) {
    return c.json({ detail: 'Invalid credentials' }, 401);
  }
  
  if (!user.is_verified) {
    // Reenviar código
    const code = generateCode();
    const expiration = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    
    await c.env.DB.prepare(
      'UPDATE users SET verification_code = ?, code_expiration = ? WHERE email = ?'
    ).bind(code, expiration, email).run();
    
    return c.json({ detail: 'Email not verified. New code sent.' }, 403);
  }
  
  const token = await createToken(
    user.user_id as string, 
    email, 
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
});

// Forgot password
authRoutes.post('/forgot-password', async (c) => {
  const { email } = await c.req.json();
  
  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE email = ?'
  ).bind(email).first();
  
  if (user) {
    const code = generateCode();
    const expiration = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    
    await c.env.DB.prepare(
      'UPDATE users SET reset_code = ?, reset_code_expiration = ? WHERE email = ?'
    ).bind(code, expiration, email).run();
    
    const html = `
      <div style="font-family: Arial; padding: 20px; background: #09090B; color: #FAFAFA;">
        <h2 style="color: #6366f1;">Recuperación de contraseña</h2>
        <p>Tu código es:</p>
        <div style="background: #18181B; padding: 20px; text-align: center; border-radius: 8px;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #6366f1;">${code}</span>
        </div>
      </div>
    `;
    
    await sendEmail(c.env.RESEND_API_KEY, c.env.SENDER_EMAIL, email, 'Recupera tu contraseña', html);
  }
  
  return c.json({ message: 'If the email exists, a reset code has been sent', success: true });
});

// Reset password
authRoutes.post('/reset-password', async (c) => {
  const { email, code, new_password } = await c.req.json();
  
  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE email = ?'
  ).bind(email).first();
  
  if (!user) {
    return c.json({ detail: 'User not found' }, 404);
  }
  
  if (user.reset_code !== code) {
    return c.json({ detail: 'Invalid reset code' }, 400);
  }
  
  if (new Date() > new Date(user.reset_code_expiration as string)) {
    return c.json({ detail: 'Reset code expired' }, 400);
  }
  
  const passwordHash = await hashPassword(new_password);
  
  await c.env.DB.prepare(
    'UPDATE users SET password_hash = ?, reset_code = NULL, reset_code_expiration = NULL WHERE email = ?'
  ).bind(passwordHash, email).run();
  
  return c.json({ message: 'Password reset successfully', success: true });
});

// Get current user (protegido)
authRoutes.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ detail: 'Authentication required' }, 401);
  }
  
  const token = authHeader.substring(7);
  
  try {
    const secretKey = new TextEncoder().encode(c.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secretKey);
    
    const user = await c.env.DB.prepare(
      'SELECT user_id, email, name, is_verified, created_at FROM users WHERE user_id = ?'
    ).bind(payload.user_id).first();
    
    if (!user) {
      return c.json({ detail: 'User not found' }, 401);
    }
    
    return c.json(user);
  } catch {
    return c.json({ detail: 'Invalid or expired token' }, 401);
  }
});
```

---

## Paso 5: Frontend en Cloudflare Pages

### 5.1 Build del frontend
```bash
cd frontend
yarn build
```

### 5.2 Desplegar a Pages
```bash
wrangler pages deploy build --project-name=auth-template-frontend
```

### 5.3 Configurar variable de entorno
En el dashboard de Cloudflare Pages:
- Settings → Environment Variables
- Añadir: `REACT_APP_BACKEND_URL` = `https://auth-template.TU_SUBDOMAIN.workers.dev`

---

## Paso 6: Desplegar Backend (Workers)

```bash
# Agregar secret de Resend
wrangler secret put RESEND_API_KEY
# Pegar: re_H8KWAc1g_LSyZAcxYhfG7fAgYsLMv3MYu

# Desplegar
wrangler deploy
```

---

## Paso 7: Configurar Dominio Personalizado (Opcional)

### Workers (API)
1. Cloudflare Dashboard → Workers → auth-template
2. Settings → Triggers → Custom Domains
3. Añadir: `api.tudominio.com`

### Pages (Frontend)
1. Cloudflare Dashboard → Pages → auth-template-frontend
2. Custom domains → Add
3. Añadir: `app.tudominio.com`

---

## Resumen de Comandos

```bash
# 1. Crear proyecto
mkdir auth-cloudflare && cd auth-cloudflare
npm init -y
npm install hono jose resend

# 2. Crear base de datos
wrangler d1 create auth-db
wrangler d1 execute auth-db --file=./schema.sql

# 3. Configurar secrets
wrangler secret put RESEND_API_KEY

# 4. Desplegar backend
wrangler deploy

# 5. Desplegar frontend
cd frontend && yarn build
wrangler pages deploy build --project-name=auth-frontend
```

---

## Diferencias Importantes

| Aspecto | MongoDB/FastAPI | Cloudflare D1/Workers |
|---------|-----------------|----------------------|
| Queries | `db.users.find_one()` | `DB.prepare().bind().first()` |
| IDs | `ObjectId` auto | `crypto.randomUUID()` |
| Hash | `bcrypt` | Web Crypto API (SHA-256) |
| JWT | `pyjwt` | `jose` library |
| Async | `async/await` nativo | `async/await` nativo |

---

## Costos Cloudflare (Tier Gratuito)

- **Workers**: 100,000 requests/día gratis
- **D1**: 5 GB storage, 5M rows read/día gratis
- **Pages**: Builds ilimitados, bandwidth ilimitado

Para la mayoría de proyectos, el tier gratuito es suficiente.
