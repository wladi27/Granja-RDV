const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');

function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function randomUuid() {
  return crypto.randomUUID();
}

function randomReferralCode(level, index) {
  return `T2L${level}N${String(index).padStart(5, '0')}`;
}

function chunk(array, size) {
  const chunks = [];
  for (let index = 0; index < array.length; index += size) {
    chunks.push(array.slice(index, index + size));
  }
  return chunks;
}

async function insertUsers(client, users) {
  if (users.length === 0) {
    return;
  }

  for (const userChunk of chunk(users, 400)) {
    const ids = userChunk.map((row) => row.id);
    const usernames = userChunk.map((row) => row.username);
    const fullNames = userChunk.map((row) => row.fullName);
    const emails = userChunk.map((row) => row.email);
    const passwordHashes = userChunk.map((row) => row.passwordHash);
    const roles = userChunk.map((row) => row.role);
    const sponsorCodes = userChunk.map((row) => row.sponsorCode);
    const referralCodes = userChunk.map((row) => row.referralCode);
    const referredByUserIds = userChunk.map((row) => row.referredByUserId);
    const walletBalances = userChunk.map((row) => row.walletBalanceCop);
    const membershipCutDays = userChunk.map((row) => row.membershipCutDay);
    const membershipActiveUntil = userChunk.map((row) => row.membershipActiveUntil);

    await client.query(
      `
        INSERT INTO users(
          id,
          username,
          full_name,
          email,
          password_hash,
          role,
          sponsor_code,
          referral_code,
          referred_by_user_id,
          wallet_balance_cop,
          membership_cut_day,
          membership_active_until
        )
        SELECT *
        FROM UNNEST(
          $1::uuid[],
          $2::text[],
          $3::text[],
          $4::text[],
          $5::text[],
          $6::text[],
          $7::text[],
          $8::text[],
          $9::uuid[],
          $10::int[],
          $11::int[],
          $12::timestamptz[]
        )
      `,
      [
        ids,
        usernames,
        fullNames,
        emails,
        passwordHashes,
        roles,
        sponsorCodes,
        referralCodes,
        referredByUserIds,
        walletBalances,
        membershipCutDays,
        membershipActiveUntil,
      ],
    );
  }
}

async function insertOrders(client, orders) {
  if (orders.length === 0) {
    return;
  }

  for (const orderChunk of chunk(orders, 500)) {
    await client.query(
      `
        INSERT INTO orders(
          id,
          user_id,
          total_cop,
          paid_from_wallet_cop,
          pending_payment_cop,
          payment_method,
          delivery_method,
          status,
          created_at,
          delivered_at
        )
        SELECT *
        FROM UNNEST(
          $1::uuid[],
          $2::uuid[],
          $3::int[],
          $4::int[],
          $5::int[],
          $6::text[],
          $7::text[],
          $8::text[],
          $9::timestamptz[],
          $10::timestamptz[]
        )
      `,
      [
        orderChunk.map((row) => row.id),
        orderChunk.map((row) => row.userId),
        orderChunk.map((row) => row.totalCop),
        orderChunk.map((row) => row.paidFromWalletCop),
        orderChunk.map((row) => row.pendingPaymentCop),
        orderChunk.map((row) => row.paymentMethod),
        orderChunk.map((row) => row.deliveryMethod),
        orderChunk.map((row) => row.status),
        orderChunk.map((row) => row.createdAt),
        orderChunk.map((row) => row.deliveredAt),
      ],
    );
  }
}

async function insertOrderItems(client, orderItems) {
  if (orderItems.length === 0) {
    return;
  }

  for (const itemChunk of chunk(orderItems, 700)) {
    await client.query(
      `
        INSERT INTO order_items(order_id, product_id, quantity, unit_price_cop, total_price_cop)
        SELECT *
        FROM UNNEST(
          $1::uuid[],
          $2::text[],
          $3::int[],
          $4::int[],
          $5::int[]
        )
      `,
      [
        itemChunk.map((row) => row.orderId),
        itemChunk.map((row) => row.productId),
        itemChunk.map((row) => row.quantity),
        itemChunk.map((row) => row.unitPriceCop),
        itemChunk.map((row) => row.totalPriceCop),
      ],
    );
  }
}

