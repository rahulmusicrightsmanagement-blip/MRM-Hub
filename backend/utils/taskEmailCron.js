const cron = require('node-cron');
const ClientMessage = require('../models/ClientMessage');
const User = require('../models/User');
const { sendTaskEmail } = require('./mailer');
const { ADMIN_EMAILS, resolveSpocEmail } = require('./taskEmailConfig');

const runTaskEmailBroadcast = async () => {
  const startedAt = new Date();
  console.log(`[taskEmailCron] run started at ${startedAt.toISOString()}`);

  const tasks = await ClientMessage.find({}).lean();

  // 1) Admin recipients — full list, one send per address
  for (const adminEmail of ADMIN_EMAILS) {
    try {
      await sendTaskEmail({
        to: adminEmail,
        recipientLabel: 'Admin',
        tasks,
        mode: 'admin',
      });
      console.log(`[taskEmailCron] admin email sent → ${adminEmail} (${tasks.length} tasks)`);
    } catch (err) {
      console.error(`[taskEmailCron] admin email failed for ${adminEmail}:`, err.message);
    }
  }

  // 2) Per-SPOC — group by assignee
  const byUserId = new Map();
  const byUserName = new Map();
  for (const t of tasks) {
    if (t.assignedToId) {
      const k = t.assignedToId.toString();
      if (!byUserId.has(k)) byUserId.set(k, []);
      byUserId.get(k).push(t);
    } else if (t.assignedTo && t.assignedTo.trim()) {
      const k = t.assignedTo.trim().toLowerCase();
      if (!byUserName.has(k)) byUserName.set(k, []);
      byUserName.get(k).push(t);
    }
  }

  const userIds = Array.from(byUserId.keys());
  const users = userIds.length ? await User.find({ _id: { $in: userIds } }).lean() : [];
  const userById = new Map(users.map((u) => [u._id.toString(), u]));

  // Users matched by ObjectId
  for (const [uid, userTasks] of byUserId.entries()) {
    const user = userById.get(uid);
    if (!user) continue;
    const to = resolveSpocEmail(user);
    if (!to) {
      console.warn(`[taskEmailCron] skipping ${user.name} — no email resolved`);
      continue;
    }
    try {
      await sendTaskEmail({ to, recipientLabel: user.name, tasks: userTasks, mode: 'spoc' });
      console.log(`[taskEmailCron] SPOC email sent → ${user.name} <${to}> (${userTasks.length} tasks)`);
    } catch (err) {
      console.error(`[taskEmailCron] SPOC email failed for ${user.name}:`, err.message);
    }
  }

  // Users matched by name only (no id on task) — resolve via DB
  for (const [nameKey, userTasks] of byUserName.entries()) {
    const nameRegex = new RegExp(`^${nameKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    const user = await User.findOne({ name: nameRegex }).lean();
    if (!user) {
      console.warn(`[taskEmailCron] skipping name "${nameKey}" — no user match`);
      continue;
    }
    // Skip if same user already got email via id
    if (byUserId.has(user._id.toString())) continue;
    const to = resolveSpocEmail(user);
    if (!to) continue;
    try {
      await sendTaskEmail({ to, recipientLabel: user.name, tasks: userTasks, mode: 'spoc' });
      console.log(`[taskEmailCron] SPOC email sent → ${user.name} <${to}> (${userTasks.length} tasks)`);
    } catch (err) {
      console.error(`[taskEmailCron] SPOC email failed for ${user.name}:`, err.message);
    }
  }

  console.log(`[taskEmailCron] run finished in ${Date.now() - startedAt.getTime()}ms`);
};

const startTaskEmailCron = () => {
  // 11:40 AM India time (Asia/Kolkata), daily
  cron.schedule('0 10 * * *', () => {
    runTaskEmailBroadcast().catch((err) => console.error('[taskEmailCron] run error:', err));
  }, { timezone: 'Asia/Kolkata' });
  console.log('[taskEmailCron] scheduled daily 10:00 Asia/Kolkata');
};

module.exports = { startTaskEmailCron, runTaskEmailBroadcast };
