import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import documentRoutes from './routes/documents.js';
import uploadRoutes from './routes/uploads.js';
import { notFoundHandler, errorHandler } from './middleware/errors.js';

const allowedOrigins = config.clientOrigin
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

/** Builds the Express app around a libSQL client. Tests pass their own database. */
export function createApp({ db }) {
  const app = express();
  app.locals.db = db;
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        // Non-browser clients send no Origin header; browsers are restricted to the allowlist.
        callback(null, !origin || allowedOrigins.includes(origin));
      },
      allowedHeaders: ['Content-Type', 'Authorization'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    }),
  );
  if (config.env !== 'test') app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));
  app.use(express.json({ limit: '1.5mb' }));

  app.get('/api/health', async (req, res) => {
    try {
      await req.app.locals.db.execute('SELECT 1');
      res.json({ status: 'ok', database: 'ok', time: new Date().toISOString() });
    } catch {
      res.status(503).json({ status: 'error', database: 'unavailable' });
    }
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/documents', documentRoutes);
  app.use('/api/uploads', uploadRoutes);

  app.use('/api', notFoundHandler);
  app.use(errorHandler);
  return app;
}