async function insertCommissions(client, commissions) {
  if (commissions.length === 0) {
    return;
  }

  for (const commissionChunk of chunk(commissions, 1200)) {
    await client.query(
      `
        INSERT INTO commissions(id, order_id, beneficiary_user_id, source_user_id, level, amount_cop, created_at)
        SELECT *
        FROM UNNEST(
          $1::uuid[],
          $2::uuid[],
          $3::uuid[],
          $4::uuid[],
          $5::int[],
          $6::int[],
          $7::timestamptz[]
        )
      `,
      [
        commissionChunk.map((row) => row.id),
        commissionChunk.map((row) => row.orderId),
        commissionChunk.map((row) => row.beneficiaryUserId),
        commissionChunk.map((row) => row.sourceUserId),
        commissionChunk.map((row) => row.level),
        commissionChunk.map((row) => row.amountCop),
        commissionChunk.map((row) => row.createdAt),
      ],
    );
  }
}

async function insertPurchases(client, purchases) {
  if (purchases.length === 0) {
    return;
  }

  for (const purchaseChunk of chunk(purchases, 1000)) {
    await client.query(
      `
        INSERT INTO user_purchases(user_id, purchased_at)
        SELECT *
        FROM UNNEST(
          $1::uuid[],
          $2::timestamptz[]
        )
      `,
      [
        purchaseChunk.map((row) => row.userId),
        purchaseChunk.map((row) => row.purchasedAt),
      ],
    );
  }
}

