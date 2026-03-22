import { Hono } from 'hono';
import type { Env, Card, CardFile, CardInput, PaginatedResponse } from '../types';
import { getValidAccessToken } from './google';

export const cardsRoutes = new Hono<{ Bindings: Env }>();

// GET /api/cards - Obtener tarjetas del usuario con paginación
cardsRoutes.get('/', async (c) => {
  try {
    const userId = c.req.query('user_id');
    const page = parseInt(c.req.query('page') || '1');
    const perPage = parseInt(c.req.query('per_page') || '6');
    const includePublic = c.req.query('include_public') === 'true';

    if (!userId && !includePublic) {
      return c.json({ detail: 'user_id is required' }, 400);
    }

    const offset = (page - 1) * perPage;

    let query: string;
    let countQuery: string;
    let params: string[];

    if (userId && includePublic) {
      // Mis tarjetas + públicas de otros
      query = 'SELECT * FROM cards WHERE user_id = ? OR is_public = 1 ORDER BY created_at DESC LIMIT ? OFFSET ?';
      countQuery = 'SELECT COUNT(*) as total FROM cards WHERE user_id = ? OR is_public = 1';
      params = [userId];
    } else if (userId) {
      // Solo mis tarjetas
      query = 'SELECT * FROM cards WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?';
      countQuery = 'SELECT COUNT(*) as total FROM cards WHERE user_id = ?';
      params = [userId];
    } else {
      // Solo públicas
      query = 'SELECT * FROM cards WHERE is_public = 1 ORDER BY created_at DESC LIMIT ? OFFSET ?';
      countQuery = 'SELECT COUNT(*) as total FROM cards WHERE is_public = 1';
      params = [];
    }

    const cards = await c.env.DB.prepare(query)
      .bind(...params, perPage, offset)
      .all<Card>();

    const countResult = await c.env.DB.prepare(countQuery)
      .bind(...params)
      .first<{ total: number }>();

    const total = countResult?.total || 0;

    const response: PaginatedResponse<Card> = {
      data: cards.results || [],
      page,
      per_page: perPage,
      total,
      total_pages: Math.ceil(total / perPage)
    };

    return c.json(response);
  } catch (error) {
    console.error('Get cards error:', error);
    return c.json({ detail: 'Failed to get cards' }, 500);
  }
});

// GET /api/cards/:cardId - Obtener una tarjeta específica
cardsRoutes.get('/:cardId', async (c) => {
  try {
    const cardId = c.req.param('cardId');
    const userId = c.req.query('user_id');

    const card = await c.env.DB.prepare(
      'SELECT * FROM cards WHERE card_id = ?'
    ).bind(cardId).first<Card>();

    if (!card) {
      return c.json({ detail: 'Card not found' }, 404);
    }

    // Verificar acceso
    if (!card.is_public && card.user_id !== userId) {
      return c.json({ detail: 'Access denied' }, 403);
    }

    // Obtener archivos de la tarjeta
    const files = await c.env.DB.prepare(
      'SELECT * FROM card_files WHERE card_id = ? ORDER BY sort_order, created_at'
    ).bind(cardId).all<CardFile>();

    return c.json({
      ...card,
      files: files.results || []
    });
  } catch (error) {
    console.error('Get card error:', error);
    return c.json({ detail: 'Failed to get card' }, 500);
  }
});

// POST /api/cards - Crear nueva tarjeta
cardsRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json() as CardInput & { user_id: string };
    const { user_id, title, description, cover_url, cover_file_id, is_public } = body;

    if (!user_id || !title) {
      return c.json({ detail: 'user_id and title are required' }, 400);
    }

    const cardId = crypto.randomUUID();
    const now = new Date().toISOString();

    await c.env.DB.prepare(
      'INSERT INTO cards (card_id, user_id, title, description, cover_url, cover_file_id, is_public, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      cardId,
      user_id,
      title,
      description || null,
      cover_url || null,
      cover_file_id || null,
      is_public ? 1 : 0,
      now,
      now
    ).run();

    const card = await c.env.DB.prepare(
      'SELECT * FROM cards WHERE card_id = ?'
    ).bind(cardId).first<Card>();

    return c.json(card, 201);
  } catch (error) {
    console.error('Create card error:', error);
    return c.json({ detail: 'Failed to create card' }, 500);
  }
});

