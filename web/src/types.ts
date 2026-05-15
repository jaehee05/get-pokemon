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

/** 표시용 라벨. 등급 코드만 사용 (Pokemon TCG Pocket 등급 체계는
 *  letter code 가 곧 등급 이름이고 별도 한글 번역이 일관되게 없음). */
export const RARITY_LABEL: Record<Rarity, string> = {
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

export interface Expansion {
  id: string;
  /** 짧은 코드 (예: "M4", "MR"). 카드에 함께 표시됨. */
  code: string;
  /** 풀 네임 (예: "Mega Evolution Vol.4"). 비워도 됨. */
  name: string;
  /** 기본 카드 수 — 표시상 "/083" 의 분모. AR 등 특수 카드 번호가 이걸 넘겨도 OK. */
  baseCardCount: number;
  isActive: boolean;
}

export interface Card {
  id: string;
  name: string;
  imageUrl: string;
  rarity: Rarity;
  weight: number;
  isActive: boolean;
  expansionId?: string;
  number?: number;
  /** 남은 재고. 0 이거나 미정의면 가챠 후보에서 제외. 뽑히면 1 차감. */
  stock?: number;
}

/** "M4 001/083" 형태로 포맷. expansion 없으면 빈 문자열. */
export function formatCardNumber(
  card: Pick<Card, "expansionId" | "number">,
  expansion?: Pick<Expansion, "code" | "baseCardCount"> | null
): string {
  if (!expansion || card.number == null) return "";
  const n = String(card.number).padStart(3, "0");
  const total = String(expansion.baseCardCount).padStart(3, "0");
  return `${expansion.code} ${n}/${total}`;
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
