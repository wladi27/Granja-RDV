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
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

function getDatabaseConfig() {
  const ssl = process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false;
  if (process.env.DATABASE_URL_VPS) {
    return { connectionString: process.env.DATABASE_URL_VPS, ssl };
  }
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL, ssl };
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

async function main() {
  const envPath = path.resolve(__dirname, '..', '.env');
  loadEnvFile(envPath);
  const pool = new Pool(getDatabaseConfig());
  const client = await pool.connect();

  try {
    const orderId = process.argv[2] || 'c05c3268-f64b-4f70-8708-413742db1b32';
    console.log('Inspecting order', orderId);

    const orderRes = await client.query(
      `SELECT id, user_id, status, delivery_method, payment_method, pending_payment_cop, total_cop, created_at
       FROM orders WHERE id = $1`,
      [orderId],
    );
    console.log('order', orderRes.rows[0]);

    const itemsRes = await client.query(
      `SELECT oi.product_id, oi.quantity, oi.unit_price_cop, oi.total_price_cop, p.name
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1`,
      [orderId],
    );
    console.log('items', itemsRes.rows);

    const commissionsRes = await client.query(
      `SELECT id, beneficiary_user_id, source_user_id, level, amount_cop, created_at FROM commissions WHERE order_id = $1 ORDER BY level`,
      [orderId],
    );
    console.log('commissions', commissionsRes.rows);

    const userRes = await client.query(
      `SELECT id, full_name, email, referred_by_user_id, wallet_balance_cop, membership_active_until FROM users WHERE id = $1`,
      [orderRes.rows[0]?.user_id],
    );
    console.log('buyer', userRes.rows[0]);

    let current = userRes.rows[0];
    const chain = [];
    for (let level = 1; level <= 7; level += 1) {
      if (!current?.referred_by_user_id) break;
      const refRes = await client.query(
        `SELECT id, full_name, email, referred_by_user_id, wallet_balance_cop, membership_active_until FROM users WHERE id = $1`,
        [current.referred_by_user_id],
      );
      if (!refRes.rowCount) break;
      current = refRes.rows[0];
      chain.push({ level, ...current });
    }
    console.log('referral_chain', chain);

    const totalsRes = await client.query(
      `SELECT SUM(quantity)::int AS total_products FROM order_items WHERE order_id = $1`,
      [orderId],
    );
    console.log('total_products', totalsRes.rows[0]);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('ERROR', error);
  process.exit(1);
});
