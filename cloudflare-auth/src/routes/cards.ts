import { Hono } from 'hono';
import type { Env, Card, PaginatedResponse } from '../types';

export const cardsRoutes = new Hono<{ Bindings: Env }>();

// GET /api/cards - Obtener tarjetas con paginación
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
    let bindParams: (string | number)[];
    let countParams: string[];

    if (userId && includePublic) {
      query = 'SELECT card_id, user_id, title, description, cover_data, is_public, created_at, updated_at FROM cards WHERE user_id = ? OR is_public = 1 ORDER BY created_at DESC LIMIT ? OFFSET ?';
      countQuery = 'SELECT COUNT(*) as total FROM cards WHERE user_id = ? OR is_public = 1';
      bindParams = [userId, perPage, offset];
      countParams = [userId];
    } else if (userId) {
      query = 'SELECT card_id, user_id, title, description, cover_data, is_public, created_at, updated_at FROM cards WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?';
      countQuery = 'SELECT COUNT(*) as total FROM cards WHERE user_id = ?';
      bindParams = [userId, perPage, offset];
      countParams = [userId];
    } else {
      query = 'SELECT card_id, user_id, title, description, cover_data, is_public, created_at, updated_at FROM cards WHERE is_public = 1 ORDER BY created_at DESC LIMIT ? OFFSET ?';
      countQuery = 'SELECT COUNT(*) as total FROM cards WHERE is_public = 1';
      bindParams = [perPage, offset];
      countParams = [];
    }

    const cards = await c.env.DB.prepare(query).bind(...bindParams).all<Card>();
    
    let total = 0;
    if (countParams.length > 0) {
      const countResult = await c.env.DB.prepare(countQuery).bind(...countParams).first<{ total: number }>();
      total = countResult?.total || 0;
    } else {
      const countResult = await c.env.DB.prepare(countQuery).first<{ total: number }>();
      total = countResult?.total || 0;
    }

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
    return c.json({ detail: 'Failed to get cards', error: String(error) }, 500);
  }
});

// GET /api/cards/:cardId - Obtener una tarjeta
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

    if (!card.is_public && card.user_id !== userId) {
      return c.json({ detail: 'Access denied' }, 403);
    }

    return c.json(card);
  } catch (error) {
    console.error('Get card error:', error);
    return c.json({ detail: 'Failed to get card' }, 500);
  }
});

// POST /api/cards - Crear tarjeta
cardsRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const { user_id, title, description, cover_data, is_public } = body;

    if (!user_id || !title) {
      return c.json({ detail: 'user_id and title are required' }, 400);
    }

    const cardId = crypto.randomUUID();
    const now = new Date().toISOString();

    await c.env.DB.prepare(
      'INSERT INTO cards (card_id, user_id, title, description, cover_data, is_public, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      cardId,
      user_id,
      title,
      description || null,
      cover_data || null,
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
    return c.json({ detail: 'Failed to create card', error: String(error) }, 500);
  }
});

// PUT /api/cards/:cardId - Actualizar tarjeta
cardsRoutes.put('/:cardId', async (c) => {
  try {
    const cardId = c.req.param('cardId');
    const body = await c.req.json();
    const { user_id, title, description, cover_data, is_public } = body;

    if (!user_id) {
      return c.json({ detail: 'user_id is required' }, 400);
    }

    const existing = await c.env.DB.prepare(
      'SELECT * FROM cards WHERE card_id = ?'
    ).bind(cardId).first<Card>();

    if (!existing) {
      return c.json({ detail: 'Card not found' }, 404);
    }

    if (existing.user_id !== user_id) {
      return c.json({ detail: 'Access denied' }, 403);
    }

    const now = new Date().toISOString();

    await c.env.DB.prepare(
      'UPDATE cards SET title = ?, description = ?, cover_data = ?, is_public = ?, updated_at = ? WHERE card_id = ?'
    ).bind(
      title || existing.title,
      description !== undefined ? description : existing.description,
      cover_data !== undefined ? cover_data : existing.cover_data,
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

    const existing = await c.env.DB.prepare(
      'SELECT user_id FROM cards WHERE card_id = ?'
    ).bind(cardId).first<Card>();

    if (!existing) {
      return c.json({ detail: 'Card not found' }, 404);
    }

    if (existing.user_id !== userId) {
      return c.json({ detail: 'Access denied' }, 403);
    }

    await c.env.DB.prepare('DELETE FROM cards WHERE card_id = ?').bind(cardId).run();

    return c.json({ success: true, message: 'Card deleted' });
  } catch (error) {
    console.error('Delete card error:', error);
    return c.json({ detail: 'Failed to delete card' }, 500);
  }
});
