// Run: node --test test/broadcast.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePhone, parseList, fill, unknownPlaceholders, waLink } from "../broadcast/lib.js";

test("phones become 7XXXXXXXXXX", () => {
  assert.equal(normalizePhone("+7 (701) 123-45-67"), "77011234567");
  assert.equal(normalizePhone("87011234567"), "77011234567");
  assert.equal(normalizePhone("7011234567"), "77011234567");
  assert.equal(normalizePhone("12345"), null);
  assert.equal(normalizePhone(""), null);
});

test("pasted lists: semicolons, tabs, dashes; bad lines reported", () => {
  const { ok, bad } = parseList("Әли Нұрланов; Нұрлан Сейітұлы; +7 701 123 45 67\nАружан Ердос\tГүлнар\t87021112233\n\nДанияр — 8 705 000 11 22\nтелефонсыз жол");
  assert.deepEqual(ok, [
    { student: "Әли Нұрланов", parent: "Нұрлан Сейітұлы", phone: "77011234567" },
    { student: "Аружан Ердос", parent: "Гүлнар", phone: "77021112233" },
    { student: "Данияр", parent: "", phone: "77050001122" },
  ]);
  assert.deepEqual(bad, [{ line: 5, text: "телефонсыз жол" }]);
});

test("fill, unknown placeholders, links", () => {
  assert.equal(fill("Құрметті {ата_ана}! {оқушы} ертең…", { parent: "Гүлнар", student: "Аружан" }), "Құрметті Гүлнар! Аружан ертең…");
  assert.equal(fill("Құрметті {ата_ана}!", { student: "Данияр" }), "Құрметті ата-ана!");
  assert.deepEqual(unknownPlaceholders("{ата_ана} {сынып} {оқушы} {date}"), ["{сынып}", "{date}"]);
  assert.equal(waLink("77011234567", "Сәлем & сау бол"), "https://wa.me/77011234567?text=%D0%A1%D3%99%D0%BB%D0%B5%D0%BC%20%26%20%D1%81%D0%B0%D1%83%20%D0%B1%D0%BE%D0%BB");
});
