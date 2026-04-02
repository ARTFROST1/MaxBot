// messages.js — Тексты, клавиатуры, callback-константы (аналог messages.py)
import { config } from './config.js';

// ============================================================
// Callback-константы (1:1 с Python)
// ============================================================
export const CB_Q1_YES = 'q1:yes';
export const CB_Q1_NO = 'q1:no';
export const CB_Q2_50K_YES = 'q2_50k:yes';
export const CB_Q2_50K_NO = 'q2_50k:no';
export const CB_Q2_100K_YES = 'q2_100k:yes';
export const CB_Q2_100K_NO = 'q2_100k:no';
export const CB_REJECT_APPLY = 'reject:apply';
export const CB_GOAL_AUDIT = 'goal:audit';
export const CB_ACCESS_YES = 'access:yes';
export const CB_ACCESS_REM_YES = 'access_rem:yes';
export const CB_ACCESS_REM_WRITE = 'access_rem:write';
export const CB_PRICE_YES = 'price:yes';
export const CB_PRICE_NO = 'price:no';
export const CB_PRICE_REM_PAY = 'price_rem:pay';
export const CB_PRICE_REM_WRITE = 'price_rem:write';
export const CB_INDIVIDUAL_WRITE = 'individual:write';
export const CB_SUB_CHECK = 'sub:check';
export const CB_SUB_READY = 'sub:ready';
export const CB_PRICE_CONTINUE = 'price:continue';
export const CB_PHONE_SKIP = 'phone:skip';

// ============================================================
// Helper: создать inline keyboard attachment
// ============================================================
function kb(buttons) {
  return {
    type: 'inline_keyboard',
    payload: { buttons },
  };
}

function cbBtn(text, payload) {
  return { type: 'callback', text, payload };
}

function linkBtn(text, url) {
  return { type: 'link', text, url };
}

// ============================================================
// Клавиатуры
// ============================================================
export const KB_QUESTION_1 = kb([
  [cbBtn('✅ Да', CB_Q1_YES), cbBtn('❌ Нет', CB_Q1_NO)],
]);

export const KB_QUESTION_2_50K = kb([
  [cbBtn('✅ Да', CB_Q2_50K_YES), cbBtn('❌ Нет', CB_Q2_50K_NO)],
]);

export const KB_QUESTION_2_100K = kb([
  [cbBtn('✅ Да', CB_Q2_100K_YES), cbBtn('❌ Нет', CB_Q2_100K_NO)],
]);

export const KB_REJECT = kb([
  [cbBtn('📝 Оставить заявку', CB_REJECT_APPLY)],
]);

export const KB_ACCESS_REQUEST = kb([
  [cbBtn('✅ Согласен предоставить доступ', CB_ACCESS_YES)],
]);

export const KB_ACCESS_REMINDER = kb([
  [cbBtn('✅ Предоставить доступ', CB_ACCESS_REM_YES)],
  [cbBtn('✍️ Напишите мне', CB_ACCESS_REM_WRITE)],
]);

// Напоминание о бесплатном аудите при оплате
export const MSG_PRICE_SUB_REMINDER =
  `💡 <b>Кстати!</b>\n` +
  `\n` +
  `При подписке на наш канал аудит становится <b>бесплатным</b>.\n` +
  `\n` +
  `Подпишитесь и нажмите «Проверить подписку» — ` +
  `и аудит будет бесплатным!`;

export function kbPriceSubReminder() {
  return kb([
    [linkBtn('📢 Подписаться на канал', config.MAX_CHANNEL_LINK || 'https://max.ru')],
    [cbBtn('🔍 Проверить подписку', CB_SUB_CHECK)],
    [cbBtn('➡️ Продолжить без подписки', CB_PRICE_CONTINUE)],
  ]);
}

export function kbPrice() {
  return kb([
    [linkBtn('📢 Подписаться на канал', config.MAX_CHANNEL_LINK || 'https://max.ru')],
    [cbBtn('🔍 Проверить подписку', CB_SUB_CHECK)],
    [cbBtn('✅ Да, по счёту', CB_PRICE_YES), cbBtn('💬 Другой способ', CB_PRICE_NO)],
  ]);
}

