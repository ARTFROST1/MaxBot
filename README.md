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

## Метрика и client_id

В Telegram используется `/start cid_XXXX` для передачи client_id из Метрики. В Max API нет payload при `bot_started` — стартовые параметры не поддерживаются.

Текущее поведение: бот отправляет конверсии в Метрику на каждый шаг воронки, но `client_id` всегда `null`. Метрика принимает конверсии, но не может привязать их к визиту на сайт. Для полноценной атрибуции потребуется внешний сервис маппинга (см. `MaxDocs/MIGRATION_PLAN.md`, Вариант C).

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
