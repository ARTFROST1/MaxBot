// scheduler.js — Персистентный планировщик напоминаний (аналог scheduler.py)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from './logger.js';
import { fsm } from './fsm.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REMINDERS_FILE = join(__dirname, 'reminders.json');

// callback_type -> async function handler(userId)
const _handlers = {};

// userId -> timeoutId
const _timers = {};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Публичный API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function registerHandler(callbackType, handler) {
  _handlers[callbackType] = handler;
}

export function schedule(userId, callbackType, delay, expectedState = '') {
  cancel(userId);

  const fireAt = Date.now() / 1000 + delay;
  const data = _load();
  data[String(userId)] = {
    callback_type: callbackType,
    fire_at: fireAt,
    expected_state: expectedState,
  };
  _save(data);

  _createTimer(userId, callbackType, delay * 1000);
  logger.debug(`[scheduler] Запланировано '${callbackType}' user=${userId} через ${delay} сек`);
}

export function cancel(userId) {
  const timerId = _timers[userId];
  if (timerId != null) {
    clearTimeout(timerId);
    delete _timers[userId];
  }

  const data = _load();
  if (data[String(userId)]) {
    delete data[String(userId)];
    _save(data);
  }
}

export async function restoreOnStartup() {
  const data = _load();
  if (!Object.keys(data).length) {
    logger.info('[scheduler] Нет сохранённых напоминаний для восстановления');
    return;
  }

  const now = Date.now() / 1000;
  let restored = 0;

  for (const [userIdStr, entry] of Object.entries(data)) {
    const userId = Number(userIdStr);
    const { callback_type: callbackType, fire_at: fireAt, expected_state: expectedState } = entry;

    if (!callbackType) continue;

    // Восстанавливаем FSM-состояние
    if (expectedState) {
      fsm.setState(userId, expectedState);
      logger.debug(`[scheduler] FSM user=${userId} восстановлено: ${expectedState}`);
    }

    // Оставшееся время. Минимум 10 сек
    const remainingMs = Math.max(10_000, (fireAt - now) * 1000);
    const overdue = fireAt < now;
    logger.info(
      `[scheduler] Восстановлено: '${callbackType}' user=${userId} через ${Math.round(remainingMs / 1000)} сек${overdue ? ' (просрочено)' : ' (в срок)'}`,
    );
    _createTimer(userId, callbackType, remainingMs);
    restored++;
  }

  logger.info(`[scheduler] Итого восстановлено напоминаний: ${restored}`);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Внутренние утилиты
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function _load() {
  if (!existsSync(REMINDERS_FILE)) return {};
  try {
    return JSON.parse(readFileSync(REMINDERS_FILE, 'utf-8'));
  } catch {
    logger.warn('[scheduler] reminders.json не читается');
    return {};
  }
}

function _save(data) {
  try {
    writeFileSync(REMINDERS_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    logger.warn({ err: e }, '[scheduler] reminders.json не записывается');
  }
}

function _createTimer(userId, callbackType, delayMs) {
  const timerId = setTimeout(async () => {
    try {
      const handler = _handlers[callbackType];
      if (!handler) {
        logger.error(`[scheduler] Обработчик не найден: '${callbackType}'`);
        return;
      }
      await handler(userId);
    } catch (err) {
      logger.error({ err }, `[scheduler] Ошибка в '${callbackType}' user=${userId}`);
    } finally {
      // Удаляем из словаря только если таймер тот же
      if (_timers[userId] === timerId) {
        delete _timers[userId];
      }
      // Удаляем из файла только если тип совпадает
      try {
        const data = _load();
        const entry = data[String(userId)];
        if (entry?.callback_type === callbackType) {
          delete data[String(userId)];
          _save(data);
        }
      } catch (e) {
        logger.warn({ err: e }, '[scheduler] Ошибка cleanup reminders.json');
      }
    }
  }, Math.max(0, delayMs));

  _timers[userId] = timerId;
}
