// fsm.js — Кастомная FSM (аналог aiogram MemoryStorage + StatesGroup)
import { logger } from './logger.js';

// Enum состояний (аналог class Funnel(StatesGroup))
export const States = {
  GREETING: 'greeting',
  QUESTION_1: 'question_1',
  QUESTION_2_50K: 'question_2_50k',
  QUESTION_2_100K: 'question_2_100k',
  REJECT: 'reject',
  KEY_GOAL: 'key_goal',
  GOAL_REMINDER: 'goal_reminder',
  ACCESS_REQUEST: 'access_request',
  ACCESS_REMINDER: 'access_reminder',
  PRICE: 'price',
  PRICE_REMINDER: 'price_reminder',
  INDIVIDUAL: 'individual',
  PHONE_REQUEST: 'phone_request',
  FINISHED: 'finished',
};

class FSM {
  constructor() {
    /** @type {Map<number, string>} userId -> state */
    this._states = new Map();
    /** @type {Map<number, object>} userId -> data */
    this._data = new Map();
  }

  getState(userId) {
    return this._states.get(userId) || null;
  }

  setState(userId, state) {
    this._states.set(userId, state);
    logger.debug({ userId, state }, 'FSM setState');
  }

  getData(userId) {
    return this._data.get(userId) || {};
  }

  updateData(userId, newData) {
    const current = this._data.get(userId) || {};
    this._data.set(userId, { ...current, ...newData });
  }

  clear(userId) {
    this._states.delete(userId);
    this._data.delete(userId);
    logger.debug({ userId }, 'FSM clear');
  }
}

export const fsm = new FSM();
