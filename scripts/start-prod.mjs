/**
 * Arranca o servidor com NODE_ENV=production (rotas de demo/dev desligadas por defeito).
 */
process.env.NODE_ENV = "production";
await import("../src/server.js");
