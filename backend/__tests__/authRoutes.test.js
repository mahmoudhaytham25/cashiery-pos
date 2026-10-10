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
  createMockClient,
  wasIssued,
  firstMatch,
} = require('./helpers/testUtils');
const { buildApp } = require('./helpers/app');

const app = buildApp();

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/auth/login', () => {
  test('401 when the username does not exist (compared against a dummy hash)', async () => {
    db.query.mockResolvedValue({ rows: [] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'ghost', password: 'password123' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid credentials' });
    expect(db.query).toHaveBeenCalledWith(
      'SELECT * FROM users WHERE username = $1',
      ['ghost']
    );
    // Timing-enumeration guard: bcrypt.compare still runs against a constant
    // dummy hash so unknown usernames cost the same as wrong passwords.
    expect(bcrypt.compare).toHaveBeenCalledWith('password123', expect.any(String));
  });

  test('401 when the password does not match the stored hash', async () => {
    db.query.mockResolvedValue({
      rows: [{ id: 3, username: 'bob', password: 'stored-hash', role: 'cashier' }],
    });
    bcrypt.compare.mockResolvedValue(false);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'bob', password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid credentials' });
    expect(bcrypt.compare).toHaveBeenCalledWith('wrong-password', 'stored-hash');
  });

  test.each([
    ['missing username', { password: 'password123' }],
    ['blank username', { username: '   ', password: 'password123' }],
    ['missing password', { username: 'bob' }],
    ['short password', { username: 'bob', password: 'short' }],
    ['non-string password', { username: 'bob', password: 12345678 }],
  ])('400 on invalid credentials: %s (no DB call, no bcrypt)', async (_label, body) => {
    const res = await request(app).post('/api/auth/login').send(body);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'Username and a password of at least 8 characters are required',
    });
    expect(db.query).not.toHaveBeenCalled();
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  test('200 returns a signed JWT plus user info on success', async () => {
    db.query.mockResolvedValue({
      rows: [{ id: 3, username: 'bob', password: 'stored-hash', role: 'cashier' }],
    });
    bcrypt.compare.mockResolvedValue(true);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'bob', password: 'correct-password' });

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
      .send({ username: 'bob', password: 'password123' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Server error' });
  });
});

