const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiError');
const { normalizeType } = require('../../shared/services/notification.service');
const { CATEGORIES, CHANNELS } = require('../notificationEngine/notificationEvents.catalog');
const repo = require('./notifications.repository');

function mapNotification(n) {
  return {
    id: n.id,
    title: n.title,
    body: n.body,
    type: n.type,
    action_url: n.action_url ?? null,
    action_label: n.action_label ?? null,
    is_read: n.is_read,
    event_type: n.event_type ?? null,
    category: n.category ?? null,
    priority: n.priority ?? null,
    entity_type: n.entity_type ?? null,
    entity_id: n.entity_id ?? null,
    actor_id: n.actor_id ?? null,
    is_critical: n.is_critical ?? false,
    requires_acknowledgement: n.requires_acknowledgement ?? false,
    read_at: n.read_at ?? null,
    acknowledged_at: n.acknowledged_at ?? null,
    archived_at: n.archived_at ?? null,
    clicked_at: n.clicked_at ?? null,
    created_at: n.created_at,
    updated_at: n.updated_at,
  };
}

async function listNotifications(query, requester) {
  const where = { archived_at: null };
  if (query.is_read !== undefined) where.is_read = query.is_read;
  if (query.type) where.type = query.type;
  const [total, rows] = await Promise.all([
    repo.countForUser(requester.userId, where),
    repo.findManyForUser(requester.userId, where, { skip: query.skip, take: query.take }),
  ]);
  const total_pages = Math.max(1, Math.ceil(total / query.page_size));
  return {
    notifications: rows.map(mapNotification),
    meta: {
      page: query.page,
      page_size: query.page_size,
      total,
      total_pages,
    },
  };
}

async function getNotificationById(id, requester) {
  const row = await repo.findByIdForUser(id, requester.userId);
  if (!row) throw new ApiError(404, 'الإشعار غير موجود');
  return { notification: mapNotification(row) };
}

async function markRead(id, requester) {
  const row = await repo.findByIdForUser(id, requester.userId);
  if (!row) throw new ApiError(404, 'الإشعار غير موجود');
  const now = new Date();
  const updated = await repo.update(id, {
    is_read: true,
    read_at: row.read_at || now,
    updated_at: now,
  });
  return { notification: mapNotification(updated) };
}

async function markAllRead(requester) {
  const now = new Date();
  const result = await prisma.notifications.updateMany({
    where: { user_id: requester.userId, is_read: false, archived_at: null },
    data: { is_read: true, read_at: now, updated_at: now },
  });
  return { updated_count: result.count };
}

async function acknowledge(id, requester) {
  const row = await repo.findByIdForUser(id, requester.userId);
  if (!row) throw new ApiError(404, 'الإشعار غير موجود');
  const now = new Date();
  const updated = await repo.update(id, {
    is_read: true,
    read_at: row.read_at || now,
    acknowledged_at: now,
    updated_at: now,
  });
  return { notification: mapNotification(updated) };
}

async function archive(id, requester) {
  const row = await repo.findByIdForUser(id, requester.userId);
  if (!row) throw new ApiError(404, 'الإشعار غير موجود');
  const now = new Date();
  const updated = await repo.update(id, {
    archived_at: now,
    is_read: true,
    read_at: row.read_at || now,
    updated_at: now,
  });
  return { notification: mapNotification(updated) };
}

async function unreadCount(requester) {
  const count = await prisma.notifications.count({
    where: {
      user_id: requester.userId,
      is_read: false,
      archived_at: null,
    },
  });
  return { unread_count: count };
}

async function getPreferences(requester) {
  const rows = await prisma.notification_preferences.findMany({
    where: { user_id: requester.userId },
    orderBy: [{ notification_category: 'asc' }, { channel: 'asc' }],
  });
  return {
    preferences: rows.map((r) => ({
      id: r.id,
      notification_category: r.notification_category,
      channel: r.channel,
      is_enabled: r.is_enabled,
      updated_at: r.updated_at,
    })),
    categories: CATEGORIES,
    channels: CHANNELS,
  };
}

async function updatePreferences(requester, body) {
  const items = Array.isArray(body?.preferences) ? body.preferences : [];
  const out = [];
  for (const item of items) {
    const category = String(item.notification_category || '');
    const channel = String(item.channel || '');
    if (!CATEGORIES.includes(category) || !CHANNELS.includes(channel)) {
      throw new ApiError(400, 'تصنيف أو قناة غير صالحة', null, 'INVALID_PREFERENCE');
    }
    // Critical system categories on IN_APP cannot be fully disabled at preference layer
    // for ACCOUNT when channel is IN_APP — still allow preference row; dispatcher enforces is_critical.
    const row = await prisma.notification_preferences.upsert({
      where: {
        user_id_notification_category_channel: {
          user_id: requester.userId,
          notification_category: category,
          channel,
        },
      },
      create: {
        user_id: requester.userId,
        notification_category: category,
        channel,
        is_enabled: Boolean(item.is_enabled),
      },
      update: {
        is_enabled: Boolean(item.is_enabled),
        updated_at: new Date(),
      },
    });
    out.push({
      id: row.id,
      notification_category: row.notification_category,
      channel: row.channel,
      is_enabled: row.is_enabled,
      updated_at: row.updated_at,
    });
  }
  return { preferences: out };
}

/**
 * Create a notification for a user (internal / future event hooks).
 * @param {{ userId: string, title: string, body?: string | null, type?: string }} payload
 */
async function createNotificationForUser(payload) {
  const created = await repo.create({
    user_id: payload.userId,
    title: payload.title,
    body: payload.body ?? null,
    type: normalizeType(payload.type ?? 'info'),
  });
  return { notification: mapNotification(created) };
}

module.exports = {
  listNotifications,
  getNotificationById,
  markRead,
  markAllRead,
  acknowledge,
  archive,
  unreadCount,
  getPreferences,
  updatePreferences,
  createNotificationForUser,
};
