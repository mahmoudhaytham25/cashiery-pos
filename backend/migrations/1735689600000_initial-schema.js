/**
 * Initial schema: users, products, transactions, transaction_items.
 *
 * Reproduces backend/database/schema.sql exactly — same columns, types,
 * constraints and defaults (there are no standalone indexes; uniqueness and
 * primary keys are expressed inline). All statements are idempotent
 * (IF NOT EXISTS / IF EXISTS), so this migration also applies cleanly to a
 * database that was already seeded by schema.sql — node-pg-migrate simply
 * records it in the `pgmigrations` table either way.
 */

exports.up = (pgm) => {
  pgm.sql(`
    -- Users table (Cashiers and Admins)
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(10) CHECK (role IN ('cashier', 'admin')) NOT NULL
    );

    -- Products table
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      price DECIMAL(10, 2) NOT NULL,
      stock INT NOT NULL,
      SKU VARCHAR(50) UNIQUE
    );

    -- Transactions table
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      cashier_id INT REFERENCES users(id) ON DELETE SET NULL,
      total DECIMAL(10, 2) NOT NULL,
      timestamp TIMESTAMP DEFAULT NOW()
    );

    -- Transaction line items table
    CREATE TABLE IF NOT EXISTS transaction_items (
      id SERIAL PRIMARY KEY,
      transaction_id INT REFERENCES transactions(id) ON DELETE CASCADE,
      product_id INT REFERENCES products(id) ON DELETE SET NULL,
      quantity INT NOT NULL,
      unit_price DECIMAL(10, 2) NOT NULL
    );
  `);
};

exports.down = (pgm) => {
  // Drop order respects FK dependencies (children first).
  pgm.sql(`
    DROP TABLE IF EXISTS transaction_items;
    DROP TABLE IF EXISTS transactions;
    DROP TABLE IF EXISTS products;
    DROP TABLE IF EXISTS users;
  `);
};
