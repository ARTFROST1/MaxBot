// bot.js — Polling loop, routing, handlers (аналог bot.py)
import { config } from './config.js';
import { logger } from './logger.js';
import { maxApi } from './maxApi.js';
import { fsm, States } from './fsm.js';
import * as scheduler from './scheduler.js';
import { sendConversion } from './metrika.js';
import { getVideoToken, preloadVideos } from './videoManager.js';
import {
  CB_Q1_YES, CB_Q1_NO,
  CB_Q2_50K_YES, CB_Q2_50K_NO,
  CB_Q2_100K_YES, CB_Q2_100K_NO,
  CB_REJECT_APPLY, CB_GOAL_AUDIT,
  CB_ACCESS_YES, CB_ACCESS_REM_YES, CB_ACCESS_REM_WRITE,
  CB_PRICE_YES, CB_PRICE_NO,
  CB_PRICE_REM_PAY, CB_PRICE_REM_WRITE,
  CB_INDIVIDUAL_WRITE, CB_SUB_CHECK, CB_SUB_READY, CB_PRICE_CONTINUE, CB_PHONE_SKIP,
  KB_QUESTION_1, KB_QUESTION_2_50K, KB_QUESTION_2_100K,
  KB_REJECT, KB_ACCESS_REQUEST, KB_ACCESS_REMINDER,
  KB_PRICE_REMINDER, KB_INDIVIDUAL, KB_PHONE_REQUEST,
  kbPrice, kbPriceSubscribed, kbPriceSubReminder, kbChannelLink,
  MSG_GREETING, MSG_QUESTION_1, MSG_QUESTION_2_50K, MSG_QUESTION_2_100K,
  MSG_REJECT, MSG_KEY_GOAL, MSG_GOAL_REMINDER, MSG_GOAL_CONFIRMED,
  MSG_ACCESS_REQUEST, MSG_ACCESS_REMINDER,
  MSG_PRICE, MSG_PRICE_DISCOUNTED, MSG_PRICE_SUB_REMINDER, MSG_PRICE_REMINDER,
  MSG_INDIVIDUAL, MSG_PHONE_REQUEST,
  MSG_LEAD_SHORT, MSG_LEAD_REQUISITES, MSG_LEAD_SUBSCRIBED, MSG_FINAL_REMINDER,
  adminNotification,
} from './messages.js';

let cachedResolvedChannel = null;

