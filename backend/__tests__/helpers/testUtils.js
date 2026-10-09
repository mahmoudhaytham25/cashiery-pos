// Shared test utilities. Imported by every suite BEFORE the modules under
// test so that process.env.JWT_SECRET is already set when
// middleware/authMiddleware.js and routes/authRoutes.js read it at load time
// (both do `const { JWT_SECRET } = process.env;` at the top of the file).

const jwt = require('jsonwebtoken');

const JWT_SECRET = 'test-jwt-secret';
process.env.JWT_SECRET = JWT_SECRET;

// --- Token helpers -----------------------------------------------------------

const signToken = (payload, options) => jwt.sign(payload, JWT_SECRET, options);

const adminToken = () => signToken({ id: 1, role: 'admin' });
const cashierToken = () => signToken({ id: 2, role: 'cashier' });
const expiredToken = (payload = { id: 1, role: 'admin' }) =>
  signToken({ ...payload, exp: Math.floor(Date.now() / 1000) - 60 });

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

// --- Express res/next mocks (for plain middleware unit tests) ----------------

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

// --- pg client mock ----------------------------------------------------------
// transactionRoutes POST uses `const client = await db.connect()` then
// `client.query('BEGIN')`, per-statement queries, `client.query('COMMIT')` /
// `client.query('ROLLBACK')` and `client.release()`.
//
// createMockClient(results) returns { client, calls } where `results` is a
// queue of pg-style results consumed in query order. Queue entries may be
//   { rows: [...], rowCount: n }   -> resolves
//   new Error(...)                 -> rejects
// When the queue is empty, a benign { rows: [], rowCount: 0 } is resolved so
// that trailing ROLLBACK/COMMIT calls never fail. `calls` records every
// { text, params } the code issued so tests can assert on the SQL itself.

const createMockClient = (results = []) => {
  const queue = [...results];
  const calls = [];
  const client = {
    query: jest.fn((text, params) => {
      calls.push({ text, params });
      const next = queue.length ? queue.shift() : { rows: [], rowCount: 0 };
      if (next instanceof Error) return Promise.reject(next);
      return Promise.resolve(next);
    }),
    release: jest.fn(),
  };
  return { client, calls };
};

// Helpers for asserting on the queries a client/pool issued.
const queryTexts = (calls) => calls.map((c) => c.text);
const wasIssued = (calls, text) => calls.some((c) => c.text === text);
const firstMatch = (calls, pattern) =>
  calls.find((c) => (pattern instanceof RegExp ? pattern.test(c.text) : c.text === pattern));

module.exports = {
  JWT_SECRET,
  signToken,
  adminToken,
  cashierToken,
  expiredToken,
  bearer,
  mockRes,
  createMockClient,
  queryTexts,
  wasIssued,
  firstMatch,
};
