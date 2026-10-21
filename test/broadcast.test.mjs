// Run: node --test test/broadcast.test.mjs   (all names and numbers below are made up)
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePhone, parseContacts, parseTable, matchTable, addressName, firstName, genitive, fill, unknownPlaceholders, plan, messagesFor, waLink, BUILTIN_TAGS } from "../broadcast/lib.js";

const TABLE = [
  "Аты жөні\tАнасы\tАнасының номері\tӘкесі\tӘкесінің номері",
  "Серіков Ален\tСерікова Айжан Боранқызы\t87010000001\t\t",
  '"Ахметов Тимур \n"\tАхметова Сара Нұрқызы\t87010000002\tАхметов Ерлан Болатұлы\t87010000003',
  "Омаров Сұлтан\tОмарова Дина Маратовна\t\tОмаров Бауыржан Ерікұлы\t87010000004",
  "Нұрланұлы Әли\tЖақсыбаева Гүл Сериковна\t87010000005\tНұрлан Асқар\tмұғалім",
  "Қайрат Алдияр\tҚайратова Зере Нұрқызы\t87010000006\tҚайратов Нұр Асанұлы\t87010000007",
  "Қайрат Данияр\tҚайратова Зере Нұрқызы\t87010000006\tҚайратов Нұр Асанұлы\t87010000007",
].join("\n");
const contacts = () => parseContacts(TABLE).contacts;

test("phones", () => {
  assert.equal(normalizePhone("+7 (701) 123-45-67"), "77011234567");
  assert.equal(normalizePhone("87011234567"), "77011234567");
  assert.equal(normalizePhone("мұғалім"), null);
});

test("contacts keep parents without a number", () => {
  const { contacts: cs, bad } = parseContacts(TABLE);
  assert.equal(cs.length, 11);
  assert.deepEqual(cs.filter((c) => !c.phone).map((c) => [c.parent, c.note ?? ""]), [["Омарова Дина Маратовна", ""], ["Нұрлан Асқар", "мұғалім"]]);
  assert.equal(cs[1].student, "Ахметов Тимур");
  assert.deepEqual(bad, []);
  assert.deepEqual(parseContacts("Әли Нұрланов; Нұрлан Сейітұлы; +7 701 123 45 67").contacts, [{ student: "Әли Нұрланов", parent: "Нұрлан Сейітұлы", phone: "77011234567", role: "" }]);
});

test("audiences", () => {
  const n = (a, o) => plan(contacts(), a, o).messages.length;
  assert.equal(n("mother_first"), 5);               // 6 students, the twins' mother gets one message
  assert.equal(n("mother_first", { perStudent: true }), 6);
  assert.equal(n("father"), 3);                      // Тимур, Сұлтан, twins (shared)
  assert.equal(n("both"), 7);
  assert.equal(n("all"), 7);
  const { notes } = plan(contacts(), "mother_first");
  assert.deepEqual(notes, [{ student: "Омаров Сұлтан", text: "анасының нөмірі жоқ, әкесіне жіберіледі" }]);
  const fathers = plan(contacts(), "father").notes.map((x) => [x.student, x.text]);
  assert.deepEqual(fathers, [["Серіков Ален", "әкесі тізімде жоқ"], ["Нұрланұлы Әли", "әкесінің нөмірі жоқ"]]);
  const cs = contacts(); cs.find((c) => c.student === "Ахметов Тимур" && c.role === "әке").primary = true;
  assert.equal(plan(cs, "primary").messages.find((m) => m.students[0] === "Ахметов Тимур").contact.role, "әке");
  cs.push({ student: "Серіков Ален", parent: "Серікова Гүл", phone: "77019999999", role: "туысы", nearby: true });
  assert.deepEqual(plan(cs, "nearby").messages.map((m) => m.phone), ["77019999999"]);
});

