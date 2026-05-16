import { collection, doc, getDoc, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { SafeImage } from "../SafeImage";
import { useAuth } from "../auth";
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
import { formatCurrency, useProfile } from "../useProfile";

interface InvRow {
  cardId: string;
  count: number;
  card?: Card;
}

export default function Inventory() {
  const { user } = useAuth();
  const profile = useProfile();
  const [rows, setRows] = useState<InvRow[]>([]);
  const [exps, setExps] = useState<Expansion[]>([]);
  const [expFilter, setExpFilter] = useState<string>("");
  // 빈 set = 등급 필터 없음 (전체 표시). 1개 이상 선택 시 해당 등급만.
  const [rarityFilter, setRarityFilter] = useState<Set<Rarity>>(new Set());
  const [search, setSearch] = useState("");

  useEffect(() => {
    return onSnapshot(collection(db, "expansions"), (s) =>
      setExps(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Expansion))
    );
  }, []);

  useEffect(() => {
    if (!user) return;
    const ref = collection(db, "users", user.uid, "inventory");
    return onSnapshot(ref, async (snap) => {
      const base: InvRow[] = snap.docs.map((d) => ({
        cardId: d.id,
        count: (d.data().count as number) ?? 0,
      }));
      const filled = await Promise.all(
        base.map(async (r) => {
          const c = await getDoc(doc(db, "cards", r.cardId));
          return { ...r, card: c.exists() ? ({ id: c.id, ...c.data() } as Card) : undefined };
        })
      );
      setRows(filled);
    });
  }, [user]);

  const expById = useMemo(() => {
    const m = new Map<string, Expansion>();
    for (const e of exps) m.set(e.id, e);
    return m;
  }, [exps]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows
      .filter((r) => !!r.card)
      .filter((r) => (expFilter ? r.card!.expansionId === expFilter : true))
      .filter((r) => rarityFilter.size === 0 || rarityFilter.has(r.card!.rarity))
      .filter((r) => {
        if (!q) return true;
        const exp = r.card!.expansionId ? expById.get(r.card!.expansionId) : undefined;
        const label = formatCardNumber(r.card!, exp).toLowerCase();
        return (
          r.card!.name.toLowerCase().includes(q) ||
          label.includes(q) ||
          r.card!.rarity.toLowerCase() === q
        );
      })
      .sort((a, b) => {
        const ca = a.card!;
        const cb = b.card!;
        const ea = ca.expansionId ? expById.get(ca.expansionId)?.code ?? "" : "";
        const eb = cb.expansionId ? expById.get(cb.expansionId)?.code ?? "" : "";
        if (ea !== eb) return ea.localeCompare(eb);
        return (ca.number ?? 0) - (cb.number ?? 0);
      });
  }, [rows, expFilter, rarityFilter, search, expById]);

  const stats = useMemo(() => {
    const types = filtered.length;
    const total = filtered.reduce((s, r) => s + r.count, 0);
    const byRarity = new Map<Rarity, { types: number; copies: number }>();
    for (const r of filtered) {
      const rr = r.card!.rarity;
      const e = byRarity.get(rr) ?? { types: 0, copies: 0 };
      e.types += 1;
      e.copies += r.count;
      byRarity.set(rr, e);
    }
    return { types, total, byRarity };
  }, [filtered]);

  function toggleRarity(r: Rarity) {
    setRarityFilter((cur) => {
      const next = new Set(cur);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  }

  if (!user) {
    return (
      <div className="empty">
        <div className="icon">🔐</div>
        로그인이 필요합니다.
      </div>
    );
  }

  return (
    <div className="col">
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <h1 className="h1" style={{ margin: 0 }}>내 컬렉션</h1>
        <span className="balance-pill"><span>💎</span><b>{formatCurrency(profile?.currency ?? 0)}</b></span>
      </div>

      {/* Filters */}
      <div className="panel">
        <div className="row" style={{ marginBottom: 10 }}>
          <label>
            확장팩
            <select
              value={expFilter}
              onChange={(e) => setExpFilter(e.target.value)}
              style={{ minWidth: 160 }}
            >
              <option value="">전체</option>
              {exps.map((e) => (
                <option key={e.id} value={e.id}>{e.code} {e.name ? `(${e.name})` : ""}</option>
              ))}
            </select>
          </label>
          <label style={{ flex: 1, minWidth: 200 }}>
            검색
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름 / 번호 / 등급"
            />
          </label>
        </div>
        <div className="row" style={{ gap: 4, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--muted)", marginRight: 4 }}>
            등급
            {rarityFilter.size === 0 && (
              <span style={{ marginLeft: 6 }}>(전체)</span>
            )}
          </span>
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
          {rarityFilter.size > 0 && (
            <button
              className="secondary"
              onClick={() => setRarityFilter(new Set())}
              style={{ fontSize: 11, padding: "4px 8px" }}
            >
              해제
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="panel">
        <div className="row" style={{ fontSize: 14 }}>
          <span>보유 종류 <b>{stats.types}</b></span>
          <span>총 매수 <b>{formatCurrency(stats.total)}</b></span>
        </div>
        {stats.byRarity.size > 0 && (
          <div className="row" style={{ marginTop: 8, gap: 6, flexWrap: "wrap" }}>
            {[...stats.byRarity.entries()]
              .sort(
                ([a], [b]) =>
                  ALL_RARITIES.indexOf(a) - ALL_RARITIES.indexOf(b)
              )
              .map(([r, info]) => (
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
                  {r} · {info.types}종 · {info.copies}장
                </span>
              ))}
          </div>
        )}
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="empty">
          <div className="icon">🃏</div>
          {rows.length === 0 ? "아직 카드가 없습니다. 팩을 열어보세요." : "필터에 맞는 카드가 없습니다."}
        </div>
      ) : (
        <div className="grid cards">
          {filtered.map((r) => {
            const c = r.card!;
            const exp = c.expansionId ? expById.get(c.expansionId) : undefined;
            const label = formatCardNumber(c, exp);
            return (
              <div key={r.cardId} className="card">
                <div className="thumb">
                  <SafeImage
                    src={c.imageUrl}
                    alt={c.name}
                    fallback={<span className="muted">No image</span>}
                  />
                  {r.count > 1 && (
                    <span
                      style={{
                        position: "absolute",
                        top: 6, right: 6,
                        background: "rgba(0,0,0,0.7)",
                        backdropFilter: "blur(4px)",
                        color: "#fff",
                        padding: "2px 8px",
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 700,
                        border: "1px solid rgba(255,255,255,0.15)",
                      }}
                    >
                      ×{r.count}
                    </span>
                  )}
                </div>
                <div className="name" style={{ fontSize: 13 }}>{c.name}</div>
                <div className="row" style={{ justifyContent: "space-between", gap: 6 }}>
                  <span
                    className="rarity-pill"
                    style={{ background: RARITY_COLOR[c.rarity] }}
                  >
                    {c.rarity}
                  </span>
                  {label && <code className="mini">{label}</code>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
