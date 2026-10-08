/// Neolex: партнёрская программа

// регистрация по ссылке ментора: запоминаем, кто пригласил
onRecordCreateRequest((e) => {
  const lib = require(`${__hooks}/neolex_ref.js`);
  const code = (e.record.get("refNick") || "").toLowerCase().trim().replace(/^@/, "");
  e.record.set("refNick", "");
  // у каждого пользователя свой постоянный код для партнёрской ссылки
  e.record.set("refCode", $security.randomStringWithAlphabet(8, "abcdefghijkmnpqrstuvwxyz23456789"));
  let referrer = null;
  if (code) {
    let r = null;
    try { r = e.app.findFirstRecordByFilter("users", "refCode = {:c}", { c: code }); } catch (_) {
      try { r = e.app.findFirstRecordByFilter("users", "nick = {:c}", { c: code }); } catch (__) {}
    }
    if (r && r.getBool("approved") && lib.PRO.indexOf(r.get("role")) >= 0) referrer = r;
  }
  e.next();
  if (referrer && referrer.id !== e.record.id) {
    try {
      const rr = new Record(e.app.findCollectionByNameOrId("referrals"));
      rr.set("referrer", referrer.id); rr.set("referred", e.record.id);
      e.app.save(rr);
    } catch (err) { console.log("referral save failed", err); }
  }
}, "users");

// оплата прошла: начисляем процент
onRecordAfterCreateSuccess((e) => {
  const lib = require(`${__hooks}/neolex_ref.js`);
  try { lib.accrue(e.app, e.record); } catch (err) { console.log("accrue failed", err); }
  e.next();
}, "payments");

// оплата отмечена как оплаченная позже или возвращена
onRecordAfterUpdateSuccess((e) => {
  const lib = require(`${__hooks}/neolex_ref.js`);
  try {
    if (e.record.get("status") === "paid") lib.accrue(e.app, e.record);
    if (e.record.get("status") === "refunded") {
      const l = e.app.findRecordsByFilter("ref_earnings", "payment = {:p} && status = 'accrued'", "", 10, 0, { p: e.record.id });
      l.forEach((x) => { x.set("status", "canceled"); e.app.save(x); });
    }
  } catch (err) { console.log("payment update failed", err); }
  e.next();
}, "payments");

// заявка на вывод: сумму считает сервер, а не браузер
onRecordCreateRequest((e) => {
  if (e.hasSuperuserAuth()) { e.next(); return; }
  const lib = require(`${__hooks}/neolex_ref.js`);
  const me = e.auth.id;
  const open = e.app.findRecordsByFilter("ref_earnings", "referrer = {:m} && status = 'accrued'", "", 5000, 0, { m: me });
  let sum = 0; open.forEach((x) => { sum += x.getFloat("amount"); });
  sum = Math.round(sum * 100) / 100;
  const min = lib.setting(e.app, "payout_min", 1000);
  if (sum < min) throw new BadRequestError("Вывести можно от " + min + " ₽. Сейчас доступно " + sum + " ₽.");
  if (["npd_ru", "ip_ru", "foreign"].indexOf(e.record.get("payeeType")) < 0) throw new BadRequestError("Выберите статус получателя.");
  if (!(e.record.get("country") || "").trim()) throw new BadRequestError("Укажите страну.");
  e.record.set("amount", sum); e.record.set("status", "new"); e.record.set("note", "");
  e.next();
  open.forEach((x) => { x.set("status", "requested"); x.set("payout", e.record.id); e.app.save(x); });
}, "payouts");

// владелец отметил выплату в панели
onRecordAfterUpdateSuccess((e) => {
  const st = e.record.get("status");
  try {
    const l = e.app.findRecordsByFilter("ref_earnings", "payout = {:p}", "", 5000, 0, { p: e.record.id });
    l.forEach((x) => {
      if (st === "paid" && x.get("status") === "requested") { x.set("status", "paid"); e.app.save(x); }
      if (st === "rejected" && x.get("status") === "requested") { x.set("status", "accrued"); x.set("payout", ""); e.app.save(x); }
    });
  } catch (err) { console.log("payout update failed", err); }
  e.next();
}, "payouts");
