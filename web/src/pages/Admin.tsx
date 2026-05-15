import { Link, Route, Routes } from "react-router-dom";
import AdminCards from "./AdminCards";
import AdminExpansions from "./AdminExpansions";
import AdminPacks from "./AdminPacks";
import AdminStock from "./AdminStock";
import AdminUsers from "./AdminUsers";

const tile: React.CSSProperties = {
  padding: 12,
  textDecoration: "none",
  color: "inherit",
  flex: "1 1 140px",
  textAlign: "center",
};

export default function Admin() {
  return (
    <div>
      <h1 className="h1">관리자</h1>
      <div className="row" style={{ marginBottom: 16 }}>
        <Link to="/admin/expansions" className="card" style={tile}>📚 확장팩</Link>
        <Link to="/admin/cards" className="card" style={tile}>🃏 카드</Link>
        <Link to="/admin/stock" className="card" style={tile}>📦 재고</Link>
        <Link to="/admin/packs" className="card" style={tile}>🎴 팩</Link>
        <Link to="/admin/users" className="card" style={tile}>💰 유저 / 캐시</Link>
      </div>
      <Routes>
        <Route path="expansions" element={<AdminExpansions />} />
        <Route path="cards" element={<AdminCards />} />
        <Route path="stock" element={<AdminStock />} />
        <Route path="packs" element={<AdminPacks />} />
        <Route path="users" element={<AdminUsers />} />
      </Routes>
    </div>
  );
}
