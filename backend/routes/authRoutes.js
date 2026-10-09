const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('../database/db');
const { authMiddleware, adminAuth } = require('../middleware/authMiddleware');
const { JWT_SECRET } = process.env;

// Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    if (!user.rows[0]) return res.status(401).json({ error: 'Invalid credentials' });

    const validPassword = await bcrypt.compare(password, user.rows[0].password);
    if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.rows[0].id, role: user.rows[0].role }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ 
      token, 
      id: user.rows[0].id,
      username: user.rows[0].username,
      role: user.rows[0].role
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Register (Admin-only)
router.post('/register', authMiddleware, adminAuth, async (req, res) => {
  const { username, password, role } = req.body;
  if (role !== 'cashier' && role !== 'admin') return res.status(400).json({ error: 'Invalid role' });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query(
      'INSERT INTO users (username, password, role) VALUES ($1, $2, $3)',
      [username, hashedPassword, role]
    );
    res.status(201).json({ message: 'User created' });
  } catch (err) {
    res.status(500).json({ error: 'Username already exists' });
  }
});



module.exports = router;