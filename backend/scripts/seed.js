#!/usr/bin/env node
/**
 * First-run demo catalog seed.
 *
 * Inserts a small starter product catalog — but only while the products
 * table is completely empty, so it takes effect exactly once on a fresh
 * database and is a no-op on every later boot (docker-entrypoint.sh calls
 * it on each container start, right after migrations).
 *
 * Two seeded items sit below the default low-stock threshold (10) so the
 * admin dashboard's Low Stock Alerts card isn't empty on first login.
 *
 * Not wired into index.js on purpose: CI/e2e runs `node index.js` directly
 * and provisions its own catalog through the API. Set SEED_PRODUCTS=0
 * (or false/no/off) to skip — honored by both the entrypoint and
 * `npm run seed`. Transactions aren't seeded: they need a real cashier
 * user, which only exists after the bootstrap registration.
 */
const db = require('../database/db');

const DEMO_PRODUCTS = [
  // [name, price, stock, SKU] — first two are intentionally low-stock.
  ['Bottled Water 500ml', 1.5, 6, 'WAT-500'],
  ['Croissant', 3.75, 3, 'BAKE-CRS'],
  ['Chocolate Bar', 2.95, 59, 'SNK-CHOC'],
  ['Coca-Cola 330ml', 2.5, 46, 'COKE-330'],
  ['Iced Coffee', 4.25, 30, 'DRK-ICOF'],
  ['Potato Chips', 1.95, 80, 'SNK-CHP'],
  ['Orange Juice 1L', 3.5, 22, 'DRK-OJ1L'],
  ['Cheese Sandwich', 5.25, 14, 'DELI-CSW'],
];

const DISABLED = ['0', 'false', 'no', 'off'];

const main = async () => {
  if (DISABLED.includes((process.env.SEED_PRODUCTS || '').toLowerCase())) {
    console.log('seed: disabled via SEED_PRODUCTS — skipping');
    return;
  }
  const { rows } = await db.query('SELECT COUNT(*)::int AS n FROM products');
  if (rows[0].n > 0) {
    console.log(`seed: ${rows[0].n} products already present — skipping`);
    return;
  }
  const placeholders = DEMO_PRODUCTS.map(
    (_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`
  ).join(', ');
  await db.query(
    `INSERT INTO products (name, price, stock, SKU) VALUES ${placeholders}
     ON CONFLICT (SKU) DO NOTHING`,
    DEMO_PRODUCTS.flat()
  );
  console.log(`seed: inserted ${DEMO_PRODUCTS.length} demo products`);
};

main()
  .catch((err) => {
    console.error('seed: failed:', err);
    process.exitCode = 1;
  })
  .finally(() => db.end());
