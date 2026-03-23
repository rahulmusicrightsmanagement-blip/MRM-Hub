const path = require('path');

// Allowed MIME types and their valid extensions
const ALLOWED_TYPES = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'text/csv': ['.csv'],
};

/**
 * Multer fileFilter that rejects files with disallowed MIME types
 * or mismatched extensions (e.g. .html disguised as application/pdf).
 */
function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ALLOWED_TYPES[file.mimetype];

  if (!allowedExts) {
    return cb(new Error(`File type "${file.mimetype}" is not allowed`));
  }

  if (!allowedExts.includes(ext)) {
    return cb(new Error(`Extension "${ext}" does not match file type "${file.mimetype}"`));
  }

  cb(null, true);
}

module.exports = { fileFilter, ALLOWED_TYPES };
