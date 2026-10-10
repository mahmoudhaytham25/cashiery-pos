// Unit tests for middleware/rateLimit.js — exercised directly with mock
// req/res/next objects (no HTTP layer needed).

const { rateLimit } = require('../middleware/rateLimit');
const { mockRes } = require('./helpers/testUtils');

describe('rateLimit', () => {
  test('allows up to `max` requests per IP per window, then 429s', () => {
    const limiter = rateLimit({ windowMs: 60 * 1000, max: 3 });
    const req = { ip: '10.0.0.1' };
    const res = mockRes();
    const next = jest.fn();

    limiter(req, res, next);
    limiter(req, res, next);
    limiter(req, res, next);
    expect(next).toHaveBeenCalledTimes(3);
    expect(res.status).not.toHaveBeenCalled();

    limiter(req, res, next); // 4th request exceeds the cap
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({ error: 'Too many attempts, try again later' });
    expect(next).toHaveBeenCalledTimes(3); // not called again
  });

  test('tracks IPs independently and resets once the window expires', () => {
    const limiter = rateLimit({ windowMs: 1000, max: 1 });
    const next = jest.fn();

    limiter({ ip: 'a' }, mockRes(), next);
    const resA = mockRes();
    limiter({ ip: 'a' }, resA, next); // over the cap for 'a'
    expect(resA.status).toHaveBeenCalledWith(429);

    // A different IP is unaffected.
    limiter({ ip: 'b' }, mockRes(), next);
    expect(next).toHaveBeenCalledTimes(2);

    // After the window passes, 'a' is allowed again.
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 2000);
    limiter({ ip: 'a' }, mockRes(), next);
    expect(next).toHaveBeenCalledTimes(3);
    nowSpy.mockRestore();
  });
});
