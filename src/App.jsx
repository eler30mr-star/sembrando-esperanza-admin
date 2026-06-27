import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import AdminLayout from './components/AdminLayout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Login from './pages/Login.jsx';
import SectionManager from './pages/SectionManager.jsx';
import NotFound from './pages/NotFound.jsx';
import { adminEmail, auth, firebaseReady } from './services/firebase.js';

function RequireFirebaseSession({ children }) {
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!firebaseReady || !auth) {
      setAllowed(false);
      setChecking(false);
      return undefined;
    }

    return onAuthStateChanged(auth, (user) => {
      setAllowed(Boolean(user && user.email?.toLowerCase() === adminEmail.toLowerCase()));
      setChecking(false);
    });
  }, []);

  if (checking) return <main className="login-page"><p className="admin-message">Verificando sesión...</p></main>;
  return allowed ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <RequireFirebaseSession>
            <AdminLayout />
          </RequireFirebaseSession>
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
