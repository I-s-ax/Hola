import { Hono } from 'hono';
import type { Env, CloudConnection } from '../types';

export const googleRoutes = new Hono<{ Bindings: Env }>();

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

// Scopes para Google Drive
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
].join(' ');

// GET /api/google/auth - Iniciar OAuth con Google
googleRoutes.get('/auth', async (c) => {
  const userId = c.req.query('user_id');
  if (!userId) {
    return c.json({ detail: 'user_id is required' }, 400);
  }

  const redirectUri = `${c.env.FRONTEND_URL}/auth/google/callback`;
  
  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state: userId
  });

  const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;
  return c.json({ auth_url: authUrl });
});

// POST /api/google/callback - Intercambiar código por tokens
googleRoutes.post('/callback', async (c) => {
  try {
    const { code, user_id } = await c.req.json();
    
    if (!code || !user_id) {
      return c.json({ detail: 'code and user_id are required' }, 400);
    }

    const redirectUri = `${c.env.FRONTEND_URL}/auth/google/callback`;

    // Intercambiar código por tokens
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: c.env.GOOGLE_CLIENT_ID,
        client_secret: c.env.GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      })
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Token error:', error);
      return c.json({ detail: 'Failed to exchange code for tokens' }, 400);
    }

    const tokens = await tokenResponse.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    // Obtener información del usuario de Google
    const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });

    if (!userInfoResponse.ok) {
      return c.json({ detail: 'Failed to get user info' }, 400);
    }

    const userInfo = await userInfoResponse.json() as { email: string };

    // Calcular expiración del token
    const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Verificar si ya existe una conexión
    const existing = await c.env.DB.prepare(
      'SELECT connection_id FROM cloud_connections WHERE user_id = ? AND provider = ?'
    ).bind(user_id, 'google_drive').first();

    const now = new Date().toISOString();

    if (existing) {
      // Actualizar conexión existente
      await c.env.DB.prepare(
        'UPDATE cloud_connections SET access_token = ?, refresh_token = ?, token_expiry = ?, provider_email = ?, updated_at = ? WHERE user_id = ? AND provider = ?'
      ).bind(
        tokens.access_token,
        tokens.refresh_token || '',
        tokenExpiry,
        userInfo.email,
        now,
        user_id,
        'google_drive'
      ).run();
    } else {
      // Crear nueva conexión
      const connectionId = crypto.randomUUID();
      await c.env.DB.prepare(
        'INSERT INTO cloud_connections (connection_id, user_id, provider, access_token, refresh_token, token_expiry, provider_email, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        connectionId,
        user_id,
        'google_drive',
        tokens.access_token,
        tokens.refresh_token || '',
        tokenExpiry,
        userInfo.email,
        now,
        now
      ).run();
    }

    return c.json({ 
      success: true, 
      message: 'Google Drive connected successfully',
      provider_email: userInfo.email
    });
  } catch (error) {
    console.error('Google callback error:', error);
    return c.json({ detail: 'Failed to connect Google Drive' }, 500);
  }
});

// GET /api/google/status - Verificar estado de conexión
googleRoutes.get('/status', async (c) => {
  const userId = c.req.query('user_id');
  if (!userId) {
    return c.json({ detail: 'user_id is required' }, 400);
  }

  const connection = await c.env.DB.prepare(
    'SELECT provider_email, token_expiry FROM cloud_connections WHERE user_id = ? AND provider = ?'
  ).bind(userId, 'google_drive').first<CloudConnection>();

  if (!connection) {
    return c.json({ connected: false });
  }

  return c.json({ 
    connected: true, 
    provider_email: connection.provider_email,
    expires_at: connection.token_expiry
  });
});

// POST /api/google/disconnect - Desconectar Google Drive
googleRoutes.post('/disconnect', async (c) => {
  try {
    const { user_id } = await c.req.json();
    
    if (!user_id) {
      return c.json({ detail: 'user_id is required' }, 400);
    }

    await c.env.DB.prepare(
      'DELETE FROM cloud_connections WHERE user_id = ? AND provider = ?'
    ).bind(user_id, 'google_drive').run();

    return c.json({ success: true, message: 'Google Drive disconnected' });
  } catch (error) {
    console.error('Disconnect error:', error);
    return c.json({ detail: 'Failed to disconnect' }, 500);
  }
});

