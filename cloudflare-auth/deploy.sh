#!/bin/bash

# Script de despliegue para Cloudflare Workers

echo "🚀 Desplegando Auth Template a Cloudflare..."
echo ""

# Verificar si wrangler está instalado
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler no está instalado. Instalando..."
    npm install -g wrangler
fi

# Verificar login
echo "📋 Verificando autenticación con Cloudflare..."
wrangler whoami || {
    echo "❌ No estás autenticado. Ejecuta: wrangler login"
    exit 1
}

echo ""
echo "📦 Instalando dependencias..."
npm install

echo ""
echo "🗄️ Creando base de datos D1..."
DB_OUTPUT=$(wrangler d1 create auth-db 2>&1)

# Extraer database_id del output
DB_ID=$(echo "$DB_OUTPUT" | grep -oP 'database_id = "\K[^"]+')

if [ -n "$DB_ID" ]; then
    echo "✅ Base de datos creada con ID: $DB_ID"
    
    # Actualizar wrangler.toml
    sed -i "s/TU_DATABASE_ID_AQUI/$DB_ID/g" wrangler.toml
    echo "✅ wrangler.toml actualizado"
else
    echo "⚠️ La base de datos ya existe o hubo un error."
    echo "   Asegúrate de que database_id esté configurado en wrangler.toml"
fi

echo ""
echo "📊 Aplicando schema a la base de datos..."
wrangler d1 execute auth-db --remote --file=./schema.sql

echo ""
echo "🔐 Configurando RESEND_API_KEY..."
echo "   Ingresa tu API key de Resend cuando se solicite:"
wrangler secret put RESEND_API_KEY

echo ""
echo "🚀 Desplegando Worker..."
wrangler deploy

echo ""
echo "✅ ¡Despliegue completado!"
echo ""
echo "Tu API está disponible en:"
echo "https://auth-template.<tu-subdomain>.workers.dev"
echo ""
echo "Próximos pasos:"
echo "1. Actualiza REACT_APP_BACKEND_URL en tu frontend"
echo "2. Despliega el frontend con: wrangler pages deploy build"
