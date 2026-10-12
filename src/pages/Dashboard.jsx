import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StatCard from '../components/StatCard.jsx';
import { loadSectionItems } from '../services/contentService.js';

export const dashboardSections = [
  { key: 'plans', label: 'Planes', url: '/planes' },
  { key: 'stories', label: 'Historias', url: '/historias' },
  { key: 'videos', label: 'Videos', url: '/videos' },
  { key: 'albums', label: 'Álbumes', url: '/albumes' },
  { key: 'verses', label: 'Versículos', url: '/versiculos' },
  { key: 'prayers', label: 'Oraciones', url: '/oraciones' },
  { key: 'homeSections', label: 'Inicio', url: '/inicio' }
];

export default function Dashboard() {
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState({});
  const [failures, setFailures] = useState({});

  const reload = useCallback(() => setRefresh((value) => value + 1), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setFailures({});
    setOverview({});
    // All settled: un fallo de una colección no elimina los resultados de las otras.
    Promise.allSettled(dashboardSections.map(({ key }) => loadSectionItems(key)))
      .then((results) => {
        if (!alive) return;
        const nextOverview = {};
        const nextFailures = {};
        results.forEach((result, index) => {
          const section = dashboardSections[index];
          if (result.status === 'fulfilled') {
            const items = result.value;
            nextOverview[section.key] = {
              total: items.length,
              published: items.filter((item) => item.status === 'published').length,
              drafts: items.filter((item) => item.status !== 'published').length
            };
          } else {
            nextFailures[section.key] = result.reason?.message || 'No se pudo consultar esta colección.';
          }
        });
        setOverview(nextOverview);
        setFailures(nextFailures);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [refresh]);

  const failedSections = dashboardSections.filter(({ key }) => failures[key]);
  const loadedSections = dashboardSections.filter(({ key }) => overview[key]);
  const summary = loadedSections.reduce((acc, { key }) => {
    acc.total += overview[key].total;
    acc.published += overview[key].published;
    acc.drafts += overview[key].drafts;
    return acc;
  }, { total: 0, published: 0, drafts: 0 });

  return (
    <section className="admin-page">
      <div className="page-title">
        <span>Administración</span>
        <h2>Resumen de contenido</h2>
        <p>Estado real de Firestore. Los datos no están guardados localmente y nunca se sustituyen por cifras de demostración.</p>
      </div>

      <div className="admin-panel">
        <div className="page-title">
          <h3>Estado de carga</h3>
          <p aria-live="polite">
            {loading
              ? 'Consultando las siete colecciones...'
              : failedSections.length
                ? `${loadedSections.length} colecciones consultadas; ${failedSections.length} con errores.`
                : 'Siete colecciones consultadas correctamente.'}
          </p>
        </div>
        <button type="button" onClick={reload} disabled={loading}>
          {loading ? 'Actualizando...' : 'Actualizar datos'}
        </button>
        {failedSections.length > 0 && (
          <div role="alert" className="admin-message">
            <strong>Datos incompletos. No se muestran totales globales como definitivos.</strong>
            <ul>
              {failedSections.map((section) => (
                <li key={section.key}>
                  {section.label}: {failures[section.key]} — <Link to={section.url}>Abrir sección</Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {!loading && failedSections.length === 0 && (
        <div className="stats-grid" aria-label="Totales de todas las colecciones">
          <StatCard label="Registros" value={summary.total} helper="Todas las secciones" />
          <StatCard label="Publicados" value={summary.published} helper="Visibles según cada sección" />
          <StatCard label="No publicados" value={summary.drafts} helper="Borradores u otros estados" />
        </div>
      )}

      <div className="stats-grid">
        {dashboardSections.map((section) => {
          const data = overview[section.key];
          return (
            <div key={section.key}>
              {data
                ? <StatCard label={section.label} value={data.total} helper={`${data.published} publicados · ${data.drafts} no publicados`} />
                : <StatCard label={section.label} value="—" helper={loading ? 'Cargando...' : 'Sin datos verificados'} />}
              <Link to={section.url}>Administrar {section.label.toLowerCase()}</Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
