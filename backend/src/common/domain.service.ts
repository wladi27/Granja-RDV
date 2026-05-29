import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { PoolClient } from 'pg';
import {
  AdminPermission,
  Commission,
  CommissionLevelConfig,
  DeliveryFeesByMunicipality,
  DeliveryMethod,
  Order,
  OrderItem,
  OrderStatus,
  PaymentAccountConfig,
  PaymentMethod,
  Product,
  SystemConfig,
  User,
  UserRole,
  WithdrawalStatus,
} from '../domain/models';
import { DatabaseService } from '../infrastructure/database/database.service';

interface CreateOrderInput {
  userId: string;
  paymentMethod: PaymentMethod;
  deliveryMethod: DeliveryMethod;
  deliveryFeeCop?: number;
  address?: string;
  phone?: string;
  useWallet: boolean;
  paymentProofDataUrl?: string;
  items: Array<{ productId: string; quantity: number }>;
}

interface ReviewWithdrawalInput {
  withdrawalId: string;
  adminUserId: string;
  decision: 'approved' | 'rejected';
  notes?: string;
}

interface UpdateUserProfileInput {
  userId: string;
  username?: string;
  fullName?: string;
  email?: string;
  whatsappPhone?: string;
  currentPassword?: string;
  newPassword?: string;
}

interface AdminUserInput {
  fullName: string;
  username: string;
  email: string;
  password: string;
  permissions: AdminPermission[];
}

interface UpdateAdminUserInput {
  adminUserId: string;
  fullName?: string;
  username?: string;
  email?: string;
  password?: string;
  permissions?: AdminPermission[];
}

interface CourierUserInput {
  fullName: string;
  username: string;
  email: string;
  whatsappPhone?: string;
  password: string;
}

interface UpdateCourierUserInput {
  courierUserId: string;
  fullName?: string;
  username?: string;
  email?: string;
  whatsappPhone?: string;
  password?: string;
}

interface DeliveryConfirmationTokenPayload extends jwt.JwtPayload {
  purpose: 'delivery_confirmation';
  orderId: string;
  deliveryCode: string;
}

