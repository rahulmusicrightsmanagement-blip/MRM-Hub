/**
 * Migration: Convert existing users from `role` (string) to `roles` (array).
 *
 * Run once:  node migrate-roles.js
 *
 * Mapping:
 *   role: 'admin'   → roles: ['admin']
 *   role: 'manager' → roles: ['lead']
 *   role: 'spoc'    → roles: ['lead']
 *   anything else   → roles: ['lead']
 */
require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

async function migrate() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;
  const col = db.collection('spoc_users');

  const users = await col.find({}).toArray();
  let updated = 0;

  for (const user of users) {
    // Skip if already migrated
    if (Array.isArray(user.roles) && user.roles.length > 0) {
      console.log(`  SKIP ${user.name} — already has roles: [${user.roles.join(', ')}]`);
      continue;
    }

    const oldRole = (user.role || '').toLowerCase().trim();
    let newRoles;

    switch (oldRole) {
      case 'admin':
        newRoles = ['admin'];
        break;
      case 'manager':
        newRoles = ['lead'];
        break;
      case 'spoc':
        newRoles = ['lead'];
        break;
      default:
        newRoles = ['lead'];
    }

    await col.updateOne(
      { _id: user._id },
      { $set: { roles: newRoles }, $unset: { role: '' } }
    );

    console.log(`  MIGRATED ${user.name}: "${oldRole}" → [${newRoles.join(', ')}]`);
    updated++;
  }

  console.log(`\nDone. ${updated} user(s) migrated out of ${users.length} total.`);
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
