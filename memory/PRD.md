# Auth Template PRD

## Original Problem Statement
Plantilla para autenticación con registro, inicio de sesión, recuperación de contraseña, verificación de código mediante correo con Resend, base de datos preparada para Cloudflare D1, sesión persistente de 5 días, menú de navegación colapsable, y página de bienvenida con diseño oscuro.

## User Personas
- **Desarrolladores**: Necesitan una plantilla de autenticación lista para usar y personalizar

## Core Requirements
1. Registro de usuarios con verificación de email
2. Inicio de sesión seguro con JWT
3. Recuperación de contraseña
4. Verificación de código de 6 dígitos
5. Sesión persistente (5 días)
6. Menú colapsable con páginas de plantilla
7. Diseño oscuro profesional

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI + JWT Authentication
- **Database**: MongoDB (preparado para migrar a Cloudflare D1)
- **Email**: Resend (dominio: updates.isadev.icu)

## Implemented Features (Jan 2026)
- [x] Login page with email/password
- [x] Register page with name/email/password
- [x] Email verification with 6-digit OTP
- [x] Forgot password flow
- [x] Reset password with code
- [x] Protected home/dashboard
- [x] Collapsible sidebar navigation
- [x] JWT tokens (5-day expiration)
- [x] Dark theme throughout
- [x] Responsive design (mobile + desktop)
- [x] Placeholder pages for expansion

## Backlog
- P0: None (MVP complete)
- P1: User profile editing, Change password from dashboard
- P2: Two-factor authentication, Session management, Login history

## Next Tasks
1. Customize placeholder pages (Profile, Documents, etc.)
2. Add user profile editing functionality
3. Consider migration documentation for Cloudflare D1
