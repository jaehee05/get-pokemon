import { httpsCallable } from "firebase/functions";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { functions } from "../firebase";
import { Card, RARITY_COLOR, RARITY_LABEL, Rarity } from "../types";

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

export default function PackOpen() {
  const { packId } = useParams<{ packId: string }>();
  const nav = useNavigate();
  const [pack, setPack] = useState<PackMeta | null>(null);
  const [result, setResult] = useState<OpenPackResult | null>(null);
  const [revealed, setRevealed] = useState<boolean[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!packId) return;
    const call = httpsCallable<unknown, { packs: PackMeta[] }>(
      functions,
      "listActivePacks"
    );
    call({}).then((r) => {
      const found = r.data.packs.find((p) => p.id === packId) ?? null;
      setPack(found);
    });
  }, [packId]);

  async function open() {
    if (!packId) return;
    setBusy(true);
    setErr(null);
    try {
      const call = httpsCallable<{ packId: string }, OpenPackResult>(
        functions,
        "openPack"
      );
      const r = await call({ packId });
      setResult(r.data);
      setRevealed(new Array(r.data.cards.length).fill(false));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
    } finally {
      setBusy(false);
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
  }

  if (!pack) return <div className="center">팩 로딩 중...</div>;

  return (
    <div className="col">
      <button className="secondary" onClick={() => nav(-1)} style={{ alignSelf: "flex-start" }}>
        ← 돌아가기
      </button>

      <h1 className="h1">{pack.name}</h1>
      <p className="muted">
        {pack.cardCount}장 · 가격 {pack.price ?? 0}
      </p>

      {!result ? (
        <div className="panel">
          <p>이 팩을 열면 {pack.cardCount}장의 카드를 받습니다.</p>
          <button onClick={open} disabled={busy}>
            {busy ? "여는 중..." : "팩 열기"}
          </button>
          {err && <p style={{ color: "var(--danger)" }}>{err}</p>}
        </div>
      ) : (
        <>
          <div className="reveal">
            {result.cards.map((card, i) => (
              <div
                key={i}
                className={`flip ${revealed[i] ? "flipped" : ""}`}
                onClick={() => reveal(i)}
              >
                {revealed[i] && (
                  <div
                    className="glow"
                    style={{ background: RARITY_COLOR[result.rarities[i]] }}
                  />
                )}
                <div className="face back">탭해서 공개</div>
                <div className="face front">
                  {card.imageUrl ? (
                    <img src={card.imageUrl} alt={card.name} />
                  ) : (
                    <div className="col" style={{ padding: 12, alignItems: "center" }}>
                      <div style={{ fontSize: 32 }}>🃏</div>
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
            ))}
          </div>
          <div className="row">
            <button onClick={revealAll}>전부 공개</button>
            <button className="secondary" onClick={reset}>한 번 더</button>
          </div>
        </>
      )}
    </div>
  );
}