export function kbPriceSubscribed() {
  return kb([
    [cbBtn('✅ Я подписался. Готов к аудиту', CB_SUB_READY)],
  ]);
}

export const KB_PRICE_REMINDER = kb([
  [cbBtn('💳 Готов оплатить', CB_PRICE_REM_PAY)],
  [cbBtn('✍️ Напишите мне', CB_PRICE_REM_WRITE)],
]);

export const KB_INDIVIDUAL = kb([
  [cbBtn('✍️ Напишите мне', CB_INDIVIDUAL_WRITE)],
]);

// Замена ReplyKeyboard → Inline с request_contact
export const KB_PHONE_REQUEST = kb([
  [{ type: 'request_contact', text: '📱 Поделиться номером' }],
  [cbBtn('Пропустить', CB_PHONE_SKIP)],
]);

export function kbChannelLink() {
  return kb([
    [linkBtn('📢 Подписаться на канал', config.MAX_CHANNEL_LINK || 'https://max.ru')],
  ]);
}

// ============================================================
// Тексты сообщений (HTML, 1:1 перенос из messages.py)
// Изменения: <tg-spoiler> удалены, <u> → <ins> (Max поддерживает оба)
// ============================================================

// Сообщение 1 — Приветствие
export const MSG_GREETING =
  `👋 <b>Привет!</b>\n` +
  `\n` +
  `Нам нужно задать пару вопросов, чтобы убедиться, ` +
  `что мы можем быть полезны.\n` +
  `\n` +
  `Если <b>ВДРУГ</b> бот застрял или завис — ` +
  `пишите и звоните напрямую:\n` +
  `📞 <b>${config.CONTACT_PHONE}</b>\n` +
  `✈️ <b>${config.CONTACT_TG}</b>`;

// Сообщение 2 — Вопрос 1
export const MSG_QUESTION_1 =
  `📊 <b>Вопрос 1 из 2</b>\n` +
  `\n` +
  `Реклама в Яндекс.Директе работала последние <b>3 месяца</b>?`;

// Сообщение 3 — Вопрос 2 (50k)
export const MSG_QUESTION_2_50K =
  `💰 <b>Вопрос 2 из 2</b>\n` +
  `\n` +
  `Средний бюджет аккаунта в месяц больше <b>50 000 ₽</b>?`;

// Сообщение 4 — Вопрос 2 (100k)
export const MSG_QUESTION_2_100K =
  `💰 <b>Вопрос 2 из 2</b>\n` +
  `\n` +
  `Средний бюджет аккаунта в месяц больше <b>100 000 ₽</b>?`;

// Сообщение 5 — Отказ
export const MSG_REJECT =
  `🤔 <b>Хм, похоже данных маловато…</b>\n` +
  `\n` +
  `Скорее всего, на аккаунте недостаточно данных ` +
  `для проведения корректного анализа.\n` +
  `\n` +
  `Давайте пообщаемся более предметно по вашей задаче — ` +
  `нажмите кнопку ниже, и мы вам напишем!`;

// Сообщение 6 — Ключевая цель
export const MSG_KEY_GOAL =
  `🔑 <b>Отлично! Переходим к делу.</b>\n` +
  `\n` +
  `Мы будем рассматривать аккаунт на 3х уровнях:\n` +
  `— технический;\n` +
  `— логический;\n` +
  `— стратегический.\n` +
  `\n` +
  `И чтобы мы корректно оценили существующие настройки, ` +
  `нам надо понимать одну вещь.\n` +
  `\n` +
  `Какая ключевая цель вашего рекламного аккаунта сейчас?\n` +
  `\n` +
  `<i>Напишите текстом — например: «Увеличить количество заявок», ` +
  `«Снизить стоимость лида» и т.д.</i>`;

// Сообщение 7 — Напоминание 1 (не ответил про цель)
export const MSG_GOAL_REMINDER =
  `💡 <b>Не можете определиться с целью?</b>\n` +
  `\n` +
  `Пожалуйста, напишите в ответ 1 фразой, что сейчас для вас главное ` +
  `в рекламе. Даже если формулировка пока грубая — это нормально.\n` +
  `\n` +
  `Если ключевой цели аккаунта нет — значит, ` +
  `аудит жизненно необходим.\n` +
  `Так и напишите: «Цели нет» — ` +
  `мы поможем её сформулировать.`;

