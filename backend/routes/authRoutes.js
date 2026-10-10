const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('../database/db');
const { firstUserOrAdmin } = require('../middleware/authMiddleware');
const { JWT_SECRET } = process.env;

// A syntactically valid bcrypt hash compared against when the username
// doesn't exist, so login timing can't reveal registered usernames.
const DUMMY_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

// Shared login/register credential check (before bcrypt or the DB).
const validCredentials = (username, password) =>
  typeof username === 'string' && username.trim() !== '' &&
  typeof password === 'string' && password.length >= 8;

const CREDENTIALS_ERROR = 'Username and a password of at least 8 characters are required';

// Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!validCredentials(username, password)) {
    return res.status(400).json({ error: CREDENTIALS_ERROR });
  }
  try {
    const user = await db.query('SELECT * FROM users WHERE username = $1', [username.trim()]);
    const hash = user.rows[0] ? user.rows[0].password : DUMMY_HASH;
    const validPassword = await bcrypt.compare(password, hash);
    if (!user.rows[0] || !validPassword) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.rows[0].id, username: user.rows[0].username, role: user.rows[0].role },
      JWT_SECRET,
      { expiresIn: '12h' }
    );
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

// Arbitrary key for the advisory lock that serializes bootstrap registration.
const BOOTSTRAP_LOCK_ID = 730001;

// Register (first-ever user becomes admin unauthenticated; afterwards admin-only)
router.post('/register', firstUserOrAdmin, async (req, res) => {
  const { username, password, role } = req.body;
  if (!validCredentials(username, password)) {
    return res.status(400).json({ error: CREDENTIALS_ERROR });
  }
  if (role !== 'cashier' && role !== 'admin') return res.status(400).json({ error: 'Invalid role' });

  let client;
  try {
    client = await db.connect();
    await client.query('BEGIN');
    // Serialize the "is this the first user" check + insert so two concurrent
    // registrations can't both slip past firstUserOrAdmin and create admins.
    await client.query('SELECT pg_advisory_xact_lock($1)', [BOOTSTRAP_LOCK_ID]);
    const { rows } = await client.query('SELECT COUNT(*)::int AS n FROM users');
    if (rows[0].n > 0 && req.isBootstrap) {
      // Another registration won the bootstrap race — this request was never
      // authenticated, so it may not create a user at all.
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Admin access required' });
    }
    const finalRole = rows[0].n === 0 ? 'admin' : role;

    const hashedPassword = await bcrypt.hash(password, 10);
    await client.query(
      'INSERT INTO users (username, password, role) VALUES ($1, $2, $3)',
      [username.trim(), hashedPassword, finalRole]
    );
    await client.query('COMMIT');
    res.status(201).json({ message: 'User created' });
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    if (err.code === '23505') return res.status(409).json({ error: 'Username already exists' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    if (client) client.release();
  }
});



module.exports = router;
