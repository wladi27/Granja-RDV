import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly pool: Pool;

  constructor(private readonly configService: ConfigService) {
    this.pool = new Pool({
      connectionString: this.configService.getOrThrow<string>('DATABASE_URL'),
      host: this.configService.getOrThrow<string>('DB_HOST'),
      port: this.configService.getOrThrow<number>('DB_PORT'),
      database: this.configService.getOrThrow<string>('DB_NAME'),
      user: this.configService.getOrThrow<string>('DB_USER'),
      password: this.configService.getOrThrow<string>('DB_PASSWORD'),
      min: this.configService.getOrThrow<number>('DB_POOL_MIN'),
      max: this.configService.getOrThrow<number>('DB_POOL_MAX'),
      idleTimeoutMillis: this.configService.getOrThrow<number>('DB_IDLE_TIMEOUT_MS'),
      connectionTimeoutMillis: this.configService.getOrThrow<number>('DB_CONN_TIMEOUT_MS'),
      ssl: this.configService.get<boolean>('DB_SSL') ? { rejectUnauthorized: false } : false,
    });
  }

  async onModuleInit() {
    await this.initializeSchema();
    await this.seedDefaults();
  }

  async ping() {
    const result = await this.pool.query<{ now: Date }>('SELECT NOW() as now');
    return {
      ok: true,
      now: result.rows[0]?.now,
      database: this.configService.getOrThrow<string>('DB_NAME'),
    };
  }

  async query<T extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, values);
  }

  async withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async initializeSchema() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS app_config (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL
      );

      CREATE TABLE IF NOT EXISTS commission_levels (
        level INTEGER PRIMARY KEY,
        amount_cop INTEGER NOT NULL CHECK (amount_cop >= 0),
        enabled BOOLEAN NOT NULL DEFAULT TRUE
      );

      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        whatsapp_phone TEXT,
        password_hash TEXT NOT NULL DEFAULT '',
        role TEXT NOT NULL DEFAULT 'customer',
        sponsor_code TEXT,
        referral_code TEXT NOT NULL UNIQUE,
        referred_by_user_id UUID REFERENCES users(id),
        wallet_balance_cop INTEGER NOT NULL DEFAULT 0,
        membership_cut_day INTEGER,
        membership_active_until TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        price_cop INTEGER NOT NULL CHECK (price_cop >= 0),
        stock INTEGER NOT NULL CHECK (stock >= 0)
      );

      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id),
        total_cop INTEGER NOT NULL CHECK (total_cop >= 0),
        delivery_fee_cop INTEGER NOT NULL DEFAULT 0 CHECK (delivery_fee_cop >= 0),
        paid_from_wallet_cop INTEGER NOT NULL DEFAULT 0 CHECK (paid_from_wallet_cop >= 0),
        pending_payment_cop INTEGER NOT NULL DEFAULT 0 CHECK (pending_payment_cop >= 0),
        payment_method TEXT NOT NULL,
        delivery_method TEXT NOT NULL,
        status TEXT NOT NULL,
        address TEXT,
        phone TEXT,
        courier_id UUID REFERENCES users(id),
        delivered_evidence_photo_url TEXT,
        delivered_signature TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        delivered_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS order_items (
        order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id TEXT NOT NULL REFERENCES products(id),
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        unit_price_cop INTEGER NOT NULL CHECK (unit_price_cop >= 0),
        total_price_cop INTEGER NOT NULL CHECK (total_price_cop >= 0),
        PRIMARY KEY (order_id, product_id)
      );

      CREATE TABLE IF NOT EXISTS commissions (
        id UUID PRIMARY KEY,
        order_id UUID NOT NULL REFERENCES orders(id),
        beneficiary_user_id UUID NOT NULL REFERENCES users(id),
        source_user_id UUID NOT NULL REFERENCES users(id),
        level INTEGER NOT NULL,
        amount_cop INTEGER NOT NULL CHECK (amount_cop >= 0),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS withdrawals (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id),
        amount_cop INTEGER NOT NULL CHECK (amount_cop > 0),
        status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
        destination TEXT,
        notes TEXT,
        reviewed_by_user_id UUID REFERENCES users(id),
        reviewed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS user_purchases (
        id BIGSERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id),
        purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS admin_wallet_transactions (
        id UUID PRIMARY KEY,
        source_user_id UUID REFERENCES users(id),
        order_id UUID REFERENCES orders(id),
        type TEXT NOT NULL,
        amount_cop INTEGER NOT NULL,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT NOT NULL DEFAULT '';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'customer';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '[]';
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_received_signature TEXT;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_received_confirmed_at TIMESTAMPTZ;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS route_position INTEGER;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee_cop INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_proof_data_url TEXT;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_proof_status TEXT;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_proof_uploaded_at TIMESTAMPTZ;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_proof_reviewed_at TIMESTAMPTZ;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_proof_reviewed_by_user_id UUID REFERENCES users(id);
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_proof_rejection_reason TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (username) WHERE username IS NOT NULL;
      CREATE INDEX IF NOT EXISTS admin_wallet_transactions_created_at_idx ON admin_wallet_transactions(created_at DESC);
      CREATE INDEX IF NOT EXISTS admin_wallet_transactions_source_user_id_idx ON admin_wallet_transactions(source_user_id);
      CREATE INDEX IF NOT EXISTS orders_courier_route_position_idx ON orders(courier_id, route_position) WHERE route_position IS NOT NULL;
    `);
  }

  private async seedDefaults() {
    const minWithdrawal = this.configService.getOrThrow<number>('MIN_WITHDRAWAL_COP');
    const graceDays = this.configService.getOrThrow<number>('DEFAULT_GRACE_PERIOD_DAYS');
    const maxLevels = this.configService.getOrThrow<number>('MAX_COMMISSION_LEVELS');
    const deliveryCommission = this.configService.getOrThrow<number>('DELIVERY_COMMISSION_PERCENT');

    await this.pool.query(
      `
        INSERT INTO app_config(key, value) VALUES
          ('min_withdrawal_cop', to_jsonb($1::int)),
          ('grace_period_days', to_jsonb($2::int)),
          ('max_commission_levels', to_jsonb($3::int)),
          ('delivery_commission_percent', to_jsonb($4::numeric)),
          ('enabled_payment_methods', to_jsonb($5::text[])),
          ('payment_accounts', $6::jsonb),
          ('delivery_fees_by_municipality', $7::jsonb)
        ON CONFLICT (key) DO NOTHING;
      `,
      [
        minWithdrawal,
        graceDays,
        maxLevels,
        deliveryCommission,
        ['wallet', 'bank_transfer', 'mobile_payment', 'cash'],
        JSON.stringify([]),
        JSON.stringify({ Dosquebradas: 12000, Pereira: 12000, Cuba: 12000 }),
      ],
    );

    await this.pool.query(`
      INSERT INTO commission_levels(level, amount_cop, enabled)
      VALUES (1, 5000, TRUE), (2, 3000, TRUE), (3, 1500, TRUE)
      ON CONFLICT (level) DO NOTHING;
    `);

    await this.pool.query(`
      INSERT INTO products(id, name, price_cop, stock)
      VALUES
        ('p1', 'Carne premium 1kg', 42000, 500),
        ('p2', 'Docena de huevos campesinos', 18000, 1200),
        ('p3', 'Queso fresco 500g', 22000, 700),
        ('p4', 'Chorizo artesanal 1kg', 36000, 450)
      ON CONFLICT (id) DO NOTHING;
    `);

    await this.pool.query(`
      UPDATE users
      SET username = NULL
      WHERE username IS NOT NULL
        AND referral_code IS NOT NULL
        AND username = LOWER(referral_code);
    `);

    await this.pool.query(`
      UPDATE users
      SET permissions = '["*"]'::jsonb
      WHERE role = 'admin'
        AND (
          permissions IS NULL
          OR permissions = '[]'::jsonb
        );
    `);

    const adminEmail = this.configService.getOrThrow<string>('ADMIN_EMAIL').toLowerCase();
    const adminPassword = this.configService.getOrThrow<string>('ADMIN_PASSWORD');
    const adminFullName = this.configService.getOrThrow<string>('ADMIN_FULL_NAME');

    const adminExists = await this.pool.query('SELECT 1 FROM users WHERE email = $1 LIMIT 1', [adminEmail]);
    if (!adminExists.rowCount) {
      const passwordHash = await bcrypt.hash(adminPassword, this.configService.getOrThrow<number>('BCRYPT_SALT_ROUNDS'));
      await this.pool.query(
        `
          INSERT INTO users(
            id, username, full_name, email, password_hash, role, referral_code, wallet_balance_cop,
            permissions, membership_cut_day, membership_active_until
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            'admin',
            $6,
            0,
            $7,
            NULL,
            NULL
          )
        `,
        [randomUUID(), 'admin', adminFullName, adminEmail, passwordHash, 'ADMINGRV', JSON.stringify(['*'])],
      );
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
