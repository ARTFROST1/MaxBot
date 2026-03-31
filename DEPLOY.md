# MaxBot — Деплой на сервер

> Сервер: `pbi.sargos-agency.com`, пользователь: `direct`
> Путь: `/home/direct/MaxBot`
> Дата: 31 марта 2026

---

## Проблема после первого клона

Репозиторий был клонирован через `sudo git clone`, из-за чего владелец файлов — `root`, а не `direct`. Это вызывает ошибки прав доступа. **Исправляем ниже.**

---

## Пошаговая инструкция

Все команды выполняются на сервере от пользователя `direct` (подключение по SSH).

### 1. Исправить владельца файлов

```bash
sudo chown -R direct:direct /home/direct/MaxBot
```

### 2. Установить Node.js 20 LTS

На сервере нет Node.js и npm. Устанавливаем из NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

Проверяем:

```bash
node --version   # ожидаем v20.x.x
npm --version    # ожидаем 10.x.x
```

### 3. Установить зависимости

```bash
cd /home/direct/MaxBot
npm install --production
```

### 4. Скопировать .env и video_tokens.json

Эти файлы в `.gitignore` и не попадают в git. Копируем с локальной машины.

**С локальной машины (macOS):**

```bash
scp /Users/artfrost/Projects/VDS_scripts/MaxBot/.env direct@pbi.sargos-agency.com:/home/direct/MaxBot/.env
scp /Users/artfrost/Projects/VDS_scripts/MaxBot/video_tokens.json direct@pbi.sargos-agency.com:/home/direct/MaxBot/video_tokens.json
```

`video_tokens.json` содержит токены видео, уже загруженных на серверы Max. С ним бот не будет перезаливать видео при старте. Если файла нет — бот попробует загрузить из `videos/`, но на сервере видеофайлов нет, и шаги с видео будут пропускаться (тексты отправятся, видео — нет).

### 5. Тестовый запуск (ручной)

```bash
cd /home/direct/MaxBot
node index.js
```

Ожидаемый вывод: `🚀 MaxBot Auditbot запущен`. Остановить: `Ctrl+C`.

Если ошибка `MAX_BOT_TOKEN` — проверь `.env`.

### 6. Установить systemd-сервис

```bash
sudo cp /home/direct/MaxBot/maxbot.service /etc/systemd/system/maxbot.service
sudo systemctl daemon-reload
sudo systemctl enable maxbot
sudo systemctl start maxbot
```

### 7. Проверить статус

```bash
sudo systemctl status maxbot
```

Логи в реальном времени:

```bash
sudo journalctl -u maxbot -f
```

---

## Обновление кода (git pull)

```bash
cd /home/direct/MaxBot
git pull
npm install --production
sudo systemctl restart maxbot
```

---

## Полезные команды

| Команда | Что делает |
|---------|------------|
| `sudo systemctl start maxbot` | Запустить бота |
| `sudo systemctl stop maxbot` | Остановить бота |
| `sudo systemctl restart maxbot` | Перезапустить |
| `sudo systemctl status maxbot` | Статус |
| `sudo journalctl -u maxbot -f` | Логи (live) |
| `sudo journalctl -u maxbot --since "1 hour ago"` | Логи за последний час |

---

## Конфигурация сервиса (maxbot.service)

```ini
[Unit]
Description=MaxBot Auditbot — Max Messenger audit funnel bot
After=network.target

[Service]
Type=simple
User=direct
WorkingDirectory=/home/direct/MaxBot
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Сервис работает от пользователя `direct`, автоматически перезапускается при падении.

---

## Чеклист деплоя

- [ ] `sudo chown -R direct:direct /home/direct/MaxBot`
- [ ] Node.js 20 установлен (`node --version`)
- [ ] `npm install --production` выполнен
- [ ] `.env` скопирован на сервер
- [ ] `video_tokens.json` скопирован на сервер
- [ ] `node index.js` — тестовый запуск успешен
- [ ] systemd-сервис установлен и запущен
- [ ] `systemctl status maxbot` — active (running)
