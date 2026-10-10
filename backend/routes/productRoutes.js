const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authMiddleware, adminAuth } = require('../middleware/authMiddleware');

// ':id' params must be positive integers before they reach Postgres.
const isValidId = (id) => /^\d+$/.test(id) && Number(id) > 0;

// NaN for empty/nullish input so '' or null can't slip through as 0.
const toNumber = (v) =>
  v === null || v === undefined || (typeof v === 'string' && v.trim() === '')
    ? NaN
    : Number(v);

// Returns an error message when name/price/stock are invalid, else null.
const validateProductFields = ({ name, price, stock }) => {
  if (typeof name !== 'string' || name.trim() === '') {
    return 'Name is required';
  }
  const p = toNumber(price);
  if (!Number.isFinite(p) || p < 0) {
    return 'Price must be a non-negative number';
  }
  const s = toNumber(stock);
  if (!Number.isInteger(s) || s < 0) {
    return 'Stock must be a non-negative integer';
  }
  return null;
};

const normalizeSku = (SKU) =>
  typeof SKU === 'string' && SKU.trim() !== '' ? SKU.trim() : null;

// Get all products (Cashier/Admin)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const search = req.query.search;
    let products;
    if (search) {
      products = await db.query(
        'SELECT * FROM products WHERE name ILIKE $1 ORDER BY name LIMIT 500',
        [`%${search}%`]
      );
    } else {
      products = await db.query('SELECT * FROM products ORDER BY name LIMIT 500');
    }
    res.json(products.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create product (Admin-only)
router.post('/', authMiddleware, adminAuth, async (req, res) => {
  const invalid = validateProductFields(req.body);
  if (invalid) return res.status(400).json({ error: invalid });

  const { name, price, stock, SKU } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO products (name, price, stock, SKU) VALUES ($1, $2, $3, $4) RETURNING *',
      [name.trim(), Number(price), Number(stock), normalizeSku(SKU)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: 'Invalid SKU or missing fields' });
  }
});

router.get('/low-stock', authMiddleware, async (req, res) => {
  try {
    let threshold = 10;
    if (req.query.threshold !== undefined) {
      const t = Number(req.query.threshold);
      if (!Number.isInteger(t) || t <= 0) {
        return res.status(400).json({ error: 'threshold must be a positive integer' });
      }
      threshold = Math.min(t, 1000);
    }
    const products = await db.query(
      'SELECT * FROM products WHERE stock < $1 LIMIT 500',
      [threshold]
    );
    res.json(products.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update product stock/price (Admin-only)
router.put('/:id', authMiddleware, adminAuth, async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) {
    return res.status(400).json({ error: 'Invalid product id' });
  }

  const { name, price, stock, SKU } = req.body;

  // Basic validation for required fields
  if (!name || price === undefined || stock === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const invalid = validateProductFields(req.body);
  if (invalid) return res.status(400).json({ error: invalid });

  try {
    const result = await db.query(
      `UPDATE products 
       SET name = $1, price = $2, stock = $3, SKU = $4 
       WHERE id = $5
       RETURNING *`,
      [name.trim(), Number(price), Number(stock), normalizeSku(SKU), id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({
      message: 'Product updated successfully',
      product: result.rows[0]
    });
  } catch (err) {
    console.error('Update error:', err);

    // Handle specific database errors
    if (err.code === '23505') { // Unique violation (e.g., duplicate SKU)
      return res.status(400).json({ error: 'SKU must be unique' });
    }

    res.status(500).json({ error: 'Failed to update product' });
  }
});

router.delete('/:productId', authMiddleware, adminAuth, async (req, res) => {
  const { productId } = req.params;
  if (!isValidId(productId)) {
    return res.status(400).json({ error: 'Invalid product id' });
  }
  try {
    // Optionally, check if product exists first
    const result = await db.query('DELETE FROM products WHERE id = $1 RETURNING *', [productId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ message: 'Product deleted successfully', product: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

module.exports = router;
