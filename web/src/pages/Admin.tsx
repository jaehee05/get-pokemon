import { Link, Route, Routes } from "react-router-dom";
import AdminCards from "./AdminCards";
import AdminPacks from "./AdminPacks";

export default function Admin() {
  return (
    <div>
      <h1 className="h1">관리자</h1>
      <div className="row" style={{ marginBottom: 16 }}>
        <Link to="/admin/cards" className="card" style={{ padding: 10, textDecoration: "none", color: "inherit" }}>
          🃏 카드 관리
        </Link>
        <Link to="/admin/packs" className="card" style={{ padding: 10, textDecoration: "none", color: "inherit" }}>
          📦 팩 관리
        </Link>
      </div>
      <Routes>
        <Route path="cards" element={<AdminCards />} />
        <Route path="packs" element={<AdminPacks />} />
      </Routes>
    </div>
  );
}
