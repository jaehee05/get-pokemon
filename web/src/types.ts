export type Rarity =
  | "common"
  | "uncommon"
  | "rare"
  | "super_rare"
  | "secret_rare";

export const ALL_RARITIES: Rarity[] = [
  "common",
  "uncommon",
  "rare",
  "super_rare",
  "secret_rare",
];

export const RARITY_LABEL: Record<Rarity, string> = {
  common: "C 커먼",
  uncommon: "U 언커먼",
  rare: "R 레어",
  super_rare: "SR 슈퍼레어",
  secret_rare: "SCR 시크릿",
};

export const RARITY_COLOR: Record<Rarity, string> = {
  common: "#9aa0a6",
  uncommon: "#34a853",
  rare: "#4285f4",
  super_rare: "#a142f4",
  secret_rare: "#f9ab00",
};

export interface Card {
  id: string;
  name: string;
  imageUrl: string;
  rarity: Rarity;
  weight: number;
  isActive: boolean;
}

export type RarityWeights = Partial<Record<Rarity, number>>;

export interface SlotConfig {
  rarityWeights: RarityWeights;
}

export interface Pack {
  id: string;
  name: string;
  imageUrl?: string;
  cardCount: number;
  slots: SlotConfig[];
  cardPool: string[];
  price: number;
  isActive: boolean;
}
