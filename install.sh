#!/usr/bin/env bash
# Установка и обновление сайта Neolex на сервере Ubuntu.
# Запуск: curl -fsSL https://raw.githubusercontent.com/ЛОГИН/neolex-site/main/install.sh | bash -s -- ДОМЕН ЛОГИН
set -euo pipefail

DOMAIN="${1:-}"
GH_USER="${2:-}"
REPO="${3:-neolex-site}"
PB_VERSION="0.30.0"
APP_DIR="/opt/neolex"

if [ -z "$DOMAIN" ] || [ -z "$GH_USER" ]; then
  echo "Укажите домен и логин GitHub. Пример: bash install.sh neolexedu.com polina"; exit 1
fi
if [ "$(id -u)" -ne 0 ]; then echo "Запустите от имени root"; exit 1; fi

echo "==> Устанавливаю нужные программы"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y >/dev/null
apt-get install -y unzip curl ufw >/dev/null

mkdir -p "$APP_DIR"
cd "$APP_DIR"

echo "==> Скачиваю PocketBase $PB_VERSION"
ARCH="amd64"; [ "$(uname -m)" = "aarch64" ] && ARCH="arm64"
curl -fsSL -o pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${ARCH}.zip"
unzip -oq pb.zip pocketbase && rm -f pb.zip && chmod +x pocketbase

echo "==> Скачиваю файлы сайта из GitHub ($GH_USER/$REPO)"
rm -rf /tmp/neolex-src && mkdir -p /tmp/neolex-src
curl -fsSL -o /tmp/neolex-src/site.zip "https://github.com/${GH_USER}/${REPO}/archive/refs/heads/main.zip"
unzip -oq /tmp/neolex-src/site.zip -d /tmp/neolex-src
SRC="$(find /tmp/neolex-src -maxdepth 1 -mindepth 1 -type d | head -1)"
# если файлы загружены на GitHub без папок — раскладываем их сами
if [ ! -d "$SRC/pb_public" ] && [ -f "$SRC/index.html" ]; then
  echo "==> Раскладываю файлы по папкам"
  mkdir -p "$SRC/pb_public" "$SRC/pb_migrations" "$SRC/pb_hooks"
  for f in "$SRC"/*; do
    [ -f "$f" ] || continue
    b="$(basename "$f")"
    case "$b" in
      install.sh|README.md|*.zip) ;;
      [0-9]*_*.js) mv "$f" "$SRC/pb_migrations/" ;;
      *.pb.js|neolex_ref.js) mv "$f" "$SRC/pb_hooks/" ;;
      *) mv "$f" "$SRC/pb_public/" ;;
    esac
  done
fi
for d in pb_public pb_migrations pb_hooks; do
  if [ ! -d "$SRC/$d" ]; then echo "На GitHub не найдена папка $d. Проверьте, что файлы сайта загружены в репозиторий."; exit 1; fi
  rm -rf "$APP_DIR/$d"
  cp -r "$SRC/$d" "$APP_DIR/$d"
done

echo "==> Настраиваю автозапуск"
cat > /etc/systemd/system/neolex.service <<UNIT
[Unit]
Description=Neolex (PocketBase)
After=network.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR
ExecStart=$APP_DIR/pocketbase serve $DOMAIN www.$DOMAIN --dir $APP_DIR/pb_data --publicDir $APP_DIR/pb_public --migrationsDir $APP_DIR/pb_migrations --hooksDir $APP_DIR/pb_hooks
Restart=always
RestartSec=5
LimitNOFILE=4096

[Install]
WantedBy=multi-user.target
UNIT

echo "==> Открываю порты 22, 80, 443"
ufw allow 22/tcp >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null
yes | ufw enable >/dev/null || true

systemctl daemon-reload
systemctl enable neolex >/dev/null 2>&1
systemctl restart neolex
sleep 4

if systemctl is-active --quiet neolex; then
  echo ""
  echo "Готово. Сайт: https://$DOMAIN"
  echo "Сертификат https выпустится автоматически в течение минуты после первого открытия сайта."
  echo ""
  echo "Если это первая установка, создайте администратора (подставьте свой e-mail и придумайте пароль):"
  echo "  $APP_DIR/pocketbase superuser upsert ВАШ@EMAIL.RU ПАРОЛЬ --dir $APP_DIR/pb_data"
  echo "Панель управления: https://$DOMAIN/_/"
else
  echo "Сайт не запустился. Пришлите вывод команды: journalctl -u neolex -n 50 --no-pager"
  exit 1
fi
