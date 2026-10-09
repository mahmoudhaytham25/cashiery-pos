const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authMiddleware, adminAuth } = require('../middleware/authMiddleware');

// Get all products (Cashier/Admin)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const search = req.query.search;
    let products;
    if (search) {
      products = await db.query(
        'SELECT * FROM products WHERE name ILIKE $1 ORDER BY name',
        [`%${search}%`]
      );
    } else {
      products = await db.query('SELECT * FROM products ORDER BY name');
    }
    res.json(products.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create product (Admin-only)
router.post('/', authMiddleware, adminAuth, async (req, res) => { // Add authMiddleware
  const { name, price, stock, SKU } = req.body;
  try {
    await db.query(
      'INSERT INTO products (name, price, stock, SKU) VALUES ($1, $2, $3, $4)',
      [name, price, stock, SKU]
    );
    res.status(201).json({ message: 'Product added' });
  } catch (err) {
    res.status(400).json({ error: 'Invalid SKU or missing fields' });
  }
});

router.get('/low-stock', authMiddleware, async (req, res) => {
  try {
    const products = await db.query(
      'SELECT * FROM products WHERE stock < 10'
    );
    res.json(products.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update product stock/price (Admin-only)
router.put('/:id', authMiddleware, adminAuth, async (req, res) => {
  const { id } = req.params;
  const { name, price, stock, SKU } = req.body;
  
  // Basic validation for required fields
  if (!name || price === undefined || stock === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Handle SKU being null, undefined, or empty string
    const skuValue = (SKU === null || SKU === undefined || SKU === '') ? null : SKU;
    
    const result = await db.query(
      `UPDATE products 
       SET name = $1, price = $2, stock = $3, SKU = $4 
       WHERE id = $5
       RETURNING *`,
      [name, parseFloat(price), parseInt(stock), skuValue, id]
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
    
    res.status(500).json({ 
      error: 'Failed to update product',
      details: err.message 
    });
  }
});

router.delete('/:productId', authMiddleware, adminAuth, async (req, res) => {
  const { productId } = req.params;
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