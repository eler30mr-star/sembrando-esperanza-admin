import { useEffect, useMemo, useState } from 'react';
import EditorForm from '../components/EditorForm.jsx';
import { sectionConfig } from '../data/initialData.js';
import { createId, loadCollections } from '../services/localStore.js';
import { deleteSectionItem, loadSectionItems, saveSectionItem } from '../services/contentService.js';
import { firebaseReady } from '../services/firebase.js';

function createEmptyPlanDay() {
  return {
    title: '',
    subtitle: '',
    verse: '',
    verseText: '',
    text: '',
    prayer: '',
    action: ''
  };
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

    return () => {
      alive = false;
    };
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

      setCollections((current) => ({ ...current, [section]: nextItems }));
      setEditing(null);
      setDraft(emptyItemFor(config));
      setMessage(firebaseReady
        ? 'Contenido guardado en Firebase. Si está publicado, aparecerá en la web pública.'
        : 'Contenido guardado solo en este navegador. Firebase no está configurado en Vercel o falta redeploy.');
    } catch (error) {
      console.error('No se pudo guardar el contenido.', error);
      setMessage('No se pudo guardar. Revisa Firebase, reglas o variables Vercel.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    setMessage('');

    try {
      await deleteSectionItem(section, id);
      setCollections((current) => ({
        ...current,
        [section]: items.filter((item) => item.id !== id)
      }));
      setMessage('Contenido eliminado correctamente.');
    } catch (error) {
      console.error('No se pudo eliminar el contenido.', error);
      setMessage('No se pudo eliminar. Revisa Firebase o permisos.');
    }
  }

  return (
    <section className="admin-page">
      <div className="section-manager-head">
        <div className="page-title">
          <span>Administrar</span>
          <h2>{config.label}</h2>
          <p>{config.description}</p>
        </div>
        <button className="btn primary" type="button" onClick={startCreate}>Nuevo</button>
      </div>

      <p className={`admin-message ${firebaseReady ? 'success' : 'warning'}`}>
        {firebaseReady ? 'Firebase conectado: el contenido se guarda en la nube.' : 'Firebase no configurado: el contenido solo se guarda en este navegador.'}
      </p>

      <div className="mini-stats">
        <span>Total: <strong>{stats.total}</strong></span>
        <span>Publicados: <strong>{stats.published}</strong></span>
        <span>Borradores: <strong>{stats.drafts}</strong></span>
      </div>

      {message && <p className="admin-message">{message}</p>}
      {loading && <p className="admin-message">Cargando contenido...</p>}

      {editing && (
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
          <thead>
            <tr>
              <th>Título</th>
              <th>Categoría/Tema</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{getPrimaryTitle(item)}</strong>
                  <small>{item.shortDescription || item.url || item.text || ''}</small>
                </td>
                <td>{item.category || item.theme || item.moment || '—'}</td>
                <td><span className={`status ${item.status || 'draft'}`}>{item.status || 'draft'}</span></td>
                <td>
                  <div className="row-actions">
                    <button type="button" onClick={() => startEdit(item)}>Editar</button>
                    <button type="button" className="danger" onClick={() => remove(item.id)}>Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan="4" className="empty-state">No hay contenido todavía.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}