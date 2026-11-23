import { describe, expect, it } from "vitest";
import { splitProductName } from "../src/lib/product-name";

describe("store POP product name line breaks", () => {
  it.each([
    // Reported in trial use: the old middle split gave 「ツ／イン」「味／噌」.
    ["おかめ豆腐ツインパック", ["おかめ豆腐", "ツインパック"]],
    [
      "サッポロ一番塩ラーメン・味噌ラーメン・醤油ラーメン",
      ["サッポロ一番塩ラーメン・", "味噌ラーメン・醤油ラーメン"],
    ],
    ["生サーモン刺身用柵どり", ["生サーモン", "刺身用柵どり"]],
    ["北海道産じゃがいもメークイン", ["北海道産じゃがいも", "メークイン"]],
  ])("breaks %s at a natural boundary", (name, lines) => {
    expect(splitProductName(name)).toEqual(lines);
  });

  it.each([
    [
      "サッポロ一番 塩・味噌・醤油ラーメン",
      ["サッポロ一番", "塩・味噌・醤油ラーメン"],
    ],
    ["おかめ豆腐　ツインパック", ["おかめ豆腐", "ツインパック"]],
    // With several spaces, the one nearest the middle wins; others are kept.
    ["国産 牛肩ロース すき焼き用", ["国産 牛肩ロース", "すき焼き用"]],
  ])("uses a staff-typed space as the break in %s", (name, lines) => {
    expect(splitProductName(name)).toEqual(lines);
  });

  it.each([
    "国産牛 切り落とし",
    "成分無調整牛乳",
    "トマト",
    "１０個入りたまご",
  ])("keeps %s on one line", (name) => {
    expect(splitProductName(name)).toEqual([name]);
  });

  it("never starts a line with small kana, 「ー」 or 「・」", () => {
    for (const name of [
      "チョコレートクッキーアソート",
      "シャインマスカット・ピオーネ",
      "あっさりしょうゆラーメン",
    ]) {
      const [, second] = splitProductName(name);
      expect(second).not.toMatch(/^[ァィゥェォッャュョっゃゅょー・、]/);
    }
  });

  it("does not split numbers or Latin words", () => {
    expect(splitProductName("コカ・コーラ1500ml")).toEqual([
      "コカ・コーラ",
      "1500ml",
    ]);
    expect(splitProductName("北海道産Premium牛乳")).toEqual([
      "北海道産",
      "Premium牛乳",
    ]);
  });

  it("lets staff fix words the rules cannot see with a space", () => {
    // Without a dictionary, one long katakana word or a kanji/hiragana word
    // has no visible boundary; two lines are still produced, and a typed
    // space puts the break exactly where staff want it.
    for (const name of [
      "アイスクリームサンドイッチ",
      "国産若鶏もも肉からあげ用",
    ])
      expect(splitProductName(name)).toHaveLength(2);
    expect(splitProductName("アイスクリーム サンドイッチ")).toEqual([
      "アイスクリーム",
      "サンドイッチ",
    ]);
    expect(splitProductName("国産若鶏もも肉 からあげ用")).toEqual([
      "国産若鶏もも肉",
      "からあげ用",
    ]);
  });
});
