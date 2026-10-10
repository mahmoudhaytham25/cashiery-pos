// Tiny in-memory rate limiter (no external deps) for the auth endpoints.
// Tracks request counts per client IP in a fixed window — enough to blunt
// brute-force login attempts without needing Redis or another service.
const rateLimit = ({ windowMs = 5 * 60 * 1000, max = 20 } = {}) => {
  const hits = new Map(); // ip -> { count, resetAt }

  return (req, res, next) => {
    const now = Date.now();
    let entry = hits.get(req.ip);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(req.ip, entry);
      // Keep the map bounded: sweep expired buckets when it grows large.
      if (hits.size > 5000) {
        for (const [ip, e] of hits) if (now > e.resetAt) hits.delete(ip);
      }
    }
    entry.count += 1;
    if (entry.count > max) {
      return res.status(429).json({ error: 'Too many attempts, try again later' });
    }
    next();
  };
};

module.exports = { rateLimit };
