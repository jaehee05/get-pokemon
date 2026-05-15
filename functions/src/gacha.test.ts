import { describe, expect, it } from "vitest";
import { openPack, weightedPickKey, weightedPickItem } from "./gacha";
import { Card, Pack } from "./types";

function seededRng(seed: number) {
  // mulberry32
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("weightedPickKey", () => {
  it("respects weights over many samples", () => {
    const rng = seededRng(1);
    const counts: Record<string, number> = { a: 0, b: 0 };
    const N = 10000;
    for (let i = 0; i < N; i++) {
      const k = weightedPickKey({ a: 90, b: 10 }, rng);
      counts[k]++;
    }
    const aRatio = counts.a / N;
    expect(aRatio).toBeGreaterThan(0.87);
    expect(aRatio).toBeLessThan(0.93);
  });

  it("throws when all weights zero", () => {
    expect(() => weightedPickKey({ a: 0, b: 0 })).toThrow();
  });
});

describe("weightedPickItem", () => {
  it("falls back to uniform when all weights zero", () => {
    const rng = seededRng(2);
    const counts: Record<string, number> = { x: 0, y: 0 };
    for (let i = 0; i < 5000; i++) {
      const pick = weightedPickItem(
        [{ id: "x" }, { id: "y" }],
        () => 0,
        rng
      );
      counts[pick.id]++;
    }
    expect(counts.x / 5000).toBeGreaterThan(0.45);
    expect(counts.x / 5000).toBeLessThan(0.55);
  });
});

describe("openPack — TCG Pocket 스타일 (5장, 5번째 슬롯이 Hit)", () => {
  const cards: Card[] = [
    { id: "c1", name: "Magikarp", imageUrl: "", rarity: "common", weight: 1, isActive: true },
    { id: "c2", name: "Pidgey", imageUrl: "", rarity: "common", weight: 1, isActive: true },
    { id: "u1", name: "Bulbasaur", imageUrl: "", rarity: "uncommon", weight: 1, isActive: true },
    { id: "r1", name: "Charmeleon", imageUrl: "", rarity: "rare", weight: 1, isActive: true },
    { id: "sr1", name: "Charizard", imageUrl: "", rarity: "super_rare", weight: 1, isActive: true },
    { id: "scr1", name: "Charizard ex", imageUrl: "", rarity: "secret_rare", weight: 1, isActive: true },
  ];

  const pack: Pack = {
    id: "p1",
    name: "기본 팩",
    cardCount: 5,
    cardPool: cards.map((c) => c.id),
    price: 0,
    isActive: true,
    slots: [
      { rarityWeights: { common: 100 } },
      { rarityWeights: { common: 100 } },
      { rarityWeights: { common: 100 } },
      { rarityWeights: { uncommon: 90, rare: 10 } },
      { rarityWeights: { rare: 70, super_rare: 25, secret_rare: 5 } },
    ],
  };

  it("always returns cardCount cards", () => {
    const rng = seededRng(7);
    for (let i = 0; i < 50; i++) {
      const res = openPack(pack, cards, rng);
      expect(res.cards.length).toBe(5);
      expect(res.rarities.length).toBe(5);
    }
  });

  it("slots 0-2 are always common", () => {
    const rng = seededRng(11);
    for (let i = 0; i < 200; i++) {
      const res = openPack(pack, cards, rng);
      expect(res.rarities[0]).toBe("common");
      expect(res.rarities[1]).toBe("common");
      expect(res.rarities[2]).toBe("common");
    }
  });

  it("slot 4 (Hit) follows configured rarity distribution", () => {
    const rng = seededRng(42);
    const counts = { rare: 0, super_rare: 0, secret_rare: 0 };
    const N = 20000;
    for (let i = 0; i < N; i++) {
      const res = openPack(pack, cards, rng);
      counts[res.rarities[4] as keyof typeof counts]++;
    }
    expect(counts.rare / N).toBeGreaterThan(0.65);
    expect(counts.rare / N).toBeLessThan(0.75);
    expect(counts.super_rare / N).toBeGreaterThan(0.22);
    expect(counts.super_rare / N).toBeLessThan(0.28);
    expect(counts.secret_rare / N).toBeGreaterThan(0.035);
    expect(counts.secret_rare / N).toBeLessThan(0.065);
  });

  it("respects per-card weight within a rarity", () => {
    const weighted = [
      ...cards.filter((c) => c.rarity !== "common"),
      { id: "cA", name: "A", imageUrl: "", rarity: "common" as const, weight: 9, isActive: true },
      { id: "cB", name: "B", imageUrl: "", rarity: "common" as const, weight: 1, isActive: true },
    ];
    const onlyCommon: Pack = {
      ...pack,
      slots: [{ rarityWeights: { common: 100 } }],
      cardCount: 1,
      cardPool: ["cA", "cB"],
    };
    const rng = seededRng(99);
    const counts = { cA: 0, cB: 0 };
    const N = 5000;
    for (let i = 0; i < N; i++) {
      const id = openPack(onlyCommon, weighted, rng).cards[0].id;
      counts[id as keyof typeof counts]++;
    }
    expect(counts.cA / N).toBeGreaterThan(0.85);
    expect(counts.cA / N).toBeLessThan(0.95);
  });

  it("throws when slots.length != cardCount", () => {
    const bad: Pack = { ...pack, cardCount: 4 };
    expect(() => openPack(bad, cards, seededRng(1))).toThrow();
  });

  it("throws when a rarity is rolled but pool has none", () => {
    const noSecret = cards.filter((c) => c.rarity !== "secret_rare");
    const alwaysSecret: Pack = {
      ...pack,
      cardCount: 1,
      slots: [{ rarityWeights: { secret_rare: 1 } }],
      cardPool: noSecret.map((c) => c.id),
    };
    expect(() => openPack(alwaysSecret, noSecret, seededRng(3))).toThrow();
  });
});
