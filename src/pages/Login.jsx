import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';
import { adminEmail } from '../services/firebase.js';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState(adminEmail);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function submit(event) {
    event.preventDefault();

    if (email.trim().toLowerCase() !== adminEmail.toLowerCase()) {
      setError('Este correo no está autorizado para administrar la página.');
      return;
    }

    if (!password.trim()) {
      setError('Ingresa una contraseña. En producción esto se conecta con Firebase Auth.');
      return;
    }

    localStorage.setItem('se-admin-session', JSON.stringify({ email, at: new Date().toISOString() }));
    navigate('/');
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
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Modo demo local" />
          </label>
          {error && <p className="error-text">{error}</p>}
          <button className="btn primary" type="submit">Entrar al panel</button>
        </form>
      </section>
    </main>
  );
}