// Сообщение 7.5 — Подтверждение ключевой цели
export const MSG_GOAL_CONFIRMED =
  `✅ <b>Отлично!</b> Мы учтём эту цель при аудите вашего аккаунта.`;

// Сообщение 8 — Запрос доступа
export const MSG_ACCESS_REQUEST =
  `🔓 <b>Мы готовы к работе!</b>\n` +
  `\n` +
  `Для проведения аудита нам потребуется ` +
  `<b>доступ на просмотр</b> к:\n` +
  `\n` +
  `  • Яндекс.Директ\n` +
  `  • Яндекс.Метрика\n` +
  `\n` +
  `Инструкции вышлем после подтверждения.\n` +
  `\n` +
  `🔒 <i>Напоминаем — ваши данные остаются вашими данными. ` +
  `Доступ только на просмотр.</i>`;

// Сообщение 9 — Напоминание 2 (не дал доступ)
export const MSG_ACCESS_REMINDER =
  `🤝 <b>Есть сложности с доступом?</b>\n` +
  `\n` +
  `Мы можем провести аудит в <b>онлайн-формате</b> — ` +
  `без предоставления постоянного доступа.\n` +
  `\n` +
  `Если у вас другая задача — оставьте заявку, и мы обсудим.`;

// Сообщение 10 — Стоимость
export const MSG_PRICE =
  `💼 <b>Условия аудита</b>\n` +
  `\n` +
  `💰 Стоимость: <b>5 000 ₽</b>\n` +
  `🎁 При подписке на наш канал: <b>БЕСПЛАТНО</b>\n` +
  `⏱ Срок выполнения: <b>2–3 дня</b>\n` +
  `\n` +
  `Посмотрите видео — в нём мы объясняем, почему аудит платный ` +
  `и что вы получите.\n` +
  `\n` +
  `Вам будет удобно оплатить через <b>расчётный счёт</b>?`;

// Сообщение 10 — Стоимость со скидкой
export const MSG_PRICE_DISCOUNTED =
  `💼 <b>Условия аудита</b>\n` +
  `\n` +
  `💰 Стоимость: <s>5 000 ₽</s> <b>БЕСПЛАТНО</b>\n` +
  `✅ Подписка на канал подтверждена.\n` +
  `⏱ Срок выполнения: <b>2–3 дня</b>\n` +
  `\n` +
  `Нажмите кнопку ниже, чтобы оставить заявку.`;

// Сообщение 11 — Напоминание 3 (тг-споилер удалён)
export const MSG_PRICE_REMINDER =
  `💭 <b>Вы остановились, узнав цену</b>\n` +
  `\n` +
  `Это понятно и нормально. Но подумайте вот о чём:\n` +
  `\n` +
  `Вы же покупаете не просто услугу. Вы покупаете потенциал. ` +
  `Подробнее — в видео.\n` +
  `\n` +
  `\n` +
  `❓ Если я не прав и дело не в цене…\n\n` +
  `Мы бы очень хотели узнать, в чём настоящая задача. ` +
  `Давайте напишем вам и обсудим это по-честному?`;

// Сообщение 12 — Индивидуальный формат
export const MSG_INDIVIDUAL =
  `🤝 <b>Обсудим индивидуально</b>\n` +
  `\n` +
  `Мы напишем вам и предложим удобные варианты сотрудничества.`;

// Запрос номера телефона
export const MSG_PHONE_REQUEST =
  `📱 <b>Последний шаг!</b>\n` +
  `\n` +
  `Поделитесь номером телефона — это поможет нам ` +
  `связаться с вами быстрее.\n` +
  `\n` +
  `<i>Если не хотите — нажмите «Пропустить».</i>`;

// Сообщение 13 — Заявка принята (короткая)
export const MSG_LEAD_SHORT =
  `🎉 <b>Заявка принята!</b>\n` +
  `\n` +
  `Мы уже получили вашу заявку и скоро напишем.\n` +
  `\n` +
  `А пока подписывайтесь на канал — ` +
  `там много полезного про Директ:\n` +
  `👇 Нажмите кнопку ниже`;

