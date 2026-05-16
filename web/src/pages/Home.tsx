import { httpsCallable } from "firebase/functions";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CurrencyMark } from "../CurrencyMark";
import { SafeImage } from "../SafeImage";
import { useAuth } from "../auth";
import { functions } from "../firebase";
import { formatCurrency, useProfile } from "../useProfile";

interface PackMeta {
  id: string;
  name: string;
  imageUrl: string;
  cardCount: number;
  price: number;
  approxPacksRemaining: number;
}

export default function Home() {
  const [packs, setPacks] = useState<PackMeta[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { user } = useAuth();
  const profile = useProfile();
  const balance = profile?.currency ?? 0;

  useEffect(() => {
    const call = httpsCallable<unknown, { packs: PackMeta[] }>(
      functions,
      "listActivePacks"
    );
    let cancelled = false;
    function refresh() {
      call({})
        .then((r) => { if (!cancelled) setPacks(r.data.packs); })
        .catch((e) => { if (!cancelled) setErr(e instanceof Error ? e.message : String(e)); });
    }
    refresh();
    // 10초 간격 폴링 + 탭이 다시 활성화될 때 즉시 갱신
    const interval = setInterval(refresh, 10000);
    function onVisibility() {
      if (!document.hidden) refresh();
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", refresh);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  return (
    <div>
      <section className="hero">
        <h1>Pokémon 카드 뽑기</h1>
        <p>
          확장팩별 카드를 모아보고, 팩을 열어 컬렉션을 완성하세요.
          {user ? " 캐시로 새 팩을 열고 희귀 카드를 노려보세요." : " 로그인 후 팩을 열 수 있어요."}
        </p>
        {user && (
          <div className="hero-balance row" style={{ gap: 12 }}>
            <span className="balance-pill" style={{ fontSize: 14 }}>
              <CurrencyMark size={16} />
              <b>{formatCurrency(balance)}</b>
            </span>
            <span className="muted" style={{ fontSize: 12 }}>보유 캐시</span>
          </div>
        )}
      </section>

      <div className="page-head">
        <div>
          <h2 className="page-title" style={{ fontSize: 22 }}>팩 컬렉션</h2>
          <p className="page-sub">현재 활성화된 팩들. 잔여 재고 기준으로 표시됩니다.</p>
        </div>
      </div>

      {err && <p style={{ color: "var(--danger)" }}>{err}</p>}
      {packs === null && !err && <p className="muted">불러오는 중...</p>}
      {packs && packs.length === 0 && (
        <div className="empty">
          <div className="icon">📦</div>
          아직 활성화된 팩이 없습니다. 관리자에서 카드와 팩을 추가해주세요.
        </div>
      )}
      {packs && packs.length > 0 && (
        <div className="grid packs">
          {packs.map((p) => {
            const free = (p.price ?? 0) === 0;
            const cantAfford = user && !free && balance < p.price;
            const soldOut = (p.approxPacksRemaining ?? 0) <= 0;
            const lowStock = !soldOut && p.approxPacksRemaining <= 5;
            const dimmed = soldOut || cantAfford;
            return (
              <Link
                key={p.id}
                to={`/pack/${p.id}`}
                className={`card pack-tile${dimmed ? " unaffordable" : ""}${soldOut ? " sold-out" : ""}`}
                style={{ textDecoration: "none", color: "inherit" }}
                onClick={(e) => {
                  if (soldOut) {
                    e.preventDefault();
                    alert("이 팩은 현재 재고가 없습니다.");
                  }
                }}
              >
                <div className="thumb">
                  <SafeImage
                    src={p.imageUrl}
                    alt={p.name}
                    fallback={<span className="pack-icon">📦</span>}
                  />
                  {soldOut ? (
                    <div className="sold-out-stamp">
                      <span className="ko">품절</span>
                      <span className="en">sold out</span>
                    </div>
                  ) : (
                    <>
                      {cantAfford && (
                        <span
                          className="badge"
                          style={{
                            top: "auto",
                            bottom: 10,
                            background: "rgba(244, 63, 94, 0.85)",
                            borderColor: "rgba(244, 63, 94, 0.4)",
                          }}
                        >
                          잔액 부족
                        </span>
                      )}
                      {lowStock && !cantAfford && (
                        <span
                          className="badge"
                          style={{
                            top: "auto",
                            bottom: 10,
                            background: "rgba(245, 158, 11, 0.85)",
                            borderColor: "rgba(245, 158, 11, 0.4)",
                          }}
                        >
                          약 {p.approxPacksRemaining}팩 남음
                        </span>
                      )}
                    </>
                  )}
                </div>
                <div className="name">{p.name}</div>
                <div className="row" style={{ justifyContent: "space-between", gap: 6 }}>
                  <span className="muted" style={{ fontSize: 12 }}>
                    팩당 {p.cardCount}장
                  </span>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 14,
                      color: soldOut
                        ? "var(--muted)"
                        : free
                        ? "var(--ok)"
                        : cantAfford
                        ? "var(--danger)"
                        : "var(--accent)",
                    }}
                  >
                    {soldOut ? (
                      "품절"
                    ) : free ? (
                      "무료"
                    ) : (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <CurrencyMark size={14} />
                        {formatCurrency(p.price)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
