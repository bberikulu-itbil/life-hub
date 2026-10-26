// Run: node --test test/addword.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { pickWord } = createRequire(import.meta.url)("../brand/addword.js");

test("pickWord accepts 1-4 English words and rejects the rest", () => {
  assert.equal(pickWord("  “Achieve,” "), "Achieve");
  assert.equal(pickWord("look  forward\nto"), "look forward to");
  assert.equal(pickWord("well-known"), "well-known");
  assert.equal(pickWord("don't"), "don't");
  assert.equal(pickWord("one two three four five"), null);
  assert.equal(pickWord("қол жеткізу"), null);
  assert.equal(pickWord("42"), null);
  assert.equal(pickWord(null), null);
});
