const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { randomUUID } = require('crypto');

function loadEnvFile(envFilePath) {
  if (!fs.existsSync(envFilePath)) {
    return;
  }

  const content = fs.readFileSync(envFilePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();
    if (value.startsWith("\"") && value.endsWith("\"")) {
      value = value.slice(1, -1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function getDatabaseConfig() {
  const ssl = process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false;
  if (process.env.DATABASE_URL_VPS) {
    console.log('Usando DATABASE_URL_VPS para la conexión a la base de datos remota');
    return {
      connectionString: process.env.DATABASE_URL_VPS,
      ssl,
    };
  }

  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl,
    };
  }

  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl,
  };
}

function isMembershipActive(membershipActiveUntil) {
  if (!membershipActiveUntil) {
    return false;
  }
  return new Date(membershipActiveUntil).getTime() >= Date.now();
}

async function reconcileOrder(client, order, commissionLevels) {
  const buyerRes = await client.query(
    'SELECT id, referred_by_user_id FROM users WHERE id = $1',
    [order.user_id],
  );
  if (!buyerRes.rowCount) {
    throw new Error(`Usuario comprador no encontrado: ${order.user_id}`);
  }

  const existingRes = await client.query(
    'SELECT id, beneficiary_user_id, level, amount_cop FROM commissions WHERE order_id = $1',
    [order.id],
  );
  const existingMap = new Map(
    existingRes.rows.map((row) => [`${row.beneficiary_user_id}|${row.level}`, row]),
  );

  let currentReferrerId = buyerRes.rows[0].referred_by_user_id;
  let createdCount = 0;
  let updatedCount = 0;

  for (const levelConfig of commissionLevels) {
    if (!currentReferrerId) {
      break;
    }

    const beneficiaryRes = await client.query(
      'SELECT id, referred_by_user_id, wallet_balance_cop, membership_active_until FROM users WHERE id = $1 FOR UPDATE',
      [currentReferrerId],
    );
    if (!beneficiaryRes.rowCount) {
      break;
    }

    const beneficiary = beneficiaryRes.rows[0];
    currentReferrerId = beneficiary.referred_by_user_id;

    if (!levelConfig.enabled) {
      continue;
    }

    if (!isMembershipActive(beneficiary.membership_active_until)) {
      continue;
    }

    const commissionAmountCop = Number(levelConfig.amount_cop) * Number(order.total_products);
    if (commissionAmountCop <= 0) {
      continue;
    }

    const key = `${beneficiary.id}|${levelConfig.level}`;
    const existing = existingMap.get(key);

    if (existing) {
      const currentAmount = Number(existing.amount_cop);
      if (currentAmount !== commissionAmountCop) {
        const delta = commissionAmountCop - currentAmount;
        await client.query('UPDATE commissions SET amount_cop = $1 WHERE id = $2', [commissionAmountCop, existing.id]);
        if (delta !== 0) {
          await client.query(
            'UPDATE users SET wallet_balance_cop = wallet_balance_cop + $1 WHERE id = $2',
            [delta, beneficiary.id],
          );
        }
        updatedCount += 1;
      }
      continue;
    }

    const insertRes = await client.query(
      `
        INSERT INTO commissions(id, order_id, beneficiary_user_id, source_user_id, level, amount_cop, created_at)
        VALUES($1, $2, $3, $4, $5, $6, NOW())
      `,
      [randomUUID(), order.id, beneficiary.id, order.user_id, levelConfig.level, commissionAmountCop],
    );

    if (insertRes.rowCount > 0) {
      await client.query(
        'UPDATE users SET wallet_balance_cop = wallet_balance_cop + $1 WHERE id = $2',
        [commissionAmountCop, beneficiary.id],
      );
      createdCount += 1;
    }
  }

  return { createdCount, updatedCount };
}

async function main() {
  const envPath = path.resolve(__dirname, '..', '.env');
  loadEnvFile(envPath);

  const pool = new Pool(getDatabaseConfig());
  const client = await pool.connect();

  try {
    const commissionLevelsRes = await client.query(
      'SELECT level, amount_cop, enabled FROM commission_levels ORDER BY level ASC',
    );
    const commissionLevels = commissionLevelsRes.rows;

    const orderRes = await client.query(
      `
        SELECT
          o.id,
          o.user_id,
          o.payment_method,
          o.status,
          o.pending_payment_cop,
          o.delivery_method,
          SUM(oi.quantity)::int AS total_products
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        WHERE (
          (o.delivery_method = 'pickup' AND o.status = 'confirmed')
          OR (o.delivery_method = 'home_delivery' AND o.status = 'delivered')
        )
        GROUP BY o.id, o.user_id, o.payment_method, o.status, o.pending_payment_cop, o.delivery_method
        ORDER BY o.created_at DESC
      `,
    );

    let reconciledOrders = 0;
    let totalCommissionsCreated = 0;
    let totalCommissionsUpdated = 0;
    let cashOrdersFixed = 0;

    for (const order of orderRes.rows) {
      await client.query('BEGIN');
      try {
        if (order.payment_method === 'cash' && order.status === 'delivered' && Number(order.pending_payment_cop) > 0) {
          await client.query('UPDATE orders SET pending_payment_cop = 0 WHERE id = $1', [order.id]);
          cashOrdersFixed += 1;
        }

        const { createdCount, updatedCount } = await reconcileOrder(client, order, commissionLevels);
        if (createdCount > 0 || updatedCount > 0) {
          reconciledOrders += 1;
          totalCommissionsCreated += createdCount;
          totalCommissionsUpdated += updatedCount;
        }

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Error procesando orden ${order.id}:`, error.message || error);
      }
    }

    console.log('Reconciliación completada');
    console.log(`Órdenes procesadas con cambios en comisiones: ${reconciledOrders}`);
    console.log(`Registros de comisión creados: ${totalCommissionsCreated}`);
    console.log(`Registros de comisión actualizados: ${totalCommissionsUpdated}`);
    console.log(`Órdenes cash delivery corregidas (pending_payment_cop=0): ${cashOrdersFixed}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Error al ejecutar el script:', error.message || error);
  process.exit(1);
});
