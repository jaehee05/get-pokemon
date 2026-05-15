import { httpsCallable } from "firebase/functions";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
    call({})
      .then((r) => setPacks(r.data.packs))
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap" }}>
        <h1 className="h1" style={{ margin: 0 }}>팩 선택</h1>
        {user && (
          <div className="row" style={{ gap: 14, fontSize: 13 }}>
            <span className="muted">보유 캐시</span>
            <span className="balance-pill" style={{ fontSize: 14 }}>
              <span>💎</span>
              <b style={{ fontSize: 14 }}>{formatCurrency(balance)}</b>
            </span>
          </div>
        )}
      </div>

      {!user && (
        <div className="empty" style={{ marginBottom: 16 }}>
          <div className="icon">🔐</div>
          팩을 열려면 우측 상단에서 로그인 또는 회원가입을 해주세요.
        </div>
      )}

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
                  <span className="badge">{p.cardCount}장</span>
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
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div className="name">{p.name}</div>
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
                    {soldOut ? "품절" : free ? "무료" : `💎 ${formatCurrency(p.price)}`}
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
