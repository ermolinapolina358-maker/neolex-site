/// Neolex: схема базы данных
migrate((app) => {
  // ---- пользователи ----
  const users = app.findCollectionByNameOrId("users");
  const add = (f) => { if (!users.fields.getByName(f.name)) users.fields.add(f); };
  add(new TextField({ name: "nick", max: 20, pattern: "^[a-z0-9_]{3,20}$" }));
  add(new SelectField({ name: "role", maxSelect: 1, values: ["Абитуриент", "Студент", "Выпускник", "Ментор", "Репетитор", "Представитель вуза"] }));
  add(new BoolField({ name: "approved" }));
  add(new TextField({ name: "country", max: 60 }));
  add(new TextField({ name: "city", max: 60 }));
  add(new TextField({ name: "goal", max: 200 }));
  add(new TextField({ name: "about", max: 2000 }));
  add(new JSONField({ name: "sections", maxSize: 400000 }));
  add(new JSONField({ name: "contacts", maxSize: 5000 }));
  add(new JSONField({ name: "services", maxSize: 10000 }));
  add(new DateField({ name: "consentAt" }));
  add(new DateField({ name: "appliedAt" }));
  users.indexes = (users.indexes || []).concat(["CREATE UNIQUE INDEX idx_users_nick ON users (nick) WHERE nick != ''"]);
  users.listRule = "";
  users.viewRule = "";
  users.updateRule = "id = @request.auth.id && @request.body.approved:isset = false";
  app.save(users);

  const U = users.id;
  const auth = "@request.auth.id != '' && @request.auth.verified = true";
  const created = () => [new AutodateField({ name: "created", onCreate: true }), new AutodateField({ name: "updated", onCreate: true, onUpdate: true })];
  const rel = (name, coll, req, cascade) => new RelationField({ name, collectionId: coll, maxSelect: 1, required: !!req, cascadeDelete: !!cascade });
  const img = (name, max) => new FileField({ name, maxSelect: max, maxSize: 6 * 1024 * 1024, mimeTypes: ["image/jpeg", "image/png", "image/webp"], thumbs: ["600x0", "120x120"] });
  const make = (o) => { const { fields, indexes, ...rest } = o; const c = new Collection(rest); fields.forEach((f) => c.fields.add(f)); c.indexes = indexes || []; app.save(c); return c; };

  const posts = make({ type: "base", name: "posts",
    listRule: "", viewRule: "",
    createRule: `${auth} && @request.body.author = @request.auth.id`,
    updateRule: "author = @request.auth.id", deleteRule: "author = @request.auth.id",
    fields: [rel("author", U, true, true), new TextField({ name: "text", max: 3000 }), new TextField({ name: "tag", max: 20 }), new TextField({ name: "country", max: 60 }), img("images", 4), ...created()],
    indexes: ["CREATE INDEX idx_posts_created ON posts (created)"] });

  const comments = make({ type: "base", name: "comments",
    listRule: "", viewRule: "",
    createRule: `${auth} && @request.body.author = @request.auth.id`,
    updateRule: "author = @request.auth.id", deleteRule: "author = @request.auth.id",
    fields: [rel("post", posts.id, true, true), rel("author", U, true, true), new TextField({ name: "text", required: true, max: 1500 }), ...created()] });

  make({ type: "base", name: "likes",
    listRule: "", viewRule: "",
    createRule: `${auth} && @request.body.user = @request.auth.id`,
    deleteRule: "user = @request.auth.id",
    fields: [rel("user", U, true, true), rel("post", posts.id, false, true), rel("comment", comments.id, false, true), ...created()],
    indexes: ["CREATE UNIQUE INDEX idx_likes_unique ON likes (user, post, comment)"] });

  make({ type: "base", name: "news",
    listRule: "", viewRule: "",
    createRule: `${auth} && @request.body.author = @request.auth.id && @request.auth.approved = true`,
    updateRule: "author = @request.auth.id", deleteRule: "author = @request.auth.id",
    fields: [rel("author", U, false, true), new TextField({ name: "source", max: 80 }), new TextField({ name: "byRole", max: 40 }), new TextField({ name: "title", required: true, max: 200 }), new TextField({ name: "text", max: 5000 }), new URLField({ name: "url" }), new TextField({ name: "country", max: 60 }), img("image", 1), ...created()] });

  make({ type: "base", name: "reviews",
    listRule: "", viewRule: "",
    createRule: `${auth} && @request.body.author = @request.auth.id`,
    updateRule: "author = @request.auth.id && @request.body.author:isset = false", deleteRule: "author = @request.auth.id",
    fields: [new TextField({ name: "target", required: true, max: 80 }), rel("author", U, true, true), new NumberField({ name: "rating", required: true, min: 1, max: 5, onlyInt: true }), new TextField({ name: "role", max: 80 }), new TextField({ name: "year", max: 4 }), new TextField({ name: "text", required: true, min: 20, max: 3000 }), ...created()],
    indexes: ["CREATE UNIQUE INDEX idx_reviews_unique ON reviews (target, author)"] });

  make({ type: "base", name: "questions",
    listRule: "", viewRule: "",
    createRule: `${auth} && @request.body.author = @request.auth.id && @request.body.to != @request.auth.id`,
    updateRule: "to = @request.auth.id && @request.body.text:isset = false && @request.body.author:isset = false && @request.body.to:isset = false",
    deleteRule: "author = @request.auth.id || to = @request.auth.id",
    fields: [rel("to", U, true, true), rel("author", U, true, true), new TextField({ name: "text", required: true, max: 1500 }), new TextField({ name: "answer", max: 1500 }), ...created()] });

  make({ type: "base", name: "photos",
    listRule: "", viewRule: "",
    createRule: `${auth} && @request.body.author = @request.auth.id && @request.auth.approved = true`,
    deleteRule: "author = @request.auth.id",
    fields: [new TextField({ name: "target", required: true, max: 80 }), rel("author", U, false, true), new TextField({ name: "byRole", max: 40 }), new FileField({ name: "image", required: true, maxSelect: 1, maxSize: 6 * 1024 * 1024, mimeTypes: ["image/jpeg", "image/png", "image/webp"], thumbs: ["600x0"] }), ...created()] });

  make({ type: "base", name: "uniprogs",
    listRule: "", viewRule: "",
    createRule: `${auth} && @request.body.author = @request.auth.id && @request.auth.approved = true`,
    updateRule: "author = @request.auth.id", deleteRule: "author = @request.auth.id",
    fields: [new TextField({ name: "uni", required: true, max: 80 }), rel("author", U, true, true), new SelectField({ name: "kind", maxSelect: 1, values: ["p", "s"] }), new TextField({ name: "level", max: 2 }), new TextField({ name: "title", required: true, max: 160 }), new TextField({ name: "lang", max: 40 }), new TextField({ name: "cost", max: 60 }), new TextField({ name: "deadline", max: 60 }), new URLField({ name: "url" }), new TextField({ name: "note", max: 600 }), ...created()] });

  make({ type: "base", name: "messages",
    listRule: "@request.auth.id != '' && (from = @request.auth.id || to = @request.auth.id)",
    viewRule: "@request.auth.id != '' && (from = @request.auth.id || to = @request.auth.id)",
    createRule: `${auth} && @request.body.from = @request.auth.id && @request.body.to != @request.auth.id`,
    updateRule: "to = @request.auth.id && @request.body.text:isset = false && @request.body.from:isset = false && @request.body.to:isset = false",
    deleteRule: "from = @request.auth.id",
    fields: [rel("from", U, true, true), rel("to", U, true, true), new TextField({ name: "text", required: true, max: 2000 }), new BoolField({ name: "read" }), ...created()],
    indexes: ["CREATE INDEX idx_msg_pair ON messages (`from`, `to`, created)"] });

  make({ type: "base", name: "support",
    createRule: "",
    fields: [rel("author", U, false, false), new TextField({ name: "name", max: 80 }), new EmailField({ name: "email", required: true }), new TextField({ name: "topic", max: 80 }), new TextField({ name: "text", required: true, min: 10, max: 3000 }), new BoolField({ name: "done" }), ...created()] });

  make({ type: "base", name: "subscribers",
    createRule: "",
    fields: [new EmailField({ name: "email", required: true }), ...created()],
    indexes: ["CREATE UNIQUE INDEX idx_subs_email ON subscribers (email)"] });

  // стартовые новости редакции
  const news = app.findCollectionByNameOrId("news");
  [["Neolex открылся: 36 стран в одной базе", "Программы, стипендии, стажировки и волонтёрство из 36 стран, каталог из 6 290 вузов и менторы. Заполните профиль, и поиск покажет, куда вы проходите уже сейчас.", ""],
   ["Chevening: приём заявок обычно закрывается в начале ноября", "Полная стипендия на магистратуру в Великобритании. Нужно 2 года опыта работы. Точную дату проверьте на официальном сайте.", "https://www.chevening.org"],
   ["Stipendium Hungaricum: подача обычно до середины января", "Бесплатная учёба в Венгрии, стипендия и жильё для граждан стран-партнёров. Самое время собирать документы.", "https://stipendiumhungaricum.hu"],
   ["Türkiye Bursları: окно подачи обычно с января по 20 февраля", "Полная стипендия Турции на бакалавриат, магистратуру и PhD, плюс год турецкого языка.", "https://www.turkiyeburslari.gov.tr"],
   ["ETH Zürich: заявки в магистратуру принимают до середины декабря", "Вместе с заявкой можно подать на стипендию ESOP, которая покрывает учёбу и жизнь.", "https://ethz.ch/en.html"]
  ].forEach(([t, x, u]) => { const r = new Record(news); r.set("title", t); r.set("text", x); r.set("url", u); r.set("source", "Neolex"); app.save(r); });
}, (app) => {
  ["subscribers", "support", "messages", "uniprogs", "photos", "questions", "reviews", "news", "likes", "comments", "posts"].forEach((n) => { try { app.delete(app.findCollectionByNameOrId(n)); } catch (_) {} });
});
