import { Link, Route, Routes } from "react-router-dom";
import AdminCards from "./AdminCards";
import AdminPacks from "./AdminPacks";
import AdminUsers from "./AdminUsers";

export default function Admin() {
  return (
    <div>
      <h1 className="h1">관리자</h1>
      <div className="row" style={{ marginBottom: 16 }}>
        <Link
          to="/admin/cards"
          className="card"
          style={{ padding: 12, textDecoration: "none", color: "inherit", flex: "1 1 160px", textAlign: "center" }}
        >
          🃏 카드 관리
        </Link>
        <Link
          to="/admin/packs"
          className="card"
          style={{ padding: 12, textDecoration: "none", color: "inherit", flex: "1 1 160px", textAlign: "center" }}
        >
          📦 팩 관리
        </Link>
        <Link
          to="/admin/users"
          className="card"
          style={{ padding: 12, textDecoration: "none", color: "inherit", flex: "1 1 160px", textAlign: "center" }}
        >
          💰 유저 / 캐시
        </Link>
      </div>
      <Routes>
        <Route path="cards" element={<AdminCards />} />
        <Route path="packs" element={<AdminPacks />} />
        <Route path="users" element={<AdminUsers />} />
      </Routes>
    </div>
  );
}
