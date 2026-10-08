// Neolex: общие функции партнёрской программы (подключаются из ref.pb.js)
const PRO = ["Ментор", "Репетитор", "Представитель вуза"];

function setting(app, key, def) {
  try { return app.findFirstRecordByFilter("settings", "key = {:k}", { k: key }).getFloat("value"); } catch (_) { return def; }
}
function toMs(dt) { return new Date(String(dt).replace(" ", "T")).getTime(); }

// начислить процент пригласившему за оплату
function accrue(app, payment) {
  if (payment.get("status") !== "paid") return;
  const userId = payment.get("user");
  let ref;
  try { ref = app.findFirstRecordByFilter("referrals", "referred = {:u}", { u: userId }); } catch (_) { return; }
  const referrer = ref.get("referrer");
  try { app.findFirstRecordByFilter("ref_earnings", "payment = {:p}", { p: payment.id }); return; } catch (_) {}
  const months = setting(app, "ref_months", 12);
  const first = app.findRecordsByFilter("payments", "user = {:u} && status = 'paid'", "created", 1, 0, { u: userId });
  if (months > 0 && first.length) {
    const limit = toMs(first[0].get("created")) + months * 30.44 * 86400000;
    if (toMs(payment.get("created")) > limit) return;
  }
  const pct = setting(app, "ref_percent", 15);
  const amount = Math.round(payment.getFloat("amount") * pct) / 100;
  if (amount <= 0) return;
  const e = new Record(app.findCollectionByNameOrId("ref_earnings"));
  e.set("referrer", referrer); e.set("referred", userId); e.set("payment", payment.id);
  e.set("amount", amount); e.set("percent", pct); e.set("status", "accrued");
  app.save(e);
}

module.exports = { PRO, setting, accrue };
