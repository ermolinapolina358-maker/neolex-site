# Neolex

Сайт Neolex: вузы, стипендии, стажировки и менторы 36 стран.

## Состав
- `pb_public/` — сам сайт (index.html, каталог вузов, библиотека PocketBase)
- `pb_migrations/` — структура базы данных и права доступа
- `pb_hooks/` — серверные правила (ник, подписи новостей, проверки)
- `install.sh` — установка и обновление на сервере Ubuntu

## Установка на сервер
В консоли сервера (от root):

    curl -fsSL https://raw.githubusercontent.com/ЛОГИН/neolex-site/main/install.sh | bash -s -- ДОМЕН ЛОГИН

Обновление сайта — та же команда: данные пользователей (папка pb_data) не затрагиваются.

## После установки
1. Создайте администратора: `/opt/neolex/pocketbase superuser upsert EMAIL ПАРОЛЬ --dir /opt/neolex/pb_data`
2. Откройте `https://ДОМЕН/_/` → Settings → Application: укажите адрес сайта `https://ДОМЕН`.
3. Settings → Mail settings: SMTP Яндекс 360 (smtp.yandex.ru, порт 465, SSL, логин — полный адрес ящика, пароль приложения).
4. Settings → Backups: включите ежедневные резервные копии.
