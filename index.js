// index.js — Точка входа MaxBot Auditbot
import { startPolling } from './bot.js';

startPolling().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
