import { db } from './db.js';

window.__loadNotifications = async function () {
  if (!window.user) return;

  const { data } = await db.from('notifications')
    .select('id,title,read,created_at')
    .eq('user_id', window.user.id)
    .order('created_at', { ascending: false })
    .limit(30);

  window.__notifCache = data || [];
};


