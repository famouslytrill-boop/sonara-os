// Deterministic test environment for the SONARA OS suite.
// Cookie "secure" flags depend on NODE_ENV; supertest agents drop Secure
// cookies over plain HTTP, so tests must never inherit NODE_ENV=production
// from the developer shell. Production (Vercel) behavior is unaffected.
process.env.NODE_ENV = "test";
