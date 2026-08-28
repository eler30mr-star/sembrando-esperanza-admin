import { useEffect, useMemo, useState } from 'react';
import EditorForm from '../components/EditorForm.jsx';
import PlanLanguageEditor from '../components/PlanLanguageEditor.jsx';
import { sectionConfig } from '../data/initialData.js';
import { createId, loadCollections } from '../services/localStore.js';
import { deleteSectionItem, loadSectionItems, saveSectionItem } from '../services/contentService.js';
import { auth, firebaseReady } from '../services/firebase.js';

function createEmptyPlanDay() {
  return { title: '', subtitle: '', verse: '', text: '', prayer: '', action: '' };
}

function emptyItemFor(config, section) {
  return config.fields.reduce((acc, field) => {
    if (field.type === 'status') acc[field.name] = section === 'videos' ? 'published' : 'draft';
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

const jsonSections = new Set(['plans', 'videos', 'stories']);

export default function SectionManager({ section }) {
  const config = sectionConfig[section];
  const [collections, setCollections] = useState(loadCollections());
  const items = collections[section] || [];
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(emptyItemFor(config, section));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let alive = true;
    async function loadItems() {
      setLoading(true);
      setMessage('');
      const loadedItems = await loadSectionItems(section);
      if (!alive) return;
      setCollections((current) => ({ ...current, [section]: loadedItems }));
      setDraft(emptyItemFor(config, section));
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
    setDraft(emptyItemFor(config, section));
    setMessage('');
  }

  function startEdit(item) {
    setEditing(item.id);
    setDraft({ ...emptyItemFor(config, section), ...item });
    setMessage('');
  }

  async function publishJson(sectionName, nextItems) {
    const user = auth?.currentUser;
    if (!user) throw new Error('La sesión de administrador expiró. Vuelve a iniciar sesión.');

    const configBySection = {
      plans: { endpoint: '/api/publish-plans', bodyKey: 'plans', label: 'planes' },
      videos: { endpoint: '/api/publish-videos', bodyKey: 'videos', label: 'videos' },
      stories: { endpoint: '/api/publish-stories', bodyKey: 'stories', label: 'historias' }
    };
    const publishConfig = configBySection[sectionName];
    if (!publishConfig) return null;

    const idToken = await user.getIdToken();
    const response = await fetch(publishConfig.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`
      },
      body: JSON.stringify({ [publishConfig.bodyKey]: nextItems })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || `No se pudo actualizar el JSON de ${publishConfig.label} en GitHub.`);
    }
    return payload;
  }

  async function deletePublishedPlan(planId) {
    const user = auth?.currentUser;
    if (!user) throw new Error('La sesión de administrador expiró. Vuelve a iniciar sesión.');

    const idToken = await user.getIdToken();
    const response = await fetch('/api/delete-plan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`
      },
      body: JSON.stringify({ planId })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'No se pudo eliminar el plan del JSON público.');
    return payload;
  }

  async function syncJson() {
    setSyncing(true);
    setMessage('');
    try {
      const result = await publishJson(section, items);
      setMessage(`JSON público sincronizado correctamente en el commit ${result?.commit?.slice(0, 7) || 'nuevo'}.`);
    } catch (error) {
      console.error('No se pudo sincronizar el JSON público.', error);
      setMessage(error.message || 'No se pudo sincronizar el JSON público.');
    } finally {
      setSyncing(false);
    }
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const nextItem = editing === 'new'
        ? { ...draft, id: createId(section.slice(0, -1) || section), updatedAtMs: Date.now() }
        : { ...draft, updatedAtMs: Date.now() };

      const savedItem = await saveSectionItem(section, nextItem);
      const nextItems = editing === 'new'
        ? [savedItem, ...items]
        : items.map((item) => item.id === editing ? savedItem : item);

      if (jsonSections.has(section)) {
        await publishJson(section, nextItems);
      }

      setCollections((current) => ({ ...current, [section]: nextItems }));
      setEditing(null);
      setDraft(emptyItemFor(config, section));

      if (jsonSections.has(section)) {
        const names = { plans: 'Plan', videos: 'Video', stories: 'Historia' };
        const itemName = names[section];
        setMessage(savedItem.status === 'published'
          ? `${itemName} guardado correctamente. Firebase y el JSON de GitHub quedaron actualizados.`
          : `${itemName} guardado como borrador. El JSON público de GitHub quedó sincronizado sin este contenido.`);
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

  async function remove(item) {
    if (deletingId || saving || syncing) return;

    const title = getPrimaryTitle(item);
    const confirmed = window.confirm(`¿Eliminar "${title}" definitivamente? Esta acción no se puede deshacer.`);
    if (!confirmed) return;

    const nextItems = items.filter((current) => current.id !== item.id);
    setDeletingId(item.id);
    setMessage('');

    try {
      await deleteSectionItem(section, item.id);
      setCollections((current) => ({ ...current, [section]: nextItems }));

      if (editing === item.id) {
        setEditing(null);
        setDraft(emptyItemFor(config, section));
      }

      if (section === 'plans') {
        try {
          await deletePublishedPlan(item.id);
          setMessage('Plan eliminado definitivamente de Firebase y de los JSON públicos.');
        } catch (publicError) {
          console.error('El plan se eliminó de Firebase, pero falló la limpieza del JSON público.', publicError);
          setMessage(`Plan eliminado de Firebase. No se pudo limpiar el JSON público: ${publicError.message}`);
        }
      } else if (section === 'videos' || section === 'stories') {
        try {
          await publishJson(section, nextItems);
          setMessage(section === 'videos'
            ? 'Video eliminado definitivamente de Firebase y de los JSON públicos.'
            : 'Historia eliminada definitivamente de Firebase y de los JSON públicos.');
        } catch (publicError) {
          console.error('El contenido se eliminó de Firebase, pero falló la limpieza del JSON público.', publicError);
          setMessage(`Contenido eliminado de Firebase. No se pudo limpiar el JSON público: ${publicError.message}`);
        }
      } else {
        setMessage('Contenido eliminado definitivamente.');
      }
    } catch (error) {
      console.error('No se pudo eliminar el contenido de Firebase.', error);
      setMessage(error.message || 'No se pudo eliminar el contenido de Firebase.');
    } finally {
      setDeletingId(null);
    }
  }

  const connectedMessage = firebaseReady
    ? jsonSections.has(section)
      ? `Firebase conectado. Al guardar ${section === 'stories' ? 'una historia' : section === 'videos' ? 'un video' : 'un plan'} también se actualiza automáticamente el JSON en GitHub.`
      : 'Firebase conectado.'
    : 'Firebase no configurado: el contenido solo se guarda en este navegador.';

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
          {jsonSections.has(section) && (
            <button
              className="btn muted"
              type="button"
              onClick={syncJson}
              disabled={syncing || loading || saving || Boolean(deletingId)}
            >
              {syncing ? 'Sincronizando...' : 'Sincronizar JSON'}
            </button>
          )}
          <button className="btn primary" type="button" onClick={startCreate} disabled={saving || syncing || Boolean(deletingId)}>Nuevo</button>
        </div>
      </div>

      <p className={`admin-message ${firebaseReady ? 'success' : 'warning'}`}>{connectedMessage}</p>

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
                <td>
                  <div className="row-actions">
                    <button type="button" onClick={() => startEdit(item)} disabled={Boolean(deletingId) || saving || syncing}>Editar</button>
                    <button
                      type="button"
                      className="danger-link"
                      onClick={() => remove(item)}
                      disabled={Boolean(deletingId) || saving || syncing}
                    >
                      {deletingId === item.id ? 'Eliminando...' : 'Eliminar'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && <tr><td colSpan="4" className="empty-state">No hay contenido todavía.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
