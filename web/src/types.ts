/**
 * 등급. 낮은 → 높은 순.
 */
export type Rarity =
  | "C"
  | "U"
  | "R"
  | "RR"
  | "SR"
  | "AR"
  | "SAR"
  | "UR"
  | "ACE"
  | "S"
  | "SSR"
  | "BWR"
  | "MUR"
  | "MA";

export const ALL_RARITIES: Rarity[] = [
  "C", "U", "R", "RR", "SR", "AR", "SAR",
  "UR", "ACE", "S", "SSR", "BWR", "MUR", "MA",
];

/** 코드 + 한글 보조 이름 (드롭다운/배지용). */
export const RARITY_LABEL: Record<Rarity, string> = {
  C: "C 커먼",
  U: "U 언커먼",
  R: "R 레어",
  RR: "RR 더블레어",
  SR: "SR 슈퍼레어",
  AR: "AR 아트레어",
  SAR: "SAR 스페셜아트",
  UR: "UR 울트라레어",
  ACE: "ACE 에이스",
  S: "S 샤이니",
  SSR: "SSR 스페셜슈퍼레어",
  BWR: "BWR 흑백레어",
  MUR: "MUR 마스터울트라",
  MA: "MA 마스터",
};

/** 짧은 코드 (공간 좁은 곳). */
export const RARITY_CODE: Record<Rarity, string> = {
  C: "C",
  U: "U",
  R: "R",
  RR: "RR",
  SR: "SR",
  AR: "AR",
  SAR: "SAR",
  UR: "UR",
  ACE: "ACE",
  S: "S",
  SSR: "SSR",
  BWR: "BWR",
  MUR: "MUR",
  MA: "MA",
};

/** 단색 (배지/스트라이프). */
export const RARITY_COLOR: Record<Rarity, string> = {
  C: "#aab1c1",
  U: "#4ade80",
  R: "#60a5fa",
  RR: "#38bdf8",
  SR: "#fbbf24",
  AR: "#f472b6",
  SAR: "#fb923c",
  UR: "#ef4444",
  ACE: "#dc2626",
  S: "#e5e7eb",
  SSR: "#a855f7",
  BWR: "#cbd5e1",
  MUR: "#a78bfa",
  MA: "#fde047",
};

/** 빛/오라용 그라데이션. 등급이 높을수록 화려. */
export const RARITY_GRADIENT: Record<Rarity, string> = {
  C: "linear-gradient(135deg, #aab1c1, #6b7280)",
  U: "linear-gradient(135deg, #6ee7b7, #10b981)",
  R: "linear-gradient(135deg, #93c5fd, #3b82f6)",
  RR: "linear-gradient(135deg, #67e8f9, #0891b2)",
  SR: "linear-gradient(135deg, #fde68a, #f59e0b)",
  AR: "linear-gradient(135deg, #f0abfc, #d946ef)",
  SAR: "linear-gradient(135deg, #fde68a, #fb923c, #f472b6)",
  UR: "linear-gradient(135deg, #fca5a5, #ef4444, #b91c1c)",
  ACE: "linear-gradient(135deg, #ef4444, #7f1d1d)",
  S: "linear-gradient(135deg, #ffffff, #cbd5e1, #94a3b8)",
  SSR: "linear-gradient(135deg, #d8b4fe, #a855f7, #6b21a8)",
  BWR: "linear-gradient(135deg, #0f172a, #f8fafc, #0f172a)",
  MUR: "linear-gradient(135deg, #fbbf24, #c084fc, #60a5fa, #34d399, #fbbf24)",
  MA: "linear-gradient(135deg, #fde047, #fb923c, #f472b6, #c084fc, #60a5fa, #34d399, #fde047)",
};

/** 등급별 시각적 강도 (애니메이션/효과 분기용). 0 = 평범, 4 = 최상위 */
export const RARITY_TIER: Record<Rarity, 0 | 1 | 2 | 3 | 4> = {
  C: 0,
  U: 0,
  R: 1,
  RR: 1,
  SR: 2,
  AR: 2,
  SAR: 2,
  UR: 3,
  ACE: 3,
  S: 3,
  SSR: 4,
  BWR: 4,
  MUR: 4,
  MA: 4,
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
