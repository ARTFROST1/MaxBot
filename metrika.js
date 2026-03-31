// metrika.js — Яндекс.Метрика: отправка оффлайн-конверсий (аналог metrika.py)
import axios from 'axios';
import { config } from './config.js';
import { logger } from './logger.js';

const BASE_URL = 'https://api-metrika.yandex.net/management/v1';

export async function sendConversion(clientId, goalId, userId) {
  if (!clientId) {
    logger.debug(`ClientId не передан (userId=${userId}, goal=${goalId}) — конверсия пропущена`);
    return false;
  }

  if (!config.METRIKA_TOKEN || !config.METRIKA_COUNTER_ID || !goalId) {
    logger.debug('Метрика не настроена (токен/счётчик/цель) — конверсия не отправлена');
    return false;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const csvContent = `ClientId,Target,DateTime\n${clientId},${goalId},${timestamp}`;

  try {
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    form.append('file', Buffer.from(csvContent), {
      filename: 'conversion.csv',
      contentType: 'text/csv',
    });

    const response = await axios.post(
      `${BASE_URL}/counter/${config.METRIKA_COUNTER_ID}/offline_conversions/upload`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `OAuth ${config.METRIKA_TOKEN}`,
        },
        timeout: 15_000,
      },
    );

    if (response.status === 200) {
      logger.info(`✅ Конверсия отправлена: goal=${goalId}, cid=${clientId}`);
      return true;
    }
    logger.error(`❌ Ошибка Метрики: ${response.status} — ${JSON.stringify(response.data)}`);
    return false;
  } catch (e) {
    logger.error({ err: e }, '❌ Ошибка при отправке конверсии');
    return false;
  }
}
