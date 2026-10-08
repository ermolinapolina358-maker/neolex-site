/// Neolex: серверные правила

// ник всегда в нижнем регистре
onRecordCreateRequest((e) => { const n = (e.record.get("nick") || "").toLowerCase().trim(); e.record.set("nick", n); e.next(); }, "users");
onRecordUpdateRequest((e) => { const n = (e.record.get("nick") || "").toLowerCase().trim(); e.record.set("nick", n); e.next(); }, "users");

// подпись новости: роль автора задаёт сервер, а не браузер
onRecordCreateRequest((e) => {
  if (e.auth) { e.record.set("byRole", e.auth.get("role") || ""); e.record.set("source", ""); }
  e.next();
}, "news");

// фото кампуса: роль автора задаёт сервер
onRecordCreateRequest((e) => { if (e.auth) e.record.set("byRole", e.auth.get("role") || ""); e.next(); }, "photos");

// пост должен содержать текст или фото
onRecordCreateRequest((e) => {
  const t = (e.record.get("text") || "").trim();
  const files = e.record.get("images") || [];
  if (!t && (!files || files.length === 0)) throw new BadRequestError("Напишите текст или добавьте фото.");
  e.next();
}, "posts");
