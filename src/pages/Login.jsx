import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { LockKeyhole } from 'lucide-react';
import { adminEmail, auth, firebaseReady } from '../services/firebase.js';

function getFriendlyAuthError(error) {
  if (error?.code === 'auth/invalid-credential' || error?.code === 'auth/wrong-password' || error?.code === 'auth/user-not-found') {
    return 'Correo o contraseña incorrectos. Revisa que el usuario exista en Firebase Authentication.';
  }

  if (error?.code === 'auth/operation-not-allowed') {
    return 'El inicio con correo y contraseña no está habilitado en Firebase Authentication.';
  }

  if (error?.code === 'auth/unauthorized-domain') {
    return 'Este dominio no está autorizado en Firebase Authentication.';
  }

  return 'No se pudo iniciar sesión con Firebase. Revisa Authentication, dominio autorizado y contraseña.';
}

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState(adminEmail);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');

    if (!firebaseReady || !auth) {
      setError('Firebase no está configurado. Revisa las variables de entorno en Vercel y vuelve a desplegar.');
      return;
    }

    if (email.trim().toLowerCase() !== adminEmail.toLowerCase()) {
      setError('Este correo no está autorizado para administrar la página.');
      return;
    }

    if (!password.trim()) {
      setError('Ingresa la contraseña del usuario creado en Firebase Authentication.');
      return;
    }

    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email.trim(), password);
      navigate('/');
    } catch (authError) {
      console.error('No se pudo iniciar sesión.', authError);
      setError(getFriendlyAuthError(authError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <span className="login-icon"><LockKeyhole /></span>
        <div>
          <span className="eyebrow">Acceso privado</span>
          <h1>Panel Admin</h1>
          <p>Administra planes, historias, videos, álbumes, versículos, oraciones y contenido destacado del inicio.</p>
        </div>
        <form onSubmit={submit}>
          <label>
            Correo administrador
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
          </label>
          <label>
            Contraseña
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Contraseña de Firebase Auth" />
          </label>
          {error && <p className="error-text">{error}</p>}
          <button className="btn primary" type="submit" disabled={loading}>{loading ? 'Entrando...' : 'Entrar al panel'}</button>
        </form>
      </section>
    </main>
  );
}
