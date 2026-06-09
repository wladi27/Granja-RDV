const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

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
    if (value.startsWith('"') && value.endsWith('"')) {
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
    console.log('Using DATABASE_URL_VPS');
    return {
      connectionString: process.env.DATABASE_URL_VPS,
      ssl,
    };
  }
  if (process.env.DATABASE_URL) {
    console.log('Using DATABASE_URL');
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

async function run() {
  loadEnvFile(path.resolve(__dirname, '..', '.env'));
  const pool = new Pool(getDatabaseConfig());
  const client = await pool.connect();

  try {
    const results = [];
    const add = async (label, query) => {
      const res = await client.query(query);
      results.push({ label, rows: res.rows });
    };

    await add('commission_levels', 'SELECT level, amount_cop, enabled FROM commission_levels ORDER BY level');
    await add('orders_summary', `SELECT status, delivery_method, payment_method, COUNT(*) AS count FROM orders GROUP BY status, delivery_method, payment_method ORDER BY status, delivery_method, payment_method`);
    await add('total_orders', 'SELECT COUNT(*)::int AS total_orders FROM orders');
    await add('delivered_cash_pending', `SELECT COUNT(*)::int AS count FROM orders WHERE delivery_method = 'home_delivery' AND payment_method = 'cash' AND status = 'delivered' AND pending_payment_cop > 0`);
    await add('settled_order_commissions', `
      SELECT
        o.id,
        o.status,
        o.delivery_method,
        o.payment_method,
        o.pending_payment_cop,
        SUM(oi.quantity)::int AS total_products,
        COALESCE(c.total_commissions, 0)::bigint AS total_commissions,
        o.total_cop
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN (
        SELECT order_id, SUM(amount_cop)::bigint AS total_commissions FROM commissions GROUP BY order_id
      ) c ON c.order_id = o.id
      WHERE (o.delivery_method = 'pickup' AND o.status = 'confirmed')
         OR (o.delivery_method = 'home_delivery' AND o.status = 'delivered')
      GROUP BY o.id, o.status, o.delivery_method, o.payment_method, o.pending_payment_cop, c.total_commissions, o.total_cop
      ORDER BY o.created_at DESC
      LIMIT 20
    `);
    await add('settled_orders_without_commissions', `
      SELECT
        o.id,
        o.status,
        o.delivery_method,
        o.payment_method,
        SUM(oi.quantity)::int AS total_products,
        o.total_cop
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN (
        SELECT order_id, SUM(amount_cop) AS total_commissions FROM commissions GROUP BY order_id
      ) c ON c.order_id = o.id
      WHERE ((o.delivery_method = 'pickup' AND o.status = 'confirmed') OR (o.delivery_method = 'home_delivery' AND o.status = 'delivered'))
        AND COALESCE(c.total_commissions, 0) = 0
      GROUP BY o.id, o.status, o.delivery_method, o.payment_method, o.total_cop
      ORDER BY o.created_at DESC
      LIMIT 20
    `);
    await add('commission_distributions', `
      SELECT
        o.id AS order_id,
        o.status,
        o.delivery_method,
        o.payment_method,
        SUM(oi.quantity)::int AS total_products,
        COALESCE(c.total_commissions,0)::bigint AS total_commissions,
        c.commission_count,
        o.total_cop
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN (
        SELECT order_id, SUM(amount_cop)::bigint AS total_commissions, COUNT(*) AS commission_count FROM commissions GROUP BY order_id
      ) c ON c.order_id = o.id
      GROUP BY o.id, o.status, o.delivery_method, o.payment_method, c.total_commissions, c.commission_count, o.total_cop
      ORDER BY total_commissions DESC
      LIMIT 20
    `);

    console.log(JSON.stringify(results, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((error) => {
  console.error('ERROR:', error);
  process.exit(1);
});
