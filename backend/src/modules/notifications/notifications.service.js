const { ApiError } = require('../../utils/apiError');
const repo = require('./notifications.repository');

function mapNotification(n) {
  return {
    id: n.id,
    title: n.title,
    body: n.body,
    type: n.type,
    is_read: n.is_read,
    created_at: n.created_at,
    updated_at: n.updated_at,
  };
}

async function listNotifications(query, requester) {
  const where = {};
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
  if (!row) throw new ApiError(404, 'Notification not found');
  return { notification: mapNotification(row) };
}

async function markRead(id, requester) {
  const row = await repo.findByIdForUser(id, requester.userId);
  if (!row) throw new ApiError(404, 'Notification not found');
  const updated = await repo.update(id, { is_read: true, updated_at: new Date() });
  return { notification: mapNotification(updated) };
}

async function markAllRead(requester) {
  const result = await repo.markAllReadForUser(requester.userId);
  return { updated_count: result.count };
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
    type: payload.type ?? 'info',
  });
  return { notification: mapNotification(created) };
}

module.exports = {
  listNotifications,
  getNotificationById,
  markRead,
  markAllRead,
  createNotificationForUser,
};