// PUT /api/cards/:cardId - Actualizar tarjeta
cardsRoutes.put('/:cardId', async (c) => {
  try {
    const cardId = c.req.param('cardId');
    const body = await c.req.json() as CardInput & { user_id: string };
    const { user_id, title, description, cover_url, cover_file_id, is_public } = body;

    if (!user_id) {
      return c.json({ detail: 'user_id is required' }, 400);
    }

    // Verificar propiedad
    const existing = await c.env.DB.prepare(
      'SELECT user_id FROM cards WHERE card_id = ?'
    ).bind(cardId).first<Card>();

    if (!existing) {
      return c.json({ detail: 'Card not found' }, 404);
    }

    if (existing.user_id !== user_id) {
      return c.json({ detail: 'Access denied' }, 403);
    }

    const now = new Date().toISOString();

    await c.env.DB.prepare(
      'UPDATE cards SET title = ?, description = ?, cover_url = ?, cover_file_id = ?, is_public = ?, updated_at = ? WHERE card_id = ?'
    ).bind(
      title || existing.title,
      description !== undefined ? description : null,
      cover_url !== undefined ? cover_url : null,
      cover_file_id !== undefined ? cover_file_id : null,
      is_public !== undefined ? (is_public ? 1 : 0) : existing.is_public,
      now,
      cardId
    ).run();

    const card = await c.env.DB.prepare(
      'SELECT * FROM cards WHERE card_id = ?'
    ).bind(cardId).first<Card>();

    return c.json(card);
  } catch (error) {
    console.error('Update card error:', error);
    return c.json({ detail: 'Failed to update card' }, 500);
  }
});

// DELETE /api/cards/:cardId - Eliminar tarjeta
cardsRoutes.delete('/:cardId', async (c) => {
  try {
    const cardId = c.req.param('cardId');
    const userId = c.req.query('user_id');

    if (!userId) {
      return c.json({ detail: 'user_id is required' }, 400);
    }

    // Verificar propiedad
    const existing = await c.env.DB.prepare(
      'SELECT user_id FROM cards WHERE card_id = ?'
    ).bind(cardId).first<Card>();

    if (!existing) {
      return c.json({ detail: 'Card not found' }, 404);
    }

    if (existing.user_id !== userId) {
      return c.json({ detail: 'Access denied' }, 403);
    }

    // Eliminar archivos asociados de la DB (los archivos en Google Drive se mantienen)
    await c.env.DB.prepare(
      'DELETE FROM card_files WHERE card_id = ?'
    ).bind(cardId).run();

    // Eliminar tarjeta
    await c.env.DB.prepare(
      'DELETE FROM cards WHERE card_id = ?'
    ).bind(cardId).run();

    return c.json({ success: true, message: 'Card deleted' });
  } catch (error) {
    console.error('Delete card error:', error);
    return c.json({ detail: 'Failed to delete card' }, 500);
  }
});

// POST /api/cards/:cardId/files - Añadir archivo a tarjeta
cardsRoutes.post('/:cardId/files', async (c) => {
  try {
    const cardId = c.req.param('cardId');
    const body = await c.req.json() as {
      user_id: string;
      provider: string;
      provider_file_id: string;
      file_name: string;
      file_type: 'image' | 'video' | 'document';
      mime_type: string;
      thumbnail_url?: string;
      file_size?: number;
      description?: string;
    };

    const { user_id, provider, provider_file_id, file_name, file_type, mime_type, thumbnail_url, file_size, description } = body;

    if (!user_id || !provider || !provider_file_id || !file_name || !file_type || !mime_type) {
      return c.json({ detail: 'Missing required fields' }, 400);
    }

    // Verificar que la tarjeta existe y pertenece al usuario
    const card = await c.env.DB.prepare(
      'SELECT user_id FROM cards WHERE card_id = ?'
    ).bind(cardId).first<Card>();

    if (!card) {
      return c.json({ detail: 'Card not found' }, 404);
    }

    if (card.user_id !== user_id) {
      return c.json({ detail: 'Access denied' }, 403);
    }

    // Obtener el último sort_order
    const lastFile = await c.env.DB.prepare(
      'SELECT MAX(sort_order) as max_order FROM card_files WHERE card_id = ?'
    ).bind(cardId).first<{ max_order: number | null }>();

    const sortOrder = (lastFile?.max_order || 0) + 1;

    const fileId = crypto.randomUUID();
    const now = new Date().toISOString();

    await c.env.DB.prepare(
      'INSERT INTO card_files (file_id, card_id, user_id, provider, provider_file_id, file_name, file_type, mime_type, thumbnail_url, file_size, description, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      fileId,
      cardId,
      user_id,
      provider,
      provider_file_id,
      file_name,
      file_type,
      mime_type,
      thumbnail_url || null,
      file_size || null,
      description || null,
      sortOrder,
      now
    ).run();

    const file = await c.env.DB.prepare(
      'SELECT * FROM card_files WHERE file_id = ?'
    ).bind(fileId).first<CardFile>();

    return c.json(file, 201);
  } catch (error) {
    console.error('Add file error:', error);
    return c.json({ detail: 'Failed to add file' }, 500);
  }
});

