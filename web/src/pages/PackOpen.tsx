import { httpsCallable } from "firebase/functions";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { functions } from "../firebase";
import {
  Card,
  RARITY_COLOR,
  RARITY_GRADIENT,
  RARITY_LABEL,
  RARITY_TIER,
  Rarity,
} from "../types";

interface PackMeta {
  id: string;
  name: string;
  imageUrl: string;
  cardCount: number;
  price: number;
}

interface OpenPackResult {
  pullId: string;
  cards: Card[];
  rarities: Rarity[];
  currencyAfter: number;
}

type Stage = "idle" | "opening" | "revealed";

const MIN_OPEN_MS = 1400;

export default function PackOpen() {
  const { packId } = useParams<{ packId: string }>();
  const nav = useNavigate();
  const [pack, setPack] = useState<PackMeta | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [result, setResult] = useState<OpenPackResult | null>(null);
  const [revealed, setRevealed] = useState<boolean[]>([]);
  const [err, setErr] = useState<string | null>(null);

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

  async function open() {
    if (!packId) return;
    setErr(null);
    setStage("opening");
    try {
      const t0 = Date.now();
      const [r] = await Promise.all([
        httpsCallable<{ packId: string }, OpenPackResult>(
          functions,
          "openPack"
        )({ packId }),
        new Promise<void>((res) => setTimeout(res, 200)),
      ]);
      const elapsed = Date.now() - t0;
      if (elapsed < MIN_OPEN_MS) {
        await new Promise((res) => setTimeout(res, MIN_OPEN_MS - elapsed));
      }
      setResult(r.data);
      setRevealed(new Array(r.data.cards.length).fill(false));
      setStage("revealed");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
      setStage("idle");
    }
  }

  function reveal(i: number) {
    setRevealed((arr) => arr.map((v, idx) => (idx === i ? true : v)));
  }
  function revealAll() {
    if (!result) return;
    setRevealed(new Array(result.cards.length).fill(true));
  }
  function reset() {
    setResult(null);
    setRevealed([]);
    setStage("idle");
  }

  if (!pack) return <div className="center">팩 로딩 중...</div>;

  const maxTier = result
    ? Math.max(0, ...result.rarities.map((r) => RARITY_TIER[r]))
    : 0;

  return (
    <div className={`open-root tier-${maxTier}`}>
      <button
        className="secondary"
        onClick={() => nav(-1)}
        style={{ alignSelf: "flex-start" }}
      >
        ← 돌아가기
      </button>

      <h1 className="h1" style={{ marginBottom: 4 }}>{pack.name}</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        {pack.cardCount}장 · 가격 {pack.price ?? 0}
      </p>

      {/* Idle / Opening: 큰 팩 */}
      {stage !== "revealed" && (
        <div className="pack-stage">
          <div className={`pack-art ${stage}`}>
            <div className="pack-glow" />
            <div className="pack-body">
              {pack.imageUrl ? (
                <img src={pack.imageUrl} alt={pack.name} />
              ) : (
                <div className="pack-cover">
                  <div className="pack-emoji">📦</div>
                  <div className="pack-title">{pack.name}</div>
                </div>
              )}
              <div className="pack-shine" />
              <div className="pack-tear" />
            </div>
          </div>

          {stage === "idle" ? (
            <div className="col" style={{ alignItems: "center" }}>
              <button onClick={open} className="open-btn">팩 열기</button>
              {err && <p style={{ color: "var(--danger)" }}>{err}</p>}
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
          <div className="reveal-wrap">
            <div className="reveal">
              {result.cards.map((card, i) => {
                const tier = RARITY_TIER[result.rarities[i]];
                return (
                  <div
                    key={i}
                    className={`flip-wrap entry tier-${tier}`}
                    style={{ animationDelay: `${i * 90}ms` }}
                  >
                    <div
                      className={`flip ${revealed[i] ? "flipped" : ""}`}
                      onClick={() => reveal(i)}
                    >
                      {revealed[i] && (
                        <div
                          className="aura"
                          style={{ background: RARITY_GRADIENT[result.rarities[i]] }}
                        />
                      )}
                      <div className="face back">
                        <div className="back-pattern" />
                        <span className="tap-hint">탭</span>
                      </div>
                      <div className="face front">
                        {card.imageUrl ? (
                          <>
                            <img src={card.imageUrl} alt={card.name} />
                            {tier >= 1 && <div className="holo" />}
                            {tier >= 3 && <div className="shine-burst" />}
                          </>
                        ) : (
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
                        )}
                      </div>
                    </div>
                    {revealed[i] && (
                      <div className="card-meta">
                        <span
                          className="rarity-pill"
                          style={{ background: RARITY_COLOR[result.rarities[i]] }}
                          title={RARITY_LABEL[result.rarities[i]]}
                        >
                          {RARITY_LABEL[result.rarities[i]]}
                        </span>
                        <div className="card-name">{card.name}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="row" style={{ justifyContent: "center", marginTop: 20 }}>
            <button onClick={revealAll} className="secondary">전부 공개</button>
            <button onClick={reset}>한 번 더</button>
          </div>
        </>
      )}
    </div>
  );
}
