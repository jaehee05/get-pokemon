import { collection, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { SafeImage } from "../SafeImage";
import { db, functions } from "../firebase";
import {
  Card,
  Expansion,
  RARITY_COLOR,
  RARITY_GRADIENT,
  RARITY_LABEL,
  RARITY_TIER,
  Rarity,
  formatCardNumber,
} from "../types";
import { formatCurrency, useProfile } from "../useProfile";

/** 카드 앞면 — 이미지 로드 실패 시 placeholder 로 자동 폴백. */
function CardFront({ card, tier }: { card: Card; tier: number }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [card.imageUrl]);
  if (!card.imageUrl || failed) {
    return (
      <div className="placeholder">
        <div className="emoji">🃏</div>
        <div className="name">{card.name}</div>
        <span
          className="rarity-pill"
          style={{ background: RARITY_COLOR[card.rarity] }}
        >
          {RARITY_LABEL[card.rarity]}
        </span>
      </div>
    );
  }
  return (
    <>
      <img src={card.imageUrl} alt={card.name} onError={() => setFailed(true)} />
      {tier >= 1 && <div className="holo" />}
      {tier >= 3 && <div className="shine-burst" />}
    </>
  );
}

interface PackMeta {
  id: string;
  name: string;
  imageUrl: string;
  cardBackImageUrl: string;
  cardCount: number;
  price: number;
}

interface SinglePackResult {
  cards: Card[];
  rarities: Rarity[];
}
interface OpenPackResult {
  pullIds: string[];
  packs: SinglePackResult[];
  count: number;
  totalCost: number;
  currencyAfter: number;
}

type Stage = "idle" | "opening" | "revealed";

const MIN_OPEN_MS = 1400;