// Сообщение 14 — Заявка принята (с реквизитами)
export const MSG_LEAD_REQUISITES =
  `🎉 <b>Заявка принята!</b>\n` +
  `\n` +
  `Мы уже получили вашу заявку и скоро напишем.\n` +
  `\n` +
  `📋 <b>Подготовьте, пожалуйста, реквизиты</b> — ` +
  `по ним мы составим договор и выставим счёт.\n` +
  `\n` +
  `А пока подписывайтесь на канал — ` +
  `там много полезного про Директ:\n` +
  `👇 Нажмите кнопку ниже`;

// Сообщение — Заявка от подписчика (бесплатный аудит)
export const MSG_LEAD_SUBSCRIBED =
  `🎉 <b>Заявка уже у нас!</b>\n` +
  `\n` +
  `Скоро вам напишем.\n` +
  `\n` +
  `А пока — вот самые интересные материалы:\n` +
  `\n` +
  `1. <a href="https://t.me/kirill_i_ta/66">Самая большая ошибка в Яндекс Директе</a>\n` +
  `2. <a href="https://t.me/kirill_i_ta/56">Одна простая истина</a>\n` +
  `3. <a href="https://t.me/kirill_i_ta/78">Не забывайте про продажи</a>\n` +
  `4. <a href="https://t.me/kirill_i_ta/76">Что обо мне стоит знать</a>`;

// Сообщение 15 — Финальное напоминание
export const MSG_FINAL_REMINDER =
  `😅 <b>Итак, мы застряли</b>\n` +
  `\n` +
  `Но, как любой уважающий себя маркетолог, я должен сделать 3 вещи:\n` +
  `\n` +
  `1️⃣  Предложить подписаться на канал:\n` +
  `     👉 ${config.MAX_CHANNEL_LINK || 'канал'}\n` +
  `\n` +
  `2️⃣  Напомнить контакты для прямой связи:\n` +
  `     📞 <b>${config.CONTACT_PHONE}</b>\n` +
  `     ✈️ <b>${config.CONTACT_TG}</b>\n` +
  `\n` +
  `3️⃣  Попросить не отправлять этого бота в бан 🙏\n` +
  `\n` +
  `<i>Обещаю не спамить, но иногда буду напоминать о себе. ` +
  `Возможно, вам будет интересно, как я это буду делать 😉</i>`;

// ============================================================
// Уведомление администратору
// ============================================================
export function adminNotification({
  username,
  fullName,
  userId,
  ycid,
  adWorked,
  budgetOk,
  keyGoal,
  phone,
  leadType,
  channelSubscribed,
  dataIncomplete = false,
}) {
  const nameDisplay = fullName || 'Без имени';
  const userLink = username
    ? `<a href="https://max.ru/u/${username}">@${username}</a>`
    : (userId ? `<a href="https://max.ru/u/${userId}">user_id: ${userId}</a>` : '<i>не определён</i>');
  const phoneLine = phone
    ? `📱 Телефон: <b>${phone}</b>`
    : '📱 Телефон: <i>не указан</i>';
  const ycidLine = ycid
    ? `🆔 ycid: <code>${ycid}</code>`
    : '🆔 ycid: <i>не передан</i>';
  const subMark = channelSubscribed ? '✅' : '❌';
  const warning = dataIncomplete ? '\n\n⚠️ <i>Часть данных утрачена (перезапуск бота)</i>' : '';
  return (
    `🔔 <b>Новая заявка из MaxBot!</b>\n` +
    `\n` +
    `👤 ${nameDisplay} (${userLink})\n` +
    `🆔 Max ID: <code>${userId || '—'}</code>\n` +
    `${ycidLine}\n` +
    `${phoneLine}\n` +
    `\n` +
    `📊 Реклама работала: <b>${adWorked}</b>\n` +
    `💰 Бюджет достаточный: <b>${budgetOk}</b>\n` +
    `🔑 Ключевая цель: <b>${keyGoal}</b>\n` +
    `📢 Подписан на канал: <b>${subMark}</b>\n` +
    `\n` +
    `📝 Тип заявки: <b>${leadType}</b>${warning}`
  );
}
