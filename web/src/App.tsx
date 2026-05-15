import { useState } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthDialog } from "./AuthDialog";
import { useAuth } from "./auth";
import Admin from "./pages/Admin";
import Home from "./pages/Home";
import Inventory from "./pages/Inventory";
import PackOpen from "./pages/PackOpen";

export default function App() {
  const { user, isAdmin, loading, signOutNow } = useAuth();
  const location = useLocation();
  const [authOpen, setAuthOpen] = useState(false);

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