@Injectable()
export class DomainService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
  ) {}

  private isUuidV4(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  async getConfig(): Promise<SystemConfig> {
    const [configMap, commissionLevels] = await Promise.all([
      this.getConfigMap(),
      this.getCommissionLevels(),
    ]);

    return {
      commissionLevels,
      gracePeriodDays: Number(configMap.get('grace_period_days') ?? 3),
      minWithdrawalCop: Number(configMap.get('min_withdrawal_cop') ?? 50000),
      deliveryCommissionPercent: Number(configMap.get('delivery_commission_percent') ?? 0),
      maxCommissionLevels: Number(configMap.get('max_commission_levels') ?? 10),
      enabledPaymentMethods: this.normalizeEnabledPaymentMethods(configMap.get('enabled_payment_methods')),
      paymentAccounts: this.normalizePaymentAccounts(configMap.get('payment_accounts')),
      deliveryFeesByMunicipality: this.normalizeDeliveryFeesByMunicipality(configMap.get('delivery_fees_by_municipality')),
    };
  }

  async updateConfig(patch: Partial<SystemConfig>): Promise<SystemConfig> {
    return this.databaseService.withTransaction(async (client) => {
      const current = await this.getConfigUsingClient(client);
      const next: SystemConfig = {
        ...current,
        ...patch,
        commissionLevels: patch.commissionLevels ?? current.commissionLevels,
        paymentAccounts: patch.paymentAccounts ?? current.paymentAccounts,
      };

      if (next.gracePeriodDays < 0 || next.gracePeriodDays > 30) {
        throw new BadRequestException('gracePeriodDays must be between 0 and 30');
      }

      const normalizedEnabledPaymentMethods = this.normalizeEnabledPaymentMethods(next.enabledPaymentMethods, false);
      if (normalizedEnabledPaymentMethods.length === 0) {
        throw new BadRequestException('At least one payment method must be enabled');
      }

      const normalizedPaymentAccounts = this.normalizePaymentAccounts(next.paymentAccounts, false);
      const normalizedPaymentAccountsForEnabledMethods = normalizedPaymentAccounts.filter((account) =>
        normalizedEnabledPaymentMethods.includes(account.method),
      );
      const normalizedDeliveryFeesByMunicipality = this.normalizeDeliveryFeesByMunicipality(next.deliveryFeesByMunicipality);

      await this.upsertConfigValue(client, 'grace_period_days', next.gracePeriodDays);
      await this.upsertConfigValue(client, 'min_withdrawal_cop', next.minWithdrawalCop);
      await this.upsertConfigValue(client, 'delivery_commission_percent', next.deliveryCommissionPercent);
      await this.upsertConfigValue(client, 'max_commission_levels', next.maxCommissionLevels);
      await this.upsertConfigValue(client, 'enabled_payment_methods', normalizedEnabledPaymentMethods);
      await this.upsertConfigValue(client, 'payment_accounts', normalizedPaymentAccountsForEnabledMethods);
      await this.upsertConfigValue(client, 'delivery_fees_by_municipality', normalizedDeliveryFeesByMunicipality);

      if (patch.commissionLevels) {
        const levels = patch.commissionLevels
          .map((x) => ({ ...x }))
          .sort((a, b) => a.level - b.level)
          .slice(0, next.maxCommissionLevels);

        await client.query('DELETE FROM commission_levels');
        for (const level of levels) {
          await client.query(
            'INSERT INTO commission_levels(level, amount_cop, enabled) VALUES($1, $2, $3)',
            [level.level, level.amountCop, level.enabled],
          );
        }
      }

      return this.getConfigUsingClient(client);
    });
  }

  async getAdminUsers() {
    const result = await this.databaseService.query<{
      id: string;
      username: string | null;
      full_name: string;
      email: string;
      permissions: unknown | null;
      created_at: string;
    }>(
      `
        SELECT id, username, full_name, email, permissions, created_at
        FROM users
        WHERE role = 'admin'
        ORDER BY created_at DESC, full_name ASC
      `,
    );

    return result.rows.map((row) => ({
      id: row.id,
      username: row.username,
      fullName: row.full_name,
      email: row.email,
      permissions: this.normalizePermissions(row.permissions),
      createdAt: row.created_at,
    }));
  }

  async createAdminUser(input: AdminUserInput) {
    const normalizedEmail = input.email.trim().toLowerCase();
    const username = this.normalizeUsername(input.username);
    const permissions = this.normalizePermissions(input.permissions);

    if (!username) {
      throw new BadRequestException('username is required');
    }

    if (!input.password || input.password.length < 8) {
      throw new BadRequestException('Password must have at least 8 characters');
    }

    if (permissions.length === 0) {
      throw new BadRequestException('permissions are required');
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    return this.databaseService.withTransaction(async (client) => {
      const emailCheck = await client.query('SELECT 1 FROM users WHERE email = $1 LIMIT 1', [normalizedEmail]);
      if (emailCheck.rowCount) {
        throw new BadRequestException('Email already registered');
      }

      const usernameCheck = await client.query('SELECT 1 FROM users WHERE username = $1 LIMIT 1', [username]);
      if (usernameCheck.rowCount) {
        throw new BadRequestException('Username already registered');
      }

      const id = randomUUID();
      const referralCode = await this.generateUniqueReferralCode();

      await client.query(
        `
          INSERT INTO users(
            id, username, full_name, email, whatsapp_phone, password_hash, role, referral_code,
            wallet_balance_cop, permissions, membership_cut_day, membership_active_until
          )
          VALUES($1,$2,$3,$4,$5,$6,'admin',$7,0,$8,NULL,NULL)
        `,
        [id, username, input.fullName.trim(), normalizedEmail, null, passwordHash, referralCode, JSON.stringify(permissions)],
      );

      return {
        id,
        username,
        fullName: input.fullName.trim(),
        email: normalizedEmail,
        permissions,
        role: 'admin' as UserRole,
        referralCode,
      };
    });
  }

  async updateAdminUser(input: UpdateAdminUserInput) {
    if (!this.isUuidV4(input.adminUserId)) {
      throw new BadRequestException('Invalid adminUserId');
    }

    const nextPermissions = input.permissions ? this.normalizePermissions(input.permissions) : undefined;

    return this.databaseService.withTransaction(async (client) => {
      const current = await client.query<{ id: string; role: UserRole }>('SELECT id, role FROM users WHERE id = $1 FOR UPDATE', [input.adminUserId]);
      const currentUser = current.rows[0];
      if (!currentUser) {
        throw new NotFoundException('User not found');
      }

      if (currentUser.role !== 'admin') {
        throw new BadRequestException('User is not an admin');
      }

      const updates: string[] = [];
      const values: unknown[] = [];

      if (input.fullName !== undefined) {
        values.push(input.fullName.trim());
        updates.push(`full_name = $${values.length}`);
      }

      if (input.username !== undefined) {
        const username = this.normalizeUsername(input.username);
        if (!username) {
          throw new BadRequestException('username is required');
        }
        const usernameCheck = await client.query('SELECT 1 FROM users WHERE username = $1 AND id <> $2 LIMIT 1', [username, input.adminUserId]);
        if (usernameCheck.rowCount) {
          throw new BadRequestException('Username already registered');
        }
        values.push(username);
        updates.push(`username = $${values.length}`);
      }

      if (input.email !== undefined) {
        const email = input.email.trim().toLowerCase();
        const emailCheck = await client.query('SELECT 1 FROM users WHERE email = $1 AND id <> $2 LIMIT 1', [email, input.adminUserId]);
        if (emailCheck.rowCount) {
          throw new BadRequestException('Email already registered');
        }
        values.push(email);
        updates.push(`email = $${values.length}`);
      }

      if (input.password !== undefined) {
        if (input.password.length < 8) {
          throw new BadRequestException('Password must have at least 8 characters');
        }
        values.push(await bcrypt.hash(input.password, 12));
        updates.push(`password_hash = $${values.length}`);
      }

      if (nextPermissions) {
        values.push(JSON.stringify(nextPermissions));
        updates.push(`permissions = $${values.length}::jsonb`);
      }

      if (updates.length > 0) {
        values.push(input.adminUserId);
        await client.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${values.length}`, values);
      }

      const refreshed = await client.query<{
        id: string;
        username: string | null;
        full_name: string;
        email: string;
        permissions: unknown;
        created_at: string;
      }>('SELECT id, username, full_name, email, permissions, created_at FROM users WHERE id = $1 LIMIT 1', [input.adminUserId]);

      const row = refreshed.rows[0];
      return {
        id: row.id,
        username: row.username,
        fullName: row.full_name,
        email: row.email,
        permissions: this.normalizePermissions(row.permissions),
        createdAt: row.created_at,
      };
    });
  }

  async getCourierUsers() {
    const result = await this.databaseService.query<{
      id: string;
      username: string | null;
      full_name: string;
      email: string;
      whatsapp_phone: string | null;
      created_at: string;
    }>(
      `
        SELECT id, username, full_name, email, whatsapp_phone, created_at
        FROM users
        WHERE role = 'courier'
        ORDER BY created_at DESC, full_name ASC
      `,
    );

    return result.rows.map((row) => ({
      id: row.id,
      username: row.username,
      fullName: row.full_name,
      email: row.email,
      whatsappPhone: row.whatsapp_phone,
      createdAt: row.created_at,
    }));
  }

  async createCourierUser(input: CourierUserInput) {
    const fullName = input.fullName.trim();
    const normalizedEmail = input.email.trim().toLowerCase();
    const username = this.normalizeUsername(input.username);
    const whatsappPhone = this.normalizeWhatsappPhone(input.whatsappPhone, true);

    if (fullName.length < 2) {
      throw new BadRequestException('El nombre debe tener al menos 2 caracteres');
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw new BadRequestException('El correo electrónico no es válido');
    }

    if (!username) {
      throw new BadRequestException('username is required');
    }

    if (!input.password || input.password.length < 8) {
      throw new BadRequestException('Password must have at least 8 characters');
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    return this.databaseService.withTransaction(async (client) => {
      const emailCheck = await client.query('SELECT 1 FROM users WHERE email = $1 LIMIT 1', [normalizedEmail]);
      if (emailCheck.rowCount) {
        throw new BadRequestException('Email already registered');
      }

      const usernameCheck = await client.query('SELECT 1 FROM users WHERE username = $1 LIMIT 1', [username]);
      if (usernameCheck.rowCount) {
        throw new BadRequestException('Username already registered');
      }

      const id = randomUUID();
      const referralCode = await this.generateUniqueReferralCode();

      await client.query(
        `
          INSERT INTO users(
            id, username, full_name, email, whatsapp_phone, password_hash, role, referral_code,
            wallet_balance_cop, permissions, membership_cut_day, membership_active_until
          )
          VALUES($1,$2,$3,$4,$5,$6,'courier',$7,0,$8,NULL,NULL)
        `,
        [id, username, fullName, normalizedEmail, whatsappPhone ?? null, passwordHash, referralCode, JSON.stringify([])],
      );

      return {
        id,
        username,
        fullName,
        email: normalizedEmail,
        whatsappPhone: whatsappPhone ?? null,
        role: 'courier' as UserRole,
        referralCode,
      };
    });
  }

  async updateCourierUser(input: UpdateCourierUserInput) {
    if (!this.isUuidV4(input.courierUserId)) {
      throw new BadRequestException('Invalid courierUserId');
    }

    const hasWhatsappPhoneChange = Object.prototype.hasOwnProperty.call(input, 'whatsappPhone');
    const nextWhatsappPhone = this.normalizeWhatsappPhone(input.whatsappPhone, hasWhatsappPhoneChange);

    return this.databaseService.withTransaction(async (client) => {
      const current = await client.query<{ id: string; role: UserRole }>('SELECT id, role FROM users WHERE id = $1 FOR UPDATE', [input.courierUserId]);
      const currentUser = current.rows[0];
      if (!currentUser) {
        throw new NotFoundException('User not found');
      }

      if (currentUser.role !== 'courier') {
        throw new BadRequestException('User is not a courier');
      }

      const updates: string[] = [];
      const values: unknown[] = [];

      if (input.fullName !== undefined) {
        const fullName = input.fullName.trim();
        if (fullName.length < 2) {
          throw new BadRequestException('El nombre debe tener al menos 2 caracteres');
        }
        values.push(fullName);
        updates.push(`full_name = $${values.length}`);
      }

      if (input.username !== undefined) {
        const username = this.normalizeUsername(input.username);
        if (!username) {
          throw new BadRequestException('username is required');
        }
        const usernameCheck = await client.query('SELECT 1 FROM users WHERE username = $1 AND id <> $2 LIMIT 1', [username, input.courierUserId]);
        if (usernameCheck.rowCount) {
          throw new BadRequestException('Username already registered');
        }
        values.push(username);
        updates.push(`username = $${values.length}`);
      }

      if (input.email !== undefined) {
        const email = input.email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          throw new BadRequestException('El correo electrónico no es válido');
        }
        const emailCheck = await client.query('SELECT 1 FROM users WHERE email = $1 AND id <> $2 LIMIT 1', [email, input.courierUserId]);
        if (emailCheck.rowCount) {
          throw new BadRequestException('Email already registered');
        }
        values.push(email);
        updates.push(`email = $${values.length}`);
      }

      if (input.password !== undefined) {
        if (input.password.length < 8) {
          throw new BadRequestException('Password must have at least 8 characters');
        }
        values.push(await bcrypt.hash(input.password, 12));
        updates.push(`password_hash = $${values.length}`);
      }

      if (hasWhatsappPhoneChange) {
        values.push(nextWhatsappPhone ?? null);
        updates.push(`whatsapp_phone = $${values.length}`);
      }

      if (updates.length > 0) {
        values.push(input.courierUserId);
        await client.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${values.length}`, values);
      }

      const refreshed = await client.query<{
        id: string;
        username: string | null;
        full_name: string;
        email: string;
        whatsapp_phone: string | null;
        created_at: string;
      }>(
        'SELECT id, username, full_name, email, whatsapp_phone, created_at FROM users WHERE id = $1 LIMIT 1',
        [input.courierUserId],
      );

      const row = refreshed.rows[0];
      return {
        id: row.id,
        username: row.username,
        fullName: row.full_name,
        email: row.email,
        whatsappPhone: row.whatsapp_phone,
        createdAt: row.created_at,
      };
    });
  }

  async registerUser(input: {
    fullName: string;
    username: string;
    email: string;
    passwordHash: string;
    sponsorCode?: string;
    role?: UserRole;
  }): Promise<User> {
    const normalizedEmail = input.email.toLowerCase();
    const username = await this.resolveUsername(input.username);
    const emailCheck = await this.databaseService.query<{ exists: number }>(
      'SELECT 1 as exists FROM users WHERE email = $1 LIMIT 1',
      [normalizedEmail],
    );
    if (emailCheck.rowCount) {
      throw new BadRequestException('Email already registered');
    }

    let referredByUserId: string | undefined;
    if (input.sponsorCode) {
      const sponsorRes = await this.databaseService.query<{ id: string }>(
        'SELECT id FROM users WHERE referral_code = $1 LIMIT 1',
        [input.sponsorCode],
      );
      if (!sponsorRes.rowCount) {
        throw new BadRequestException('Invalid sponsor code');
      }
      referredByUserId = sponsorRes.rows[0]?.id;
    }

    const id = randomUUID();
    const referralCode = await this.generateUniqueReferralCode();
    await this.databaseService.query(
      `
        INSERT INTO users(
          id, username, full_name, email, whatsapp_phone, password_hash, role, sponsor_code, referral_code, referred_by_user_id,
          wallet_balance_cop, membership_cut_day, membership_active_until
        )
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      `,
      [
        id,
        username,
        input.fullName,
        normalizedEmail,
        null,
        input.passwordHash,
        input.role ?? 'customer',
        input.sponsorCode,
        referralCode,
        referredByUserId ?? null,
        0,
        null,
        null,
      ],
    );

    return {
      id,
      username,
      fullName: input.fullName,
      email: normalizedEmail,
      whatsappPhone: null,
      role: input.role ?? 'customer',
      permissions: [],
      sponsorCode: input.sponsorCode,
      referralCode,
      referredByUserId,
      walletBalanceCop: 0,
      purchases: [],
    };
  }

  async getProducts(): Promise<Product[]> {
    const result = await this.databaseService.query<{
      id: string;
      name: string;
      price_cop: number;
      stock: number;
    }>('SELECT id, name, price_cop, stock FROM products ORDER BY name ASC');
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      priceCop: row.price_cop,
      stock: row.stock,
    }));
  }

  async getProductsPage(page = 1, pageSize = 24, search?: string) {
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(Math.max(pageSize, 1), 100);
    const offset = (safePage - 1) * safePageSize;
    const normalizedSearch = search?.trim() ?? '';
    const searchPattern = normalizedSearch ? `%${normalizedSearch}%` : null;

    const [totalRes, itemsRes] = await Promise.all([
      this.databaseService.query<{ total: string }>(
        `
          SELECT COUNT(*)::text AS total
          FROM products
          WHERE ($1::text IS NULL OR name ILIKE $1)
        `,
        [searchPattern],
      ),
      this.databaseService.query<{
        id: string;
        name: string;
        price_cop: number;
        stock: number;
      }>(
        `
          SELECT id, name, price_cop, stock
          FROM products
          WHERE ($1::text IS NULL OR name ILIKE $1)
          ORDER BY name ASC, id ASC
          LIMIT $2
          OFFSET $3
        `,
        [searchPattern, safePageSize, offset],
      ),
    ]);

    return {
      page: safePage,
      pageSize: safePageSize,
      total: Number(totalRes.rows[0]?.total ?? '0'),
      products: itemsRes.rows.map((row) => ({
        id: row.id,
        name: row.name,
        priceCop: row.price_cop,
        stock: row.stock,
      })),
    };
  }

  async createProduct(input: { name: string; priceCop: number; stock: number; id?: string }): Promise<Product> {
    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException('Product name is required');
    }
    if (input.priceCop < 0) {
      throw new BadRequestException('priceCop must be >= 0');
    }
    if (input.stock < 0) {
      throw new BadRequestException('stock must be >= 0');
    }

    const id = input.id?.trim() || randomUUID();
    await this.databaseService.query(
      'INSERT INTO products(id, name, price_cop, stock) VALUES($1, $2, $3, $4)',
      [id, name, Math.trunc(input.priceCop), Math.trunc(input.stock)],
    );

    return {
      id,
      name,
      priceCop: Math.trunc(input.priceCop),
      stock: Math.trunc(input.stock),
    };
  }

  async updateProduct(productId: string, patch: { name?: string; priceCop?: number; stock?: number }): Promise<Product> {
    const current = await this.databaseService.query<{
      id: string;
      name: string;
      price_cop: number;
      stock: number;
    }>('SELECT id, name, price_cop, stock FROM products WHERE id = $1 LIMIT 1', [productId]);

    const row = current.rows[0];
    if (!row) {
      throw new NotFoundException('Product not found');
    }

    const nextName = patch.name !== undefined ? patch.name.trim() : row.name;
    const nextPrice = patch.priceCop !== undefined ? Math.trunc(patch.priceCop) : row.price_cop;
    const nextStock = patch.stock !== undefined ? Math.trunc(patch.stock) : row.stock;

    if (!nextName) {
      throw new BadRequestException('Product name is required');
    }
    if (nextPrice < 0) {
      throw new BadRequestException('priceCop must be >= 0');
    }
    if (nextStock < 0) {
      throw new BadRequestException('stock must be >= 0');
    }

    await this.databaseService.query(
      'UPDATE products SET name = $1, price_cop = $2, stock = $3 WHERE id = $4',
      [nextName, nextPrice, nextStock, productId],
    );

    return {
      id: row.id,
      name: nextName,
      priceCop: nextPrice,
      stock: nextStock,
    };
  }

  async adjustProductStock(productId: string, delta: number): Promise<Product> {
    const roundedDelta = Math.trunc(delta);
    if (roundedDelta === 0) {
      throw new BadRequestException('delta must be different from 0');
    }

    const update = await this.databaseService.query<{
      id: string;
      name: string;
      price_cop: number;
      stock: number;
    }>(
      `
        UPDATE products
        SET stock = stock + $1
        WHERE id = $2
          AND stock + $1 >= 0
        RETURNING id, name, price_cop, stock
      `,
      [roundedDelta, productId],
    );

    const row = update.rows[0];
    if (!row) {
      const exists = await this.databaseService.query<{ id: string }>('SELECT id FROM products WHERE id = $1 LIMIT 1', [productId]);
      if (!exists.rowCount) {
        throw new NotFoundException('Product not found');
      }
      throw new BadRequestException('Stock cannot be negative');
    }

    return {
      id: row.id,
      name: row.name,
      priceCop: row.price_cop,
      stock: row.stock,
    };
  }

  async deleteProduct(productId: string): Promise<{ deleted: boolean }> {
    const inOrders = await this.databaseService.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM order_items WHERE product_id = $1',
      [productId],
    );
    if (Number(inOrders.rows[0]?.count ?? '0') > 0) {
      throw new BadRequestException('Product cannot be deleted because it has order history');
    }

    const deleted = await this.databaseService.query('DELETE FROM products WHERE id = $1', [productId]);
    if (!deleted.rowCount) {
      throw new NotFoundException('Product not found');
    }

    return { deleted: true };
  }

  async getDashboard(userId: string) {
    const [user, config, referralsRes, commissionsRes, ordersRes] = await Promise.all([
      this.getUserById(userId),
      this.getConfig(),
      this.databaseService.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM users WHERE referred_by_user_id = $1', [userId]),
      this.databaseService.query<{
        id: string;
        order_id: string;
        level: number;
        amount_cop: number;
        created_at: string;
      }>(
        `
          SELECT id, order_id, level, amount_cop, created_at
          FROM commissions
          WHERE beneficiary_user_id = $1
          ORDER BY created_at DESC
          LIMIT 50
        `,
        [userId],
      ),
      this.databaseService.query<{
        id: string;
        status: string;
        total_cop: number;
        delivery_method: string;
        created_at: string;
      }>(
        `
          SELECT id, status, total_cop, delivery_method, created_at
          FROM orders
          WHERE user_id = $1
          ORDER BY created_at DESC
          LIMIT 10
        `,
        [userId],
      ),
    ]);

    const membership = this.getMembershipSnapshot(user, config.gracePeriodDays);

    return {
      user,
      membership,
      directReferralsCount: Number(referralsRes.rows[0]?.count ?? '0'),
      walletBalanceCop: user.walletBalanceCop,
      commissions: commissionsRes.rows.map((row) => ({
        id: row.id,
        orderId: row.order_id,
        beneficiaryUserId: userId,
        sourceUserId: userId,
        level: row.level,
        amountCop: row.amount_cop,
        createdAt: row.created_at,
      })),
      recentOrders: ordersRes.rows.map((row) => ({
        id: row.id,
        userId,
        items: [],
        totalCop: row.total_cop,
        paidFromWalletCop: 0,
        pendingPaymentCop: 0,
        paymentMethod: 'wallet',
        deliveryMethod: row.delivery_method as DeliveryMethod,
        status: row.status as OrderStatus,
        createdAt: row.created_at,
      })),
    };
  }

  async getUserOrdersPage(userId: string, page = 1, pageSize = 20) {
    if (!this.isUuidV4(userId)) {
      throw new BadRequestException('Invalid userId');
    }

    const safePage = Math.max(1, page);
    const safePageSize = Math.min(Math.max(pageSize, 1), 100);
    const offset = (safePage - 1) * safePageSize;

    await this.getUserById(userId);

    const [totalRes, ordersRes] = await Promise.all([
      this.databaseService.query<{ total: string }>('SELECT COUNT(*)::text AS total FROM orders WHERE user_id = $1', [userId]),
      this.databaseService.query<{
        id: string;
        status: OrderStatus;
        total_cop: number;
        paid_from_wallet_cop: number;
        pending_payment_cop: number;
        payment_method: PaymentMethod;
        delivery_method: DeliveryMethod;
        address: string | null;
        phone: string | null;
        delivered_at: string | null;
        delivered_signature: string | null;
        customer_received_confirmed_at: string | null;
        created_at: string;
      }>(
        `
          SELECT
            id,
            status,
            total_cop,
            paid_from_wallet_cop,
            pending_payment_cop,
            payment_method,
            delivery_method,
            address,
            phone,
            delivered_at,
            delivered_signature,
            customer_received_confirmed_at,
            created_at
          FROM orders
          WHERE user_id = $1
          ORDER BY created_at DESC, id DESC
          LIMIT $2
          OFFSET $3
        `,
        [userId, safePageSize, offset],
      ),
    ]);

    return {
      page: safePage,
      pageSize: safePageSize,
      total: Number(totalRes.rows[0]?.total ?? '0'),
      orders: ordersRes.rows.map((row) => ({
        id: row.id,
        status: row.status,
        totalCop: row.total_cop,
        paidFromWalletCop: row.paid_from_wallet_cop,
        pendingPaymentCop: row.pending_payment_cop,
        paymentMethod: row.payment_method,
        deliveryMethod: row.delivery_method,
        address: row.address,
        phone: row.phone,
        deliveredAt: row.delivered_at,
        courierDeliveryConfirmed: Boolean(row.delivered_signature && row.delivered_at),
        customerReceivedConfirmedAt: row.customer_received_confirmed_at,
        createdAt: row.created_at,
      })),
    };
  }

  async confirmCustomerReceipt(input: { orderId: string }): Promise<Order> {

    return this.databaseService.withTransaction(async (client) => {
      const order = await this.findOrderUsingClient(input.orderId, client, true);

      if (order.deliveryMethod !== 'home_delivery') {
        throw new BadRequestException('Solo aplica para órdenes con domicilio');
      }

      if (order.status !== 'delivered') {
        throw new BadRequestException('Solo puedes confirmar una orden entregada');
      }

      if (!order.deliveredSignature || !order.deliveredEvidencePhotoUrl) {
        throw new BadRequestException('La orden aún no tiene respaldo de entrega del repartidor');
      }

      if (order.customerReceivedConfirmedAt) {
        throw new BadRequestException('La recepción de esta orden ya fue confirmada');
      }

      await client.query(
        `
          UPDATE orders
          SET customer_received_signature = $1,
              customer_received_confirmed_at = NOW()
          WHERE id = $2
        `,
        ['confirmado_en_app', input.orderId],
      );

      return this.findOrderUsingClient(input.orderId, client);
    });
  }

  async getWalletSummary(userId: string) {
    if (!this.isUuidV4(userId)) {
      throw new BadRequestException('Invalid userId');
    }

    const [user, config, pendingRes] = await Promise.all([
      this.getUserById(userId),
      this.getConfig(),
      this.databaseService.query<{ total: string }>(
        `
          SELECT COALESCE(SUM(amount_cop), 0)::text AS total
          FROM withdrawals
          WHERE user_id = $1 AND status = 'pending'
        `,
        [userId],
      ),
    ]);

    return {
      walletBalanceCop: user.walletBalanceCop,
      pendingWithdrawalsCop: Number(pendingRes.rows[0]?.total ?? '0'),
      minWithdrawalCop: config.minWithdrawalCop,
    };
  }

  async getWalletMovements(userId: string, page = 1, pageSize = 20) {
    if (!this.isUuidV4(userId)) {
      throw new BadRequestException('Invalid userId');
    }

    const safePage = Math.max(1, page);
    const safePageSize = Math.min(Math.max(pageSize, 1), 100);
    const offset = (safePage - 1) * safePageSize;

    await this.getUserById(userId);

    const [totalRes, movementsRes] = await Promise.all([
      this.databaseService.query<{ total: string }>(
        `
          WITH movements AS (
            SELECT
              c.created_at AS created_at
            FROM commissions c
            WHERE c.beneficiary_user_id = $1

            UNION ALL

            SELECT
              w.created_at AS created_at
            FROM withdrawals w
            WHERE w.user_id = $1

            UNION ALL

            SELECT
              o.created_at AS created_at
            FROM orders o
            WHERE o.user_id = $1
              AND o.paid_from_wallet_cop > 0
          )
          SELECT COUNT(*)::text AS total
          FROM movements
        `,
        [userId],
      ),
      this.databaseService.query<{
        id: string;
        type: 'commission' | 'withdrawal' | 'order_payment';
        label: string;
        amount_cop: number;
        status: string;
        date: string;
      }>(
        `
          WITH movements AS (
            SELECT
              CONCAT('commission-', c.id) AS id,
              'commission'::text AS type,
              CONCAT('Comisión generación ', c.level) AS label,
              c.amount_cop AS amount_cop,
              'Acreditada'::text AS status,
              c.created_at AS date
            FROM commissions c
            WHERE c.beneficiary_user_id = $1

            UNION ALL

            SELECT
              CONCAT('withdrawal-', w.id) AS id,
              'withdrawal'::text AS type,
              COALESCE('Retiro a ' || NULLIF(TRIM(w.destination), ''), 'Solicitud de retiro') AS label,
              -ABS(w.amount_cop) AS amount_cop,
              CASE w.status
                WHEN 'pending' THEN 'Pendiente'
                WHEN 'approved' THEN 'Aprobado'
                WHEN 'rejected' THEN 'Rechazado'
                ELSE w.status::text
              END AS status,
              w.created_at AS date
            FROM withdrawals w
            WHERE w.user_id = $1

            UNION ALL

            SELECT
              CONCAT('order-payment-', o.id) AS id,
              'order_payment'::text AS type,
              CONCAT('Pago de pedido ', UPPER(LEFT(o.id::text, 8)), ' con wallet') AS label,
              -ABS(o.paid_from_wallet_cop) AS amount_cop,
              CASE o.status
                WHEN 'pending_payment' THEN 'Pendiente de pago'
                WHEN 'paid' THEN 'Pagado'
                WHEN 'confirmed' THEN 'Confirmado'
                WHEN 'assigned' THEN 'Asignado a repartidor'
                WHEN 'picked_up' THEN 'Recogido por repartidor'
                WHEN 'on_the_way' THEN 'En camino'
                WHEN 'delivered' THEN 'Entregado'
                ELSE o.status::text
              END AS status,
              o.created_at AS date
            FROM orders o
            WHERE o.user_id = $1
              AND o.paid_from_wallet_cop > 0
          )
          SELECT id, type::text, label, amount_cop, status, date
          FROM movements
          ORDER BY date DESC, id DESC
          LIMIT $2
          OFFSET $3
        `,
        [userId, safePageSize, offset],
      ),
    ]);

    return {
      page: safePage,
      pageSize: safePageSize,
      total: Number(totalRes.rows[0]?.total ?? '0'),
      movements: movementsRes.rows.map((row) => ({
        id: row.id,
        type: row.type,
        label: row.label,
        amountCop: row.amount_cop,
        status: row.status,
        date: row.date,
      })),
    };
  }

  async payAdminFromWallet(input: { userId: string; amountCop: number; notes?: string }) {
    if (!this.isUuidV4(input.userId)) {
      throw new BadRequestException('Invalid userId');
    }

    const amountCop = Math.trunc(input.amountCop);
    if (!Number.isInteger(amountCop) || amountCop <= 0) {
      throw new BadRequestException('amountCop must be a positive integer');
    }

    return this.databaseService.withTransaction(async (client) => {
      const userRes = await client.query<{
        id: string;
        full_name: string;
        wallet_balance_cop: number;
      }>(
        `
          SELECT id, full_name, wallet_balance_cop
          FROM users
          WHERE id = $1
          FOR UPDATE
        `,
        [input.userId],
      );

      const user = userRes.rows[0];
      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.wallet_balance_cop < amountCop) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      await client.query('UPDATE users SET wallet_balance_cop = wallet_balance_cop - $1 WHERE id = $2', [amountCop, input.userId]);

      const transactionId = randomUUID();
      await client.query(
        `
          INSERT INTO admin_wallet_transactions(id, source_user_id, order_id, type, amount_cop, notes)
          VALUES($1, $2, NULL, 'manual_wallet_payment', $3, $4)
        `,
        [transactionId, input.userId, amountCop, input.notes ?? 'Pago directo al admin desde wallet'],
      );

      return {
        id: transactionId,
        type: 'manual_wallet_payment',
        amountCop,
        sourceUserId: input.userId,
        sourceUserName: user.full_name,
        notes: input.notes ?? null,
        createdAt: new Date().toISOString(),
      };
    });
  }

  async updateUserProfile(input: UpdateUserProfileInput) {
    const userId = input.userId;
    if (!this.isUuidV4(userId)) {
      throw new BadRequestException('Invalid userId');
    }

    const nextUsername = this.normalizeUsername(input.username);
    const nextFullName = input.fullName?.trim();
    const nextEmail = input.email?.trim().toLowerCase();
    const hasWhatsappPhoneChange = Object.prototype.hasOwnProperty.call(input, 'whatsappPhone');
    const nextWhatsappPhone = this.normalizeWhatsappPhone(input.whatsappPhone, hasWhatsappPhoneChange);
    const wantsPasswordChange = Boolean(input.newPassword);

    if (!nextUsername && !nextFullName && !nextEmail && !hasWhatsappPhoneChange && !wantsPasswordChange) {
      throw new BadRequestException('No profile changes were provided');
    }

    if (nextUsername !== undefined && nextUsername.length < 3) {
      throw new BadRequestException('El username debe tener al menos 3 caracteres');
    }

    if (nextFullName !== undefined && nextFullName.length < 2) {
      throw new BadRequestException('El nombre debe tener al menos 2 caracteres');
    }

    if (nextEmail !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      throw new BadRequestException('El correo electrónico no es válido');
    }

    return this.databaseService.withTransaction(async (client) => {
      const currentUser = await this.getUserById(userId, client, true);

      if (nextEmail && nextEmail !== currentUser.email) {
        const emailExists = await client.query<{ exists: number }>(
          'SELECT 1 AS exists FROM users WHERE email = $1 AND id <> $2 LIMIT 1',
          [nextEmail, userId],
        );
        if (emailExists.rowCount) {
          throw new BadRequestException('Email already registered');
        }
      }

      if (nextUsername && nextUsername !== currentUser.username) {
        const usernameExists = await client.query<{ exists: number }>(
          'SELECT 1 AS exists FROM users WHERE username = $1 AND id <> $2 LIMIT 1',
          [nextUsername, userId],
        );
        if (usernameExists.rowCount) {
          throw new BadRequestException('Ese username ya está en uso');
        }
      }

      let nextPasswordHash: string | undefined;
      if (wantsPasswordChange) {
        if (!input.currentPassword) {
          throw new BadRequestException('Debes ingresar tu contraseña actual para cambiarla');
        }

        const authUser = await this.getUserAuthById(userId, client);
        const currentPasswordValid = await bcrypt.compare(input.currentPassword, authUser.password_hash);
        if (!currentPasswordValid) {
          throw new BadRequestException('La contraseña actual no coincide');
        }

        if (!input.newPassword || input.newPassword.length < 8) {
          throw new BadRequestException('La nueva contraseña debe tener al menos 8 caracteres');
        }

        nextPasswordHash = await bcrypt.hash(input.newPassword, 12);
      }

      await client.query(
        `
          UPDATE users
          SET username = COALESCE($1, username),
              full_name = COALESCE($2, full_name),
              email = COALESCE($3, email),
              whatsapp_phone = CASE WHEN $4 THEN $5 ELSE whatsapp_phone END,
              password_hash = COALESCE($6, password_hash)
          WHERE id = $7
        `,
        [
          nextUsername ?? null,
          nextFullName ?? null,
          nextEmail ?? null,
          hasWhatsappPhoneChange,
          nextWhatsappPhone,
          nextPasswordHash ?? null,
          userId,
        ],
      );

      const updated = await this.getUserById(userId, client);
      return {
        id: updated.id,
        username: updated.username,
        fullName: updated.fullName,
        email: updated.email,
        whatsappPhone: updated.whatsappPhone,
        role: updated.role,
        referralCode: updated.referralCode,
        walletBalanceCop: updated.walletBalanceCop,
      };
    });
  }

  async createOrder(input: CreateOrderInput): Promise<Order> {
    return this.databaseService.withTransaction(async (client) => {
      const normalizedPaymentMethod = this.normalizePaymentMethod(input.paymentMethod);
      const user = await this.getUserById(input.userId, client, true);
      const config = await this.getConfigUsingClient(client);

      if (!config.enabledPaymentMethods.includes(normalizedPaymentMethod)) {
        throw new BadRequestException('El metodo de pago seleccionado no esta habilitado');
      }

      if (this.requiresConfiguredPaymentAccount(normalizedPaymentMethod)) {
        const hasAccountForMethod = config.paymentAccounts.some((account) => account.method === normalizedPaymentMethod);
        if (!hasAccountForMethod) {
          throw new BadRequestException('No hay cuentas configuradas para el metodo de pago seleccionado');
        }
      }

      if (!input.items?.length) {
        throw new BadRequestException('Order items are required');
      }

      if (input.deliveryMethod === 'home_delivery' && (!input.address || !input.phone)) {
        throw new BadRequestException('address and phone are required for home delivery');
      }

      const items: OrderItem[] = [];
      for (const it of input.items) {
        if (it.quantity <= 0) {
          throw new BadRequestException('quantity must be greater than 0');
        }
        const productRes = await client.query<{ id: string; name: string; price_cop: number; stock: number }>(
          'SELECT id, name, price_cop, stock FROM products WHERE id = $1 FOR UPDATE',
          [it.productId],
        );
        const product = productRes.rows[0];
        if (!product) {
          throw new BadRequestException(`Product ${it.productId} not found`);
        }
        if (product.stock < it.quantity) {
          throw new BadRequestException(`Not enough stock for ${product.name}`);
        }

        items.push({
          productId: product.id,
          quantity: it.quantity,
          unitPriceCop: product.price_cop,
          totalPriceCop: product.price_cop * it.quantity,
        });
      }

      const itemsTotalCop = items.reduce((acc, it) => acc + it.totalPriceCop, 0);
      const requestedDeliveryFeeCop = Math.max(0, Math.trunc(Number(input.deliveryFeeCop ?? 0)));
      const deliveryFeeCop = input.deliveryMethod === 'home_delivery' ? requestedDeliveryFeeCop : 0;
      const totalCop = itemsTotalCop + deliveryFeeCop;
      let paidFromWalletCop = 0;
      let pendingPaymentCop = totalCop;

      if (input.useWallet && user.walletBalanceCop > 0) {
        paidFromWalletCop = Math.min(user.walletBalanceCop, totalCop);
        pendingPaymentCop = totalCop - paidFromWalletCop;
        user.walletBalanceCop -= paidFromWalletCop;
        await client.query('UPDATE users SET wallet_balance_cop = $1 WHERE id = $2', [user.walletBalanceCop, user.id]);
      }

      const status: OrderStatus = pendingPaymentCop > 0 ? 'pending_payment' : 'paid';
      const orderId = randomUUID();
      const paymentProofDataUrl = input.paymentProofDataUrl?.trim() ?? '';

      if (pendingPaymentCop > 0 && this.requiresPaymentProof(normalizedPaymentMethod)) {
        if (!paymentProofDataUrl) {
          throw new BadRequestException('Debes subir un comprobante para pagos por transferencia bancaria o pago movil');
        }

        if (!paymentProofDataUrl.startsWith('data:image/')) {
          throw new BadRequestException('El comprobante debe ser una imagen válida');
        }

        if (paymentProofDataUrl.length > 6_000_000) {
          throw new BadRequestException('El comprobante es demasiado pesado');
        }
      }

      await client.query(
        `
          INSERT INTO orders(
            id, user_id, total_cop, delivery_fee_cop, paid_from_wallet_cop, pending_payment_cop,
            payment_method, delivery_method, status, address, phone,
            payment_proof_data_url, payment_proof_status, payment_proof_uploaded_at
          )
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        `,
        [
          orderId,
          user.id,
          totalCop,
          deliveryFeeCop,
          paidFromWalletCop,
          pendingPaymentCop,
          normalizedPaymentMethod,
          input.deliveryMethod,
          status,
          input.address ?? null,
          input.phone ?? null,
          pendingPaymentCop > 0 && this.requiresPaymentProof(normalizedPaymentMethod) ? paymentProofDataUrl : null,
          pendingPaymentCop > 0 && this.requiresPaymentProof(normalizedPaymentMethod) ? 'pending' : null,
          pendingPaymentCop > 0 && this.requiresPaymentProof(normalizedPaymentMethod) ? new Date().toISOString() : null,
        ],
      );

      for (const item of items) {
        await client.query(
          `
            INSERT INTO order_items(order_id, product_id, quantity, unit_price_cop, total_price_cop)
            VALUES($1, $2, $3, $4, $5)
          `,
          [orderId, item.productId, item.quantity, item.unitPriceCop, item.totalPriceCop],
        );
        await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [item.quantity, item.productId]);
      }

      if (paidFromWalletCop > 0) {
        await client.query(
          `
            INSERT INTO admin_wallet_transactions(id, source_user_id, order_id, type, amount_cop, notes)
            VALUES($1, $2, $3, $4, $5, $6)
          `,
          [
            randomUUID(),
            user.id,
            orderId,
            'order_wallet_payment',
            paidFromWalletCop,
            'Pago de pedido con saldo de wallet',
          ],
        );
      }

      await this.registerPurchase(user, new Date(), client);

      return {
        id: orderId,
        userId: user.id,
        items,
        totalCop,
        deliveryFeeCop,
        paidFromWalletCop,
        pendingPaymentCop,
        paymentMethod: normalizedPaymentMethod,
        deliveryMethod: input.deliveryMethod,
        status,
        address: input.address,
        phone: input.phone,
        paymentProofDataUrl: pendingPaymentCop > 0 && this.requiresPaymentProof(normalizedPaymentMethod) ? paymentProofDataUrl : undefined,
        paymentProofStatus: pendingPaymentCop > 0 && this.requiresPaymentProof(normalizedPaymentMethod) ? 'pending' : undefined,
        createdAt: new Date().toISOString(),
      };
    });
  }

  async confirmPayment(orderId: string, reviewedByUserId?: string): Promise<Order> {
    return this.databaseService.withTransaction(async (client) => {
      const order = await this.findOrderUsingClient(orderId, client, true);

      if (order.pendingPaymentCop <= 0) {
        return order;
      }

      if (this.requiresPaymentProof(order.paymentMethod) && !order.paymentProofDataUrl) {
        throw new BadRequestException('Esta orden no tiene comprobante de pago para validar');
      }

      await this.execQuery(
        `
          UPDATE orders
          SET pending_payment_cop = 0,
              status = CASE
                WHEN pending_payment_cop > 0 AND status = 'pending_payment' THEN 'paid'
                ELSE status
              END,
              payment_proof_status = CASE WHEN payment_proof_data_url IS NOT NULL THEN 'approved' ELSE payment_proof_status END,
              payment_proof_reviewed_at = CASE WHEN payment_proof_data_url IS NOT NULL THEN NOW() ELSE payment_proof_reviewed_at END,
              payment_proof_reviewed_by_user_id = CASE WHEN payment_proof_data_url IS NOT NULL THEN COALESCE($2, payment_proof_reviewed_by_user_id) ELSE payment_proof_reviewed_by_user_id END,
              payment_proof_rejection_reason = NULL
          WHERE id = $1
        `,
        [orderId, reviewedByUserId ?? null],
        client,
      );

      const updatedOrder = await this.findOrderUsingClient(orderId, client);

      if (updatedOrder.deliveryMethod === 'home_delivery' && updatedOrder.status === 'delivered') {
        await this.processCommissions(updatedOrder, client);
      }

      return updatedOrder;
    });
  }

  async rejectPayment(orderId: string, reviewedByUserId?: string, rejectionReason?: string): Promise<Order> {
    return this.databaseService.withTransaction(async (client) => {
      const order = await this.findOrderUsingClient(orderId, client, true);

      if (order.pendingPaymentCop <= 0) {
        throw new BadRequestException('La orden no tiene saldo pendiente para rechazar');
      }

      if (!this.requiresPaymentProof(order.paymentMethod)) {
        throw new BadRequestException('El metodo de pago de esta orden no requiere comprobante');
      }

      if (!order.paymentProofDataUrl) {
        throw new BadRequestException('La orden no tiene comprobante de pago');
      }

      await this.execQuery(
        `
          UPDATE orders
          SET payment_proof_status = 'rejected',
              payment_proof_reviewed_at = NOW(),
              payment_proof_reviewed_by_user_id = COALESCE($2, payment_proof_reviewed_by_user_id),
              payment_proof_rejection_reason = NULLIF($3, '')
          WHERE id = $1
        `,
        [orderId, reviewedByUserId ?? null, rejectionReason?.trim() ?? null],
        client,
      );

      return this.findOrderUsingClient(orderId, client);
    });
  }

  async confirmOrder(orderId: string): Promise<Order> {
    return this.databaseService.withTransaction(async (client) => {
      const order = await this.findOrderUsingClient(orderId, client, true);

      if (order.pendingPaymentCop > 0) {
        throw new BadRequestException('Order still has pending payment');
      }

      if (!['paid', 'confirmed'].includes(order.status)) {
        throw new BadRequestException(`Order cannot be confirmed from status ${order.status}`);
      }

      await client.query('UPDATE orders SET status = $1 WHERE id = $2', ['confirmed', orderId]);

      // Pickup orders never enter courier flow, so commissions are settled at confirmation.
      if (order.deliveryMethod === 'pickup') {
        await this.processCommissions(order, client);
      }

      return this.findOrderUsingClient(orderId, client);
    });
  }

  async assignCourier(orderId: string, courierId: string): Promise<Order> {
    const [order] = await Promise.all([this.findOrder(orderId), this.getUserById(courierId)]);

    if (order.deliveryMethod !== 'home_delivery') {
      throw new BadRequestException('Only home delivery orders can be assigned to a courier');
    }

    const normalizedPaymentMethod = this.normalizePaymentMethod(order.paymentMethod);
    const canAssignBeforePayment =
      order.status === 'pending_payment' && order.deliveryMethod === 'home_delivery' && normalizedPaymentMethod === 'cash';

    if (order.status !== 'confirmed' && !canAssignBeforePayment) {
      throw new BadRequestException('Order must be confirmed before courier assignment');
    }

    await this.databaseService.query('UPDATE orders SET courier_id = $1, status = $2 WHERE id = $3', [courierId, 'assigned', orderId]);
    return this.findOrder(orderId);
  }

  async updateCourierStatus(input: {
    orderId: string;
    status: 'picked_up' | 'on_the_way';
  }): Promise<Order> {
    return this.databaseService.withTransaction(async (client) => {
      const order = await this.findOrderUsingClient(input.orderId, client, true);

      if (!order.courierId) {
        throw new BadRequestException('Order has no assigned courier');
      }

      if (order.status === 'delivered') {
        throw new BadRequestException('Order is already delivered');
      }

      const allowedTransitionByStatus: Partial<Record<OrderStatus, 'picked_up' | 'on_the_way'>> = {
        assigned: 'picked_up',
        picked_up: 'on_the_way',
      };
      const expectedNextStatus = allowedTransitionByStatus[order.status];
      if (!expectedNextStatus || expectedNextStatus !== input.status) {
        throw new BadRequestException(`Invalid status transition from ${order.status} to ${input.status}`);
      }

      await client.query('UPDATE orders SET status = $1 WHERE id = $2', [input.status, input.orderId]);

      return this.findOrderUsingClient(input.orderId, client);
    });
  }

  generateDeliveryConfirmationToken(orderId: string) {
    const orderPromise = this.findOrder(orderId);

    return orderPromise.then(async (order) => {
      if (order.deliveryMethod !== 'home_delivery') {
        throw new BadRequestException('Only home delivery orders can generate delivery confirmation QR');
      }

      if (order.status !== 'on_the_way') {
        throw new BadRequestException('The order must be in transit before generating the delivery QR');
      }

      if (!order.courierId) {
        throw new BadRequestException('Order has no assigned courier');
      }

      const deliveryCode = String(Math.floor(100000 + Math.random() * 900000));
      const expiresIn = this.configService.get<string>('DELIVERY_CONFIRMATION_TTL') ?? '12h';
      const secret = this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
      const token = jwt.sign(
        {
          purpose: 'delivery_confirmation',
          orderId,
          deliveryCode,
        } satisfies DeliveryConfirmationTokenPayload,
        secret,
        { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] },
      );
      const decoded = jwt.decode(token) as jwt.JwtPayload | null;
      const expiresAt = typeof decoded?.exp === 'number' ? new Date(decoded.exp * 1000).toISOString() : null;
      const customer = await this.getUserById(order.userId);

      return {
        token,
        deliveryCode,
        expiresAt,
        order: {
          id: order.id,
          customerName: customer.fullName,
          address: order.address ?? null,
          totalCop: order.totalCop,
        },
      };
    });
  }

  async previewDeliveryConfirmation(token: string, requesterUserId: string) {
    const payload = this.verifyDeliveryConfirmationToken(token);
    const order = await this.findOrder(payload.orderId);

    if (order.userId !== requesterUserId) {
      throw new ForbiddenException('Debes iniciar sesión con la cuenta dueña de este pedido para validarlo');
    }

    const customer = await this.getUserById(order.userId);

    return {
      orderId: order.id,
      customerName: customer.fullName,
      address: order.address ?? null,
      totalCop: order.totalCop,
      status: order.status,
      deliveryCode: payload.deliveryCode,
      deliveredAt: order.deliveredAt ?? null,
      customerReceivedConfirmedAt: order.customerReceivedConfirmedAt ?? null,
    };
  }

  async confirmDeliveryByToken(token: string, requesterUserId: string): Promise<Order> {
    const payload = this.verifyDeliveryConfirmationToken(token);

    return this.databaseService.withTransaction(async (client) => {
      const order = await this.findOrderUsingClient(payload.orderId, client, true);

      if (order.userId !== requesterUserId) {
        throw new ForbiddenException('Debes iniciar sesión con la cuenta dueña de este pedido para confirmarlo');
      }

      if (order.deliveryMethod !== 'home_delivery') {
        throw new BadRequestException('Only home delivery orders can be confirmed with QR');
      }

      if (order.status === 'delivered' && order.customerReceivedConfirmedAt) {
        return order;
      }

      if (order.status !== 'on_the_way') {
        throw new BadRequestException('This delivery is not awaiting customer confirmation');
      }

      await client.query(
        `
          UPDATE orders
          SET status = 'delivered',
              route_position = NULL,
              delivered_signature = COALESCE(delivered_signature, $2),
              delivered_at = COALESCE(delivered_at, NOW()),
              customer_received_confirmed_at = NOW()
          WHERE id = $1
        `,
        [order.id, `Confirmado por QR ${payload.deliveryCode}`],
      );

      const deliveredOrder = await this.findOrderUsingClient(order.id, client);
      if (deliveredOrder.pendingPaymentCop <= 0) {
        await this.processCommissions(deliveredOrder, client);
      }

      return deliveredOrder;
    });
  }

  async getOrderById(orderId: string): Promise<Order> {
    return this.findOrder(orderId);
  }

  async getAdminOverview() {
    const [
      usersRes,
      ordersRes,
      pendingRes,
      salesRes,
      commissionsRes,
      totalPaidRes,
      totalPayableRes,
      withdrawalsApprovedRes,
      adminWalletBalanceRes,
      totalWalletsBalanceRes,
      monthlyStatsRes,
      adminWalletMovementsRes,
    ] = await Promise.all([
      this.databaseService.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM users'),
      this.databaseService.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM orders'),
      this.databaseService.query<{ count: string }>(
        `
          SELECT COUNT(*)::text AS count
          FROM orders
          WHERE status IN ('pending_payment', 'paid', 'confirmed', 'assigned', 'picked_up', 'on_the_way')
        `,
      ),
      this.databaseService.query<{ total: string }>('SELECT COALESCE(SUM(total_cop), 0)::text AS total FROM orders'),
      this.databaseService.query<{ total: string }>('SELECT COALESCE(SUM(amount_cop), 0)::text AS total FROM commissions'),
      this.databaseService.query<{ total: string }>(
        "SELECT COALESCE(SUM(amount_cop), 0)::text AS total FROM withdrawals WHERE status = 'approved'",
      ),
      this.databaseService.query<{ total: string }>(
        `
          SELECT COALESCE(
            SUM(
              CASE
                WHEN status = 'pending' THEN amount_cop
                ELSE 0
              END
            ),
            0
          )::text AS total
          FROM withdrawals
        `,
      ),
      this.databaseService.query<{ total: string }>(
        "SELECT COALESCE(SUM(amount_cop), 0)::text AS total FROM withdrawals WHERE status = 'approved'",
      ),
      this.databaseService.query<{ total: string }>(
        'SELECT COALESCE(SUM(amount_cop), 0)::text AS total FROM admin_wallet_transactions',
      ),
      this.databaseService.query<{ total: string }>(
        'SELECT COALESCE(SUM(wallet_balance_cop), 0)::text AS total FROM users',
      ),
      this.databaseService.query<{
        month_label: string;
        income_cop: string;
        expenses_cop: string;
        paid_cop: string;
        payable_cop: string;
        wallet_payments_cop: string;
      }>(
        `
          WITH months AS (
            SELECT date_trunc('month', CURRENT_DATE) - (interval '1 month' * gs) AS month_start
            FROM generate_series(5, 0, -1) AS gs
          ),
          orders_monthly AS (
            SELECT
              date_trunc('month', o.created_at) AS month_start,
              SUM(o.total_cop)::bigint AS income_cop,
              SUM(
                CASE
                  WHEN o.status <> 'pending_payment' THEN o.total_cop
                  ELSE 0
                END
              )::bigint AS paid_cop,
              SUM(
                CASE
                  WHEN o.status = 'pending_payment' THEN
                    CASE
                      WHEN o.pending_payment_cop > 0 THEN o.pending_payment_cop
                      WHEN o.total_cop > o.paid_from_wallet_cop THEN o.total_cop - o.paid_from_wallet_cop
                      ELSE o.total_cop
                    END
                  ELSE 0
                END
              )::bigint AS payable_cop
            FROM orders o
            GROUP BY 1
          ),
          commissions_monthly AS (
            SELECT
              date_trunc('month', c.created_at) AS month_start,
              SUM(c.amount_cop)::bigint AS commissions_cop
            FROM commissions c
            GROUP BY 1
          ),
          withdrawals_monthly AS (
            SELECT
              date_trunc('month', COALESCE(w.reviewed_at, w.created_at)) AS month_start,
              SUM(CASE WHEN w.status = 'approved' THEN w.amount_cop ELSE 0 END)::bigint AS approved_cop,
              SUM(CASE WHEN w.status = 'pending' THEN w.amount_cop ELSE 0 END)::bigint AS pending_cop,
              SUM(CASE WHEN w.status IN ('approved', 'pending') THEN w.amount_cop ELSE 0 END)::bigint AS withdrawals_cop
            FROM withdrawals w
            GROUP BY 1
          ),
          wallet_monthly AS (
            SELECT
              date_trunc('month', t.created_at) AS month_start,
              SUM(t.amount_cop)::bigint AS wallet_payments_cop
            FROM admin_wallet_transactions t
            GROUP BY 1
          )
          SELECT
            TO_CHAR(m.month_start, 'YYYY-MM') AS month_label,
            COALESCE(o.income_cop, 0)::text AS income_cop,
            (COALESCE(c.commissions_cop, 0) + COALESCE(w.withdrawals_cop, 0))::text AS expenses_cop,
            COALESCE(w.approved_cop, 0)::text AS paid_cop,
            COALESCE(w.pending_cop, 0)::text AS payable_cop,
            COALESCE(k.wallet_payments_cop, 0)::text AS wallet_payments_cop
          FROM months m
          LEFT JOIN orders_monthly o ON o.month_start = m.month_start
          LEFT JOIN commissions_monthly c ON c.month_start = m.month_start
          LEFT JOIN withdrawals_monthly w ON w.month_start = m.month_start
          LEFT JOIN wallet_monthly k ON k.month_start = m.month_start
          ORDER BY m.month_start DESC
        `,
      ),
      this.databaseService.query<{
        id: string;
        type: string;
        amount_cop: number;
        notes: string | null;
        order_id: string | null;
        source_user_id: string | null;
        source_user_name: string | null;
        created_at: string;
      }>(
        `
          SELECT
            t.id,
            t.type,
            t.amount_cop,
            t.notes,
            t.order_id,
            t.source_user_id,
            u.full_name AS source_user_name,
            t.created_at
          FROM admin_wallet_transactions t
          LEFT JOIN users u ON u.id = t.source_user_id
          ORDER BY t.created_at DESC, t.id DESC
          LIMIT 12
        `,
      ),
    ]);

    const totalCommissions = Number(commissionsRes.rows[0]?.total ?? '0');
    const totalApprovedWithdrawals = Number(withdrawalsApprovedRes.rows[0]?.total ?? '0');
    const totalExpenses = totalCommissions + totalApprovedWithdrawals;

    return {
      users: Number(usersRes.rows[0]?.count ?? '0'),
      orders: Number(ordersRes.rows[0]?.count ?? '0'),
      pendingDeliveries: Number(pendingRes.rows[0]?.count ?? '0'),
      totalSalesCop: Number(salesRes.rows[0]?.total ?? '0'),
      totalCommissionsCop: totalCommissions,
      totalPaidCop: Number(totalPaidRes.rows[0]?.total ?? '0'),
      totalPayableCop: Number(totalPayableRes.rows[0]?.total ?? '0'),
      totalExpensesCop: totalExpenses,
      totalApprovedWithdrawalsCop: totalApprovedWithdrawals,
      adminWalletBalanceCop: Number(adminWalletBalanceRes.rows[0]?.total ?? '0'),
      totalWalletsBalanceCop: Number(totalWalletsBalanceRes.rows[0]?.total ?? '0'),
      monthlyStats: monthlyStatsRes.rows.map((row) => ({
        month: row.month_label,
        incomeCop: Number(row.income_cop ?? '0'),
        expensesCop: Number(row.expenses_cop ?? '0'),
        paidCop: Number(row.paid_cop ?? '0'),
        payableCop: Number(row.payable_cop ?? '0'),
        walletPaymentsCop: Number(row.wallet_payments_cop ?? '0'),
      })),
      adminWalletMovements: adminWalletMovementsRes.rows.map((row) => ({
        id: row.id,
        type: row.type,
        amountCop: row.amount_cop,
        notes: row.notes,
        orderId: row.order_id,
        sourceUserId: row.source_user_id,
        sourceUserName: row.source_user_name,
        createdAt: row.created_at,
      })),
    };
  }

  async getAdminOrders(limit = 50) {
    const safeLimit = Math.min(Math.max(limit, 1), 200);

    const orders = await this.databaseService.query<{
      id: string;
      user_id: string;
      customer_name: string;
      customer_email: string;
      status: OrderStatus;
      delivery_method: DeliveryMethod;
      payment_method: PaymentMethod;
      total_cop: number;
      delivery_fee_cop: number;
      pending_payment_cop: number;
      courier_id: string | null;
      courier_name: string | null;
      items_summary: string | null;
      payment_proof_data_url: string | null;
      payment_proof_status: 'pending' | 'approved' | 'rejected' | null;
      payment_proof_uploaded_at: string | null;
      payment_proof_reviewed_at: string | null;
      payment_proof_reviewed_by_user_id: string | null;
      payment_proof_rejection_reason: string | null;
      created_at: string;
    }>(
      `
        SELECT
          o.id,
          o.user_id,
          u.full_name AS customer_name,
          u.email AS customer_email,
          o.status,
          o.delivery_method,
          o.payment_method,
          o.total_cop,
          o.delivery_fee_cop,
          o.pending_payment_cop,
          o.courier_id,
          c.full_name AS courier_name,
          items.items_summary,
          o.payment_proof_data_url,
          o.payment_proof_status,
          o.payment_proof_uploaded_at,
          o.payment_proof_reviewed_at,
          o.payment_proof_reviewed_by_user_id,
          o.payment_proof_rejection_reason,
          o.created_at
        FROM orders o
        INNER JOIN users u ON u.id = o.user_id
        LEFT JOIN users c ON c.id = o.courier_id
        LEFT JOIN LATERAL (
          SELECT STRING_AGG(p.name || ' x' || oi.quantity::text, ', ' ORDER BY p.name) AS items_summary
          FROM order_items oi
          INNER JOIN products p ON p.id = oi.product_id
          WHERE oi.order_id = o.id
        ) items ON TRUE
        ORDER BY o.created_at DESC
        LIMIT $1
      `,
      [safeLimit],
    );

    return orders.rows.map((row) => ({
      ...row,
      payment_proof_data_url: row.payment_proof_data_url,
      payment_proof_status: row.payment_proof_status,
      payment_proof_uploaded_at: row.payment_proof_uploaded_at,
      payment_proof_reviewed_at: row.payment_proof_reviewed_at,
      payment_proof_reviewed_by_user_id: row.payment_proof_reviewed_by_user_id,
      payment_proof_rejection_reason: row.payment_proof_rejection_reason,
    }));
  }

  async getCourierOrdersPage(courierId: string, page = 1, pageSize = 10) {
    if (!this.isUuidV4(courierId)) {
      throw new BadRequestException('Invalid courierId');
    }

    const safePage = Math.max(1, page);
    const safePageSize = Math.min(Math.max(pageSize, 1), 50);
    const offset = (safePage - 1) * safePageSize;

    const [totalRes, ordersRes] = await Promise.all([
      this.databaseService.query<{ total: string }>(
        `
          SELECT COUNT(*)::text AS total
          FROM orders
          WHERE courier_id = $1
            AND route_position IS NULL
            AND status <> 'delivered'
        `,
        [courierId],
      ),
      this.databaseService.query<{
        id: string;
        user_id: string;
        customer_name: string;
        status: OrderStatus;
        delivery_method: DeliveryMethod;
        total_cop: number;
        address: string | null;
        phone: string | null;
        created_at: string;
        route_position: number | null;
      }>(
        `
          SELECT
            o.id,
            o.user_id,
            u.full_name AS customer_name,
            o.status,
            o.delivery_method,
            o.total_cop,
            o.address,
            o.phone,
            o.created_at,
            o.route_position
          FROM orders o
          INNER JOIN users u ON u.id = o.user_id
          WHERE o.courier_id = $1
            AND o.route_position IS NULL
            AND o.status <> 'delivered'
          ORDER BY
            o.created_at DESC,
            o.id DESC
          LIMIT $2
          OFFSET $3
        `,
        [courierId, safePageSize, offset],
      ),
    ]);

    return {
      page: safePage,
      pageSize: safePageSize,
      total: Number(totalRes.rows[0]?.total ?? '0'),
      orders: ordersRes.rows,
    };
  }

  async getCourierRoute(courierId: string) {
    if (!this.isUuidV4(courierId)) {
      throw new BadRequestException('Invalid courierId');
    }

    const ordersRes = await this.databaseService.query<{
      id: string;
      user_id: string;
      customer_name: string;
      status: OrderStatus;
      delivery_method: DeliveryMethod;
      total_cop: number;
      address: string | null;
      phone: string | null;
      created_at: string;
      route_position: number | null;
    }>(
      `
        SELECT
          o.id,
          o.user_id,
          u.full_name AS customer_name,
          o.status,
          o.delivery_method,
          o.total_cop,
          o.address,
          o.phone,
          o.created_at,
          o.route_position
        FROM orders o
        INNER JOIN users u ON u.id = o.user_id
        WHERE o.courier_id = $1
          AND o.route_position IS NOT NULL
          AND o.status <> 'delivered'
        ORDER BY o.route_position ASC, o.created_at ASC
      `,
      [courierId],
    );

    return ordersRes.rows;
  }

  async getCourierDeliveredOrdersPage(
    courierId: string,
    filters: {
      page?: number;
      pageSize?: number;
      fromDate?: string;
      toDate?: string;
      customerName?: string;
      phone?: string;
      orderId?: string;
      q?: string;
    },
  ) {
    if (!this.isUuidV4(courierId)) {
      throw new BadRequestException('Invalid courierId');
    }

    const safePage = Math.max(1, Number(filters.page ?? 1));
    const safePageSize = Math.min(Math.max(Number(filters.pageSize ?? 10), 1), 50);
    const offset = (safePage - 1) * safePageSize;

    const conditions: string[] = ["o.courier_id = $1", "o.status = 'delivered'"];
    const values: unknown[] = [courierId];
    let nextParam = 2;

    const customerName = filters.customerName?.trim();
    if (customerName) {
      conditions.push(`u.full_name ILIKE $${nextParam}`);
      values.push(`%${customerName}%`);
      nextParam += 1;
    }

    const phone = filters.phone?.trim();
    if (phone) {
      conditions.push(`COALESCE(o.phone, '') ILIKE $${nextParam}`);
      values.push(`%${phone}%`);
      nextParam += 1;
    }

    const orderId = filters.orderId?.trim();
    if (orderId) {
      conditions.push(`CAST(o.id AS text) ILIKE $${nextParam}`);
      values.push(`%${orderId}%`);
      nextParam += 1;
    }

    const fromDate = filters.fromDate?.trim();
    if (fromDate) {
      conditions.push(`o.delivered_at::date >= $${nextParam}::date`);
      values.push(fromDate);
      nextParam += 1;
    }

    const toDate = filters.toDate?.trim();
    if (toDate) {
      conditions.push(`o.delivered_at::date <= $${nextParam}::date`);
      values.push(toDate);
      nextParam += 1;
    }

    const q = filters.q?.trim();
    if (q) {
      conditions.push(`(
        u.full_name ILIKE $${nextParam}
        OR COALESCE(o.phone, '') ILIKE $${nextParam}
        OR CAST(o.id AS text) ILIKE $${nextParam}
        OR COALESCE(o.address, '') ILIKE $${nextParam}
      )`);
      values.push(`%${q}%`);
      nextParam += 1;
    }

    const whereClause = conditions.join(' AND ');

    const [totalRes, ordersRes] = await Promise.all([
      this.databaseService.query<{ total: string }>(
        `
          SELECT COUNT(*)::text AS total
          FROM orders o
          INNER JOIN users u ON u.id = o.user_id
          WHERE ${whereClause}
        `,
        values,
      ),
      this.databaseService.query<{
        id: string;
        user_id: string;
        customer_name: string;
        status: OrderStatus;
        delivery_method: DeliveryMethod;
        total_cop: number;
        address: string | null;
        phone: string | null;
        created_at: string;
        route_position: number | null;
        delivered_at: string | null;
        customer_received_confirmed_at: string | null;
      }>(
        `
          SELECT
            o.id,
            o.user_id,
            u.full_name AS customer_name,
            o.status,
            o.delivery_method,
            o.total_cop,
            o.address,
            o.phone,
            o.created_at,
            o.route_position,
            o.delivered_at,
            o.customer_received_confirmed_at
          FROM orders o
          INNER JOIN users u ON u.id = o.user_id
          WHERE ${whereClause}
          ORDER BY o.delivered_at DESC NULLS LAST, o.created_at DESC
          LIMIT $${nextParam}
          OFFSET $${nextParam + 1}
        `,
        [...values, safePageSize, offset],
      ),
    ]);

    return {
      page: safePage,
      pageSize: safePageSize,
      total: Number(totalRes.rows[0]?.total ?? '0'),
      orders: ordersRes.rows,
    };
  }

  async addOrderToCourierRoute(courierId: string, orderId: string) {
    if (!this.isUuidV4(courierId)) {
      throw new BadRequestException('Invalid courierId');
    }

    return this.databaseService.withTransaction(async (client) => {
      const order = await this.findOrderUsingClient(orderId, client, true);

      if (order.courierId !== courierId) {
        throw new ForbiddenException('Solo puedes agregar a tu ruta pedidos asignados a ti');
      }

      if (order.status === 'delivered') {
        throw new BadRequestException('No puedes agregar una orden entregada a la ruta');
      }

      if (order.routePosition) {
        return order;
      }

      const positionRes = await this.execQuery<{ next_position: number }>(
        `
          SELECT COALESCE(MAX(route_position), 0) + 1 AS next_position
          FROM orders
          WHERE courier_id = $1
            AND route_position IS NOT NULL
        `,
        [courierId],
        client,
      );
      const nextPosition = Number(positionRes.rows[0]?.next_position ?? '1');

      await this.execQuery(
        `
          UPDATE orders
          SET route_position = $2,
              status = 'on_the_way'
          WHERE id = $1
        `,
        [orderId, nextPosition],
        client,
      );

      return this.findOrderUsingClient(orderId, client);
    });
  }

  async reorderCourierRoute(courierId: string, orderIds: string[]) {
    if (!this.isUuidV4(courierId)) {
      throw new BadRequestException('Invalid courierId');
    }

    if (orderIds.length === 0) {
      return this.getCourierRoute(courierId);
    }

    return this.databaseService.withTransaction(async (client) => {
      const routeRes = await this.execQuery<{ id: string }>(
        `
          SELECT id
          FROM orders
          WHERE courier_id = $1
            AND route_position IS NOT NULL
            AND status <> 'delivered'
          ORDER BY route_position ASC
        `,
        [courierId],
        client,
      );
      const existingIds = routeRes.rows.map((row) => row.id);
      const normalizedIncoming = Array.from(new Set(orderIds));

      if (
        existingIds.length !== normalizedIncoming.length ||
        existingIds.some((id) => !normalizedIncoming.includes(id))
      ) {
        throw new BadRequestException('La ruta enviada no coincide con los pedidos activos del repartidor');
      }

      for (const [index, orderId] of normalizedIncoming.entries()) {
        await this.execQuery(
          'UPDATE orders SET route_position = $1 WHERE id = $2 AND courier_id = $3',
          [index + 1, orderId, courierId],
          client,
        );
      }

      return this.getCourierRoute(courierId);
    });
  }

  async createWithdrawalRequest(input: {
    userId: string;
    amountCop: number;
    destination?: string;
    notes?: string;
  }) {
    if (!this.isUuidV4(input.userId)) {
      throw new BadRequestException('Invalid userId');
    }
    if (!Number.isInteger(input.amountCop) || input.amountCop <= 0) {
      throw new BadRequestException('amountCop must be a positive integer');
    }

    const config = await this.getConfig();
    if (input.amountCop < config.minWithdrawalCop) {
      throw new BadRequestException(`Minimum withdrawal is ${config.minWithdrawalCop}`);
    }

    const user = await this.getUserById(input.userId);
    if (user.walletBalanceCop < input.amountCop) {
      throw new BadRequestException('Insufficient wallet balance');
    }

    const id = randomUUID();
    await this.databaseService.query(
      `
        INSERT INTO withdrawals(id, user_id, amount_cop, status, destination, notes)
        VALUES($1, $2, $3, 'pending', $4, $5)
      `,
      [id, input.userId, input.amountCop, input.destination ?? null, input.notes ?? null],
    );

    const created = await this.databaseService.query<{
      id: string;
      user_id: string;
      amount_cop: number;
      status: WithdrawalStatus;
      destination: string | null;
      notes: string | null;
      created_at: string;
    }>(
      'SELECT id, user_id, amount_cop, status, destination, notes, created_at FROM withdrawals WHERE id = $1',
      [id],
    );

    return created.rows[0];
  }

  async getUserWithdrawals(userId: string, limit = 30) {
    if (!this.isUuidV4(userId)) {
      throw new BadRequestException('Invalid userId');
    }
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const result = await this.databaseService.query<{
      id: string;
      user_id: string;
      amount_cop: number;
      status: WithdrawalStatus;
      destination: string | null;
      notes: string | null;
      reviewed_at: string | null;
      created_at: string;
    }>(
      `
        SELECT id, user_id, amount_cop, status, destination, notes, reviewed_at, created_at
        FROM withdrawals
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `,
      [userId, safeLimit],
    );
    return result.rows;
  }

  async getAdminWithdrawals(status?: WithdrawalStatus, limit = 80) {
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    const hasStatusFilter = Boolean(status && ['pending', 'approved', 'rejected'].includes(status));

    const result = await this.databaseService.query<{
      id: string;
      user_id: string;
      user_name: string;
      user_email: string;
      amount_cop: number;
      status: WithdrawalStatus;
      destination: string | null;
      notes: string | null;
      reviewed_by_user_id: string | null;
      reviewed_by_name: string | null;
      reviewed_at: string | null;
      created_at: string;
    }>(
      `
        SELECT
          w.id,
          w.user_id,
          u.full_name AS user_name,
          u.email AS user_email,
          w.amount_cop,
          w.status,
          w.destination,
          w.notes,
          w.reviewed_by_user_id,
          reviewer.full_name AS reviewed_by_name,
          w.reviewed_at,
          w.created_at
        FROM withdrawals w
        INNER JOIN users u ON u.id = w.user_id
        LEFT JOIN users reviewer ON reviewer.id = w.reviewed_by_user_id
        WHERE ($1::text IS NULL OR w.status = $1::text)
        ORDER BY w.created_at DESC
        LIMIT $2
      `,
      [hasStatusFilter ? status : null, safeLimit],
    );

    return result.rows;
  }

  async reviewWithdrawal(input: ReviewWithdrawalInput) {
    if (!this.isUuidV4(input.withdrawalId) || !this.isUuidV4(input.adminUserId)) {
      throw new BadRequestException('Invalid ids for withdrawal review');
    }

    return this.databaseService.withTransaction(async (client) => {
      const withdrawalRes = await client.query<{
        id: string;
        user_id: string;
        amount_cop: number;
        status: WithdrawalStatus;
      }>(
        `
          SELECT id, user_id, amount_cop, status
          FROM withdrawals
          WHERE id = $1
          FOR UPDATE
        `,
        [input.withdrawalId],
      );

      const withdrawal = withdrawalRes.rows[0];
      if (!withdrawal) {
        throw new NotFoundException('Withdrawal request not found');
      }
      if (withdrawal.status !== 'pending') {
        throw new BadRequestException('Withdrawal already reviewed');
      }

      if (input.decision === 'approved') {
        const user = await this.getUserById(withdrawal.user_id, client, true);
        if (user.walletBalanceCop < withdrawal.amount_cop) {
          throw new BadRequestException('User wallet does not have enough balance');
        }

        await client.query('UPDATE users SET wallet_balance_cop = wallet_balance_cop - $1 WHERE id = $2', [
          withdrawal.amount_cop,
          withdrawal.user_id,
        ]);
      }

      const reviewed = await client.query<{
        id: string;
        status: WithdrawalStatus;
        reviewed_at: string | null;
      }>(
        `
          UPDATE withdrawals
          SET status = $1,
              notes = COALESCE($2, notes),
              reviewed_by_user_id = $3,
              reviewed_at = NOW()
          WHERE id = $4
          RETURNING id, status, reviewed_at
        `,
        [input.decision, input.notes ?? null, input.adminUserId, input.withdrawalId],
      );

      return reviewed.rows[0];
    });
  }

  async getCouriers() {
    const couriers = await this.databaseService.query<{
      id: string;
      full_name: string;
      email: string;
    }>(
      `
        SELECT id, full_name, email
        FROM users
        WHERE role = 'courier'
        ORDER BY full_name ASC
      `,
    );

    return couriers.rows;
  }

  async getUserByReferralCode(referralCode: string) {
    const code = referralCode.trim().toUpperCase();
    if (!code) {
      throw new BadRequestException('referralCode is required');
    }

    const result = await this.databaseService.query<{
      id: string;
      full_name: string;
      email: string;
      role: UserRole;
      referral_code: string;
      referred_by_user_id: string | null;
    }>(
      `
        SELECT id, full_name, email, role, referral_code, referred_by_user_id
        FROM users
        WHERE referral_code = $1
        LIMIT 1
      `,
      [code],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException('User not found for referral code');
    }

    return {
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      role: row.role,
      referralCode: row.referral_code,
      referredByUserId: row.referred_by_user_id,
    };
  }

  async getReferralNetwork(rootUserId: string, maxDepth = 5) {
    const safeDepth = Math.max(1, Math.min(maxDepth, 15));
    const root = await this.getUserById(rootUserId);

    const downline = await this.databaseService.query<{
      id: string;
      full_name: string;
      email: string;
      referral_code: string;
      referred_by_user_id: string | null;
      level: number;
      wallet_balance_cop: number;
      membership_active_until: string | null;
      commissions_cop: string;
    }>(
      `
        WITH RECURSIVE tree AS (
          SELECT
            u.id,
            u.full_name,
            u.email,
            u.referral_code,
            u.referred_by_user_id,
            u.wallet_balance_cop,
            u.membership_active_until,
            1 AS level
          FROM users u
          WHERE u.referred_by_user_id = $1

          UNION ALL

          SELECT
            child.id,
            child.full_name,
            child.email,
            child.referral_code,
            child.referred_by_user_id,
            child.wallet_balance_cop,
            child.membership_active_until,
            tree.level + 1 AS level
          FROM users child
          INNER JOIN tree ON child.referred_by_user_id = tree.id
          WHERE tree.level < $2
        )
        SELECT
          tree.id,
          tree.full_name,
          tree.email,
          tree.referral_code,
          tree.referred_by_user_id,
          tree.level,
          tree.wallet_balance_cop,
          tree.membership_active_until,
          COALESCE(SUM(c.amount_cop), 0)::text AS commissions_cop
        FROM tree
        LEFT JOIN commissions c ON c.beneficiary_user_id = tree.id
        GROUP BY
          tree.id,
          tree.full_name,
          tree.email,
          tree.referral_code,
          tree.referred_by_user_id,
          tree.level,
          tree.wallet_balance_cop,
          tree.membership_active_until
        ORDER BY tree.level ASC, tree.full_name ASC
      `,
      [rootUserId, safeDepth],
    );

    const members = downline.rows.map((row) => ({
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      referralCode: row.referral_code,
      referredByUserId: row.referred_by_user_id,
      level: row.level,
      walletBalanceCop: row.wallet_balance_cop,
      membershipActiveUntil: row.membership_active_until,
      commissionsCop: Number(row.commissions_cop),
    }));

    const levelsMap = new Map<number, { level: number; count: number; commissionsCop: number }>();
    for (const member of members) {
      const current = levelsMap.get(member.level) ?? {
        level: member.level,
        count: 0,
        commissionsCop: 0,
      };
      current.count += 1;
      current.commissionsCop += member.commissionsCop;
      levelsMap.set(member.level, current);
    }

    return {
      root: {
        id: root.id,
        fullName: root.fullName,
        email: root.email,
        referralCode: root.referralCode,
      },
      maxDepth: safeDepth,
      summary: {
        totalMembers: members.length,
        directReferrals: members.filter((member) => member.level === 1).length,
        totalCommissionsCop: members.reduce((acc, member) => acc + member.commissionsCop, 0),
      },
      levels: Array.from(levelsMap.values()).sort((a, b) => a.level - b.level),
      members,
    };
  }

  async getReferralNetworkSummary(rootUserId: string, maxDepth = 7) {
    const safeDepth = Math.max(1, Math.min(maxDepth, 15));
    const root = await this.getUserById(rootUserId);

    const levelsResult = await this.databaseService.query<{
      level: number;
      count: string;
    }>(
      `
        WITH RECURSIVE tree AS (
          SELECT
            u.id,
            1 AS level
          FROM users u
          WHERE u.referred_by_user_id = $1

          UNION ALL

          SELECT
            child.id,
            tree.level + 1 AS level
          FROM users child
          INNER JOIN tree ON child.referred_by_user_id = tree.id
          WHERE tree.level < $2
        )
        SELECT tree.level, COUNT(*)::text AS count
        FROM tree
        GROUP BY tree.level
        ORDER BY tree.level ASC
      `,
      [rootUserId, safeDepth],
    );

    const levels = levelsResult.rows.map((row) => ({
      level: row.level,
      count: Number(row.count),
    }));
    const totalMembers = levels.reduce((acc, level) => acc + level.count, 0);
    const directReferrals = levels.find((level) => level.level === 1)?.count ?? 0;

    return {
      root: {
        id: root.id,
        fullName: root.fullName,
        email: root.email,
        referralCode: root.referralCode,
      },
      maxDepth: safeDepth,
      summary: {
        totalMembers,
        directReferrals,
      },
      levels,
    };
  }

  async getReferralNetworkLevelMembers(rootUserId: string, level: number, page = 1, pageSize = 25, maxDepth = 7) {
    const safeDepth = Math.max(1, Math.min(maxDepth, 15));
    const safeLevel = Math.max(1, Math.min(level, safeDepth));
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(Math.max(pageSize, 1), 100);
    const offset = (safePage - 1) * safePageSize;

    await this.getUserById(rootUserId);

    const totalResult = await this.databaseService.query<{ total: string }>(
      `
        WITH RECURSIVE tree AS (
          SELECT
            u.id,
            1 AS level
          FROM users u
          WHERE u.referred_by_user_id = $1

          UNION ALL

          SELECT
            child.id,
            tree.level + 1 AS level
          FROM users child
          INNER JOIN tree ON child.referred_by_user_id = tree.id
          WHERE tree.level < $2
        )
        SELECT COUNT(*)::text AS total
        FROM tree
        WHERE tree.level = $3
      `,
      [rootUserId, safeDepth, safeLevel],
    );

    const membersResult = await this.databaseService.query<{
      id: string;
      full_name: string;
      email: string;
      referral_code: string;
      membership_active_until: string | null;
    }>(
      `
        WITH RECURSIVE tree AS (
          SELECT
            u.id,
            u.full_name,
            u.email,
            u.referral_code,
            u.membership_active_until,
            1 AS level
          FROM users u
          WHERE u.referred_by_user_id = $1

          UNION ALL

          SELECT
            child.id,
            child.full_name,
            child.email,
            child.referral_code,
            child.membership_active_until,
            tree.level + 1 AS level
          FROM users child
          INNER JOIN tree ON child.referred_by_user_id = tree.id
          WHERE tree.level < $2
        )
        SELECT
          tree.id,
          tree.full_name,
          tree.email,
          tree.referral_code,
          tree.membership_active_until
        FROM tree
        WHERE tree.level = $3
        ORDER BY tree.full_name ASC
        LIMIT $4
        OFFSET $5
      `,
      [rootUserId, safeDepth, safeLevel, safePageSize, offset],
    );

    return {
      level: safeLevel,
      page: safePage,
      pageSize: safePageSize,
      total: Number(totalResult.rows[0]?.total ?? 0),
      members: membersResult.rows.map((row) => ({
        id: row.id,
        fullName: row.full_name,
        email: row.email,
        referralCode: row.referral_code,
        membershipActiveUntil: row.membership_active_until,
      })),
    };
  }

  private async processCommissions(order: Order, client: PoolClient): Promise<void> {
    const buyer = await this.getUserById(order.userId, client);
    const now = new Date();
    let currentReferrerId = buyer.referredByUserId;
    const commissionLevels = await this.getCommissionLevelsUsingClient(client);

    for (const levelConfig of commissionLevels) {
      if (!currentReferrerId) {
        break;
      }
      if (!levelConfig.enabled) {
        continue;
      }

      const beneficiary = await this.getUserById(currentReferrerId, client, true);
      currentReferrerId = beneficiary.referredByUserId;

      if (!this.isMembershipActive(beneficiary, now)) {
        continue;
      }

      const commission: Commission = {
        id: randomUUID(),
        orderId: order.id,
        beneficiaryUserId: beneficiary.id,
        sourceUserId: buyer.id,
        level: levelConfig.level,
        amountCop: levelConfig.amountCop,
        createdAt: now.toISOString(),
      };

      const insertedCommission = await client.query(
        `
          INSERT INTO commissions(id, order_id, beneficiary_user_id, source_user_id, level, amount_cop, created_at)
          SELECT $1,$2,$3,$4,$5,$6,$7
          WHERE NOT EXISTS (
            SELECT 1
            FROM commissions
            WHERE order_id = $2
              AND beneficiary_user_id = $3
              AND level = $5
          )
          RETURNING id
        `,
        [
          commission.id,
          commission.orderId,
          commission.beneficiaryUserId,
          commission.sourceUserId,
          commission.level,
          commission.amountCop,
          commission.createdAt,
        ],
      );

      if (insertedCommission.rowCount) {
        await client.query('UPDATE users SET wallet_balance_cop = wallet_balance_cop + $1 WHERE id = $2', [
          commission.amountCop,
          beneficiary.id,
        ]);
      }
    }
  }

  private async registerPurchase(user: User, date: Date, client: PoolClient): Promise<void> {
    const graceDays = await this.getGraceDaysUsingClient(client);
    const membershipCutDay =
      !user.membershipCutDay || !user.membershipActiveUntil || !this.isMembershipActive(user, date)
        ? date.getUTCDate()
        : user.membershipCutDay;

    const cycleEnd = this.resolveCycleEndByCutDay(date, membershipCutDay);
    cycleEnd.setUTCDate(cycleEnd.getUTCDate() + graceDays);

    await client.query(
      `
        UPDATE users
        SET membership_cut_day = $1,
            membership_active_until = $2
        WHERE id = $3
      `,
      [membershipCutDay, cycleEnd.toISOString(), user.id],
    );
    await client.query('INSERT INTO user_purchases(user_id, purchased_at) VALUES($1, $2)', [user.id, date.toISOString()]);
  }

  private resolveCycleEndByCutDay(referenceDate: Date, cutDay: number): Date {
    const year = referenceDate.getUTCFullYear();
    const month = referenceDate.getUTCMonth();

    const nextMonthBase = new Date(Date.UTC(year, month + 1, 1));
    const nextMonthDay = Math.min(cutDay, this.daysInUtcMonth(nextMonthBase.getUTCFullYear(), nextMonthBase.getUTCMonth()));
    const nextCut = new Date(Date.UTC(nextMonthBase.getUTCFullYear(), nextMonthBase.getUTCMonth(), nextMonthDay, 23, 59, 59, 999));
    nextCut.setUTCDate(nextCut.getUTCDate() - 1);

    return nextCut;
  }

  private daysInUtcMonth(year: number, month: number): number {
    return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  }

  private isMembershipActive(user: User, referenceDate: Date): boolean {
    if (!user.membershipActiveUntil) {
      return false;
    }
    return new Date(user.membershipActiveUntil).getTime() >= referenceDate.getTime();
  }

  private getMembershipSnapshot(user: User, graceThreshold: number) {
    if (!user.membershipActiveUntil) {
      return {
        status: 'inactive',
        activeUntil: null,
        daysRemaining: 0,
      };
    }

    const now = Date.now();
    const activeUntil = new Date(user.membershipActiveUntil).getTime();
    const msRemaining = activeUntil - now;

    if (msRemaining <= 0) {
      return {
        status: 'inactive',
        activeUntil: user.membershipActiveUntil,
        daysRemaining: 0,
      };
    }

    const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));
    const status = daysRemaining <= graceThreshold ? 'grace' : 'active';

    return {
      status,
      activeUntil: user.membershipActiveUntil,
      daysRemaining,
    };
  }

  private async getUserById(userId: string, client?: PoolClient, forUpdate = false): Promise<User> {
    if (!userId || !this.isUuidV4(userId)) {
      throw new BadRequestException('Invalid user id');
    }

    const lockClause = forUpdate ? 'FOR UPDATE' : '';
    const result = await this.execQuery<{
      id: string;
      username: string | null;
      full_name: string;
      email: string;
      whatsapp_phone: string | null;
      role: UserRole;
      permissions: unknown;
      sponsor_code: string | null;
      referral_code: string;
      referred_by_user_id: string | null;
      wallet_balance_cop: number;
      membership_cut_day: number | null;
      membership_active_until: string | null;
    }>(
      `
        SELECT
          id,
          username,
          full_name,
          email,
          whatsapp_phone,
          role,
          permissions,
          sponsor_code,
          referral_code,
          referred_by_user_id,
          wallet_balance_cop,
          membership_cut_day,
          membership_active_until
        FROM users
        WHERE id = $1
        ${lockClause}
      `,
      [userId],
      client,
    );
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException('User not found');
    }
    return {
      id: row.id,
      username: row.username ?? null,
      fullName: row.full_name,
      email: row.email,
      whatsappPhone: row.whatsapp_phone ?? null,
      role: row.role,
      permissions: this.normalizePermissions(row.permissions),
      sponsorCode: row.sponsor_code ?? undefined,
      referralCode: row.referral_code,
      referredByUserId: row.referred_by_user_id ?? undefined,
      walletBalanceCop: row.wallet_balance_cop,
      membershipCutDay: row.membership_cut_day ?? undefined,
      membershipActiveUntil: row.membership_active_until ?? undefined,
      purchases: [],
    };
  }

  private verifyDeliveryConfirmationToken(token: string): DeliveryConfirmationTokenPayload {
    if (!token) {
      throw new UnauthorizedException('Missing delivery confirmation token');
    }

    try {
      const payload = jwt.verify(token, this.configService.getOrThrow<string>('JWT_ACCESS_SECRET')) as DeliveryConfirmationTokenPayload;
      if (payload.purpose !== 'delivery_confirmation' || !payload.orderId || !payload.deliveryCode) {
        throw new UnauthorizedException('Invalid delivery confirmation token');
      }
      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired delivery confirmation token');
    }
  }


  private async findOrder(orderId: string): Promise<Order> {
    const order = await this.findOrderUsingClient(orderId);
    return order;
  }

  private async findOrderUsingClient(orderId: string, client?: PoolClient, forUpdate = false): Promise<Order> {
    const lockClause = forUpdate ? 'FOR UPDATE' : '';
    const orderRes = await this.execQuery<{
      id: string;
      user_id: string;
      total_cop: number;
      delivery_fee_cop: number;
      paid_from_wallet_cop: number;
      pending_payment_cop: number;
      payment_method: PaymentMethod;
      delivery_method: DeliveryMethod;
      status: OrderStatus;
      address: string | null;
      phone: string | null;
      courier_id: string | null;
      route_position: number | null;
      payment_proof_data_url: string | null;
      payment_proof_status: 'pending' | 'approved' | 'rejected' | null;
      payment_proof_uploaded_at: string | null;
      payment_proof_reviewed_at: string | null;
      payment_proof_reviewed_by_user_id: string | null;
      payment_proof_rejection_reason: string | null;
      delivered_evidence_photo_url: string | null;
      delivered_signature: string | null;
      customer_received_signature: string | null;
      customer_received_confirmed_at: string | null;
      created_at: string;
      delivered_at: string | null;
    }>(
      `
        SELECT
          id,
          user_id,
          total_cop,
          delivery_fee_cop,
          paid_from_wallet_cop,
          pending_payment_cop,
          payment_method,
          delivery_method,
          status,
          address,
          phone,
          courier_id,
          route_position,
          payment_proof_data_url,
          payment_proof_status,
          payment_proof_uploaded_at,
          payment_proof_reviewed_at,
          payment_proof_reviewed_by_user_id,
          payment_proof_rejection_reason,
          delivered_evidence_photo_url,
          delivered_signature,
          customer_received_signature,
          customer_received_confirmed_at,
          created_at,
          delivered_at
        FROM orders
        WHERE id = $1
        ${lockClause}
      `,
      [orderId],
      client,
    );
    const orderRow = orderRes.rows[0];
    if (!orderRow) {
      throw new NotFoundException('Order not found');
    }

    const itemsRes = await this.execQuery<{
      product_id: string;
      quantity: number;
      unit_price_cop: number;
      total_price_cop: number;
    }>(
      `
        SELECT product_id, quantity, unit_price_cop, total_price_cop
        FROM order_items
        WHERE order_id = $1
      `,
      [orderId],
      client,
    );

    return {
      id: orderRow.id,
      userId: orderRow.user_id,
      items: itemsRes.rows.map((item) => ({
        productId: item.product_id,
        quantity: item.quantity,
        unitPriceCop: item.unit_price_cop,
        totalPriceCop: item.total_price_cop,
      })),
      totalCop: orderRow.total_cop,
      deliveryFeeCop: orderRow.delivery_fee_cop,
      paidFromWalletCop: orderRow.paid_from_wallet_cop,
      pendingPaymentCop: orderRow.pending_payment_cop,
      paymentMethod: orderRow.payment_method,
      deliveryMethod: orderRow.delivery_method,
      status: orderRow.status,
      address: orderRow.address ?? undefined,
      phone: orderRow.phone ?? undefined,
      courierId: orderRow.courier_id ?? undefined,
      routePosition: orderRow.route_position ?? undefined,
      paymentProofDataUrl: orderRow.payment_proof_data_url ?? undefined,
      paymentProofStatus: orderRow.payment_proof_status ?? undefined,
      paymentProofUploadedAt: orderRow.payment_proof_uploaded_at ?? undefined,
      paymentProofReviewedAt: orderRow.payment_proof_reviewed_at ?? undefined,
      paymentProofReviewedByUserId: orderRow.payment_proof_reviewed_by_user_id ?? undefined,
      paymentProofRejectionReason: orderRow.payment_proof_rejection_reason ?? undefined,
      deliveredEvidencePhotoUrl: orderRow.delivered_evidence_photo_url ?? undefined,
      deliveredSignature: orderRow.delivered_signature ?? undefined,
      customerReceivedSignature: orderRow.customer_received_signature ?? undefined,
      customerReceivedConfirmedAt: orderRow.customer_received_confirmed_at ?? undefined,
      createdAt: orderRow.created_at,
      deliveredAt: orderRow.delivered_at ?? undefined,
    };
  }

  private async getConfigMap(client?: PoolClient): Promise<Map<string, unknown>> {
    const result = await this.execQuery<{ key: string; value: unknown }>('SELECT key, value FROM app_config', [], client);
    return new Map(result.rows.map((row) => [row.key, row.value]));
  }

  private async getConfigUsingClient(client: PoolClient): Promise<SystemConfig> {
    const [configMap, commissionLevels] = await Promise.all([
      this.getConfigMap(client),
      this.getCommissionLevelsUsingClient(client),
    ]);

    return {
      commissionLevels,
      gracePeriodDays: Number(configMap.get('grace_period_days') ?? 3),
      minWithdrawalCop: Number(configMap.get('min_withdrawal_cop') ?? 50000),
      deliveryCommissionPercent: Number(configMap.get('delivery_commission_percent') ?? 0),
      maxCommissionLevels: Number(configMap.get('max_commission_levels') ?? 10),
      enabledPaymentMethods: this.normalizeEnabledPaymentMethods(configMap.get('enabled_payment_methods')),
      paymentAccounts: this.normalizePaymentAccounts(configMap.get('payment_accounts')),
      deliveryFeesByMunicipality: this.normalizeDeliveryFeesByMunicipality(configMap.get('delivery_fees_by_municipality')),
    };
  }

  private normalizeDeliveryFeesByMunicipality(value: unknown): DeliveryFeesByMunicipality {
    const defaults: DeliveryFeesByMunicipality = {
      Dosquebradas: 12000,
      Pereira: 12000,
      Cuba: 12000,
    };

    if (!value || typeof value !== 'object') {
      return defaults;
    }

    const record = value as Record<string, unknown>;
    const normalizeFee = (candidate: unknown, fallback: number): number => {
      const numeric = Math.trunc(Number(candidate));
      if (!Number.isFinite(numeric) || numeric < 0) {
        return fallback;
      }
      return numeric;
    };

    return {
      Dosquebradas: normalizeFee(record.Dosquebradas, defaults.Dosquebradas),
      Pereira: normalizeFee(record.Pereira, defaults.Pereira),
      Cuba: normalizeFee(record.Cuba, defaults.Cuba),
    };
  }

  private normalizeEnabledPaymentMethods(value: unknown, fallbackToAll = true): PaymentMethod[] {
    const allowed: PaymentMethod[] = ['wallet', 'bank_transfer', 'mobile_payment', 'cash'];
    const allowedSet = new Set<string>(allowed);

    const source = Array.isArray(value) ? value : [];
    const normalized = source
      .map((item) => this.normalizePaymentMethodFromRaw(typeof item === 'string' ? item.trim() : ''))
      .filter((item): item is PaymentMethod => item !== null && allowedSet.has(item));

    if (normalized.length === 0 && fallbackToAll) {
      return [...allowed];
    }

    return Array.from(new Set(normalized));
  }

  private normalizePaymentAccounts(value: unknown, fallbackToEmpty = true): PaymentAccountConfig[] {
    const allowedMethods: PaymentMethod[] = ['wallet', 'bank_transfer', 'mobile_payment', 'cash'];
    const allowedMethodsSet = new Set<string>(allowedMethods);

    if (!Array.isArray(value)) {
      return fallbackToEmpty ? [] : [];
    }

    const normalized: PaymentAccountConfig[] = [];
    for (const item of value) {
      if (!item || typeof item !== 'object') {
        continue;
      }

      const record = item as Record<string, unknown>;
      const methodRaw = typeof record.method === 'string' ? record.method.trim() : '';
      const normalizedMethod = this.normalizePaymentMethodFromRaw(methodRaw);
      if (!normalizedMethod) {
        continue;
      }
      if (!allowedMethodsSet.has(normalizedMethod)) {
        continue;
      }

      const label = typeof record.label === 'string' ? record.label.trim() : '';
      const holderName = typeof record.holderName === 'string' ? record.holderName.trim() : '';
      const accountRef = typeof record.accountRef === 'string' ? record.accountRef.trim() : '';
      const details = typeof record.details === 'string' ? record.details.trim() : '';

      if (!label || !holderName || !accountRef) {
        continue;
      }

      const id = typeof record.id === 'string' && record.id.trim() ? record.id.trim() : randomUUID();

      normalized.push({
        id,
        method: normalizedMethod,
        label,
        holderName,
        accountRef,
        details: details || undefined,
      });
    }

    return normalized;
  }

  private normalizePaymentMethod(method: PaymentMethod): PaymentMethod {
    return method === 'cash_on_delivery' ? 'cash' : method;
  }

  private normalizePaymentMethodFromRaw(rawMethod: string): PaymentMethod | null {
    if (!rawMethod) {
      return null;
    }

    if (rawMethod === 'cash_on_delivery') {
      return 'cash';
    }

    if (rawMethod === 'wallet' || rawMethod === 'bank_transfer' || rawMethod === 'mobile_payment' || rawMethod === 'cash') {
      return rawMethod;
    }

    return null;
  }

  private requiresPaymentProof(method: PaymentMethod): boolean {
    const normalizedMethod = this.normalizePaymentMethod(method);
    return normalizedMethod === 'bank_transfer' || normalizedMethod === 'mobile_payment';
  }

  private requiresConfiguredPaymentAccount(method: PaymentMethod): boolean {
    const normalizedMethod = this.normalizePaymentMethod(method);
    return normalizedMethod === 'bank_transfer' || normalizedMethod === 'mobile_payment';
  }

  private async getCommissionLevels(): Promise<CommissionLevelConfig[]> {
    return this.getCommissionLevelsUsingClient();
  }

  private async getCommissionLevelsUsingClient(client?: PoolClient): Promise<CommissionLevelConfig[]> {
    const levels = await this.execQuery<{ level: number; amount_cop: number; enabled: boolean }>(
      'SELECT level, amount_cop, enabled FROM commission_levels ORDER BY level ASC',
      [],
      client,
    );
    return levels.rows.map((row) => ({
      level: row.level,
      amountCop: row.amount_cop,
      enabled: row.enabled,
    }));
  }

  private async upsertConfigValue(client: PoolClient, key: string, value: unknown): Promise<void> {
    await client.query(
      `
        INSERT INTO app_config(key, value)
        VALUES($1, $2::jsonb)
        ON CONFLICT (key)
        DO UPDATE SET value = EXCLUDED.value
      `,
      [key, JSON.stringify(value)],
    );
  }

  private async getGraceDaysUsingClient(client?: PoolClient): Promise<number> {
    const configMap = await this.getConfigMap(client);
    return Number(configMap.get('grace_period_days') ?? 3);
  }

  private async generateUniqueReferralCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = Math.random().toString(36).slice(2, 10).toUpperCase();
      const exists = await this.databaseService.query<{ exists: number }>(
        'SELECT 1 as exists FROM users WHERE referral_code = $1 LIMIT 1',
        [code],
      );
      if (!exists.rowCount) {
        return code;
      }
    }
    throw new BadRequestException('Unable to generate referral code, try again');
  }

  private execQuery<T extends Record<string, unknown>>(
    text: string,
    values: unknown[] = [],
    client?: PoolClient,
  ) {
    if (client) {
      return client.query<T>(text, values);
    }
    return this.databaseService.query<T>(text, values);
  }

  async getUserAuthByEmail(email: string) {
    const result = await this.databaseService.query<{
      id: string;
      username: string | null;
      full_name: string;
      email: string;
      whatsapp_phone: string | null;
      role: UserRole;
      permissions: unknown;
      password_hash: string;
      referral_code: string;
      referred_by_user_id: string | null;
      wallet_balance_cop: number;
      membership_cut_day: number | null;
      membership_active_until: string | null;
    }>(
      `
        SELECT
          id,
          username,
          full_name,
          email,
          whatsapp_phone,
          role,
          permissions,
          password_hash,
          referral_code,
          referred_by_user_id,
          wallet_balance_cop,
          membership_cut_day,
          membership_active_until
        FROM users
        WHERE email = $1
        LIMIT 1
      `,
      [email.toLowerCase()],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException('User not found');
    }

    return row;
  }

  async getUserAuthById(userId: string, client?: PoolClient) {
    if (!this.isUuidV4(userId)) {
      throw new BadRequestException('Invalid user id');
    }

    const result = await this.execQuery<{
      id: string;
      username: string | null;
      full_name: string;
      email: string;
      role: UserRole;
      permissions: unknown;
      password_hash: string;
      referral_code: string;
    }>(
      `
        SELECT id, username, full_name, email, role, permissions, password_hash, referral_code
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [userId],
      client,
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException('User not found');
    }

    return row;
  }

  private normalizeUsername(value?: string): string | undefined {
    if (value === undefined) {
      return undefined;
    }

    const username = value.trim().toLowerCase();
    if (!username) {
      return undefined;
    }

    if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
      throw new BadRequestException('El username debe tener 3-30 caracteres y usar solo letras, números, punto, guion o guion bajo');
    }

    return username;
  }

  private normalizePermissions(value: unknown): AdminPermission[] {
    if (!value) {
      return [];
    }

    if (Array.isArray(value)) {
      return value.filter((item): item is AdminPermission => typeof item === 'string');
    }

    if (typeof value === 'string') {
      try {
        return this.normalizePermissions(JSON.parse(value) as unknown);
      } catch {
        return [];
      }
    }

    return [];
  }

  private normalizeWhatsappPhone(value: string | undefined, hasField: boolean): string | null | undefined {
    if (!hasField) {
      return undefined;
    }

    const normalized = (value ?? '').trim();
    if (!normalized) {
      return null;
    }

    if (!/^\+?[0-9()\-\s]{7,20}$/.test(normalized)) {
      throw new BadRequestException('El número de WhatsApp no es válido');
    }

    return normalized;
  }

  private async resolveUsername(requestedUsername: string): Promise<string> {
    const normalized = this.normalizeUsername(requestedUsername);

    if (!normalized) {
      throw new BadRequestException('El username es obligatorio');
    }

    const exists = await this.databaseService.query<{ exists: number }>(
      'SELECT 1 as exists FROM users WHERE username = $1 LIMIT 1',
      [normalized],
    );
    if (exists.rowCount) {
      throw new BadRequestException('Ese username ya está en uso');
    }

    return normalized;
  }
}
