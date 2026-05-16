import { httpsCallable } from "firebase/functions";
import { useEffect, useMemo, useState } from "react";
import { CurrencyMark } from "../CurrencyMark";
import { SafeImage } from "../SafeImage";
import { functions } from "../firebase";
import {
  ALL_RARITIES,
  Card,
  Expansion,
  RARITY_COLOR,
  Rarity,
  formatCardNumber,
} from "../types";
import { formatCurrency } from "../useProfile";

interface SelectedCard {
  cardId: string;
  card: Card;
  exp?: Expansion;
  /** 사용자가 인벤토리에서 가지고 있는 총 보유 수량. */
  ownedCount: number;
}

export function DecomposeDialog({
  selected,
  onClose,
  onDone,
}: {
  selected: SelectedCard[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [values, setValues] = useState<Record<Rarity, number>>(
    () => Object.fromEntries(ALL_RARITIES.map((r) => [r, 0])) as Record<Rarity, number>
  );
  const [qty, setQty] = useState<Record<string, number>>(
    () => Object.fromEntries(selected.map((s) => [s.cardId, 1]))
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    httpsCallable<unknown, { values: Record<Rarity, number> }>(
      functions,
      "getDecomposeConfig"
    )({})
      .then((r) => setValues(r.data.values))
      .catch(() => {});
  }, []);

  const totals = useMemo(() => {
    let totalCash = 0;
    let totalCards = 0;
    const byRarity: Partial<Record<Rarity, { qty: number; cash: number }>> = {};
    for (const s of selected) {
      const q = qty[s.cardId] ?? 0;
      const per = values[s.card.rarity] ?? 0;
      totalCards += q;
      totalCash += per * q;
      const e = byRarity[s.card.rarity] ?? { qty: 0, cash: 0 };
      e.qty += q;
      e.cash += per * q;
      byRarity[s.card.rarity] = e;
    }
    return { totalCash, totalCards, byRarity };
  }, [selected, qty, values]);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const items = selected
        .map((s) => ({ cardId: s.cardId, qty: qty[s.cardId] ?? 0 }))
        .filter((it) => it.qty > 0);
      if (items.length === 0) {
        setErr("수량이 1 이상인 카드가 없습니다.");
        return;
      }
      const r = await httpsCallable<{ items: typeof items }, { ok: boolean; gained: number }>(
        functions,
        "decomposeCards"
      )({ items });
      alert(`분해 완료! +${r.data.gained.toLocaleString()} C 획득`);
      onDone();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function setAllMax() {
    setQty(Object.fromEntries(selected.map((s) => [s.cardId, s.ownedCount])));
  }
  function setAllOne() {
    setQty(Object.fromEntries(selected.map((s) => [s.cardId, 1])));
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "grid",
        placeItems: "center",
        zIndex: 100,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="panel"
        style={{ width: "min(640px, 100%)", maxHeight: "92vh", overflow: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
          <h2 className="h2" style={{ margin: 0 }}>♻️ 카드 분해</h2>
          <button className="ghost" onClick={onClose}>닫기</button>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
          선택한 수량만큼 카드가 컬렉션에서 차감되고, 등급별 가치만큼 캐시로 환급됩니다. (되돌릴 수 없음)
        </p>

        <div className="panel" style={{ marginTop: 12 }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap" }}>
            <h3 className="h2" style={{ margin: 0 }}>대상 카드 ({selected.length}종)</h3>
            <div className="row" style={{ gap: 6 }}>
              <button className="ghost" onClick={setAllOne} style={{ fontSize: 11 }}>모두 1장</button>
              <button className="ghost" onClick={setAllMax} style={{ fontSize: 11 }}>모두 최대</button>
            </div>
          </div>
          <div style={{ maxHeight: 280, overflow: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>이름</th>
                  <th>등급</th>
                  <th style={{ textAlign: "right" }}>가치</th>
                  <th style={{ textAlign: "right" }}>수량</th>
                  <th style={{ textAlign: "right" }}>합계</th>
                </tr>
              </thead>
              <tbody>
                {selected.map((s) => {
                  const per = values[s.card.rarity] ?? 0;
                  const q = qty[s.cardId] ?? 0;
                  return (
                    <tr key={s.cardId}>
                      <td style={{ width: 36 }}>
                        <SafeImage
                          src={s.card.imageUrl}
                          alt=""
                          style={{ width: 28, height: 40, objectFit: "cover", borderRadius: 3 }}
                          fallback={<span className="muted">—</span>}
                        />
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{s.card.name}</div>
                        <code className="mini">{formatCardNumber(s.card, s.exp)}</code>
                      </td>
                      <td>
                        <span className="rarity-pill" style={{ background: RARITY_COLOR[s.card.rarity] }}>
                          {s.card.rarity}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>{per.toLocaleString()} C</td>
                      <td style={{ textAlign: "right" }}>
                        <input
                          type="number"
                          min={0}
                          max={s.ownedCount}
                          value={q}
                          onChange={(e) =>
                            setQty((cur) => ({
                              ...cur,
                              [s.cardId]: Math.max(0, Math.min(s.ownedCount, Number(e.target.value))),
                            }))
                          }
                          style={{ width: 80, textAlign: "right" }}
                        />
                        <div className="muted" style={{ fontSize: 10 }}>
                          / {s.ownedCount}
                        </div>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>
                        {(per * q).toLocaleString()} C
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 요약 */}
        <div className="panel" style={{ marginTop: 12 }}>
          <h3 className="h2" style={{ marginTop: 0 }}>요약</h3>
          <div className="row" style={{ gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {Object.entries(totals.byRarity).map(([r, info]) =>
              info && info.qty > 0 ? (
                <span
                  key={r}
                  className="rarity-pill"
                  style={{ background: RARITY_COLOR[r as Rarity] }}
                  title={`${r} ${info.qty}장 → ${info.cash.toLocaleString()} C`}
                >
                  {r} ×{info.qty}
                </span>
              ) : null
            )}
          </div>
          <div className="row" style={{ justifyContent: "space-between", fontSize: 15 }}>
            <span>총 분해</span>
            <span><b>{totals.totalCards}</b>장</span>
          </div>
          <div className="row" style={{ justifyContent: "space-between", fontSize: 16, marginTop: 4 }}>
            <span style={{ fontWeight: 700 }}>획득 캐시</span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontWeight: 800,
                color: "var(--accent)",
              }}
            >
              <CurrencyMark size={16} /> +{formatCurrency(totals.totalCash)}
            </span>
          </div>
        </div>

        {err && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{err}</p>}

        <div className="row" style={{ marginTop: 14, justifyContent: "flex-end" }}>
          <button className="ghost" onClick={onClose}>취소</button>
          <button onClick={submit} disabled={busy || totals.totalCards === 0}>
            {busy ? "분해 중..." : `분해하고 ${formatCurrency(totals.totalCash)} C 받기`}
          </button>
        </div>
      </div>
    </div>
  );
}
