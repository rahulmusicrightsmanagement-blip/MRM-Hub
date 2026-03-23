const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const VALID_ROLES = ['admin', 'lead', 'onboarding_manager', 'society_manager', 'music_work_manager'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    roles: {
      type: [{ type: String, enum: VALID_ROLES }],
      default: ['lead'],
      validate: {
        validator: (v) => v.length > 0,
        message: 'At least one role must be assigned',
      },
    },
    phone: { type: String, default: '' },
    department: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    totpSecret: { type: String, default: '' },
  },
  { timestamps: true, collection: 'spoc_users' }
);

// Virtual: backward-compat "role" getter (returns primary role)
userSchema.virtual('role').get(function () {
  if (this.roles.includes('admin')) return 'admin';
  if (this.roles.includes('lead')) return 'lead';
  return this.roles[0] || 'lead';
});

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output (global plugin handles __v/updatedAt)
userSchema.methods.toJSON = function () {
  const obj = this.toObject({ virtuals: true });
  delete obj.password;
  delete obj.totpSecret;
  delete obj.__v;
  delete obj.updatedAt;
  return obj;
};

// Helper: check if user has a specific role
userSchema.methods.hasRole = function (role) {
  return this.roles.includes(role);
};

// Helper: check if user has any of the given roles
userSchema.methods.hasAnyRole = function (roleList) {
  return roleList.some((r) => this.roles.includes(r));
};

// Helper: admin or lead = full access
userSchema.methods.isFullAccess = function () {
  return this.roles.includes('admin') || this.roles.includes('lead');
};

const User = mongoose.model('User', userSchema);
module.exports = User;
module.exports.VALID_ROLES = VALID_ROLES;
