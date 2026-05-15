import { httpsCallable } from "firebase/functions";
import { useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthDialog } from "./AuthDialog";
import { useAuth } from "./auth";
import { functions } from "./firebase";
import Admin from "./pages/Admin";
import Home from "./pages/Home";
import Inventory from "./pages/Inventory";
import PackOpen from "./pages/PackOpen";

export default function App() {
  const { user, isAdmin, loading, signOutNow, refreshClaims } = useAuth();
  const location = useLocation();
  const [authOpen, setAuthOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  // null = 모르는 상태(체크 중), true = admin 존재, false = 아직 없음
  const [systemHasAdmin, setSystemHasAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    httpsCallable<unknown, { hasAdmin: boolean }>(functions, "getAdminStatus")({})
      .then((r) => setSystemHasAdmin(r.data.hasAdmin))
      .catch(() => setSystemHasAdmin(null));
  }, [user]);

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
        <Link to="/" className="brand">🎴 Pokémon 카드 뽑기</Link>
        <nav>
          {user && <Link to="/inventory">내 컬렉션</Link>}
          {isAdmin && <Link to="/admin">관리자</Link>}
        </nav>
        <div className="auth">
          {user ? (
            <>
              <span className="muted">
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
              <button onClick={signOutNow}>로그아웃</button>
            </>
          ) : (
            <button onClick={() => setAuthOpen(true)}>로그인 / 회원가입</button>
          )}
        </div>
      </header>

      <main>
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
      </main>

      {authOpen && <AuthDialog onClose={() => setAuthOpen(false)} />}
    </div>
  );
}
