// Seed the initial admin account
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Seed admin account
    const existingAdmin = await User.findOne({ email: 'admin@mrmhub.com' });
    if (existingAdmin) {
      console.log('Admin user already exists — skipping');
    } else {
      const admin = new User({
        name: 'Rahul M.',
        email: 'admin@mrmhub.com',
        password: 'admin123',
        role: 'admin',
        phone: '',
        department: 'Management',
        isActive: true,
      });
      await admin.save();
      console.log('Admin user created:');
      console.log('  Email: admin@mrmhub.com');
      console.log('  Password: admin123');
    }

    // Seed manager account - Devi
    const existingManager = await User.findOne({ email: 'devi@mrmhub.com' });
    if (existingManager) {
      console.log('Manager user (Devi) already exists — skipping');
    } else {
      const manager = new User({
        name: 'Devi',
        email: 'devi@mrmhub.com',
        password: 'devi123',
        role: 'manager',
        phone: '',
        department: 'Management',
        isActive: true,
      });
      await manager.save();
      console.log('Manager user created:');
      console.log('  Email: devi@mrmhub.com');
      console.log('  Password: devi123');
    }

    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err.message);
    process.exit(1);
  }
}

seed();
