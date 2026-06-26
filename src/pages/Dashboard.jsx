import StatCard from '../components/StatCard.jsx';
import { loadCollections } from '../services/localStore.js';

const labels = {
  plans: 'Planes',
  stories: 'Historias',
  videos: 'Videos',
  albums: 'Álbumes',
  verses: 'Versículos',
  prayers: 'Oraciones',
  homeSections: 'Inicio'
};

export default function Dashboard() {
  const collections = loadCollections();

  return (
    <section className="admin-page">
      <div className="page-title">
        <span>Resumen</span>
        <h2>Dashboard</h2>
        <p>Vista general del contenido que alimentará la página pública de Sembrando Esperanza.</p>
      </div>

      <div className="stats-grid">
        {Object.entries(labels).map(([key, label]) => {
          const items = collections[key] || [];
          const published = items.filter((item) => item.status === 'published').length;
          return <StatCard key={key} label={label} value={items.length} helper={`${published} publicados`} />;
        })}
      </div>

      <section className="admin-panel">
        <h3>Flujo recomendado</h3>
        <ol className="workflow-list">
          <li>Crear el contenido como borrador.</li>
          <li>Revisar título, descripción corta, portada y categoría.</li>
          <li>Publicar solo cuando esté listo para aparecer en la web pública.</li>
          <li>Configurar el inicio para destacar lo más importante.</li>
        </ol>
      </section>
    </section>
  );
}
