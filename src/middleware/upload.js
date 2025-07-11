const { put } = require('@vercel/blob');
const Busboy = require('busboy');

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Supported mimetypes
const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/jpg',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'application/rtf',
]);

const handleUpload = (req, fieldsToAccept, multiple = false) =>
  new Promise((resolve, reject) => {
    const busboy = new Busboy({ headers: req.headers, limits: { fileSize: MAX_FILE_SIZE } });
    const uploadedFiles = {};
    const nonFileFields = {};

    busboy.on('file', async (fieldname, file, filename, encoding, mimetype) => {
      try {
        if (!allowedMimeTypes.has(mimetype)) {
          return reject(new Error(`Unsupported file format: ${mimetype}`));
        }

        const blobName = `${fieldname}-${Date.now()}-${Math.round(Math.random() * 1e9)}-${filename}`;
        const { url } = await put(blobName, file, {
          access: 'public',
        });

        if (multiple) {
          if (!uploadedFiles[fieldname]) uploadedFiles[fieldname] = [];
          uploadedFiles[fieldname].push({ filename, mimetype, url });
        } else {
          uploadedFiles[fieldname] = { filename, mimetype, url };
        }
      } catch (err) {
        reject(err);
      }
    });

    busboy.on('field', (fieldname, val) => {
      nonFileFields[fieldname] = val;
    });

    busboy.on('error', reject);

    busboy.on('finish', () => {
      req.body = nonFileFields;
      req.files = uploadedFiles;
      resolve();
    });

    req.pipe(busboy);
  });

module.exports = {
  uploadSingle: (fieldName) => async (req, res, next) => {
    try {
      await handleUpload(req, [fieldName], false);
      next();
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  uploadMultiple: (fieldName, maxCount) => async (req, res, next) => {
    try {
      await handleUpload(req, [fieldName], true);
      if (req.files[fieldName]?.length > maxCount) {
        return res.status(400).json({ error: `Maximum of ${maxCount} files allowed for ${fieldName}` });
      }
      next();
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  uploadFields: (fields) => async (req, res, next) => {
    try {
      const fieldNames = fields.map((f) => f.name);
      await handleUpload(req, fieldNames, true);

      for (const field of fields) {
        const uploaded = req.files[field.name] || [];
        if (uploaded.length > field.maxCount) {
          return res.status(400).json({ error: `Maximum of ${field.maxCount} files allowed for ${field.name}` });
        }
      }

      next();
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
};
