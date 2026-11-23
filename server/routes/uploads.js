import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../middleware/errors.js';
import { config } from '../config.js';
import { isAcceptedUpload, extractDocument } from '../services/importer.js';
import { insertDocument, getDocumentWithRole, toDetail } from '../services/documents.js';

const router = Router();

// Memory storage: uploaded bytes never touch the disk and are never executed.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes, files: 1, fields: 0 },
  fileFilter(req, file, cb) {
    if (!isAcceptedUpload(file.originalname, file.mimetype)) {
      return cb(new AppError(415, 'Unsupported file type. Allowed: .txt, .md, .docx'));
    }
    cb(null, true);
  },
});

function handleMulter(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof AppError) return next(err);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError(413, 'File is too large. The limit is 2 MB.'));
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return next(new AppError(400, 'Send exactly one file in the "file" field'));
    }
    return next(new AppError(400, 'Invalid upload'));
  });
}

router.post('/', authenticate, handleMulter, async (req, res, next) => {
  try {
    if (!req.file) throw new AppError(400, 'No file was uploaded');

    const { title, content } = await extractDocument({
      originalname: req.file.originalname,
      buffer: req.file.buffer,
    });

    const db = req.app.locals.db;
    const id = randomUUID();
    await insertDocument(db, { id, ownerId: req.user.id, title, content });
    const found = await getDocumentWithRole(db, id, req.user.id);
    res.status(201).json({ document: toDetail(found.document, found.role) });
  } catch (err) {
    next(err);
  }
});

export default router;
