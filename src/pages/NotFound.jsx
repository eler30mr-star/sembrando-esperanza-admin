import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <main className="not-found">
      <h1>Página no encontrada</h1>
      <Link className="btn primary" to="/">Volver al panel</Link>
    </main>
  );
}
