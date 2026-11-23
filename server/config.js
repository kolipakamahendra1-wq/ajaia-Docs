import 'dotenv/config';

const env = process.env;

export const config = {
  env: env.NODE_ENV || 'development',
  port: Number(env.PORT) || 8080,
  databaseUrl: env.DATABASE_URL || 'file:./data/ajaia.db',
  databaseAuthToken: env.DATABASE_AUTH_TOKEN || undefined,
  jwtSecret: env.JWT_SECRET || '',
  jwtExpiresIn: env.JWT_EXPIRES_IN || '7d',
  clientOrigin: env.CLIENT_ORIGIN || 'http://localhost:5173',
  demoPassword: env.DEMO_PASSWORD || 'ajaia-demo-123',
  maxUploadBytes: 2 * 1024 * 1024,
};

export function assertConfig() {
  if (!config.jwtSecret || config.jwtSecret.length < 16) {
    throw new Error('JWT_SECRET must be set to at least 16 characters (see server/.env.example).');
  }
}