// Helper: Refrescar token si es necesario
export async function getValidAccessToken(
  db: D1Database, 
  userId: string, 
  clientId: string, 
  clientSecret: string
): Promise<string | null> {
  const connection = await db.prepare(
    'SELECT * FROM cloud_connections WHERE user_id = ? AND provider = ?'
  ).bind(userId, 'google_drive').first<CloudConnection>();

  if (!connection) {
    return null;
  }

  // Verificar si el token ha expirado
  const expiry = new Date(connection.token_expiry);
  const now = new Date();

  if (now < expiry) {
    return connection.access_token;
  }

  // Refrescar el token
  if (!connection.refresh_token) {
    return null;
  }

  try {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: connection.refresh_token,
        grant_type: 'refresh_token'
      })
    });

    if (!response.ok) {
      return null;
    }

    const tokens = await response.json() as {
      access_token: string;
      expires_in: number;
    };

    const newExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    await db.prepare(
      'UPDATE cloud_connections SET access_token = ?, token_expiry = ?, updated_at = ? WHERE user_id = ? AND provider = ?'
    ).bind(tokens.access_token, newExpiry, new Date().toISOString(), userId, 'google_drive').run();

    return tokens.access_token;
  } catch {
    return null;
  }
}

// POST /api/google/upload - Subir archivo a Google Drive
googleRoutes.post('/upload', async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('user_id') as string;
    const folderId = formData.get('folder_id') as string | null;

    if (!file || !userId) {
      return c.json({ detail: 'file and user_id are required' }, 400);
    }

    const accessToken = await getValidAccessToken(
      c.env.DB, 
      userId, 
      c.env.GOOGLE_CLIENT_ID, 
      c.env.GOOGLE_CLIENT_SECRET
    );

    if (!accessToken) {
      return c.json({ detail: 'Google Drive not connected or token expired' }, 401);
    }

    // Preparar metadata del archivo
    const metadata: Record<string, unknown> = {
      name: file.name,
      mimeType: file.type
    };

    if (folderId) {
      metadata.parents = [folderId];
    }

    // Crear multipart request
    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const closeDelimiter = "\r\n--" + boundary + "--";

    const fileBuffer = await file.arrayBuffer();
    const fileBase64 = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));

    const multipartBody = 
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: ' + file.type + '\r\n' +
      'Content-Transfer-Encoding: base64\r\n\r\n' +
      fileBase64 +
      closeDelimiter;

    const uploadResponse = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,thumbnailLink,webViewLink,size',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary="${boundary}"`
        },
        body: multipartBody
      }
    );

    if (!uploadResponse.ok) {
      const error = await uploadResponse.text();
      console.error('Upload error:', error);
      return c.json({ detail: 'Failed to upload file to Google Drive' }, 500);
    }

    const uploadedFile = await uploadResponse.json() as {
      id: string;
      name: string;
      mimeType: string;
      thumbnailLink?: string;
      webViewLink?: string;
      size?: string;
    };

    return c.json({
      success: true,
      file: {
        id: uploadedFile.id,
        name: uploadedFile.name,
        mimeType: uploadedFile.mimeType,
        thumbnailLink: uploadedFile.thumbnailLink,
        webViewLink: uploadedFile.webViewLink,
        size: uploadedFile.size
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    return c.json({ detail: 'Failed to upload file' }, 500);
  }
});

// GET /api/google/download/:fileId - Descargar archivo de Google Drive
googleRoutes.get('/download/:fileId', async (c) => {
  try {
    const fileId = c.req.param('fileId');
    const userId = c.req.query('user_id');

    if (!userId) {
      return c.json({ detail: 'user_id is required' }, 400);
    }

    const accessToken = await getValidAccessToken(
      c.env.DB, 
      userId, 
      c.env.GOOGLE_CLIENT_ID, 
      c.env.GOOGLE_CLIENT_SECRET
    );

    if (!accessToken) {
      return c.json({ detail: 'Google Drive not connected or token expired' }, 401);
    }

    // Obtener el archivo
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    );

    if (!response.ok) {
      return c.json({ detail: 'Failed to download file' }, 500);
    }

    const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
    const blob = await response.blob();

    return new Response(blob, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    console.error('Download error:', error);
    return c.json({ detail: 'Failed to download file' }, 500);
  }
});

// DELETE /api/google/file/:fileId - Eliminar archivo de Google Drive
googleRoutes.delete('/file/:fileId', async (c) => {
  try {
    const fileId = c.req.param('fileId');
    const userId = c.req.query('user_id');

    if (!userId) {
      return c.json({ detail: 'user_id is required' }, 400);
    }

    const accessToken = await getValidAccessToken(
      c.env.DB, 
      userId, 
      c.env.GOOGLE_CLIENT_ID, 
      c.env.GOOGLE_CLIENT_SECRET
    );

    if (!accessToken) {
      return c.json({ detail: 'Google Drive not connected or token expired' }, 401);
    }

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}`,
      {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    );

    if (!response.ok && response.status !== 204) {
      return c.json({ detail: 'Failed to delete file' }, 500);
    }

    return c.json({ success: true, message: 'File deleted' });
  } catch (error) {
    console.error('Delete error:', error);
    return c.json({ detail: 'Failed to delete file' }, 500);
  }
});
