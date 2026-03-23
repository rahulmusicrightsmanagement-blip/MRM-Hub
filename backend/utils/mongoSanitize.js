/**
 * Mongoose plugin that strips internal fields from JSON output.
 *
 * Removes:
 *  - __v  (version key — internal to Mongoose, leaks schema info)
 *  - updatedAt (exact server timestamps — minor info leak)
 *
 * createdAt is kept because the frontend displays it in several places.
 */
function stripInternals(schema) {
  schema.set('toJSON', {
    virtuals: true,
    transform(_doc, ret) {
      delete ret.__v;
      delete ret.updatedAt;
      return ret;
    },
  });

  schema.set('toObject', {
    virtuals: true,
    transform(_doc, ret) {
      delete ret.__v;
      delete ret.updatedAt;
      return ret;
    },
  });
}

module.exports = stripInternals;
