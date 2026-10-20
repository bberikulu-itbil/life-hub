// Run: node --test test/broadcast.test.mjs   (all names and numbers below are made up)
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePhone, parseList, fill, unknownPlaceholders, waLink, callName, firstName, recipients } from "../broadcast/lib.js";

test("phones become 7XXXXXXXXXX", () => {
  assert.equal(normalizePhone("+7 (701) 123-45-67"), "77011234567");
  assert.equal(normalizePhone("87011234567"), "77011234567");
  assert.equal(normalizePhone("7011234567"), "77011234567");
  assert.equal(normalizePhone("мұғалім"), null);
  assert.equal(normalizePhone(""), null);
});

test("class table copied from Excel: missing mother or father, quoted cell, siblings, header", () => {
  const table = [
    "Аты жөні\tАнасы\tАнасының номері\tӘкесі\tӘкесінің номері",
    "Серіков Ален\tСерікова Айжан Боранқызы\t87010000001\t\t",
    '"Ахметов Тимур \n"\tАхметова Сара Нұрқызы\t87010000002\tАхметов Ерлан Болатұлы\t87010000003',
    "Омаров Сұлтан\tОмарова Дина Маратовна\t\tОмаров Бауыржан Ерікұлы\t87010000004",
    "Нұрланұлы Әли\tЖақсыбаева Гүл Сериковна\t87010000005\tНұрлан Асқар\tмұғалім",
    "Қайрат Алдияр\tҚайратова Зере\t87010000006\tҚайратов Нұр\t87010000007",
    "Қайрат Данияр\tҚайратова Зере\t87010000006\tҚайратов Нұр\t87010000007",
    "\t\t\t\t",
  ].join("\n");
  const { ok, bad, skipped } = parseList(table);
  assert.equal(ok.length, 9);
  assert.deepEqual(ok[1], { student: "Ахметов Тимур", parent: "Ахметова Сара Нұрқызы", phone: "77010000002", role: "ана" });
  assert.deepEqual(ok.filter((p) => p.student === "Серіков Ален").map((p) => p.role), ["ана"]);
  assert.deepEqual(ok.filter((p) => p.student === "Омаров Сұлтан").map((p) => p.role), ["әке"]);
  assert.deepEqual(skipped.map((s) => [s.parent, s.reason]), [["Омарова Дина Маратовна", "телефон жоқ"], ["Нұрлан Асқар", "«мұғалім» телефон емес"]]);
  assert.deepEqual(bad, []);

  const rs = recipients(ok.map((d, i) => ({ id: "r" + i, data: d })));
  assert.equal(rs.length, 7); // 9 parent entries, but the Қайрат twins share both parents
  const mum = rs.find((r) => r.phone === "77010000006");
  assert.deepEqual(mum.students, ["Қайрат Алдияр", "Қайрат Данияр"]);
  assert.equal(fill("Құрметті {ата_ана}! {оқушы} ертең сабақта.", mum), "Құрметті Зере! Алдияр мен Данияр ертең сабақта.");
});

test("line format still works; rows without phones are reported", () => {
  const { ok, bad } = parseList("Әли Нұрланов; Нұрлан Сейітұлы; +7 701 123 45 67\nДанияр — 8 705 000 11 22\nтелефонсыз жол");
  assert.deepEqual(ok, [
    { student: "Әли Нұрланов", parent: "Нұрлан Сейітұлы", phone: "77011234567", role: "" },
    { student: "Данияр", parent: "", phone: "77050001122", role: "" },
  ]);
  assert.deepEqual(bad, [{ line: 3, text: "телефонсыз жол" }]);
});

test("how people are addressed", () => {
  assert.equal(callName("Серікова Айжан Боранқызы"), "Айжан Боранқызы");
  assert.equal(callName("Омарова Дина Маратовна"), "Дина Маратовна");
  assert.equal(callName("Нұрлан Асқар"), "Асқар");
  assert.equal(callName("Нұрлан Сейітұлы"), "Нұрлан Сейітұлы");
  assert.equal(callName("Қабылов қызы Гүлсім"), "Гүлсім");
  assert.equal(callName("ахметова сара нұрқызы"), "Сара Нұрқызы");
  assert.equal(callName(""), "");
  assert.equal(firstName("Нұрланұлы Әли "), "Әли");
  assert.equal(fill("Құрметті {ата_ана}!", { parent: "", students: ["Данияр"] }), "Құрметті ата-ана!");
});

test("unknown placeholders and links", () => {
  assert.deepEqual(unknownPlaceholders("{ата_ана} {сынып} {оқушы} {date}"), ["{сынып}", "{date}"]);
  assert.equal(waLink("77011234567", "Сәлем & сау бол"), "https://wa.me/77011234567?text=%D0%A1%D3%99%D0%BB%D0%B5%D0%BC%20%26%20%D1%81%D0%B0%D1%83%20%D0%B1%D0%BE%D0%BB");
});
