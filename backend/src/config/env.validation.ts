import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  APP_NAME: Joi.string().default('grv-api'),
  PORT: Joi.number().port().default(3002),
  API_PREFIX: Joi.string().default('api'),
  TIMEZONE: Joi.string().default('America/Bogota'),
  LOG_LEVEL: Joi.string().valid('debug', 'info', 'warn', 'error').default('debug'),

  CORS_ORIGIN: Joi.string().required(),

  DATABASE_URL: Joi.string().uri().required(),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().port().required(),
  DB_NAME: Joi.string().required(),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().allow('').required(),
  DB_SSL: Joi.boolean().truthy('true').falsy('false').default(false),
  DB_POOL_MIN: Joi.number().integer().min(0).default(2),
  DB_POOL_MAX: Joi.number().integer().min(1).default(20),
  DB_IDLE_TIMEOUT_MS: Joi.number().integer().min(1000).default(30000),
  DB_CONN_TIMEOUT_MS: Joi.number().integer().min(1000).default(10000),

  PG_BOSS_SCHEMA: Joi.string().default('pgboss'),
  PG_BOSS_ARCHIVE_COMPLETED_AFTER_SECONDS: Joi.number().integer().min(60).default(86400),
  PG_BOSS_DELETE_AFTER_DAYS: Joi.number().integer().min(1).default(7),
  PG_BOSS_NEW_JOB_CHECK_INTERVAL_SECONDS: Joi.number().integer().min(1).default(2),
  PG_BOSS_COMMISSION_QUEUE: Joi.string().default('commission.process'),
  PG_BOSS_RETRY_LIMIT: Joi.number().integer().min(0).default(5),
  PG_BOSS_RETRY_DELAY_SECONDS: Joi.number().integer().min(1).default(30),

  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_TTL: Joi.string().default('60m'),
  JWT_REFRESH_TTL: Joi.string().default('30d'),
  DELIVERY_CONFIRMATION_TTL: Joi.string().default('12h'),
  BCRYPT_SALT_ROUNDS: Joi.number().integer().min(8).max(15).default(12),
  ADMIN_FULL_NAME: Joi.string().default('Administrador GRV'),
  ADMIN_EMAIL: Joi.string().email().default('admin@grv.local'),
  ADMIN_PASSWORD: Joi.string().min(8).default('Admin12345!'),

  MIN_WITHDRAWAL_COP: Joi.number().integer().min(0).default(50000),
  DEFAULT_GRACE_PERIOD_DAYS: Joi.number().integer().min(0).max(30).default(3),
  MAX_COMMISSION_LEVELS: Joi.number().integer().min(1).max(20).default(10),
  DELIVERY_COMMISSION_PERCENT: Joi.number().min(0).max(100).default(0),

  CACHE_TTL_SECONDS: Joi.number().integer().min(1).default(300),
  CACHE_CHECK_PERIOD_SECONDS: Joi.number().integer().min(1).default(60),
  WS_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),

  UPLOAD_DIR: Joi.string().default('uploads'),
  MAX_UPLOAD_SIZE_MB: Joi.number().integer().min(1).default(10),
});