function normalizeMaxLink(link) {
  if (!link) return '';
  return String(link)
    .trim()
    .replace(/^max:\/\//i, 'https://')
    .replace(/^https?:\/\/web\.max\.ru/i, 'https://max.ru')
    .replace(/\/$/, '');
}

async function resolveChannelIdForSubscriptionCheck() {
  if (cachedResolvedChannel) return cachedResolvedChannel;

  const explicitId = String(config.MAX_CHANNEL_ID || '').trim();
  const explicitLink = normalizeMaxLink(config.MAX_CHANNEL_LINK);

  const saveResolved = ({ id, link }, reason) => {
    const normalized = {
      id: String(id || '').trim(),
      link: normalizeMaxLink(link || ''),
    };
    cachedResolvedChannel = normalized;
    if (!config.MAX_CHANNEL_ID && normalized.id) config.MAX_CHANNEL_ID = normalized.id;
    if (!config.MAX_CHANNEL_LINK && normalized.link) config.MAX_CHANNEL_LINK = normalized.link;
    logger.info(
      {
        channelId: normalized.id || null,
        channelLink: normalized.link || null,
        reason,
      },
      'Канал для проверки подписки определён',
    );
    return normalized;
  };

  if (explicitId && explicitLink) {
    return saveResolved({ id: explicitId, link: explicitLink }, 'env:id+link');
  }

  let marker = null;
  const allChats = [];
  for (let i = 0; i < 20; i += 1) {
    const page = await maxApi.getChats(marker, 100);
    const chats = Array.isArray(page?.chats) ? page.chats : [];
    allChats.push(...chats);

    if (page?.marker == null || page.marker === marker) break;
    marker = page.marker;
  }

  if (explicitLink) {
    const foundByLink = allChats.find((chat) => normalizeMaxLink(chat?.link) === explicitLink);
    if (foundByLink) {
      return saveResolved(
        {
          id: foundByLink.chat_id ?? foundByLink.id,
          link: foundByLink.link || explicitLink,
        },
        'api:link-match',
      );
    }
    logger.warn({ channelLink: explicitLink }, 'MAX_CHANNEL_LINK не найден среди /chats');
  }

  if (explicitId) {
    const foundById = allChats.find((chat) => String(chat.chat_id ?? chat.id) === explicitId);
    if (foundById) {
      return saveResolved(
        {
          id: explicitId,
          link: foundById.link || explicitLink,
        },
        'api:id-match',
      );
    }
    return saveResolved({ id: explicitId, link: explicitLink }, 'env:id-only');
  }

  const channels = allChats.filter((chat) => chat?.type === 'channel' && chat?.status === 'active');
  if (channels.length === 1) {
    return saveResolved(
      {
        id: channels[0].chat_id ?? channels[0].id,
        link: channels[0].link || '',
      },
      'api:single-active-channel',
    );
  }

  logger.warn(
    {
      channelsFound: channels.length,
      hasEnvChannelId: Boolean(explicitId),
      hasEnvChannelLink: Boolean(explicitLink),
    },
    'Не удалось определить канал для проверки подписки',
  );
  return null;
}

// ── Вспомогательная отправка шага ─────────────────────────
async function sendStep(userId, text, { keyboard = null, videoKey = '' } = {}) {
  // Typing action (аналог bot.send_chat_action в Python)
  try {
    await maxApi.sendAction(userId, 'typing_on');
  } catch { /* ignore */ }

  // Отправляем видео перед текстом, если указано (как в Python _send_step)
  if (videoKey) {
    try {
      const token = await getVideoToken(videoKey);
      if (token) {
        await maxApi.sendMessage(userId, {
          attachments: [{ type: 'video', payload: { token } }],
        });
      }
    } catch (e) {
      logger.warn({ err: e }, `Не удалось отправить видео ${videoKey}`);
    }
  }

  const body = { text, format: 'html' };
  if (keyboard) {
    body.attachments = [keyboard];
  }
  return maxApi.sendMessage(userId, body);
}

async function removeButtons(messageId) {
  try {
    await maxApi.editMessage(messageId, { attachments: [] });
  } catch {
    // Сообщение уже отредактировано или удалено
  }
}

function ensureUserData(userId, user) {
  if (!user) return;
  const data = fsm.getData(userId);
  if (!data.max_user_id) {
    const enriched = {
      max_user_id: userId,
      username: user.username || '',
      full_name: [user.first_name, user.last_name].filter(Boolean).join(' '),
    };
    fsm.updateData(userId, enriched);
  }
}

// ── Обработчики напоминаний ──────────────────────────────

async function hdlGoalReminder(userId) {
  if (fsm.getState(userId) === States.KEY_GOAL) {
    await sendStep(userId, MSG_GOAL_REMINDER, { videoKey: 'VIDEO_GOAL_REMINDER' });
    fsm.setState(userId, States.GOAL_REMINDER);
    const data = fsm.getData(userId);
    sendConversion(data.client_id, config.GOAL_NO_TARGET, userId).catch(() => {});
    scheduler.schedule(userId, 'goal_final', config.FINAL_REMINDER_TIMEOUT, States.GOAL_REMINDER);
  }
}

async function hdlGoalFinal(userId) {
  if (fsm.getState(userId) === States.GOAL_REMINDER) {
    await sendStep(userId, MSG_FINAL_REMINDER);
    fsm.setState(userId, States.FINISHED);
    const data = fsm.getData(userId);
    sendConversion(data.client_id, config.GOAL_NO_REACTION, userId).catch(() => {});
  }
}

async function hdlAccessReminder(userId) {
  if (fsm.getState(userId) === States.ACCESS_REQUEST) {
    await sendStep(userId, MSG_ACCESS_REMINDER, {
      keyboard: KB_ACCESS_REMINDER,
      videoKey: 'VIDEO_ABOUT_ME',
    });
    fsm.setState(userId, States.ACCESS_REMINDER);
    const data = fsm.getData(userId);
    sendConversion(data.client_id, config.GOAL_NO_ACCESS, userId).catch(() => {});
    scheduler.schedule(userId, 'access_final', config.FINAL_REMINDER_TIMEOUT, States.ACCESS_REMINDER);
  }
}

async function hdlAccessFinal(userId) {
  if (fsm.getState(userId) === States.ACCESS_REMINDER) {
    await sendStep(userId, MSG_FINAL_REMINDER);
    fsm.setState(userId, States.FINISHED);
    const data = fsm.getData(userId);
    sendConversion(data.client_id, config.GOAL_NO_REACTION, userId).catch(() => {});
  }
}

async function hdlPriceReminder(userId) {
  if (fsm.getState(userId) === States.PRICE) {
    await sendStep(userId, MSG_PRICE_REMINDER, {
      keyboard: KB_PRICE_REMINDER,
      videoKey: 'VIDEO_PRICE_REMINDER',
    });
    fsm.setState(userId, States.PRICE_REMINDER);
    const data = fsm.getData(userId);
    sendConversion(data.client_id, config.GOAL_HIGH_PRICE, userId).catch(() => {});
    scheduler.schedule(userId, 'price_final', config.FINAL_REMINDER_TIMEOUT, States.PRICE_REMINDER);
  }
}

async function hdlPriceFinal(userId) {
  if (fsm.getState(userId) === States.PRICE_REMINDER) {
    await sendStep(userId, MSG_FINAL_REMINDER);
    fsm.setState(userId, States.FINISHED);
    const data = fsm.getData(userId);
    sendConversion(data.client_id, config.GOAL_NO_REACTION, userId).catch(() => {});
  }
}

// ── Хелперы воронки ──────────────────────────────────────

async function sendAccessRequest(userId) {
  await sendStep(userId, MSG_GOAL_CONFIRMED);
  await sendStep(userId, MSG_ACCESS_REQUEST, {
    keyboard: KB_ACCESS_REQUEST,
    videoKey: 'VIDEO_ACCESS_INSTRUCTION',
  });
  fsm.setState(userId, States.ACCESS_REQUEST);
  const data = fsm.getData(userId);
  sendConversion(data.client_id, config.GOAL_ACCESS, userId).catch(() => {});
  scheduler.schedule(userId, 'access_reminder', config.ACCESS_REMINDER_TIMEOUT, States.ACCESS_REQUEST);
}

async function sendPrice(userId) {
  const data = fsm.getData(userId);
  const subscribed = !!data.channel_subscribed;
  const text = subscribed ? MSG_PRICE_DISCOUNTED : MSG_PRICE;
  const priceKb = subscribed ? kbPriceSubscribed() : kbPrice();
  await sendStep(userId, text, { keyboard: priceKb, videoKey: 'VIDEO_WHY_PAID' });
  fsm.setState(userId, States.PRICE);
  sendConversion(data.client_id, config.GOAL_PRICE, userId).catch(() => {});
  scheduler.schedule(userId, 'price_reminder', config.PRICE_REMINDER_TIMEOUT, States.PRICE);
}

async function requestPhone(userId, leadType) {
  fsm.updateData(userId, { pending_lead_type: leadType });
  await sendStep(userId, MSG_PHONE_REQUEST, { keyboard: KB_PHONE_REQUEST });
  fsm.setState(userId, States.PHONE_REQUEST);
}

async function finalizeLead(userId) {
  const data = fsm.getData(userId);
  const leadTypeKey = data.pending_lead_type || 'short';

  let msg, leadTypeLabel;
  if (leadTypeKey === 'subscribed') {
    msg = MSG_LEAD_SUBSCRIBED;
    leadTypeLabel = 'Подписчик (бесплатный аудит)';
  } else if (leadTypeKey === 'requisites') {
    msg = MSG_LEAD_REQUISITES;
    leadTypeLabel = 'Готов оплатить';
  } else {
    msg = MSG_LEAD_SHORT;
    leadTypeLabel = 'Запрос связи';
  }

  if (leadTypeKey === 'subscribed') {
    // Подписчик — без кнопки канала (уже подписан)
    await maxApi.sendMessage(userId, { text: msg, format: 'html' });
  } else {
    const channelKb = kbChannelLink();
    const hasButtons = Array.isArray(channelKb?.payload?.buttons) && channelKb.payload.buttons.length > 0;
    const body = { text: msg, format: 'html' };
    if (hasButtons) body.attachments = [channelKb];
    await maxApi.sendMessage(userId, body);
  }
  fsm.setState(userId, States.FINISHED);

  // Метрика: специфичная цель
  const phone = data.phone || '';
  let specificGoal;
  if (leadTypeKey === 'requisites') {
    specificGoal = phone ? config.GOAL_ORDER_PRICE_WITH_PHONE : config.GOAL_ORDER_PRICE_NO_PHONE;
  } else {
    specificGoal = phone ? config.GOAL_ORDER_WITH_PHONE : config.GOAL_ORDER_NO_PHONE;
  }
  sendConversion(data.client_id, specificGoal, userId).catch(() => {});

  // Уведомление админу
  await notifyAdmin(data, leadTypeLabel);
}

async function notifyAdmin(data, leadType) {
  if (!config.ADMIN_CHAT_ID) {
    logger.debug('ADMIN_CHAT_ID не задан — уведомление не отправлено');
    return;
  }
  const text = adminNotification({
    username: data.username || '',
    fullName: data.full_name || '',
    userId: data.max_user_id || '',
    ycid: data.client_id || '',
    adWorked: data.ad_worked || '—',
    budgetOk: data.budget_ok || '—',
    keyGoal: data.key_goal || '—',
    phone: data.phone || '',
    leadType,
    channelSubscribed: !!data.channel_subscribed,
    dataIncomplete: !data.max_user_id,
  });
  try {
    await maxApi.sendChatMessage(Number(config.ADMIN_CHAT_ID), { text, format: 'html' });
  } catch (e) {
    logger.error({ err: e }, 'Не удалось уведомить админа');
  }
}

// ── Обработка bot_started ────────────────────────────────

async function handleBotStarted(update) {
  const userId = update.user?.user_id;
  if (!userId) return;

  scheduler.cancel(userId);
  fsm.clear(userId);

  // Извлекаем ClientId из deep-link payload (если есть)
  // Формат ссылки: https://max.ru/<botName>?start=cid_XXXXXXXX
  let clientId = null;
  const payload = update.payload;
  if (payload && payload.startsWith('cid_')) {
    clientId = payload.slice(4);
    logger.info(`ClientId из deep-link получен: ${clientId} (max_user_id=${userId})`);
  } else if (payload) {
    logger.debug(`Deep-link payload без cid_: ${payload}`);
  }

  fsm.updateData(userId, {
    client_id: clientId,
    max_user_id: userId,
    username: update.user.username || '',
    full_name: [update.user.first_name, update.user.last_name].filter(Boolean).join(' '),
  });

  // Enrich: fetch full profile via GET /chats/{userId}
  try {
    const chatInfo = await maxApi.getChat(userId);
    const profile = chatInfo?.dialog_with_user;
    if (profile) {
      logger.debug({ profile_username: profile.username, profile_name: profile.first_name }, 'Enriched user profile');
      const enriched = {};
      if (profile.username) enriched.username = profile.username;
      const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
      if (fullName) enriched.full_name = fullName;
      if (Object.keys(enriched).length) fsm.updateData(userId, enriched);
    }
  } catch (e) {
    logger.debug({ err: e }, 'Не удалось обогатить профиль пользователя');
  }

  fsm.setState(userId, States.GREETING);
  await sendStep(userId, MSG_GREETING, { videoKey: 'VIDEO_GREETING' });

  sendConversion(clientId, config.GOAL_BOT_STARTED, userId).catch(() => {});

  // Таймаут 5 сек → автоматически отправляем Вопрос 1
  setTimeout(async () => {
    try {
      if (fsm.getState(userId) === States.GREETING) {
        await sendStep(userId, MSG_QUESTION_1, { keyboard: KB_QUESTION_1 });
        fsm.setState(userId, States.QUESTION_1);
        const data = fsm.getData(userId);
        sendConversion(data.client_id, config.GOAL_STEP1, userId).catch(() => {});
      }
    } catch (e) {
      logger.error({ err: e }, 'Ошибка отправки Вопрос 1 после greeting delay');
    }
  }, config.GREETING_DELAY * 1000);
}

// ── Обработка callback (нажатие inline-кнопки) ───────────

async function handleCallback(update) {
  const cb = update.callback;
  if (!cb) return;

  const userId = cb.user?.user_id;
  const callbackId = cb.callback_id;
  const payload = cb.payload;
  const messageId = update.message?.body?.mid;

  if (!userId || !payload) return;

  // Re-populate user identity if lost after restart
  ensureUserData(userId, cb.user);

  // Ответить на callback (убрать "загрузку")
  await maxApi.answerCallback(callbackId).catch(() => {});

  switch (payload) {
    // ── Вопрос 1 ──
    case CB_Q1_YES: {
      scheduler.cancel(userId);
      if (messageId) await removeButtons(messageId);
      fsm.updateData(userId, { ad_worked: 'Да' });
      await sendStep(userId, MSG_QUESTION_2_50K, { keyboard: KB_QUESTION_2_50K });
      fsm.setState(userId, States.QUESTION_2_50K);
      const data = fsm.getData(userId);
      sendConversion(data.client_id, config.GOAL_STEP2, userId).catch(() => {});
      break;
    }
    case CB_Q1_NO: {
      scheduler.cancel(userId);
      if (messageId) await removeButtons(messageId);
      fsm.updateData(userId, { ad_worked: 'Нет' });
      await sendStep(userId, MSG_QUESTION_2_100K, { keyboard: KB_QUESTION_2_100K });
      fsm.setState(userId, States.QUESTION_2_100K);
      const data = fsm.getData(userId);
      sendConversion(data.client_id, config.GOAL_STEP2, userId).catch(() => {});
      break;
    }

    // ── Вопрос 2: Бюджет достаточный ──
    case CB_Q2_50K_YES:
    case CB_Q2_100K_YES: {
      scheduler.cancel(userId);
      if (messageId) await removeButtons(messageId);
      fsm.updateData(userId, { budget_ok: 'Да' });
      await sendStep(userId, MSG_KEY_GOAL, { videoKey: 'VIDEO_KEY_GOAL' });
      fsm.setState(userId, States.KEY_GOAL);
      const data = fsm.getData(userId);
      sendConversion(data.client_id, config.GOAL_STEP3, userId).catch(() => {});
      scheduler.schedule(userId, 'goal_reminder', config.GOAL_REMINDER_TIMEOUT, States.KEY_GOAL);
      break;
    }

    // ── Вопрос 2: Бюджет недостаточный ──
    case CB_Q2_50K_NO:
    case CB_Q2_100K_NO: {
      scheduler.cancel(userId);
      if (messageId) await removeButtons(messageId);
      fsm.updateData(userId, { budget_ok: 'Нет' });
      await sendStep(userId, MSG_REJECT, { keyboard: KB_REJECT, videoKey: 'VIDEO_ABOUT_ME' });
      fsm.setState(userId, States.REJECT);
      const data = fsm.getData(userId);
      sendConversion(data.client_id, config.GOAL_NOT_ENOUGH, userId).catch(() => {});
      break;
    }

    // ── Отказ → Оставить заявку ──
    case CB_REJECT_APPLY: {
      scheduler.cancel(userId);
      if (messageId) await removeButtons(messageId);
      await requestPhone(userId, 'short');
      break;
    }

    // ── Напоминание о цели → перейти к аудиту ──
    case CB_GOAL_AUDIT: {
      scheduler.cancel(userId);
      if (messageId) await removeButtons(messageId);
      await sendStep(userId, MSG_GOAL_REMINDER);
      fsm.setState(userId, States.GOAL_REMINDER);
      scheduler.schedule(userId, 'goal_final', config.FINAL_REMINDER_TIMEOUT, States.GOAL_REMINDER);
      break;
    }

    // ── Доступ: согласие ──
    case CB_ACCESS_YES:
    case CB_ACCESS_REM_YES: {
      scheduler.cancel(userId);
      if (messageId) await removeButtons(messageId);
      await sendPrice(userId);
      break;
    }

    // ── Доступ: напишите мне ──
    case CB_ACCESS_REM_WRITE: {
      scheduler.cancel(userId);
      if (messageId) await removeButtons(messageId);
      await requestPhone(userId, 'short');
      break;
    }

    // ── Проверка подписки ──
    case CB_SUB_CHECK: {
      let resolvedChannel = null;
      try {
        resolvedChannel = await resolveChannelIdForSubscriptionCheck();
      } catch (e) {
        logger.warn({ err: e }, 'Ошибка автоопределения канала для проверки подписки');
      }

      if (!resolvedChannel?.id) {
        await maxApi.answerCallbackNotification(
          callbackId,
          'Не настроен канал для проверки подписки. Укажите MAX_CHANNEL_ID или MAX_CHANNEL_LINK и перезапустите бота.',
        ).catch(() => {});
        break;
      }
      try {
        const result = await maxApi.getMembers(resolvedChannel.id, [userId]);
        const members = Array.isArray(result?.members) ? result.members : [];
        const isMember = members.some((member) => String(member?.user_id) === String(userId));
        if (isMember) {
          fsm.updateData(userId, { channel_subscribed: true });
          await maxApi.answerCallbackNotification(callbackId, 'Подписка подтверждена — аудит бесплатно!').catch(() => {});
          const data = fsm.getData(userId);
          sendConversion(data.client_id, config.GOAL_SUB, userId).catch(() => {});

          if (data.price_accepted) {
            // Пользователь уже нажал "Да, по счёту" — перенаправляем на телефон
            scheduler.cancel(userId);
            if (messageId) await removeButtons(messageId);
            await requestPhone(userId, 'subscribed');
          } else {
            // Обновить сообщение — бесплатно + кнопка "Готов к аудиту"
            if (messageId) {
              try {
                await maxApi.editMessage(messageId, {
                  text: MSG_PRICE_DISCOUNTED,
                  format: 'html',
                  attachments: [kbPriceSubscribed()],
                });
              } catch { /* ignore */ }
            }
          }
        } else {
          await maxApi.answerCallbackNotification(callbackId, 'Подписку не вижу. Подпишитесь на канал и нажмите «Проверить подписку».').catch(() => {});
        }
      } catch (e) {
        logger.warn({ err: e }, 'Не удалось проверить подписку');
        await maxApi.answerCallbackNotification(callbackId, 'Ошибка проверки подписки. Попробуйте позже.').catch(() => {});
      }
      break;
    }

    // ── Подписчик готов к бесплатному аудиту ──
    case CB_SUB_READY: {
      scheduler.cancel(userId);
      if (messageId) await removeButtons(messageId);
      await requestPhone(userId, 'subscribed');
      break;
    }

    // ── Цена: да, по счёту ──
    case CB_PRICE_YES:
    case CB_PRICE_REM_PAY: {
      scheduler.cancel(userId);
      if (messageId) await removeButtons(messageId);
      const data = fsm.getData(userId);
      if (data.channel_subscribed) {
        // Уже подписан → сразу к телефону → бесплатный аудит
        await requestPhone(userId, 'subscribed');
      } else {
        // Не подписан → напомнить про бесплатный вариант
        fsm.updateData(userId, { price_accepted: true });
        await sendStep(userId, MSG_PRICE_SUB_REMINDER, { keyboard: kbPriceSubReminder() });
      }
      break;
    }

    // ── Продолжить оплату без подписки ──
    case CB_PRICE_CONTINUE: {
      scheduler.cancel(userId);
      if (messageId) await removeButtons(messageId);
      await requestPhone(userId, 'requisites');
      break;
    }

    // ── Цена: другой способ ──
    case CB_PRICE_NO: {
      scheduler.cancel(userId);
      if (messageId) await removeButtons(messageId);
      await sendStep(userId, MSG_INDIVIDUAL, { keyboard: KB_INDIVIDUAL });
      fsm.setState(userId, States.INDIVIDUAL);
      const data = fsm.getData(userId);
      sendConversion(data.client_id, config.GOAL_ANOTHER_BILL, userId).catch(() => {});
      break;
    }

    // ── Напоминание о цене / индивидуальный: напишите мне ──
    case CB_PRICE_REM_WRITE:
    case CB_INDIVIDUAL_WRITE: {
      scheduler.cancel(userId);
      if (messageId) await removeButtons(messageId);
      await requestPhone(userId, 'short');
      break;
    }

    // ── Телефон: пропустить ──
    case CB_PHONE_SKIP: {
      if (messageId) await removeButtons(messageId);
      fsm.updateData(userId, { phone: '' });
      await maxApi.sendMessage(userId, { text: '✅ Принято' });
      await finalizeLead(userId);
      break;
    }

    default:
      logger.debug(`Неизвестный callback payload: ${payload}`);
  }
}

// ── Обработка текстового сообщения ───────────────────────

async function handleMessage(update) {
  const msg = update.message;
  if (!msg) return;

  const userId = msg.sender?.user_id;
  if (!userId || msg.sender?.is_bot) return;

  // Re-populate user identity if lost after restart
  ensureUserData(userId, msg.sender);

  const text = msg.body?.text || '';
  const attachments = msg.body?.attachments || [];
  const state = fsm.getState(userId);

  // Проверяем наличие контакта (request_contact response)
  const contactAttach = attachments.find((a) => a.type === 'contact');
  if (contactAttach && state === States.PHONE_REQUEST) {
    logger.debug({ contactAttach: JSON.stringify(contactAttach) }, 'raw contact attachment');

    const p = contactAttach.payload || contactAttach;

    // 1) Extract from VCF string (confirmed working format: vcf_info contains TEL;TYPE=cell:79189240007)
    let phone = '';
    if (typeof p.vcf_info === 'string') {
      const telMatch = p.vcf_info.match(/TEL[^:]*:([+\d\s()-]+)/i);
      if (telMatch) phone = telMatch[1].trim();
    }

    // 2) Fallback: direct field paths
    if (!phone) {
      phone = p.phone || p.phone_number || p.vcf_phone
        || p.max_info?.phone || p.max_info?.phone_number
        || p.tam_info?.phone_number || p.tam_info?.phone
        || p.contact?.phone_number || p.contact?.phone
        || '';
    }

    // 3) Fallback: try other VCF-like string fields
    if (!phone && typeof p.vcf === 'string') {
      const telMatch = p.vcf.match(/TEL[^:]*:([+\d\s()-]+)/i);
      if (telMatch) phone = telMatch[1].trim();
    }
    if (!phone && typeof p.data === 'string') {
      const telMatch = p.data.match(/TEL[^:]*:([+\d\s()-]+)/i);
      if (telMatch) phone = telMatch[1].trim();
    }

    if (phone) {
      fsm.updateData(userId, { phone });
      await maxApi.sendMessage(userId, { text: '✅ Спасибо! Номер сохранён.' });
      await finalizeLead(userId);
    } else {
      // Contact shared but phone extraction failed — ask to type manually
      fsm.updateData(userId, { phone: '' });
      await maxApi.sendMessage(userId, {
        text: 'Спасибо! К сожалению, не удалось считать номер автоматически.\n\n' +
              '📱 Напишите, пожалуйста, ваш номер телефона вручную (например, +7 900 123 45 67), ' +
              'или нажмите «Пропустить».',
        format: 'html',
      });
      // Stay in PHONE_REQUEST state — don't finalize yet!
      // User can type their phone or press Skip
    }
    return;
  }

  // Ключевая цель — текстовый ответ
  if (state === States.KEY_GOAL || state === States.GOAL_REMINDER) {
    scheduler.cancel(userId);
    fsm.updateData(userId, { key_goal: text.trim() });
    await sendAccessRequest(userId);
    return;
  }

  // Телефон: текстовый ввод или пропуск
  if (state === States.PHONE_REQUEST) {
    const digits = text.replace(/\D/g, '');
    if (digits.length >= 7) {
      // User typed a phone number manually
      fsm.updateData(userId, { phone: text.trim() });
      await maxApi.sendMessage(userId, { text: '✅ Спасибо!' });
    } else {
      fsm.updateData(userId, { phone: '' });
      await maxApi.sendMessage(userId, { text: '✅ Принято' });
    }
    await finalizeLead(userId);
    return;
  }

  // Admin debug: получить видео/файл токен
  if (config.ADMIN_USER_ID && String(userId) === config.ADMIN_USER_ID) {
    const videoAttach = attachments.find((a) => a.type === 'video');
    if (videoAttach) {
      const token = videoAttach.payload?.token || 'N/A';
      await maxApi.sendMessage(userId, {
        text: `Video token:\n${token}\n\nМожно вставить в video_tokens.json`,
      });
      return;
    }
    const fileAttach = attachments.find((a) => a.type === 'file');
    if (fileAttach) {
      const token = fileAttach.payload?.token || 'N/A';
      await maxApi.sendMessage(userId, {
        text: `File token:\n${token}\n\nТип: ${fileAttach.payload?.filename || 'unknown'}`,
      });
      return;
    }
  }

  // Фолбэк
  if (!state || state === States.FINISHED) {
    await maxApi.sendMessage(userId, {
      text: '👋 Нажмите кнопку «Начать» в меню бота, чтобы начать!',
      format: 'html',
    });
  } else {
    await maxApi.sendMessage(userId, {
      text: '☝️ Пожалуйста, воспользуйтесь кнопками выше.',
      format: 'html',
    });
  }
}

// ── Polling loop ─────────────────────────────────────────

export async function startPolling() {
  // Регистрация обработчиков напоминаний
  scheduler.registerHandler('goal_reminder', hdlGoalReminder);
  scheduler.registerHandler('goal_final', hdlGoalFinal);
  scheduler.registerHandler('access_reminder', hdlAccessReminder);
  scheduler.registerHandler('access_final', hdlAccessFinal);
  scheduler.registerHandler('price_reminder', hdlPriceReminder);
  scheduler.registerHandler('price_final', hdlPriceFinal);

  // Восстановление напоминаний из reminders.json
  await scheduler.restoreOnStartup();

  // Предзагрузка видео
  try {
    await preloadVideos();
  } catch (e) {
    logger.warn({ err: e }, 'Ошибка предзагрузки видео — продолжаем без видео');
  }

  // Проверка токена
  try {
    const me = await maxApi.getMe();
    logger.info({ botId: me.user_id, name: me.first_name }, '🚀 MaxBot Auditbot запущен');
    logger.info(
      {
        hasChannelId: Boolean(config.MAX_CHANNEL_ID),
        channelLink: config.MAX_CHANNEL_LINK || null,
      },
      'Конфиг проверки подписки',
    );

    try {
      const resolved = await resolveChannelIdForSubscriptionCheck();
      logger.info(
        {
          hasResolvedChannelId: Boolean(resolved?.id),
          resolvedChannelId: resolved?.id || null,
          resolvedChannelLink: resolved?.link || null,
        },
        'Результат подготовки канала для проверки подписки',
      );
    } catch (e) {
      logger.warn({ err: e }, 'Не удалось подготовить канал для проверки подписки на старте');
    }
  } catch (e) {
    logger.error({ err: e }, 'Не удалось получить информацию о боте. Проверьте MAX_BOT_TOKEN.');
    process.exit(1);
  }

  let marker = null;
  const updateTypes = ['bot_started', 'message_created', 'message_callback'];

  while (true) {
    try {
      const response = await maxApi.getUpdates(marker, 30, updateTypes);
      const updates = response.updates || [];
      if (response.marker != null) {
        marker = response.marker;
      }

      for (const update of updates) {
        try {
          switch (update.update_type) {
            case 'bot_started':
              await handleBotStarted(update);
              break;
            case 'message_callback':
              await handleCallback(update);
              break;
            case 'message_created':
              await handleMessage(update);
              break;
            default:
              logger.debug(`Неизвестный update_type: ${update.update_type}`);
          }
        } catch (e) {
          logger.error({ err: e, update_type: update.update_type }, 'Ошибка обработки update');
        }
      }
    } catch (e) {
      if (e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT') {
        // Нормальный таймаут polling — продолжаем
        continue;
      }
      const status = e.response?.status;
      const apiCode = e.response?.data?.code;
      const apiMsg = e.response?.data?.message;
      logger.error({ status, apiCode, apiMsg, code: e.code }, 'Ошибка polling — повтор через 5 сек');
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}
