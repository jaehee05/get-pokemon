import { collection, doc, getDoc, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { SafeImage } from "../SafeImage";
import { useAuth } from "../auth";
import { db } from "../firebase";
import { CurrencyMark } from "../CurrencyMark";
import { DecomposeDialog } from "./DecomposeDialog";
import { ShippingDialog } from "./ShippingDialog";
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
  const [selectMode, setSelectMode] = useState<null | "shipping" | "decompose">(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [shippingOpen, setShippingOpen] = useState(false);
  const [decomposeOpen, setDecomposeOpen] = useState(false);

  const [totalCatalog, setTotalCatalog] = useState(0);

  useEffect(() => {
    return onSnapshot(collection(db, "expansions"), (s) =>
      setExps(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Expansion))
    );
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, "cards"), (s) => {
      // 활성 카드 기준으로 컬렉션 진행도 계산
      let count = 0;
      s.forEach((d) => {
        const data = d.data() as { isActive?: boolean };
        if (data.isActive !== false) count++;
      });
      setTotalCatalog(count);
    });
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
  function toggleSelect(cardId: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  }
  function exitSelectMode() {
    setSelectMode(null);
    setSelected(new Set());
  }

  if (!user) {
    return (
      <div className="empty">
        <div className="icon">🔐</div>
        로그인이 필요합니다.
      </div>
    );
  }

  const ownedTypesAll = rows.filter((r) => !!r.card).length;
  const progressPct = totalCatalog > 0 ? Math.min(100, Math.round((ownedTypesAll / totalCatalog) * 100)) : 0;

  return (
    <div className="col">
      <div className="page-head">
        <div>
          <h1 className="page-title">내 컬렉션</h1>
          <p className="page-sub">
            보유 카드 {ownedTypesAll}종 · 카탈로그 {totalCatalog}종 · 진행도 {progressPct}%
          </p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className="balance-pill"><CurrencyMark size={16} /><b>{formatCurrency(profile?.currency ?? 0)}</b></span>
          {!selectMode ? (
            <>
              <button
                className="secondary"
                onClick={() => setSelectMode("shipping")}
                disabled={rows.length === 0}
              >
                📦 배송
              </button>
              <button onClick={() => setSelectMode("decompose")} disabled={rows.length === 0}>
                ♻️ 분해
              </button>
            </>
          ) : (
            <>
              <span className="muted" style={{ fontSize: 12 }}>
                {selectMode === "shipping" ? "배송 신청" : "분해"} · 카드 선택
              </span>
              <button
                className="secondary"
                onClick={() => {
                  const visibleIds = filtered.map((r) => r.cardId);
                  // 보이는 카드 모두 선택돼 있으면 해제, 아니면 전체 선택
                  const allSelected = visibleIds.every((id) => selected.has(id));
                  setSelected((cur) => {
                    if (allSelected) {
                      const next = new Set(cur);
                      visibleIds.forEach((id) => next.delete(id));
                      return next;
                    }
                    return new Set([...cur, ...visibleIds]);
                  });
                }}
                disabled={filtered.length === 0}
                style={{ fontSize: 12 }}
              >
                {filtered.length > 0 && filtered.every((r) => selected.has(r.cardId))
                  ? "전체 해제"
                  : `전체 선택 (${filtered.length})`}
              </button>
              <button
                disabled={selected.size === 0}
                onClick={() => {
                  if (selectMode === "shipping") setShippingOpen(true);
                  else setDecomposeOpen(true);
                }}
              >
                다음 ({selected.size}종)
              </button>
              <button className="ghost" onClick={exitSelectMode}>
                취소
              </button>
            </>
          )}
        </div>
      </div>

      {totalCatalog > 0 && (
        <div className="progress" style={{ marginBottom: 14 }}>
          <span style={{ width: `${progressPct}%` }} />
        </div>
      )}

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
            const isSelected = selected.has(r.cardId);
            return (
              <div
                key={r.cardId}
                className="card"
                onClick={selectMode ? () => toggleSelect(r.cardId) : undefined}
                style={
                  selectMode
                    ? {
                        cursor: "pointer",
                        outline: isSelected ? `2px solid ${RARITY_COLOR[c.rarity]}` : undefined,
                        outlineOffset: 1,
                      }
                    : undefined
                }
              >
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
                  {selectMode && (
                    <span
                      style={{
                        position: "absolute",
                        top: 6, left: 6,
                        width: 22, height: 22,
                        borderRadius: "50%",
                        background: isSelected ? "var(--accent)" : "rgba(0,0,0,0.6)",
                        color: isSelected ? "#0a0d14" : "rgba(255,255,255,0.7)",
                        display: "grid", placeItems: "center",
                        fontSize: 13,
                        fontWeight: 800,
                        border: isSelected ? "1px solid var(--accent)" : "1px solid var(--border-strong)",
                        backdropFilter: "blur(4px)",
                      }}
                    >
                      {isSelected ? "✓" : ""}
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

      {shippingOpen && (
        <ShippingDialog
          profile={profile}
          balance={profile?.currency ?? 0}
          selected={Array.from(selected)
            .map((id): { cardId: string; card: Card; exp?: Expansion } | null => {
              const row = rows.find((r) => r.cardId === id);
              if (!row?.card) return null;
              const exp = row.card.expansionId ? expById.get(row.card.expansionId) : undefined;
              return { cardId: id, card: row.card, exp };
            })
            .filter((x): x is { cardId: string; card: Card; exp?: Expansion } => x !== null)}
          onClose={() => setShippingOpen(false)}
          onSubmitted={() => {
            setShippingOpen(false);
            exitSelectMode();
            alert("배송 신청이 접수되었습니다. 관리자가 처리 후 발송합니다.");
          }}
        />
      )}

      {decomposeOpen && (
        <DecomposeDialog
          selected={Array.from(selected)
            .map((id): { cardId: string; card: Card; exp?: Expansion; ownedCount: number } | null => {
              const row = rows.find((r) => r.cardId === id);
              if (!row?.card) return null;
              const exp = row.card.expansionId ? expById.get(row.card.expansionId) : undefined;
              return { cardId: id, card: row.card, exp, ownedCount: row.count };
            })
            .filter(
              (x): x is { cardId: string; card: Card; exp?: Expansion; ownedCount: number } =>
                x !== null
            )}
          onClose={() => setDecomposeOpen(false)}
          onDone={() => {
            setDecomposeOpen(false);
            exitSelectMode();
          }}
        />
      )}
    </div>
  );
}
