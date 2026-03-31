// config.js — Конфигурация MaxBot (аналог config.py)
import dotenv from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const env = (key, fallback = '') => process.env[key] ?? fallback;
const envInt = (key, fallback) => parseInt(env(key, String(fallback)), 10);
const envRequired = (key) => {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env variable: ${key}`);
  return v;
};

export const config = {
  // Bot
  MAX_BOT_TOKEN: envRequired('MAX_BOT_TOKEN'),

  // Admin
  ADMIN_CHAT_ID: env('ADMIN_CHAT_ID'),
  ADMIN_USER_ID: env('ADMIN_USER_ID'),

  // Yandex.Metrika
  METRIKA_TOKEN: env('METRIKA_TOKEN'),
  METRIKA_COUNTER_ID: env('METRIKA_COUNTER_ID'),

  // Metrika Goals
  GOAL_BOT_STARTED: env('GOAL_BOT_STARTED'),
  GOAL_STEP1: env('GOAL_STEP1'),
  GOAL_STEP2: env('GOAL_STEP2'),
  GOAL_NOT_ENOUGH: env('GOAL_NOT_ENOUGH'),
  GOAL_STEP3: env('GOAL_STEP3'),
  GOAL_NO_TARGET: env('GOAL_NO_TARGET'),
  GOAL_ACCESS: env('GOAL_ACCESS'),
  GOAL_NO_ACCESS: env('GOAL_NO_ACCESS'),
  GOAL_PRICE: env('GOAL_PRICE'),
  GOAL_SUB: env('GOAL_SUB'),
  GOAL_ANOTHER_BILL: env('GOAL_ANOTHER_BILL'),
  GOAL_HIGH_PRICE: env('GOAL_HIGH_PRICE'),
  GOAL_NO_REACTION: env('GOAL_NO_REACTION'),
  GOAL_ORDER_WITH_PHONE: env('GOAL_ORDER_WITH_PHONE'),
  GOAL_ORDER_NO_PHONE: env('GOAL_ORDER_NO_PHONE'),
  GOAL_ORDER_PRICE_WITH_PHONE: env('GOAL_ORDER_PRICE_WITH_PHONE'),
  GOAL_ORDER_PRICE_NO_PHONE: env('GOAL_ORDER_PRICE_NO_PHONE'),

  // Timeouts (seconds)
  GREETING_DELAY: envInt('GREETING_DELAY', 5),
  GOAL_REMINDER_TIMEOUT: envInt('GOAL_REMINDER_TIMEOUT', 600),
  ACCESS_REMINDER_TIMEOUT: envInt('ACCESS_REMINDER_TIMEOUT', 600),
  PRICE_REMINDER_TIMEOUT: envInt('PRICE_REMINDER_TIMEOUT', 86400),
  FINAL_REMINDER_TIMEOUT: envInt('FINAL_REMINDER_TIMEOUT', 86400),

  // Videos (local file paths)
  VIDEO_GREETING: env('VIDEO_GREETING'),
  VIDEO_KEY_GOAL: env('VIDEO_KEY_GOAL'),
  VIDEO_ACCESS_INSTRUCTION: env('VIDEO_ACCESS_INSTRUCTION'),
  VIDEO_GOAL_REMINDER: env('VIDEO_GOAL_REMINDER'),
  VIDEO_ABOUT_ME: env('VIDEO_ABOUT_ME'),
  VIDEO_WHY_PAID: env('VIDEO_WHY_PAID'),
  VIDEO_PRICE_REMINDER: env('VIDEO_PRICE_REMINDER'),

  // Channel
  MAX_CHANNEL_LINK: env('MAX_CHANNEL_LINK'),
  MAX_CHANNEL_ID: env('MAX_CHANNEL_ID'),

  // Contacts
  CONTACT_PHONE: env('CONTACT_PHONE', '+7-918-422-23-57'),
  CONTACT_TG: env('CONTACT_TG', '@sargos'),
};
