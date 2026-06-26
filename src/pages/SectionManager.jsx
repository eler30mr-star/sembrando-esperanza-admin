import { useMemo, useState } from 'react';
import EditorForm from '../components/EditorForm.jsx';
import { sectionConfig } from '../data/initialData.js';
import { createId, loadCollections, saveCollections } from '../services/localStore.js';

function emptyItemFor(config) {
  return config.fields.reduce((acc, field) => {
    acc[field.name] = field.type === 'status' ? 'draft' : '';
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

  const stats = useMemo(() => ({
    total: items.length,
    published: items.filter((item) => item.status === 'published').length,
    drafts: items.filter((item) => item.status === 'draft').length
  }), [items]);

  function startCreate() {
    setEditing('new');
    setDraft(emptyItemFor(config));
  }

  function startEdit(item) {
    setEditing(item.id);
    setDraft(item);
  }

  function save(event) {
    event.preventDefault();
    const nextItem = editing === 'new'
      ? { ...draft, id: createId(section.slice(0, -1) || section), updatedAt: new Date().toISOString() }
      : { ...draft, updatedAt: new Date().toISOString() };

    const nextItems = editing === 'new'
      ? [nextItem, ...items]
      : items.map((item) => item.id === editing ? nextItem : item);

    const nextCollections = { ...collections, [section]: nextItems };
    setCollections(nextCollections);
    saveCollections(nextCollections);
    setEditing(null);
    setDraft(emptyItemFor(config));
  }

  function remove(id) {
    const nextCollections = { ...collections, [section]: items.filter((item) => item.id !== id) };
    setCollections(nextCollections);
    saveCollections(nextCollections);
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

      <div className="mini-stats">
        <span>Total: <strong>{stats.total}</strong></span>
        <span>Publicados: <strong>{stats.published}</strong></span>
        <span>Borradores: <strong>{stats.drafts}</strong></span>
      </div>

      {editing && (
        <EditorForm
          config={config}
          value={draft}
          onChange={setDraft}
          onSubmit={save}
          onCancel={() => setEditing(null)}
          mode={editing === 'new' ? 'create' : 'edit'}
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
            {items.length === 0 && (
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