describe('POST /api/auth/register', () => {
  // The register middleware first runs `SELECT COUNT(*)::int AS n FROM users`
  // on the pool. n > 0 → normal admin-only path; n = 0 → unauthenticated
  // bootstrap. The handler then opens a dedicated client, takes a transaction-
  // scoped advisory lock, re-counts users under the lock (bootstrap requests
  // only — an authenticated admin's existence already proves users exist),
  // and inserts.
  const usersExist = { rows: [{ n: 1 }] };

  test('401 without a token once users exist', async () => {
    db.query.mockResolvedValueOnce(usersExist);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'new', password: 'password123', role: 'cashier' });

    expect(res.status).toBe(401);
    // Only the count query ran — no insert.
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.connect).not.toHaveBeenCalled();
  });

  test('403 with a cashier (non-admin) token once users exist', async () => {
    db.query.mockResolvedValueOnce(usersExist);

    const res = await request(app)
      .post('/api/auth/register')
      .set(bearer(cashierToken()))
      .send({ username: 'new', password: 'password123', role: 'cashier' });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Admin access required' });
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.connect).not.toHaveBeenCalled();
  });

  test('400 with an admin token but an invalid role', async () => {
    db.query.mockResolvedValueOnce(usersExist);

    const res = await request(app)
      .post('/api/auth/register')
      .set(bearer(adminToken()))
      .send({ username: 'new', password: 'password123', role: 'manager' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid role' });
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.connect).not.toHaveBeenCalled();
  });

  test.each([
    ['missing username', { password: 'password123', role: 'cashier' }],
    ['short password', { username: 'new', password: 'short', role: 'cashier' }],
    ['missing password', { username: 'new', role: 'cashier' }],
  ])('400 on invalid credentials: %s (no DB write)', async (_label, body) => {
    db.query.mockResolvedValueOnce(usersExist);

    const res = await request(app)
      .post('/api/auth/register')
      .set(bearer(adminToken()))
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'Username and a password of at least 8 characters are required',
    });
    expect(db.connect).not.toHaveBeenCalled();
  });

  test('201 bootstrap: no token + empty users table creates an admin', async () => {
    bcrypt.hash.mockResolvedValue('hashed_pw');
    db.query.mockResolvedValueOnce({ rows: [{ n: 0 }] }); // middleware count → empty
    const { client, calls } = createMockClient([
      {},                          // BEGIN
      {},                          // pg_advisory_xact_lock
      { rows: [{ n: 0 }] },        // in-transaction recount → still empty
      { rows: [], rowCount: 1 },   // INSERT
      {},                          // COMMIT
    ]);
    db.connect.mockResolvedValue(client);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'first', password: 'plaintext1', role: 'cashier' });

    expect(res.status).toBe(201);
    // Requested 'cashier' but the locked recount must force 'admin'.
    const insert = firstMatch(calls, /INSERT INTO users/);
    expect(insert.params).toEqual(['first', 'hashed_pw', 'admin']);
    expect(wasIssued(calls, 'COMMIT')).toBe(true);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test('403 when a concurrent bootstrap registration already created the first user', async () => {
    // The middleware saw an empty users table (unauthenticated bootstrap),
    // but by the time this request holds the advisory lock a user exists —
    // the request was never authenticated, so it must not create anything.
    db.query.mockResolvedValueOnce({ rows: [{ n: 0 }] }); // middleware count
    const { client, calls } = createMockClient([
      {},                          // BEGIN
      {},                          // pg_advisory_xact_lock
      { rows: [{ n: 1 }] },        // recount → a user now exists
    ]);
    db.connect.mockResolvedValue(client);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'second', password: 'password123', role: 'cashier' });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Admin access required' });
    expect(firstMatch(calls, /INSERT INTO users/)).toBeUndefined();
    expect(wasIssued(calls, 'ROLLBACK')).toBe(true);
    expect(wasIssued(calls, 'COMMIT')).toBe(false);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test('201 creates the user with a bcrypt-hashed password', async () => {
    bcrypt.hash.mockResolvedValue('hashed_pw');
    db.query.mockResolvedValueOnce(usersExist); // middleware count
    const { client, calls } = createMockClient([
      {},                          // BEGIN
      {},                          // pg_advisory_xact_lock
      { rows: [], rowCount: 1 },   // INSERT (no recount — admin is authenticated)
      {},                          // COMMIT
    ]);
    db.connect.mockResolvedValue(client);

    const res = await request(app)
      .post('/api/auth/register')
      .set(bearer(adminToken()))
      .send({ username: 'newbie', password: 'plaintext1', role: 'cashier' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ message: 'User created' });
    expect(bcrypt.hash).toHaveBeenCalledWith('plaintext1', 10);
    // The plaintext password must never reach the database.
    const insert = firstMatch(calls, /INSERT INTO users/);
    expect(insert.params).toEqual(['newbie', 'hashed_pw', 'cashier']);
    expect(wasIssued(calls, 'COMMIT')).toBe(true);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test('409 on a duplicate-username violation (23505)', async () => {
    bcrypt.hash.mockResolvedValue('hashed_pw');
    db.query.mockResolvedValueOnce(usersExist);
    const conflict = new Error('duplicate key');
    conflict.code = '23505';
    const { client, calls } = createMockClient([
      {},                    // BEGIN
      {},                    // pg_advisory_xact_lock
      conflict,              // INSERT fails
    ]);
    db.connect.mockResolvedValue(client);

    const res = await request(app)
      .post('/api/auth/register')
      .set(bearer(adminToken()))
      .send({ username: 'taken', password: 'password123', role: 'admin' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Username already exists' });
    expect(wasIssued(calls, 'ROLLBACK')).toBe(true);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test('500 on a generic insert failure (no misleading message)', async () => {
    bcrypt.hash.mockResolvedValue('hashed_pw');
    db.query.mockResolvedValueOnce(usersExist);
    const { client, calls } = createMockClient([
      {},                    // BEGIN
      {},                    // pg_advisory_xact_lock
      new Error('boom'),     // INSERT fails
    ]);
    db.connect.mockResolvedValue(client);

    const res = await request(app)
      .post('/api/auth/register')
      .set(bearer(adminToken()))
      .send({ username: 'newbie', password: 'password123', role: 'cashier' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Server error' });
    expect(wasIssued(calls, 'ROLLBACK')).toBe(true);
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