async function main() {
  loadEnv(path.join(__dirname, '..', '.env'));

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  await client.connect();

  const seedTag = 'SEED7LVL';
  const rootEmail = 'test2@gmail.com';
  const rootName = 'test2';
  const rootUsername = 'test2';
  const rootReferral = 'TEST2ROOT';
  const levelFactor = { 1: 2 };
  const levelAmounts = {
    1: 5000,
    2: 3000,
    3: 1500,
    4: 1200,
    5: 1000,
    6: 800,
    7: 600,
  };

  try {
    await client.query('BEGIN');

    let rootResult = await client.query(
      `SELECT id, referral_code FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [rootEmail],
    );

    let rootId;
    if (!rootResult.rows[0]) {
      rootId = randomUuid();
      await client.query(
        `
          INSERT INTO users(
            id,
            username,
            full_name,
            email,
            password_hash,
            role,
            sponsor_code,
            referral_code,
            wallet_balance_cop,
            membership_cut_day,
            membership_active_until
          )
          VALUES($1, $2, $3, $4, '', 'customer', NULL, $5, 0, NULL, NOW() + INTERVAL '30 days')
        `,
        [rootId, rootUsername, rootName, rootEmail, rootReferral],
      );
    } else {
      rootId = rootResult.rows[0].id;
    }

    const seededUsersRes = await client.query(`SELECT id FROM users WHERE sponsor_code = $1`, [seedTag]);
    const seededIds = seededUsersRes.rows.map((row) => row.id);

    if (seededIds.length > 0) {
      await client.query(
        `
          WITH refunded AS (
            SELECT beneficiary_user_id, SUM(amount_cop)::int AS total
            FROM commissions
            WHERE source_user_id = ANY($1::uuid[])
            GROUP BY beneficiary_user_id
          )
          UPDATE users u
          SET wallet_balance_cop = GREATEST(0, u.wallet_balance_cop - refunded.total)
          FROM refunded
          WHERE u.id = refunded.beneficiary_user_id
        `,
        [seededIds],
      );

      await client.query(`DELETE FROM commissions WHERE source_user_id = ANY($1::uuid[]) OR beneficiary_user_id = ANY($1::uuid[])`, [
        seededIds,
      ]);
      await client.query(`DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id = ANY($1::uuid[]))`, [
        seededIds,
      ]);
      await client.query(`DELETE FROM orders WHERE user_id = ANY($1::uuid[])`, [seededIds]);
      await client.query(`DELETE FROM user_purchases WHERE user_id = ANY($1::uuid[])`, [seededIds]);
      await client.query(`DELETE FROM withdrawals WHERE user_id = ANY($1::uuid[])`, [seededIds]);
      await client.query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [seededIds]);
    }

    for (const level of Object.keys(levelAmounts)) {
      await client.query(
        `
          INSERT INTO commission_levels(level, amount_cop, enabled)
          VALUES ($1, $2, TRUE)
          ON CONFLICT (level)
          DO UPDATE SET amount_cop = EXCLUDED.amount_cop, enabled = TRUE
        `,
        [Number(level), levelAmounts[level]],
      );
    }

    const newUsers = [];
    const parentById = new Map();
    const usersByLevel = new Map();
    let sequence = 1;

    let currentParents = [rootId];
    for (let level = 1; level <= 7; level += 1) {
      const branch = levelFactor[level] || 3;
      const nextParents = [];
      const levelUsers = [];

      for (const parentId of currentParents) {
        for (let i = 0; i < branch; i += 1) {
          const userId = randomUuid();
          const code = randomReferralCode(level, sequence);
          const username = `t2_l${level}_u${sequence}`;
          const email = `test2.l${level}.u${sequence}@seed.local`;

          const user = {
            id: userId,
            username,
            fullName: `T2 Nivel ${level} Usuario ${sequence}`,
            email,
            passwordHash: '',
            role: 'customer',
            sponsorCode: seedTag,
            referralCode: code,
            referredByUserId: parentId,
            walletBalanceCop: 0,
            membershipCutDay: level,
            membershipActiveUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            level,
          };

          newUsers.push(user);
          levelUsers.push(user);
          nextParents.push(userId);
          parentById.set(userId, parentId);
          sequence += 1;
        }
      }

      usersByLevel.set(level, levelUsers);
      currentParents = nextParents;
    }

    await insertUsers(client, newUsers);

    const leaves = usersByLevel.get(7) || [];

    const orders = leaves.map((leaf, index) => {
      const createdAt = new Date(Date.now() - (index % 12) * 60 * 60 * 1000);
      const deliveredAt = new Date(createdAt.getTime() + 15 * 60 * 1000);

      return {
        id: randomUuid(),
        userId: leaf.id,
        totalCop: 42000,
        paidFromWalletCop: 0,
        pendingPaymentCop: 0,
        paymentMethod: 'bank_transfer',
        deliveryMethod: 'pickup',
        status: 'delivered',
        createdAt,
        deliveredAt,
      };
    });

    await insertOrders(client, orders);

    await insertOrderItems(
      client,
      orders.map((order) => ({
        orderId: order.id,
        productId: 'p1',
        quantity: 1,
        unitPriceCop: 42000,
        totalPriceCop: 42000,
      })),
    );

    await insertPurchases(
      client,
      orders.map((order) => ({
        userId: order.userId,
        purchasedAt: order.createdAt,
      })),
    );

    const orderBySource = new Map(orders.map((order) => [order.userId, order.id]));
    const commissions = [];
    const walletDelta = new Map();

    for (const leaf of leaves) {
      const sourceId = leaf.id;
      const orderId = orderBySource.get(sourceId);
      let beneficiaryId = parentById.get(sourceId);

      for (let level = 1; level <= 7; level += 1) {
        if (!beneficiaryId) {
          break;
        }

        const amount = levelAmounts[level] || 0;
        commissions.push({
          id: randomUuid(),
          orderId,
          beneficiaryUserId: beneficiaryId,
          sourceUserId: sourceId,
          level,
          amountCop: amount,
          createdAt: new Date(),
        });

        walletDelta.set(beneficiaryId, (walletDelta.get(beneficiaryId) || 0) + amount);

        beneficiaryId = parentById.get(beneficiaryId);
      }
    }

    await insertCommissions(client, commissions);

    if (walletDelta.size > 0) {
      await client.query(
        `
          UPDATE users u
          SET wallet_balance_cop = u.wallet_balance_cop + updates.delta
          FROM (
            SELECT *
            FROM UNNEST($1::uuid[], $2::int[]) AS x(id, delta)
          ) AS updates
          WHERE u.id = updates.id
        `,
        [Array.from(walletDelta.keys()), Array.from(walletDelta.values())],
      );
    }

    const summary = await client.query(
      `
        SELECT membership_cut_day AS level, COUNT(*)::int AS count
        FROM users
        WHERE sponsor_code = $1
        GROUP BY membership_cut_day
        ORDER BY membership_cut_day
      `,
      [seedTag],
    );

    const commissionSummary = await client.query(
      `
        SELECT level, COUNT(*)::int AS rows, SUM(amount_cop)::int AS total_cop
        FROM commissions
        WHERE source_user_id IN (
          SELECT id FROM users WHERE sponsor_code = $1 AND membership_cut_day = 7
        )
        GROUP BY level
        ORDER BY level
      `,
      [seedTag],
    );

    await client.query('COMMIT');

    console.log('Seed completado para test2@gmail.com');
    console.log('Nodos por nivel:');
    for (const row of summary.rows) {
      console.log(`  Nivel ${row.level}: ${row.count}`);
    }

    console.log('Comisiones generadas por nivel (desde hojas):');
    for (const row of commissionSummary.rows) {
      console.log(`  Nivel ${row.level}: ${row.rows} filas / ${row.total_cop} COP`);
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error ejecutando seed:', error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
