import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { BookOpen, Home, Image, LayoutDashboard, LogOut, PenLine, PlayCircle, Settings, ShieldCheck, Sparkles } from 'lucide-react';
import { auth } from '../services/firebase.js';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/planes', label: 'Planes', icon: BookOpen },
  { to: '/historias', label: 'Historias', icon: PenLine },
  { to: '/videos', label: 'Videos', icon: PlayCircle },
  { to: '/albumes', label: 'Álbumes', icon: Image },
  { to: '/versiculos', label: 'Versículos', icon: Sparkles },
  { to: '/oraciones', label: 'Oraciones', icon: ShieldCheck },
  { to: '/inicio', label: 'Inicio', icon: Home }
];

export default function AdminLayout() {
  const navigate = useNavigate();

  async function logout() {
    if (auth) await signOut(auth);
    navigate('/login');
  }

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="admin-brand">
          <span><Settings size={22} /></span>
          <div>
            <strong>Sembrando Esperanza</strong>
            <small>Panel Admin</small>
          </div>
        </div>
        <nav className="admin-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} end={item.to === '/'}>
                <Icon size={18} /> {item.label}
              </NavLink>
            );
          })}
        </nav>
        <button className="logout" type="button" onClick={logout}><LogOut size={18} /> Salir</button>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div>
            <span>Panel privado</span>
            <h1>Gestión de contenido cristiano</h1>
          </div>
          <a href="/" className="status-pill">Activo</a>
        </header>
        <Outlet />
      </div>
    </div>
  );
}
