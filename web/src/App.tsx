import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./auth";
import Admin from "./pages/Admin";
import Home from "./pages/Home";
import Inventory from "./pages/Inventory";
import PackOpen from "./pages/PackOpen";

export default function App() {
  const { user, isAdmin, loading, signIn, signOutNow } = useAuth();
  const location = useLocation();

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
              <span className="muted">{user.displayName ?? user.email}</span>
              <button onClick={signOutNow}>로그아웃</button>
            </>
          ) : (
            <button onClick={signIn}>Google 로그인</button>
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
    </div>
  );
}
