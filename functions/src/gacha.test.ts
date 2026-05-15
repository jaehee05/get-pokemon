import { describe, expect, it } from "vitest";
import { openPack, weightedPickKey, weightedPickItem } from "./gacha";
import { Card, Pack } from "./types";

function seededRng(seed: number) {
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

describe("openPack — TCG Pocket 스타일 (5장, 5번째가 Hit)", () => {
  const cards: Card[] = [
    { id: "c1", name: "Magikarp", imageUrl: "", rarity: "C", weight: 1, isActive: true },
    { id: "c2", name: "Pidgey", imageUrl: "", rarity: "C", weight: 1, isActive: true },
    { id: "u1", name: "Bulbasaur", imageUrl: "", rarity: "U", weight: 1, isActive: true },
    { id: "r1", name: "Charmeleon", imageUrl: "", rarity: "R", weight: 1, isActive: true },
    { id: "rr1", name: "Wartortle ex", imageUrl: "", rarity: "RR", weight: 1, isActive: true },
    { id: "ar1", name: "Charizard ART", imageUrl: "", rarity: "AR", weight: 1, isActive: true },
    { id: "sr1", name: "Charizard SR", imageUrl: "", rarity: "SR", weight: 1, isActive: true },
    { id: "sar1", name: "Charizard SAR", imageUrl: "", rarity: "SAR", weight: 1, isActive: true },
    { id: "mur1", name: "Mew MUR", imageUrl: "", rarity: "MUR", weight: 1, isActive: true },
  ];

  const pack: Pack = {
    id: "p1",
    name: "기본 팩",
    cardCount: 5,
    cardPool: cards.map((c) => c.id),
    price: 0,
    isActive: true,
    slots: [
      { rarityWeights: { C: 100 } },
      { rarityWeights: { C: 100 } },
      { rarityWeights: { C: 100 } },
      { rarityWeights: { U: 85, R: 15 } },
      {
        rarityWeights: {
          R: 50,
          RR: 25,
          AR: 12,
          SR: 8,
          SAR: 4,
          MUR: 1,
        },
      },
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

  it("slots 0-2 are always C", () => {
    const rng = seededRng(11);
    for (let i = 0; i < 200; i++) {
      const res = openPack(pack, cards, rng);
      expect(res.rarities[0]).toBe("C");
      expect(res.rarities[1]).toBe("C");
      expect(res.rarities[2]).toBe("C");
    }
  });

  it("slot 4 (Hit) follows configured rarity distribution", () => {
    const rng = seededRng(42);
    const counts: Record<string, number> = {
      R: 0, RR: 0, AR: 0, SR: 0, SAR: 0, MUR: 0,
    };
    const N = 40000;
    for (let i = 0; i < N; i++) {
      const res = openPack(pack, cards, rng);
      counts[res.rarities[4]]++;
    }
    // 50, 25, 12, 8, 4, 1 → total 100
    expect(counts.R / N).toBeGreaterThan(0.46);
    expect(counts.R / N).toBeLessThan(0.54);
    expect(counts.RR / N).toBeGreaterThan(0.22);
    expect(counts.RR / N).toBeLessThan(0.28);
    expect(counts.AR / N).toBeGreaterThan(0.10);
    expect(counts.AR / N).toBeLessThan(0.14);
    expect(counts.MUR / N).toBeGreaterThan(0.005);
    expect(counts.MUR / N).toBeLessThan(0.020);
  });

  it("respects per-card weight within a rarity", () => {
    const weighted: Card[] = [
      ...cards.filter((c) => c.rarity !== "C"),
      { id: "cA", name: "A", imageUrl: "", rarity: "C", weight: 9, isActive: true },
      { id: "cB", name: "B", imageUrl: "", rarity: "C", weight: 1, isActive: true },
    ];
    const onlyCommon: Pack = {
      ...pack,
      slots: [{ rarityWeights: { C: 100 } }],
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
    const noMUR = cards.filter((c) => c.rarity !== "MUR");
    const alwaysMUR: Pack = {
      ...pack,
      cardCount: 1,
      slots: [{ rarityWeights: { MUR: 1 } }],
      cardPool: noMUR.map((c) => c.id),
    };
    expect(() => openPack(alwaysMUR, noMUR, seededRng(3))).toThrow();
  });
});
