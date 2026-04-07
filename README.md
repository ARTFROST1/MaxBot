# MaxBot — Auditbot для Max Messenger

Квалификационный бот-воронка для продажи аудита Яндекс.Директ.
Порт оригинального Python-бота (Auditbot/) на Node.js для мессенджера Max.

## Структура

| Файл | Назначение | Аналог в Auditbot/ |
|------|------------|---------------------|
| `index.js` | Точка входа | `if __name__` |
| `bot.js` | Polling + handlers | `bot.py` |
| `config.js` | Конфигурация (.env) | `config.py` |
| `logger.js` | Логирование (pino) | `logger.py` |
| `maxApi.js` | HTTP-обёртка для Max API | — (новый) |
| `fsm.js` | Кастомная FSM | aiogram FSM |
| `scheduler.js` | Напоминания | `scheduler.py` |
| `metrika.js` | Яндекс.Метрика | `metrika.py` |
| `videoManager.js` | Загрузка/кеш видео | file_id замена |
| `messages.js` | Тексты, клавиатуры | `messages.py` |

## Быстрый старт

```bash
cd MaxBot
cp .env.example .env
# Заполнить .env реальными значениями
npm install
node index.js
```

## Подготовка видео

1. Скачать 7 видео из Telegram (через `getFile` API)
2. Поместить в папку `videos/`
3. Указать пути в `.env`

При первом запуске бот загрузит видео в Max через Upload API и закеширует токены в `video_tokens.json`.

## Метрика и client_id (deep link)

Max API поддерживает deep links для ботов аналогично Telegram:

```
https://max.ru/<botName>?start=cid_XXXXXXXX
```

При переходе по ссылке бот получает `bot_started` с полем `payload: "cid_XXXXXXXX"`. Бот парсит client_id и передаёт его во все конверсии Яндекс.Метрики — идентично работе Auditbot в Telegram.

**На лендинге** JS-код должен строить ссылку с client_id из Яндекс.Метрики:

```javascript
ym(COUNTER_ID, 'getClientID', function(clientId) {
  document.getElementById('max-btn').href = 
    'https://max.ru/ВАШ_БОТ?start=cid_' + clientId;
});
```

Ограничения payload: до **128 символов**, допустимые символы: буквы, цифры, `_`, `-`.

## Деплой

Подробная инструкция (включая установку Node.js, копирование .env и video_tokens.json): **[DEPLOY.md](DEPLOY.md)**

Краткие команды (если Node.js и зависимости уже установлены):

```bash
sudo cp maxbot.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable maxbot
sudo systemctl start maxbot
sudo journalctl -u maxbot -f
```

## Переменные окружения

| Переменная | Описание | Обязательно |
|-----------|----------|:-----------:|
| `MAX_BOT_TOKEN` | Токен бота Max | ✅ |
| `ADMIN_CHAT_ID` | Chat ID админа для уведомлений | |
| `ADMIN_USER_ID` | User ID админа для дебага | |
| `METRIKA_TOKEN` | OAuth-токен Яндекс.Метрики | |
| `METRIKA_COUNTER_ID` | ID счётчика Метрики | |
| `GOAL_*` | ID целей Метрики (18 штук) | |
| `VIDEO_*` | Пути к видеофайлам | |
| `MAX_CHANNEL_LINK` | URL канала в Max | |
| `MAX_CHANNEL_ID` | ID канала для проверки подписки | |
| `CONTACT_PHONE` | Телефон для контакта | |
| `CONTACT_TG` | Telegram/Max контакт | |

Если `MAX_CHANNEL_ID` не задан, бот попробует автоматически определить `chat_id`
по `MAX_CHANNEL_LINK` через метод `/chats` (бот должен быть участником/админом канала).
