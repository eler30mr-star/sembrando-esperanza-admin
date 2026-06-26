import { Navigate, Route, Routes } from 'react-router-dom';
import AdminLayout from './components/AdminLayout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Login from './pages/Login.jsx';
import SectionManager from './pages/SectionManager.jsx';
import NotFound from './pages/NotFound.jsx';

function RequireLocalSession({ children }) {
  const session = localStorage.getItem('se-admin-session');
  return session ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <RequireLocalSession>
            <AdminLayout />
          </RequireLocalSession>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="planes" element={<SectionManager section="plans" />} />
        <Route path="historias" element={<SectionManager section="stories" />} />
        <Route path="videos" element={<SectionManager section="videos" />} />
        <Route path="albumes" element={<SectionManager section="albums" />} />
        <Route path="versiculos" element={<SectionManager section="verses" />} />
        <Route path="oraciones" element={<SectionManager section="prayers" />} />
        <Route path="inicio" element={<SectionManager section="homeSections" />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