export default function PackOpen() {
  const { packId } = useParams<{ packId: string }>();
  const nav = useNavigate();
  const profile = useProfile();
  const balance = profile?.currency ?? 0;
  const [pack, setPack] = useState<PackMeta | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [result, setResult] = useState<OpenPackResult | null>(null);
  const [revealed, setRevealed] = useState<boolean[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [exps, setExps] = useState<Expansion[]>([]);
  const [availability, setAvailability] = useState<number | null>(null);
  const [backImageFailed, setBackImageFailed] = useState(false);

  useEffect(() => {
    setBackImageFailed(false);
  }, [pack?.cardBackImageUrl]);

  async function refreshAvailability() {
    if (!packId) return;
    try {
      const r = await httpsCallable<{ packId: string }, { approxPacksRemaining: number }>(
        functions,
        "getPackAvailability"
      )({ packId });
      setAvailability(r.data.approxPacksRemaining);
    } catch {
      setAvailability(null);
    }
  }

  useEffect(() => {
    void refreshAvailability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packId]);

  useEffect(() => {
    if (!packId) return;
    httpsCallable<unknown, { packs: PackMeta[] }>(
      functions,
      "listActivePacks"
    )({}).then((r) => {
      const found = r.data.packs.find((p) => p.id === packId) ?? null;
      setPack(found);
    });
  }, [packId]);

  useEffect(() => {
    return onSnapshot(collection(db, "expansions"), (s) =>
      setExps(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Expansion))
    );
  }, []);

  const expById = useMemo(() => {
    const m = new Map<string, Expansion>();
    for (const e of exps) m.set(e.id, e);
    return m;
  }, [exps]);

  async function open(count: number) {
    if (!packId) return;
    setErr(null);
    setStage("opening");
    try {
      const t0 = Date.now();
      const [r] = await Promise.all([
        httpsCallable<{ packId: string; count: number }, OpenPackResult>(
          functions,
          "openPack"
        )({ packId, count }),
        new Promise<void>((res) => setTimeout(res, 200)),
      ]);
      const elapsed = Date.now() - t0;
      if (elapsed < MIN_OPEN_MS) {
        await new Promise((res) => setTimeout(res, MIN_OPEN_MS - elapsed));
      }
      const totalCards = r.data.packs.reduce((s, p) => s + p.cards.length, 0);
      setResult(r.data);
      setRevealed(new Array(totalCards).fill(false));
      setStage("revealed");
      void refreshAvailability();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
      setStage("idle");
    }
  }

  const [resetting, setResetting] = useState(false);

  function reveal(i: number) {
    setRevealed((arr) => arr.map((v, idx) => (idx === i ? true : v)));
  }
  function revealAll() {
    if (!result) return;
    const total = result.packs.reduce((s, p) => s + p.cards.length, 0);
    setRevealed(new Array(total).fill(true));
  }
  function reset() {
    setResult(null);
    setRevealed([]);
    setStage("idle");
  }

  /**
   * '한 번 더' 버튼. 안 연 카드가 남았으면 먼저 전부 공개해서 잠깐 보여준 뒤
   * 자연스럽게 idle 로 복귀.
   */
  async function againOrRevealFirst() {
    if (!result) return;
    const anyHidden = revealed.some((v) => !v);
    if (anyHidden) {
      setResetting(true);
      const total = result.packs.reduce((s, p) => s + p.cards.length, 0);
      setRevealed(new Array(total).fill(true));
      // flip 애니메이션(~0.75s) + 카드 확인 시간
      await new Promise((res) => setTimeout(res, 1100));
      setResetting(false);
    }
    reset();
  }

  if (!pack) return <div className="center">팩 로딩 중...</div>;

  const allResultRarities = result ? result.packs.flatMap((p) => p.rarities) : [];
  const allResultCards = result ? result.packs.flatMap((p) => p.cards) : [];
  const maxTier = result
    ? Math.max(0, ...allResultRarities.map((r) => RARITY_TIER[r]))
    : 0;
  const price = pack.price ?? 0;
  const free = price === 0;

  return (
    <div className={`open-root tier-${maxTier}`}>
      <button
        className="secondary"
        onClick={() => nav(-1)}
        style={{ alignSelf: "flex-start" }}
      >
        ← 돌아가기
      </button>

      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <h1 className="h1" style={{ marginBottom: 4 }}>{pack.name}</h1>
          <p className="muted" style={{ marginTop: 0 }}>
            {pack.cardCount}장 · 가격 {free ? "무료" : `💎 ${formatCurrency(price)}`}
          </p>
        </div>
        <div className="col" style={{ alignItems: "flex-end", gap: 6 }}>
          <span className="balance-pill">
            <span>💎</span>
            <b>{formatCurrency(balance)}</b>
          </span>
        </div>
      </div>

      {/* Idle / Opening: 큰 팩 */}
      {stage !== "revealed" && (
        <div className="pack-stage">
          <div className={`pack-art ${stage}`}>
            <div className="pack-glow" />
            <div className="pack-body">
              <SafeImage
                src={pack.imageUrl}
                alt={pack.name}
                fallback={
                  <div className="pack-cover">
                    <div className="pack-emoji">📦</div>
                    <div className="pack-title">{pack.name}</div>
                  </div>
                }
              />
              <div className="pack-shine" />
              <div className="pack-tear" />
            </div>
          </div>

          {stage === "idle" ? (
            <div className="col" style={{ alignItems: "center", gap: 12 }}>
              {availability === 0 ? (
                <div
                  style={{
                    padding: "20px 28px",
                    borderRadius: 14,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid var(--border-strong)",
                    textAlign: "center",
                    maxWidth: 420,
                    backdropFilter: "blur(4px)",
                  }}
                >
                  <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "0.04em" }}>
                    품절
                  </div>
                  <div style={{ fontSize: 10, letterSpacing: "0.32em", color: "var(--muted)", marginTop: 2, fontWeight: 700, textTransform: "uppercase" }}>
                    sold out
                  </div>
                  <p className="muted" style={{ margin: "10px 0 0", fontSize: 13 }}>
                    이 팩에서 뽑을 수 있는 카드 재고가 없습니다.
                  </p>
                </div>
              ) : (
                <div className="row" style={{ gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                  {[1, 5, 10].map((n) => {
                    const cost = price * n;
                    const cant = !free && balance < cost;
                    const exceeds = availability != null && n > availability;
                    const disabled = cant || exceeds;
                    return (
                      <button
                        key={n}
                        onClick={() => open(n)}
                        className={n === 1 ? "open-btn" : "secondary"}
                        disabled={disabled}
                        title={
                          cant
                            ? "캐시가 부족합니다"
                            : exceeds
                            ? "재고가 부족합니다"
                            : undefined
                        }
                        style={n === 1 ? undefined : { padding: "12px 22px", fontSize: 14, borderRadius: 999 }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.2 }}>
                          <span style={{ fontSize: 15, fontWeight: 800 }}>{n}팩</span>
                          <span style={{ fontSize: 11, opacity: 0.85 }}>
                            {free ? "무료" : `💎 ${formatCurrency(cost)}`}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {availability != null && availability > 0 && (
                <span className="muted" style={{ fontSize: 12 }}>
                  현재 재고로 약 <b>{availability}</b>팩 분량 남음
                  {availability <= 5 && (
                    <span style={{ color: "var(--accent)", marginLeft: 6 }}>· 잔여 적음</span>
                  )}
                </span>
              )}
              {err && (
                <p style={{ color: "var(--danger)", textAlign: "center", maxWidth: 480 }}>
                  {err}
                </p>
              )}
            </div>
          ) : (
            <div className="opening-status">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
              <span style={{ marginLeft: 10 }}>여는 중...</span>
            </div>
          )}
        </div>
      )}

      {/* Revealed: 카드 펼쳐짐 */}
      {stage === "revealed" && result && (
        <>
          {maxTier >= 3 && <div className="hit-flash" />}
          {result.count > 1 && (
            <div className="row" style={{ justifyContent: "center", marginTop: 8 }}>
              <span className="balance-pill" style={{ fontSize: 13 }}>
                {result.count}팩 결과 · 총 {allResultCards.length}장
              </span>
            </div>
          )}
          <div className="reveal-wrap">
            <div className="reveal">
              {allResultCards.map((card, i) => {
                const tier = RARITY_TIER[allResultRarities[i]];
                return (
                  <div
                    key={i}
                    className={`flip-wrap entry tier-${tier}`}
                    style={{ animationDelay: `${Math.min(i, 24) * 70}ms` }}
                  >
                    <div
                      className={`flip ${revealed[i] ? "flipped" : ""}`}
                      onClick={() => reveal(i)}
                    >
                      {revealed[i] && (
                        <div
                          className="aura"
                          style={{ background: RARITY_GRADIENT[allResultRarities[i]] }}
                        />
                      )}
                      <div
                        className={`face back${pack.cardBackImageUrl && !backImageFailed ? " custom" : ""}`}
                      >
                        {pack.cardBackImageUrl && !backImageFailed ? (
                          <>
                            <img
                              src={pack.cardBackImageUrl}
                              alt=""
                              className="back-image"
                              onError={() => setBackImageFailed(true)}
                            />
                            <span className="tap-hint">탭</span>
                          </>
                        ) : (
                          <>
                            <div className="back-pattern" />
                            <span className="tap-hint">탭</span>
                          </>
                        )}
                      </div>
                      <div className="face front">
                        <CardFront card={card} tier={tier} />
                      </div>
                    </div>
                    {revealed[i] && (
                      <div className="card-meta">
                        <span
                          className="rarity-pill"
                          style={{ background: RARITY_COLOR[allResultRarities[i]] }}
                          title={RARITY_LABEL[allResultRarities[i]]}
                        >
                          {RARITY_LABEL[allResultRarities[i]]}
                        </span>
                        <div className="card-name">{card.name}</div>
                        {(() => {
                          const exp = card.expansionId ? expById.get(card.expansionId) : undefined;
                          const label = formatCardNumber(card, exp);
                          return label ? <code className="mini">{label}</code> : null;
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="row" style={{ justifyContent: "center", marginTop: 20 }}>
            <button onClick={revealAll} className="secondary" disabled={resetting}>
              전부 공개
            </button>
            <button onClick={againOrRevealFirst} disabled={resetting}>
              {resetting ? "공개 중..." : "한 번 더"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