test("naming styles", () => {
  assert.equal(addressName("Айтбекова Маржан Саматовна"), "Маржан Саматовна");
  assert.equal(addressName("Айтбекова Маржан Саматовна", "title", "ана"), "Маржан апай");
  assert.equal(addressName("Шахаров Кунанбай Атамуратович", "title"), "Кунанбай ағай");
  assert.equal(addressName("Айтбекова Маржан Саматовна", "name"), "Маржан");
  assert.equal(addressName("айтбекова маржан саматовна", "full"), "Айтбекова Маржан Саматовна");
  assert.equal(addressName("Қабылов қызы Гүлсім", "title"), "Гүлсім апай");
  assert.equal(addressName("Нұрлан Сейітұлы"), "Нұрлан Сейітұлы");
  assert.equal(addressName("Камигат Жанарбек", "title"), "Жанарбек");          // no gender known, no title guessed
  assert.equal(addressName("Камигат Жанарбек", "title", "әке"), "Жанарбек ағай");
  assert.equal(firstName("Нұрланұлы Әли "), "Әли");
});

test("genitive", () => {
  const cases = { "Рамазан": "Рамазанның", "Әли": "Әлидің", "Салих": "Салихтың", "Берік": "Беріктің", "Нұрислам": "Нұрисламның",
    "Онур": "Онурдың", "Данияр": "Даниярдың", "Ахмад": "Ахмадтың", "Асау-Барақ": "Асау-Барақтың", "Айсұлтан": "Айсұлтанның",
    "Әсел": "Әселдің", "Алдияр мен Данияр": "Алдияр мен Даниярдың", "Сағадат": "Сағадаттың", "Ерғали": "Ерғалидың" };
  for (const [w, g] of Object.entries(cases)) assert.equal(genitive(w), g, w);
});

test("data table: header, matching in any word order, per-student messages", () => {
  const t = parseTable("Аты жөні\tМатематика\tҚазақ тілі\tЖалпы балл\nАлен Серіков\t18\t16\t34\nТимур\t20\t19\t39\nҚайрат Алдияр\t15\t\t15\nҚайрат Данияр\t17\t18\t35\nБөтен Адам\t1\t1\t2");
  assert.deepEqual(t.headers, ["Аты жөні", "Математика", "Қазақ тілі", "Жалпы балл"]);
  const students = [...new Set(contacts().map((c) => c.student))];
  const m = matchTable(t, students);
  assert.equal(m.col, 0);
  assert.deepEqual(m.unmatched, ["Бөтен Адам"]);
  assert.deepEqual(m.missing, ["Омаров Сұлтан", "Нұрланұлы Әли"]);
  assert.deepEqual(parseTable("Ален\t18\nТимур\t20").headers, ["Баған 1", "Баған 2"]);

  const template = "Құрметті {Алушы}! {Оқушы аты:ның} нәтижесі: Математика — {Математика}, Қазақ тілі — {Қазақ тілі}. Жалпы: {Жалпы балл}.";
  const { messages } = messagesFor({ contacts: contacts(), template, table: t, audience: "mother_first", naming: "title" });
  assert.equal(messages.length, 6); // twins split: each child has own grades
  const ali = messages.find((x) => x.students[0] === "Серіков Ален");
  assert.equal(ali.text, "Құрметті Айжан апай! Аленнің нәтижесі: Математика — 18, Қазақ тілі — 16. Жалпы: 34.");
  assert.deepEqual(messages.find((x) => x.students[0] === "Қайрат Алдияр").empty, ["Қазақ тілі"]);
  assert.equal(messages.find((x) => x.students[0] === "Омаров Сұлтан").noRow, true);
});

test("tags, old placeholders, links", () => {
  assert.deepEqual(unknownPlaceholders("{Алушы} {ата_ана} {Математика} {date}", [...BUILTIN_TAGS, "Математика"]), ["date"]);
  assert.equal(fill("Құрметті {ата_ана}! {оқушы}", { "Алушы": "Зере", "Оқушы аты": "Алдияр мен Данияр" }), "Құрметті Зере! Алдияр мен Данияр");
  const { messages } = messagesFor({ contacts: contacts(), template: "Құрметті {Алушы}! {Оқушы аты}", audience: "both" });
  assert.equal(messages.find((x) => x.phone === "77010000006").text, "Құрметті Зере Нұрқызы! Алдияр мен Данияр");
  assert.equal(waLink("77011234567", "a b"), "https://wa.me/77011234567?text=a%20b");
});
