/// Neolex: постоянный партнёрский код и данные получателя выплаты
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  if (!users.fields.getByName("refCode")) users.fields.add(new TextField({ name: "refCode", max: 12 }));
  users.updateRule = "id = @request.auth.id && @request.body.approved:isset = false && @request.body.refNick:isset = false && @request.body.refCode:isset = false";
  app.save(users);
  // коды для уже зарегистрированных
  const AB = "abcdefghijkmnpqrstuvwxyz23456789";
  app.findAllRecords("users").forEach((u) => {
    if (!u.get("refCode")) { u.set("refCode", $security.randomStringWithAlphabet(8, AB)); app.saveNoValidate(u); }
  });
  const u2 = app.findCollectionByNameOrId("users");
  u2.indexes = (u2.indexes || []).concat(["CREATE UNIQUE INDEX idx_users_refcode ON users (refCode) WHERE refCode != ''"]);
  app.save(u2);

  const payouts = app.findCollectionByNameOrId("payouts");
  payouts.fields.add(new TextField({ name: "country", required: true, max: 60 }));
  payouts.fields.add(new SelectField({ name: "payeeType", required: true, maxSelect: 1, values: ["npd_ru", "ip_ru", "foreign"] }));
  app.save(payouts);
}, (app) => {
  const payouts = app.findCollectionByNameOrId("payouts");
  ["country", "payeeType"].forEach((n) => { const f = payouts.fields.getByName(n); if (f) payouts.fields.removeById(f.id); });
  app.save(payouts);
});
