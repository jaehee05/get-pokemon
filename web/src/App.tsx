import { httpsCallable } from "firebase/functions";
import { Suspense, lazy, useEffect, useState } from "react";
import { Link, NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthDialog } from "./AuthDialog";
import { CurrencyMark } from "./CurrencyMark";
import { useAuth } from "./auth";
import { functions } from "./firebase";
import { ChargeDialog } from "./pages/ChargeDialog";
import Home from "./pages/Home";
import { formatCurrency, useProfile } from "./useProfile";

// 무거운 페이지(인증 후/관리자만 사용)는 lazy 로드해서 초기 번들 축소
const PackOpen = lazy(() => import("./pages/PackOpen"));
const Inventory = lazy(() => import("./pages/Inventory"));
const Admin = lazy(() => import("./pages/Admin"));

export default function App() {
  const { user, isAdmin, loading, signOutNow, refreshClaims } = useAuth();
  const profile = useProfile();
  const location = useLocation();
  const [authOpen, setAuthOpen] = useState(false);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [systemHasAdmin, setSystemHasAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    httpsCallable<unknown, { hasAdmin: boolean }>(functions, "getAdminStatus")({})
      .then((r) => setSystemHasAdmin(r.data.hasAdmin))
      .catch(() => setSystemHasAdmin(null));
  }, [user]);

  // 숫자 input 포커스 시 전체 선택
  useEffect(() => {
    function onFocusIn(e: FocusEvent) {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.tagName === "INPUT" && (t as HTMLInputElement).type === "number") {
        requestAnimationFrame(() => {
          try { (t as HTMLInputElement).select(); } catch { /* ignore */ }
        });
      }
    }
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, []);

  async function claimAdmin() {
    if (!confirm("관리자 권한을 시도합니다. (아직 등록된 admin 이 없는 첫 호출자만 통과)")) return;
    setClaiming(true);
    try {
      const r = (await httpsCallable<unknown, { ok: boolean; bootstrapped: boolean }>(
        functions,
        "setAdmin"
      )({})) as { data: { ok: boolean; bootstrapped: boolean } };
      if (r.data.bootstrapped) {
        alert("관리자 권한 부여 완료. 권한 갱신 중...");
        setSystemHasAdmin(true);
        await refreshClaims();
      } else {
        alert("이미 admin 이 존재합니다. 다른 admin 에게 권한을 받아야 합니다.");
        setSystemHasAdmin(true);
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setClaiming(false);
    }
  }

  const showClaimButton = !!user && !isAdmin && systemHasAdmin === false;

  if (loading) return <div className="center">로딩...</div>;

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand" aria-label="Pokémon 카드 뽑기">
          <img
            src="https://pokemoncard.co.kr/v3/img/card_main_logo.png"
            alt="Pokémon 카드 뽑기"
            className="brand-logo"
          />
        </Link>
        <nav className="top-nav">
          <NavLink to="/" end>팩</NavLink>
          {user && <NavLink to="/inventory">내 컬렉션</NavLink>}
          {isAdmin && <NavLink to="/admin">관리자</NavLink>}
        </nav>
        <div className="auth">
          {user ? (
            <>
              <button
                className="balance-pill"
                title="클릭하여 충전"
                onClick={() => setChargeOpen(true)}
                style={{ cursor: "pointer" }}
              >
                <CurrencyMark size={16} />
                <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>
                  {formatCurrency(profile?.currency ?? 0)}
                </span>
                <span className="charge-plus">+</span>
              </button>
              <span className="topbar-name">
                {user.displayName || user.email || "Trainer"}
              </span>
              {showClaimButton && (
                <button
                  className="secondary"
                  onClick={claimAdmin}
                  disabled={claiming}
                  style={{ fontSize: 12 }}
                  title="등록된 admin 이 없을 때만 본인이 첫 admin 으로 등록됩니다"
                >
                  {claiming ? "확인 중..." : "Admin 받기"}
                </button>
              )}
              <button className="secondary topbar-logout" onClick={signOutNow}>로그아웃</button>
            </>
          ) : (
            <button onClick={() => setAuthOpen(true)}>로그인</button>
          )}
        </div>
      </header>

      <main>
        <Suspense fallback={<div className="center">로딩...</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route
              path="/pack/:packId"
              element={user ? <PackOpen /> : <Navigate to="/" state={{ from: location }} replace />}
            />
            <Route
              path="/inventory"
              element={user ? <Inventory /> : <Navigate to="/" replace />}
            />
            <Route
              path="/admin/*"
              element={isAdmin ? <Admin /> : <Navigate to="/" replace />}
            />
          </Routes>
        </Suspense>
      </main>

      {/* 모바일용 bottom 탭 — < 600px 에서만 표시 */}
      <nav className="bottom-nav">
        <NavLink to="/" end className="bn-item">
          <span className="bn-icon">🎴</span>
          <span>팩</span>
        </NavLink>
        {user && (
          <NavLink to="/inventory" className="bn-item">
            <span className="bn-icon">📚</span>
            <span>컬렉션</span>
          </NavLink>
        )}
        {isAdmin && (
          <NavLink to="/admin" className="bn-item">
            <span className="bn-icon">⚙️</span>
            <span>관리자</span>
          </NavLink>
        )}
      </nav>

      {authOpen && <AuthDialog onClose={() => setAuthOpen(false)} />}
      {chargeOpen && user && <ChargeDialog onClose={() => setChargeOpen(false)} />}
    </div>
  );
}