// DELETE /api/cards/:cardId/files/:fileId - Eliminar archivo de tarjeta
cardsRoutes.delete('/:cardId/files/:fileId', async (c) => {
  try {
    const cardId = c.req.param('cardId');
    const fileId = c.req.param('fileId');
    const userId = c.req.query('user_id');
    const deleteFromCloud = c.req.query('delete_from_cloud') === 'true';

    if (!userId) {
      return c.json({ detail: 'user_id is required' }, 400);
    }

    // Verificar propiedad
    const file = await c.env.DB.prepare(
      'SELECT * FROM card_files WHERE file_id = ? AND card_id = ?'
    ).bind(fileId, cardId).first<CardFile>();

    if (!file) {
      return c.json({ detail: 'File not found' }, 404);
    }

    if (file.user_id !== userId) {
      return c.json({ detail: 'Access denied' }, 403);
    }

    // Eliminar de Google Drive si se solicita
    if (deleteFromCloud && file.provider === 'google_drive') {
      const accessToken = await getValidAccessToken(
        c.env.DB,
        userId,
        c.env.GOOGLE_CLIENT_ID,
        c.env.GOOGLE_CLIENT_SECRET
      );

      if (accessToken) {
        await fetch(
          `https://www.googleapis.com/drive/v3/files/${file.provider_file_id}`,
          {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${accessToken}` }
          }
        );
      }
    }

    // Eliminar de la DB
    await c.env.DB.prepare(
      'DELETE FROM card_files WHERE file_id = ?'
    ).bind(fileId).run();

    return c.json({ success: true, message: 'File removed' });
  } catch (error) {
    console.error('Delete file error:', error);
    return c.json({ detail: 'Failed to delete file' }, 500);
  }
});

// PUT /api/cards/:cardId/files/:fileId - Actualizar descripción del archivo
cardsRoutes.put('/:cardId/files/:fileId', async (c) => {
  try {
    const cardId = c.req.param('cardId');
    const fileId = c.req.param('fileId');
    const body = await c.req.json() as { user_id: string; description?: string; sort_order?: number };

    if (!body.user_id) {
      return c.json({ detail: 'user_id is required' }, 400);
    }

    // Verificar propiedad
    const file = await c.env.DB.prepare(
      'SELECT user_id FROM card_files WHERE file_id = ? AND card_id = ?'
    ).bind(fileId, cardId).first<CardFile>();

    if (!file) {
      return c.json({ detail: 'File not found' }, 404);
    }

    if (file.user_id !== body.user_id) {
      return c.json({ detail: 'Access denied' }, 403);
    }

    const updates: string[] = [];
    const values: (string | number)[] = [];

    if (body.description !== undefined) {
      updates.push('description = ?');
      values.push(body.description);
    }

    if (body.sort_order !== undefined) {
      updates.push('sort_order = ?');
      values.push(body.sort_order);
    }

    if (updates.length > 0) {
      values.push(fileId);
      await c.env.DB.prepare(
        `UPDATE card_files SET ${updates.join(', ')} WHERE file_id = ?`
      ).bind(...values).run();
    }

    const updated = await c.env.DB.prepare(
      'SELECT * FROM card_files WHERE file_id = ?'
    ).bind(fileId).first<CardFile>();

    return c.json(updated);
  } catch (error) {
    console.error('Update file error:', error);
    return c.json({ detail: 'Failed to update file' }, 500);
  }
});
