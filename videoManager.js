// videoManager.js — Загрузка и кеширование видео для Max (замена Telegram file_id)
import { readFileSync, writeFileSync, existsSync, createReadStream } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { maxApi } from './maxApi.js';
import { config } from './config.js';
import { logger } from './logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOKENS_FILE = join(__dirname, 'video_tokens.json');

// Загрузка кеша
let tokenCache = {};
if (existsSync(TOKENS_FILE)) {
  try {
    tokenCache = JSON.parse(readFileSync(TOKENS_FILE, 'utf-8'));
  } catch { /* ignore corrupt cache */ }
}

function saveCache() {
  writeFileSync(TOKENS_FILE, JSON.stringify(tokenCache, null, 2));
}

/**
 * Загрузить видео в Max и получить токен.
 * Если токен закеширован — возвращает его.
 * @param {string} envKey — ключ конфигурации (VIDEO_GREETING, VIDEO_KEY_GOAL и т.д.)
 * @returns {Promise<string|null>} токен для attachment или null
 */
export async function getVideoToken(envKey) {
  // Из кеша
  if (tokenCache[envKey]) {
    return tokenCache[envKey];
  }

  const filePath = config[envKey];
  if (!filePath) {
    logger.debug(`Видео ${envKey} не настроено — пропуск`);
    return null;
  }

  const absPath = join(__dirname, filePath);
  if (!existsSync(absPath)) {
    logger.warn(`Файл видео не найден: ${absPath}`);
    return null;
  }

  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Шаг 1: получить URL для загрузки и токен
      const { url: uploadUrl, token } = await maxApi.getUploadUrl('video');

      // Для video-типа токен приходит сразу в ответе POST /uploads
      // Но файл всё равно нужно загрузить
      const filename = filePath.split('/').pop();
      const stream = createReadStream(absPath);
      await maxApi.uploadFile(uploadUrl, stream, filename);

      // Ждём обработки файла
      await new Promise((r) => setTimeout(r, 2000));

      // Сохраняем токен
      tokenCache[envKey] = token;
      saveCache();
      logger.info(`✅ Видео загружено: ${envKey} → token=${token.substring(0, 20)}...`);
      return token;
    } catch (e) {
      if (attempt < MAX_RETRIES) {
        const delay = attempt * 5000; // 5s, 10s
        logger.warn(`⚠️ Попытка ${attempt}/${MAX_RETRIES} не удалась для ${envKey}, повтор через ${delay / 1000}с`);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        logger.error({ err: e }, `❌ Ошибка загрузки видео ${envKey} после ${MAX_RETRIES} попыток`);
        return null;
      }
    }
  }
}

/**
 * Предзагрузить все видео при старте.
 */
export async function preloadVideos() {
  const keys = [
    'VIDEO_GREETING',
    'VIDEO_KEY_GOAL',
    'VIDEO_ACCESS_INSTRUCTION',
    'VIDEO_GOAL_REMINDER',
    'VIDEO_ABOUT_ME',
    'VIDEO_WHY_PAID',
    'VIDEO_PRICE_REMINDER',
  ];

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (config[key]) {
      await getVideoToken(key);
      // Пауза между загрузками, чтобы не перегружать upload-сервер
      if (i < keys.length - 1) {
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }
  logger.info('Все видео предзагружены');
}
