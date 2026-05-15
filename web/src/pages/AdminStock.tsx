import {
  collection,
  doc,
  onSnapshot,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import {
  ALL_RARITIES,
  Card,
  Expansion,
  RARITY_COLOR,
  RARITY_LABEL,
  Rarity,
  formatCardNumber,
} from "../types";

export default function AdminStock() {
  const [cards, setCards] = useState<Card[]>([]);
  const [exps, setExps] = useState<Expansion[]>([]);
  const [expFilter, setExpFilter] = useState<string>(""); // "" = 전체
  const [rarityFilter, setRarityFilter] = useState<Set<Rarity>>(
    () => new Set(ALL_RARITIES)
  );
  const [busy, setBusy] = useState(false);
  const [bulkValue, setBulkValue] = useState<number>(10);

  useEffect(() => {
    const u1 = onSnapshot(collection(db, "cards"), (s) =>
      setCards(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Card))
    );
    const u2 = onSnapshot(collection(db, "expansions"), (s) =>
      setExps(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Expansion))
    );
    return () => { u1(); u2(); };
  }, []);

  const expById = useMemo(() => {
    const m = new Map<string, Expansion>();
    for (const e of exps) m.set(e.id, e);
    return m;
  }, [exps]);

  const filtered = useMemo(() => {
    return cards
      .filter((c) => (expFilter ? c.expansionId === expFilter : true))
      .filter((c) => rarityFilter.has(c.rarity))
      .sort((a, b) => {
        // 같은 expansion 안에선 번호 순, 다른 expansion 이면 expansion code 순
        const ea = a.expansionId ? expById.get(a.expansionId) : null;
        const eb = b.expansionId ? expById.get(b.expansionId) : null;
        if ((ea?.code ?? "") !== (eb?.code ?? "")) {
          return (ea?.code ?? "").localeCompare(eb?.code ?? "");
        }
        return (a.number ?? 0) - (b.number ?? 0);
      });
  }, [cards, expFilter, rarityFilter, expById]);

  const summary = useMemo(() => {
    const total = filtered.reduce((s, c) => s + (c.stock ?? 0), 0);
    const inStock = filtered.filter((c) => (c.stock ?? 0) > 0).length;
    const byRarity = new Map<Rarity, { total: number; cards: number }>();
    for (const c of filtered) {
      const e = byRarity.get(c.rarity) ?? { total: 0, cards: 0 };
      e.total += c.stock ?? 0;
      e.cards += 1;
      byRarity.set(c.rarity, e);
    }
    return { total, inStock, byRarity };
  }, [filtered]);

  function toggleRarity(r: Rarity) {
    setRarityFilter((cur) => {
      const next = new Set(cur);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  }
  function allRarities() {
    setRarityFilter(new Set(ALL_RARITIES));
  }
  function clearRarities() {
    setRarityFilter(new Set());
  }

  async function patch(id: string, stock: number) {
    await updateDoc(doc(db, "cards", id), { stock });
  }

  async function bulkSet(value: number) {
    if (filtered.length === 0) return;
    if (!confirm(`필터에 해당하는 ${filtered.length}개 카드의 재고를 ${value}로 설정합니다. 진행할까요?`)) return;
    setBusy(true);
    try {
      for (let i = 0; i < filtered.length; i += 400) {
        const chunk = filtered.slice(i, i + 400);
        const batch = writeBatch(db);
        for (const c of chunk) {
          batch.update(doc(db, "cards", c.id), { stock: value });
        }
        await batch.commit();
      }
    } finally {
      setBusy(false);
    }
  }

  async function bulkAdd(delta: number) {
    if (filtered.length === 0) return;
    if (!confirm(`필터에 해당하는 ${filtered.length}개 카드 재고에 ${delta > 0 ? "+" : ""}${delta} 합니다. 진행할까요?`)) return;
    setBusy(true);
    try {
      for (let i = 0; i < filtered.length; i += 400) {
        const chunk = filtered.slice(i, i + 400);
        const batch = writeBatch(db);
        for (const c of chunk) {
          batch.update(doc(db, "cards", c.id), {
            stock: Math.max(0, (c.stock ?? 0) + delta),
          });
        }
        await batch.commit();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="col">
      {/* 필터 */}
      <div className="panel">
        <h2 className="h2">필터</h2>
        <div className="row" style={{ marginBottom: 10 }}>
          <label>
            확장팩
            <select
              value={expFilter}
              onChange={(e) => setExpFilter(e.target.value)}
              style={{ minWidth: 180 }}
            >
              <option value="">전체</option>
              {exps.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.code} {e.name ? `(${e.name})` : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="col" style={{ flex: 1 }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>등급</span>
            <div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
              {ALL_RARITIES.map((r) => {
                const on = rarityFilter.has(r);
                return (
                  <button
                    key={r}
                    className={on ? "" : "secondary"}
                    onClick={() => toggleRarity(r)}
                    style={{
                      fontSize: 11,
                      padding: "4px 8px",
                      background: on ? RARITY_COLOR[r] : undefined,
                      color: on ? "#0a0d14" : undefined,
                    }}
                  >
                    {r}
                  </button>
                );
              })}
              <button className="secondary" onClick={allRarities} style={{ fontSize: 11, padding: "4px 8px" }}>전체</button>
              <button className="secondary" onClick={clearRarities} style={{ fontSize: 11, padding: "4px 8px" }}>해제</button>
            </div>
          </div>
        </div>
      </div>

      {/* 요약 */}
      <div className="panel">
        <h2 className="h2">요약</h2>
        <div className="row" style={{ fontSize: 14 }}>
          <span>해당 카드 <b>{filtered.length}</b></span>
          <span>그 중 재고 보유 <b style={{ color: "var(--ok)" }}>{summary.inStock}</b></span>
          <span>재고 합계 <b>{summary.total.toLocaleString()}</b></span>
        </div>
        <div className="row" style={{ marginTop: 8, gap: 6, flexWrap: "wrap" }}>
          {[...summary.byRarity.entries()].map(([r, info]) => (
            <span
              key={r}
              style={{
                background: RARITY_COLOR[r],
                color: "#0a0d14",
                padding: "3px 9px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
              }}
              title={RARITY_LABEL[r]}
            >
              {r} · {info.cards}종 · {info.total}
            </span>
          ))}
        </div>
      </div>

      {/* 일괄 작업 */}
      <div className="panel">
        <h2 className="h2">일괄 작업</h2>
        <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
          현재 필터에 잡힌 <b>{filtered.length}</b>개 카드에 한해 적용됩니다.
        </p>
        <div className="row">
          <label>
            값
            <input
              type="number"
              value={bulkValue}
              onChange={(e) => setBulkValue(Number(e.target.value))}
              style={{ width: 100 }}
            />
          </label>
          <button onClick={() => bulkSet(bulkValue)} disabled={busy || filtered.length === 0}>
            전부 = {bulkValue}
          </button>
          <button
            className="secondary"
            onClick={() => bulkAdd(bulkValue)}
            disabled={busy || filtered.length === 0}
          >
            전부 +{bulkValue}
          </button>
          <button
            className="secondary"
            onClick={() => bulkAdd(-bulkValue)}
            disabled={busy || filtered.length === 0}
          >
            전부 −{bulkValue}
          </button>
          <button
            className="danger"
            onClick={() => bulkSet(0)}
            disabled={busy || filtered.length === 0}
          >
            전부 0
          </button>
        </div>
      </div>

      {/* 개별 편집 */}
      <div className="panel">
        <h2 className="h2">개별 편집</h2>
        <div style={{ maxHeight: 600, overflow: "auto" }}>
          <table>
            <thead>
              <tr>
                <th></th>
                <th>번호</th>
                <th>이름</th>
                <th>등급</th>
                <th style={{ textAlign: "right" }}>재고</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const exp = c.expansionId ? expById.get(c.expansionId) : undefined;
                const label = formatCardNumber(c, exp);
                return (
                  <tr key={c.id}>
                    <td>
                      {c.imageUrl ? (
                        <img
                          src={c.imageUrl}
                          alt=""
                          style={{ width: 28, height: 40, objectFit: "cover", borderRadius: 3 }}
                        />
                      ) : <span className="muted">—</span>}
                    </td>
                    <td><code className="mini">{label || (c.number != null ? String(c.number).padStart(3, "0") : "")}</code></td>
                    <td>{c.name}</td>
                    <td>
                      <span
                        className="rarity-pill"
                        style={{ background: RARITY_COLOR[c.rarity] }}
                      >
                        {c.rarity}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <input
                        type="number"
                        min={0}
                        value={c.stock ?? 0}
                        onChange={(e) => patch(c.id, Math.max(0, Number(e.target.value)))}
                        style={{ width: 80, textAlign: "right" }}
                      />
                    </td>
                    <td>
                      <div className="row" style={{ gap: 4 }}>
                        <button
                          className="secondary"
                          onClick={() => patch(c.id, (c.stock ?? 0) + 1)}
                          style={{ fontSize: 11, padding: "3px 7px" }}
                        >
                          +1
                        </button>
                        <button
                          className="secondary"
                          onClick={() => patch(c.id, (c.stock ?? 0) + 10)}
                          style={{ fontSize: 11, padding: "3px 7px" }}
                        >
                          +10
                        </button>
                        <button
                          className="secondary"
                          onClick={() => patch(c.id, Math.max(0, (c.stock ?? 0) - 1))}
                          style={{ fontSize: 11, padding: "3px 7px" }}
                        >
                          −1
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted" style={{ textAlign: "center", padding: 30 }}>
                    필터 조건에 맞는 카드가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
