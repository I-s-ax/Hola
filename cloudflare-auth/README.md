# Auth Template - Cloudflare Workers + D1

Sistema de autenticación completo desplegable en Cloudflare.

## Requisitos

- Node.js 18+
- Cuenta de Cloudflare (gratuita)
- Wrangler CLI

## Instalación Rápida

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar sesión en Cloudflare
npx wrangler login

# 3. Crear la base de datos D1
npx wrangler d1 create auth-db

# 4. Copiar el database_id que te da el comando anterior
#    y pegarlo en wrangler.toml (reemplazar TU_DATABASE_ID_AQUI)

# 5. Crear las tablas
npx wrangler d1 execute auth-db --remote --file=./schema.sql

# 6. Agregar el API key de Resend como secret
npx wrangler secret put RESEND_API_KEY
# Pegar: re_H8KWAc1g_LSyZAcxYhfG7fAgYsLMv3MYu

# 7. Desplegar
npx wrangler deploy
```

## Desarrollo Local

```bash
# Crear DB local
npx wrangler d1 execute auth-db --local --file=./schema.sql

# Iniciar servidor de desarrollo
npm run dev
```

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/health | Health check |
| POST | /api/auth/register | Registrar usuario |
| POST | /api/auth/verify | Verificar código |
| POST | /api/auth/login | Iniciar sesión |
| POST | /api/auth/forgot-password | Solicitar código reset |
| POST | /api/auth/reset-password | Cambiar contraseña |
| POST | /api/auth/resend-code | Reenviar código |
| GET | /api/auth/me | Usuario actual (auth) |

## Desplegar Frontend

```bash
# Desde la carpeta del frontend React
npm run build

# Desplegar a Cloudflare Pages
npx wrangler pages deploy build --project-name=auth-frontend
```

## Variables de Entorno

En `wrangler.toml`:
- `JWT_SECRET` - Clave secreta para JWT
- `JWT_EXPIRATION_DAYS` - Días de expiración (5)
- `SENDER_EMAIL` - Email de envío

Como secrets (wrangler secret put):
- `RESEND_API_KEY` - API key de Resend

## Estructura

```
├── src/
│   ├── index.ts        # Entry point
│   ├── types.ts        # TypeScript types
│   └── routes/
│       └── auth.ts     # Rutas de autenticación
├── schema.sql          # Schema de base de datos
├── wrangler.toml       # Configuración Cloudflare
└── package.json
```
