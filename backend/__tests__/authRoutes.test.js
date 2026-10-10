// Tests for routes/authRoutes.js (POST /api/auth/login, POST /api/auth/register)
// mounted on a real express app, with the pg pool and bcrypt mocked.

jest.mock('../database/db', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('bcrypt', () => ({ compare: jest.fn(), hash: jest.fn() }));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('../database/db');
const {
  JWT_SECRET,
  adminToken,
  cashierToken,
  bearer,
} = require('./helpers/testUtils');
const { buildApp } = require('./helpers/app');

const app = buildApp();

beforeEach(() => {
  jest.resetAllMocks();
});

describe('POST /api/auth/login', () => {
  test('401 when the username does not exist (and password is never compared)', async () => {
    db.query.mockResolvedValue({ rows: [] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'ghost', password: 'pw' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid credentials' });
    expect(db.query).toHaveBeenCalledWith(
      'SELECT * FROM users WHERE username = $1',
      ['ghost']
    );
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  test('401 when the password does not match the stored hash', async () => {
    db.query.mockResolvedValue({
      rows: [{ id: 3, username: 'bob', password: 'stored-hash', role: 'cashier' }],
    });
    bcrypt.compare.mockResolvedValue(false);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'bob', password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid credentials' });
    expect(bcrypt.compare).toHaveBeenCalledWith('wrong', 'stored-hash');
  });

  test('200 returns a signed JWT plus user info on success', async () => {
    db.query.mockResolvedValue({
      rows: [{ id: 3, username: 'bob', password: 'stored-hash', role: 'cashier' }],
    });
    bcrypt.compare.mockResolvedValue(true);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'bob', password: 'correct' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 3, username: 'bob', role: 'cashier' });
    expect(typeof res.body.token).toBe('string');

    // The token must really be signed with the server secret and carry id+role.
    const decoded = jwt.verify(res.body.token, JWT_SECRET);
    expect(decoded).toMatchObject({ id: 3, role: 'cashier' });
    // 12h expiry is set on the token.
    expect(decoded.exp - decoded.iat).toBe(12 * 60 * 60);
  });

  test('500 when the database query fails', async () => {
    db.query.mockRejectedValue(new Error('connection reset'));

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'bob', password: 'pw' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Server error' });
  });
});

describe('POST /api/auth/register', () => {
  // The register middleware first runs `SELECT COUNT(*)::int AS n FROM users`.
  // n > 0 → normal admin-only path; n = 0 → unauthenticated bootstrap,
  // role forced to admin.
  const usersExist = { rows: [{ n: 1 }] };

  test('401 without a token once users exist', async () => {
    db.query.mockResolvedValueOnce(usersExist);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'new', password: 'pw', role: 'cashier' });

    expect(res.status).toBe(401);
    // Only the count query ran — no insert.
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  test('403 with a cashier (non-admin) token once users exist', async () => {
    db.query.mockResolvedValueOnce(usersExist);

    const res = await request(app)
      .post('/api/auth/register')
      .set(bearer(cashierToken()))
      .send({ username: 'new', password: 'pw', role: 'cashier' });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Admin access required' });
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  test('400 with an admin token but an invalid role', async () => {
    db.query.mockResolvedValueOnce(usersExist);

    const res = await request(app)
      .post('/api/auth/register')
      .set(bearer(adminToken()))
      .send({ username: 'new', password: 'pw', role: 'manager' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid role' });
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  test('201 bootstrap: no token + empty users table creates an admin', async () => {
    bcrypt.hash.mockResolvedValue('hashed_pw');
    db.query
      .mockResolvedValueOnce({ rows: [{ n: 0 }] })   // count → empty
      .mockResolvedValue({ rows: [], rowCount: 1 }); // insert

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'first', password: 'plaintext', role: 'cashier' });

    expect(res.status).toBe(201);
    // Requested 'cashier' but the middleware must force 'admin'.
    expect(db.query).toHaveBeenLastCalledWith(
      'INSERT INTO users (username, password, role) VALUES ($1, $2, $3)',
      ['first', 'hashed_pw', 'admin']
    );
  });

  test('201 creates the user with a bcrypt-hashed password', async () => {
    bcrypt.hash.mockResolvedValue('hashed_pw');
    db.query
      .mockResolvedValueOnce(usersExist)
      .mockResolvedValue({ rows: [], rowCount: 1 });

    const res = await request(app)
      .post('/api/auth/register')
      .set(bearer(adminToken()))
      .send({ username: 'newbie', password: 'plaintext', role: 'cashier' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ message: 'User created' });
    expect(bcrypt.hash).toHaveBeenCalledWith('plaintext', 10);
    // The plaintext password must never reach the database.
    expect(db.query).toHaveBeenLastCalledWith(
      'INSERT INTO users (username, password, role) VALUES ($1, $2, $3)',
      ['newbie', 'hashed_pw', 'cashier']
    );
  });

  test('500 when the insert fails (e.g. duplicate username)', async () => {
    bcrypt.hash.mockResolvedValue('hashed_pw');
    db.query
      .mockResolvedValueOnce(usersExist)
      .mockRejectedValue(new Error('duplicate key'));

    const res = await request(app)
      .post('/api/auth/register')
      .set(bearer(adminToken()))
      .send({ username: 'taken', password: 'pw', role: 'admin' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Username already exists' });
  });
});
