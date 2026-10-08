/// Neolex: партнёрская программа для менторов, репетиторов и вузов
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  if (!users.fields.getByName("refNick")) users.fields.add(new TextField({ name: "refNick", max: 20 }));
  // ник пригласившего задаётся только при регистрации, менять его потом нельзя
  users.updateRule = "id = @request.auth.id && @request.body.approved:isset = false && @request.body.refNick:isset = false";
  app.save(users);
  const U = users.id;

  const created = () => [new AutodateField({ name: "created", onCreate: true }), new AutodateField({ name: "updated", onCreate: true, onUpdate: true })];
  const rel = (name, coll, req) => new RelationField({ name, collectionId: coll, maxSelect: 1, required: !!req, cascadeDelete: false });
  const make = (o) => { const { fields, indexes, ...rest } = o; const c = new Collection(rest); fields.forEach((f) => c.fields.add(f)); c.indexes = indexes || []; app.save(c); return c; };

  // настройки, которые владелец меняет в панели
  const settings = make({ type: "base", name: "settings", listRule: "", viewRule: "", createRule: null, updateRule: null, deleteRule: null,
    fields: [new TextField({ name: "key", required: true, max: 40 }), new NumberField({ name: "value" }), new TextField({ name: "note", max: 300 }), ...created()],
    indexes: ["CREATE UNIQUE INDEX idx_settings_key ON settings (key)"] });
  [["ref_percent", 15, "Процент ментору с каждой оплаты приглашённого пользователя"],
   ["ref_months", 12, "Сколько месяцев с первой оплаты приглашённого начисляется процент"],
   ["payout_min", 1000, "Минимальная сумма для вывода, ₽"]].forEach(([k, v, n]) => {
    const r = new Record(settings); r.set("key", k); r.set("value", v); r.set("note", n); app.save(r);
  });

  // кто кого пригласил (видит только пригласивший)
  make({ type: "base", name: "referrals", listRule: "referrer = @request.auth.id", viewRule: "referrer = @request.auth.id", createRule: null, updateRule: null, deleteRule: null,
    fields: [rel("referrer", U, true), rel("referred", U, true), ...created()],
    indexes: ["CREATE UNIQUE INDEX idx_ref_referred ON referrals (referred)", "CREATE INDEX idx_ref_referrer ON referrals (referrer)"] });

  // оплаты подписок: создаются платёжной системой или владельцем в панели
  const payments = make({ type: "base", name: "payments", listRule: "user = @request.auth.id", viewRule: "user = @request.auth.id", createRule: null, updateRule: null, deleteRule: null,
    fields: [rel("user", U, true), new NumberField({ name: "amount", required: true, min: 0 }), new TextField({ name: "plan", max: 40 }),
      new SelectField({ name: "status", maxSelect: 1, required: true, values: ["paid", "refunded"] }), new TextField({ name: "provider", max: 40 }), new TextField({ name: "extId", max: 100 }), ...created()],
    indexes: ["CREATE INDEX idx_pay_user ON payments (user)"] });

  // заявки на вывод
  const payouts = make({ type: "base", name: "payouts", listRule: "mentor = @request.auth.id", viewRule: "mentor = @request.auth.id",
    createRule: "@request.auth.id != '' && @request.auth.approved = true && @request.body.mentor = @request.auth.id",
    updateRule: null, deleteRule: null,
    fields: [rel("mentor", U, true), new NumberField({ name: "amount", min: 0 }), new TextField({ name: "details", required: true, max: 400 }),
      new SelectField({ name: "status", maxSelect: 1, values: ["new", "paid", "rejected"] }), new TextField({ name: "note", max: 300 }), ...created()] });

  // начисления ментору
  make({ type: "base", name: "ref_earnings", listRule: "referrer = @request.auth.id", viewRule: "referrer = @request.auth.id", createRule: null, updateRule: null, deleteRule: null,
    fields: [rel("referrer", U, true), rel("referred", U, true), new RelationField({ name: "payment", collectionId: payments.id, maxSelect: 1, required: true }),
      new NumberField({ name: "amount", min: 0 }), new NumberField({ name: "percent" }),
      new SelectField({ name: "status", maxSelect: 1, required: true, values: ["accrued", "requested", "paid", "canceled"] }),
      new RelationField({ name: "payout", collectionId: payouts.id, maxSelect: 1 }), ...created()],
    indexes: ["CREATE UNIQUE INDEX idx_earn_payment ON ref_earnings (payment)", "CREATE INDEX idx_earn_ref ON ref_earnings (referrer, status)"] });
}, (app) => {
  ["ref_earnings", "payouts", "payments", "referrals", "settings"].forEach((n) => { try { app.delete(app.findCollectionByNameOrId(n)); } catch (_) {} });
});
