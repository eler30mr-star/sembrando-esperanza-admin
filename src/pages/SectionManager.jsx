import { useEffect, useMemo, useState } from 'react';
import EditorForm from '../components/EditorForm.jsx';
import PlanLanguageEditor from '../components/PlanLanguageEditor.jsx';
import { sectionConfig } from '../data/initialData.js';
import { createId, loadCollections } from '../services/localStore.js';
import { loadSectionItems, saveSectionItem } from '../services/contentService.js';
import { firebaseReady } from '../services/firebase.js';

function createEmptyPlanDay() {
  return { title: '', subtitle: '', verse: '', text: '', prayer: '', action: '' };
}

function emptyItemFor(config) {
  return config.fields.reduce((acc, field) => {
    if (field.type === 'status') acc[field.name] = 'draft';
    else if (field.type === 'chapters') acc[field.name] = [{ title: '', content: '' }];
    else if (field.type === 'list') acc[field.name] = [''];
    else if (field.type === 'planDays') acc[field.name] = [createEmptyPlanDay()];
    else acc[field.name] = '';
    return acc;
  }, {});
}

function getPrimaryTitle(item) {
  return item.title || item.reference || item.theme || 'Contenido sin título';
}

export default function SectionManager({ section }) {
  const config = sectionConfig[section];
  const [collections, setCollections] = useState(loadCollections());
  const items = collections[section] || [];
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(emptyItemFor(config));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let alive = true;
    async function loadItems() {
      setLoading(true);
      setMessage('');
      const loadedItems = await loadSectionItems(section);
      if (!alive) return;
      setCollections((current) => ({ ...current, [section]: loadedItems }));
      setLoading(false);
    }
    loadItems();
    return () => { alive = false; };
  }, [section]);

  const stats = useMemo(() => ({
    total: items.length,
    published: items.filter((item) => item.status === 'published').length,
    drafts: items.filter((item) => item.status === 'draft').length
  }), [items]);

  function startCreate() {
    setEditing('new');
    setDraft(emptyItemFor(config));
    setMessage('');
  }

  function startEdit(item) {
    setEditing(item.id);
    setDraft({ ...emptyItemFor(config), ...item });
    setMessage('');
  }

  async function publishPlansList(plansToPublish) {
    const response = await fetch('/api/publish-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plans: plansToPublish })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'No se pudo actualizar el JSON en GitHub.');
    return payload;
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const nextItem = editing === 'new'
        ? { ...draft, id: createId(section.slice(0, -1) || section) }
        : { ...draft };

      const savedItem = await saveSectionItem(section, nextItem);
      const nextItems = editing === 'new'
        ? [savedItem, ...items]
        : items.map((item) => item.id === editing ? savedItem : item);

      if (section === 'plans') {
        await publishPlansList(nextItems);
      }

      setCollections((current) => ({ ...current, [section]: nextItems }));
      setEditing(null);
      setDraft(emptyItemFor(config));

      if (section === 'plans') {
        setMessage('Plan guardado correctamente. Firebase y el JSON de GitHub quedaron actualizados.');
      } else {
        setMessage(firebaseReady
          ? 'Contenido guardado correctamente.'
          : 'Contenido guardado solo en este navegador. Firebase no está configurado en Vercel o falta redeploy.');
      }
    } catch (error) {
      console.error('No se pudo guardar o publicar el contenido.', error);
      setMessage(error.message || 'No se pudo completar el guardado. Revisa Firebase, GitHub o las variables de Vercel.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-page">
      <div className={`section-manager-head ${section === 'plans' ? 'plans-compact-head' : ''}`}>
        {section !== 'plans' && (
          <div className="page-title">
            <span>Administrar</span>
            <h2>{config.label}</h2>
            <p>{config.description}</p>
          </div>
        )}
        <div className="section-actions">
          <button className="btn primary" type="button" onClick={startCreate}>Nuevo</button>
        </div>
      </div>

      <p className={`admin-message ${firebaseReady ? 'success' : 'warning'}`}>
        {firebaseReady
          ? 'Firebase conectado. Al guardar un plan también se actualiza automáticamente el JSON en GitHub.'
          : 'Firebase no configurado: el contenido solo se guarda en este navegador.'}
      </p>

      <div className="mini-stats">
        <span>Total: <strong>{stats.total}</strong></span>
        <span>Publicados: <strong>{stats.published}</strong></span>
        <span>Borradores: <strong>{stats.drafts}</strong></span>
      </div>

      {message && <p className="admin-message">{message}</p>}
      {loading && <p className="admin-message">Cargando contenido...</p>}

      {editing && section === 'plans' && (
        <PlanLanguageEditor
          config={config}
          draft={draft}
          setDraft={setDraft}
          setMessage={setMessage}
          onSubmit={save}
          onCancel={() => setEditing(null)}
          mode={editing === 'new' ? 'create' : 'edit'}
          saving={saving}
        />
      )}

      {editing && section !== 'plans' && (
        <EditorForm
          config={config}
          value={draft}
          onChange={setDraft}
          onSubmit={save}
          onCancel={() => setEditing(null)}
          mode={editing === 'new' ? 'create' : 'edit'}
          saving={saving}
        />
      )}

      <div className="table-card">
        <table>
          <thead><tr><th>Título</th><th>Categoría/Tema</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td><strong>{getPrimaryTitle(item)}</strong><small>{item.shortDescription || item.url || item.text || ''}</small></td>
                <td>{item.category || item.theme || item.moment || '—'}</td>
                <td><span className={`status ${item.status || 'draft'}`}>{item.status || 'draft'}</span></td>
                <td><div className="row-actions"><button type="button" onClick={() => startEdit(item)}>Editar</button></div></td>
              </tr>
            ))}
            {items.length === 0 && !loading && <tr><td colSpan="4" className="empty-state">No hay contenido todavía.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
