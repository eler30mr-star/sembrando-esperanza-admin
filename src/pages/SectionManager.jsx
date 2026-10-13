import { useEffect, useMemo, useState } from 'react';
import EditorForm from '../components/EditorForm.jsx';
import PlanLanguageEditor from '../components/PlanLanguageEditor.jsx';
import StoryLanguageEditor from '../components/StoryLanguageEditor.jsx';
import { sectionConfig } from '../data/initialData.js';
import { createId } from '../services/localStore.js';
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
  const [collections, setCollections] = useState({});
  const items = collections[section] || [];
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(emptyItemFor(config, section));
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [message, setMessage] = useState('');
  const [pendingPublication, setPendingPublication] = useState(null);
  const [audit, setAudit] = useState(null);
  const [auditing, setAuditing] = useState(false);

  useEffect(() => {
    let alive = true;
    async function loadItems() {
      setLoading(true);
      setLoaded(false);
      setMessage('');
      setPendingPublication(null);
      try {
        const loadedItems = await loadSectionItems(section);
        if (!alive) return;
        setCollections((current) => ({ ...current, [section]: loadedItems }));
        setDraft(emptyItemFor(config, section));
        setLoaded(true);
      } catch (error) {
        console.error('No se pudo consultar Firestore.', error);
        if (alive) setMessage(`No se pudo cargar ${config.label} desde Firebase: ${error.message}. No se permite sincronizar sin los datos.`);
      } finally {
        if (alive) setLoading(false);
      }
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
    if (!loaded) return;
    setEditing('new');
    setDraft(emptyItemFor(config, section));
    setMessage('');
  }

  function startEdit(item) {
    setEditing(item.id);
    setDraft({ ...emptyItemFor(config, section), ...item });
    setMessage('');
  }

  async function publishJson(sectionName, nextItems, options = {}) {
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
      body: JSON.stringify({ [publishConfig.bodyKey]: nextItems, ...options })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || `No se pudo actualizar el JSON de ${publishConfig.label} en GitHub.`);
    }
    return payload;
  }


  async function compareSources() {
    if (!loaded || !jsonSections.has(section) || auditing || syncing || saving || deletingId) return;
    setAuditing(true);
    setAudit(null);
    setMessage('');
    try {
      const fresh = await loadSectionItems(section);
      const languages = section === 'videos' ? ['es'] : ['es', 'en', 'pt', 'fr'];
      const indexed = await Promise.all(languages.map(async (language) => {
        const url = 'https://raw.githubusercontent.com/eler30mr-star/sembrando-esperanza/main/public/data/' + language + '/' + section + '.json?v=' + Date.now();
        const response = await fetch(url, { cache: 'no-store' });
        if (response.status === 404) return { language, records: [] };
        if (!response.ok) throw new Error('Error HTTP ' + response.status + ' en ' + language);
        const records = await response.json();
        if (!Array.isArray(records)) throw new Error('Índice inválido: ' + language);
        return { language, records };
      }));
      const spanish = indexed.find((x) => x.language === 'es').records;
      const localById = new Map(fresh.map((x) => [String(x.id), x]));
      const remoteById = new Map(spanish.map((x) => [String(x.id), x]));
      const orphaned = spanish.filter((x) => !localById.has(String(x.id)));
      const pending = fresh.filter((x) => {
        const remote = remoteById.get(String(x.id));
        if (x.status !== 'published') return Boolean(remote);
        return !remote || Number(remote.updatedAtMs || 0) !== Number(x.updatedAtMs || 0);
      });
      const missingTranslations = indexed.filter((x) => x.language !== 'es').flatMap((x) => {
        const ids = new Set(x.records.map((entry) => String(entry.id)));
        return fresh.filter((item) => item.status === 'published' && item.translations?.[x.language] && !ids.has(String(item.id)))
          .map((item) => ({ ...item, language: x.language }));
      });
      setCollections((current) => ({ ...current, [section]: fresh }));
      setAudit({ orphaned, pending, missingTranslations, totals: indexed.map((x) => x.language.toUpperCase() + ': ' + x.records.length).join(' · ') });
    } catch (error) {
      setMessage('No se pudo comparar: ' + error.message + '. No se modificaron registros.');
    } finally {
      setAuditing(false);
    }
  }

  async function removeOrphan(item) {
    if (!window.confirm('Este registro no existe en Firebase. ¿Retirar "' + getPrimaryTitle(item) + '" del JSON público?')) return;
    setSyncing(true);
    try {
      await publishJson(section, [], { operation: 'delete', targetId: item.id });
      setAudit(null);
      setMessage('Registro retirado del JSON. GitHub conserva su historial.');
    } catch (error) {
      setMessage('No se pudo retirar el registro: ' + error.message);
    } finally {
      setSyncing(false);
    }
  }

  async function republishItem(item) {
    if (syncing || saving || deletingId || loading) return;
    setSyncing(true);
    setMessage('');
    try {
      const freshItems = await loadSectionItems(section);
      const freshItem = freshItems.find((entry) => entry.id === item.id);
      if (!freshItem) throw new Error('Este elemento ya no existe en Firebase. Actualiza la página.');
      await publishJson(section, [freshItem], { operation: 'upsert', targetId: item.id });
      setCollections((current) => ({ ...current, [section]: freshItems }));
      if (pendingPublication === item.id) setPendingPublication(null);
      setMessage(`Sincronización individual de "${getPrimaryTitle(freshItem)}" completada en GitHub.`);
    } catch (error) {
      setPendingPublication(item.id);
      setMessage(`No se pudo sincronizar "${getPrimaryTitle(item)}": ${error.message}`);
    } finally {
      setSyncing(false);
    }
  }

  async function retryPublication() {
    const item = items.find((entry) => entry.id === pendingPublication);
    if (!item || !jsonSections.has(section)) return;
    setSyncing(true);
    setMessage('');
    try {
      await publishJson(section, [item], { operation: 'upsert', targetId: item.id });
      setPendingPublication(null);
      setMessage('Publicación pendiente completada correctamente en GitHub.');
    } catch (error) {
      setMessage(`Firebase conserva el contenido, pero sigue sin publicarse en GitHub: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  }

  async function syncJson() {
    if (!loaded) return;
    setSyncing(true);
    setMessage('');
    try {
      // Leer nuevamente de Firebase evita publicar una colección obsoleta de esta pestaña.
      const freshItems = await loadSectionItems(section);
      const preview = await publishJson(section, freshItems, { operation: 'sync', dryRun: true });
      const lines = Object.entries(preview.preview || {}).map(([language, counts]) =>
        `${language.toUpperCase()}: +${counts.added} nuevos, ~${counts.updated} actualizados, -${counts.removed} eliminados`);
      if (!window.confirm(`Revisión previa de sincronización:\n\n${lines.join('\n')}\n\nArchivos a procesar: ${preview.changedFiles?.length || 0}.\nSolo se continúa si GitHub no cambia. ¿Confirmar?`)) {
        setMessage('Sincronización cancelada. No se realizó ningún cambio en GitHub.');
        return;
      }
      const result = await publishJson(section, freshItems, { operation: 'sync', expectedHead: preview.baseCommit });
      setCollections((current) => ({ ...current, [section]: freshItems }));
      setPendingPublication(null);
      setMessage(`Sincronización confirmada en GitHub. Commit: ${result.commit?.slice(0, 7) || 'no disponible'}.`);
    } catch (error) {
      console.error('No se pudo sincronizar el JSON público.', error);
      setMessage(`Sincronización sin confirmar: ${error.message}. Revisa el estado de GitHub antes de reintentar.`);
    } finally {
      setSyncing(false);
    }
  }

  async function save(event) {
    event.preventDefault();
    if (!loaded) return;
    if (saving || deletingId || syncing) return;
    setSaving(true);
    setMessage('');

    try {
      const isNew = editing === 'new';
      const nextItem = isNew
        ? { ...draft, id: createId(section.slice(0, -1) || section), updatedAtMs: Date.now() }
        : { ...draft, updatedAtMs: Date.now() };
      const expectedVersion = isNew ? null : Number(items.find((item) => item.id === editing)?.updatedAtMs || 0);
      const savedItem = await saveSectionItem(section, nextItem, expectedVersion);
      const nextItems = isNew
        ? [savedItem, ...items]
        : items.map((item) => item.id === editing ? savedItem : item);

      // Guardado real y confirmado en Firestore; la publicación en GitHub es un paso separado.
      setCollections((current) => ({ ...current, [section]: nextItems }));
      setEditing(null);
      setDraft(emptyItemFor(config, section));

      if (jsonSections.has(section)) {
        try {
          await publishJson(section, [savedItem], { operation: 'upsert', targetId: savedItem.id });
          setPendingPublication(null);
          setMessage(savedItem.status === 'published'
            ? 'Guardado en Firebase y publicado correctamente en GitHub.'
            : 'Borrador guardado en Firebase y retirado del JSON público si estaba publicado.');
        } catch (publicError) {
          console.error('Firebase guardó el contenido, pero GitHub no pudo sincronizar.', publicError);
          setPendingPublication(savedItem.id);
          setMessage(`Guardado en Firebase, pero la publicación en GitHub no se pudo confirmar: ${publicError.message}. Usa «Reintentar publicación».`);
        }
      } else {
        setMessage('Contenido guardado correctamente en Firebase.');
      }
    } catch (error) {
      console.error('No se pudo guardar el contenido en Firebase.', error);
      setMessage(`No se guardó el contenido: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function remove(item) {
    if (deletingId || saving || syncing || !loaded) return;
    const title = getPrimaryTitle(item);
    if (!window.confirm(`¿Eliminar "${title}" definitivamente? Se retirará primero de la web pública y después de Firebase.`)) return;

    setDeletingId(item.id);
    setMessage('');
    let publicRemoved = false;

    try {
      if (jsonSections.has(section)) {
        await publishJson(section, [], { operation: 'delete', targetId: item.id });
        publicRemoved = true;
      }
      await deleteSectionItem(section, item.id, Number(item.updatedAtMs || 0));
      setCollections((current) => ({
        ...current,
        [section]: (current[section] || []).filter((entry) => entry.id !== item.id)
      }));
      if (editing === item.id) {
        setEditing(null);
        setDraft(emptyItemFor(config, section));
      }
      if (pendingPublication === item.id) setPendingPublication(null);
      setMessage(publicRemoved
        ? 'Contenido eliminado del JSON público y de Firebase.'
        : 'Contenido eliminado de Firebase.');
    } catch (error) {
      console.error('No se pudo completar la eliminación.', error);
      setMessage(publicRemoved
        ? `Eliminado del JSON público, pero la eliminación de Firebase falló: ${error.message}. Vuelve a intentar eliminarlo.`
        : `No se confirmó la eliminación pública: ${error.message}. Revisa GitHub antes de volver a intentarlo; Firebase conserva el registro.`);
      try {
        const freshItems = await loadSectionItems(section);
        setCollections((current) => ({ ...current, [section]: freshItems }));
      } catch (reloadError) {
        console.error('No se pudo recargar el contenido tras el error.', reloadError);
      }
    } finally {
      setDeletingId(null);
    }
  }

  const connectedMessage = firebaseReady
    ? jsonSections.has(section)
      ? `Firebase configurado. Al guardar ${section === 'stories' ? 'una historia' : section === 'videos' ? 'un video' : 'un plan'} se intentará publicar su JSON en GitHub; revisa el resultado del guardado.`
      : 'Firebase conectado.'
    : 'Firebase no configurado: no se pueden guardar ni consultar registros hasta configurar Vercel.';

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
            <button className="btn muted" type="button" onClick={compareSources}
              disabled={!loaded || auditing || syncing || saving || Boolean(deletingId)}>
              {auditing ? 'Comparando...' : 'Comparar Firebase / JSON'}
            </button>
          )}
          {jsonSections.has(section) && (
            <button
              className="btn muted"
              type="button"
              onClick={syncJson}
              disabled={syncing || loading || !loaded || saving || Boolean(deletingId)}
            >
              {syncing ? 'Sincronizando...' : 'Sincronizar JSON'}
            </button>
          )}
          {pendingPublication && jsonSections.has(section) && (
            <button className="btn muted" type="button" onClick={retryPublication}
              disabled={syncing || loading || saving || Boolean(deletingId)}>
              Reintentar publicación
            </button>
          )}
          <button className="btn primary" type="button" onClick={startCreate} disabled={saving || syncing || !loaded || Boolean(deletingId)}>Nuevo</button>
        </div>
      </div>

      <p className={`admin-message ${firebaseReady ? 'success' : 'warning'}`}>{connectedMessage}</p>
      {!loaded && !loading && <p className="admin-message warning">La carga de datos no se completó. Actualiza la página antes de editar o publicar.</p>}

      <div className="mini-stats">
        <span>Total: <strong>{stats.total}</strong></span>
        <span>Publicados: <strong>{stats.published}</strong></span>
        <span>Borradores: <strong>{stats.drafts}</strong></span>
      </div>

      {message && <p className="admin-message">{message}</p>}
      {audit && (
        <section className="admin-panel" aria-live="polite">
          <h3>Comparación Firebase / JSON GitHub</h3>
          <p>{audit.totals}</p>
          <p>Solo en GitHub: {audit.orphaned.length} · Desactualizados o faltantes: {audit.pending.length} · Traducciones faltantes: {audit.missingTranslations.length}</p>
          {audit.orphaned.map((item) => (
            <p key={item.id}><strong>{getPrimaryTitle(item)}</strong> — solo GitHub{' '}
              <button type="button" onClick={() => removeOrphan(item)} disabled={syncing || saving || Boolean(deletingId)}>Retirar JSON</button>
            </p>
          ))}
          {audit.pending.map((item) => (
            <p key={item.id}><strong>{getPrimaryTitle(item)}</strong> — diferencia detectada{' '}
              <button type="button" onClick={() => republishItem(item)} disabled={syncing || saving || Boolean(deletingId)}>Sincronizar</button>
            </p>
          ))}
          {audit.missingTranslations.map((item) => (
            <p key={item.id + item.language}>Falta traducción {item.language.toUpperCase()}: {getPrimaryTitle(item)}</p>
          ))}
          <p>Los registros no se eliminan automáticamente. Repite la comparación después de cada corrección.</p>
        </section>
      )}

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

      {editing && section === 'stories' && (
        <StoryLanguageEditor
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

      {editing && section !== 'plans' && section !== 'stories' && (
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
                    <button type="button" onClick={() => startEdit(item)} disabled={Boolean(deletingId) || saving || syncing || !loaded}>Editar</button>
                    {jsonSections.has(section) && (
                      <button type="button" onClick={() => republishItem(item)}
                        disabled={Boolean(deletingId) || saving || syncing || loading || !loaded}>
                        Sincronizar
                      </button>
                    )}
                    <button
                      type="button"
                      className="danger-link"
                      onClick={() => remove(item)}
                      disabled={Boolean(deletingId) || saving || syncing || !loaded}
                    >
                      {deletingId === item.id ? 'Eliminando...' : 'Eliminar'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && loaded && !loading && <tr><td colSpan="4" className="empty-state">No hay contenido todavía.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
