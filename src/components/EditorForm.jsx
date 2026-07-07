function createSlug(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function createEmptyChapter() {
  return { title: '', content: '' };
}

function createEmptyPlanDay() {
  return { title: '', subtitle: '', verse: '', text: '', internalize: '', prayer: '', action: '' };
}

function normalizeList(value) {
  return Array.isArray(value) && value.length ? value : [''];
}

function normalizePlanDays(value) {
  return Array.isArray(value) && value.length ? value : [createEmptyPlanDay()];
}

export default function EditorForm({ config, value, onChange, onSubmit, onCancel, mode, saving = false }) {
  function updateField(name, fieldValue) {
    onChange({ ...value, [name]: fieldValue });
  }

  function generateSlug() {
    const slug = createSlug(value.title || value.theme || value.reference || '');
    if (slug) onChange({ ...value, slug });
  }

  function updateChapter(index, field, fieldValue) {
    const chapters = Array.isArray(value.chapters) && value.chapters.length ? value.chapters : [createEmptyChapter()];
    onChange({ ...value, chapters: chapters.map((chapter, i) => i === index ? { ...chapter, [field]: fieldValue } : chapter) });
  }

  function addChapter() {
    const chapters = Array.isArray(value.chapters) ? value.chapters : [];
    onChange({ ...value, chapters: [...chapters, createEmptyChapter()] });
  }

  function removeChapter(index) {
    const chapters = Array.isArray(value.chapters) ? value.chapters : [];
    const next = chapters.filter((_, i) => i !== index);
    onChange({ ...value, chapters: next.length ? next : [createEmptyChapter()] });
  }

  function updateListItem(name, index, itemValue) {
    const list = normalizeList(value[name]);
    onChange({ ...value, [name]: list.map((item, i) => i === index ? itemValue : item) });
  }

  function addListItem(name) {
    onChange({ ...value, [name]: [...normalizeList(value[name]), ''] });
  }

  function removeListItem(name, index) {
    const next = normalizeList(value[name]).filter((_, i) => i !== index);
    onChange({ ...value, [name]: next.length ? next : [''] });
  }

  function updatePlanDay(index, field, fieldValue) {
    const days = normalizePlanDays(value.days);
    onChange({ ...value, days: days.map((day, i) => i === index ? { ...day, [field]: fieldValue } : day) });
  }

  function addPlanDay() {
    onChange({ ...value, days: [...normalizePlanDays(value.days), createEmptyPlanDay()] });
  }

  function removePlanDay(index) {
    const next = normalizePlanDays(value.days).filter((_, i) => i !== index);
    onChange({ ...value, days: next.length ? next : [createEmptyPlanDay()] });
  }

  return (
    <form className="editor-form" onSubmit={onSubmit}>
      <div className="form-header"><div><span>{mode === 'edit' ? 'Editar' : 'Nuevo contenido'}</span><h2>{config.singular}</h2></div></div>

      <div className="form-grid">
        {config.fields.map((field) => {
          if (field.type === 'chapters') {
            const chapters = Array.isArray(value.chapters) && value.chapters.length ? value.chapters : [createEmptyChapter()];
            return <div key={field.name} className="chapter-editor full">
              <div className="chapter-editor-head"><div><span>{field.label}</span><p>Crea capítulos independientes.</p></div><button className="btn muted" type="button" onClick={addChapter}>Agregar capítulo</button></div>
              <div className="chapter-list">{chapters.map((chapter, index) => <section className="chapter-card" key={index}>
                <div className="chapter-card-head"><strong>Capítulo {index + 1}</strong><button type="button" className="danger-link" onClick={() => removeChapter(index)}>Eliminar</button></div>
                <label><span>Título del capítulo opcional</span><input value={chapter.title || ''} onChange={(event) => updateChapter(index, 'title', event.target.value)} /></label>
                <label className="full"><span>Contenido del capítulo</span><textarea rows={12} value={chapter.content || ''} required onChange={(event) => updateChapter(index, 'content', event.target.value)} /></label>
              </section>)}</div>
            </div>;
          }

          if (field.type === 'list') {
            const list = normalizeList(value[field.name]);
            return <div key={field.name} className="chapter-editor full">
              <div className="chapter-editor-head"><div><span>{field.label}</span><p>Agrega una línea por cada punto.</p></div><button className="btn muted" type="button" onClick={() => addListItem(field.name)}>Agregar punto</button></div>
              <div className="chapter-list">{list.map((item, index) => <section className="chapter-card compact-card" key={`${field.name}-${index}`}>
                <div className="chapter-card-head"><strong>Punto {index + 1}</strong><button type="button" className="danger-link" onClick={() => removeListItem(field.name, index)}>Eliminar</button></div>
                <input value={item || ''} onChange={(event) => updateListItem(field.name, index, event.target.value)} placeholder={field.itemPlaceholder || 'Escribe un punto'} />
              </section>)}</div>
            </div>;
          }

          if (field.type === 'planDays') {
            const days = normalizePlanDays(value.days);
            return <div key={field.name} className="chapter-editor full">
              <div className="chapter-editor-head"><div><span>{field.label}</span><p>Crea cada día con referencia bíblica, reflexión, Interioriza, oración y acción práctica.</p></div><button className="btn muted" type="button" onClick={addPlanDay}>Agregar día</button></div>
              <div className="chapter-list">{days.map((day, index) => <section className="chapter-card" key={index}>
                <div className="chapter-card-head"><strong>Día {index + 1}</strong><button type="button" className="danger-link" onClick={() => removePlanDay(index)}>Eliminar</button></div>
                <div className="nested-grid">
                  <label><span>Título del día</span><input value={day.title || ''} required onChange={(event) => updatePlanDay(index, 'title', event.target.value)} placeholder="Ejemplo: Dios está contigo" /></label>
                  <label><span>Subtítulo</span><input value={day.subtitle || ''} onChange={(event) => updatePlanDay(index, 'subtitle', event.target.value)} /></label>
                  <label className="full"><span>Referencia bíblica</span><input value={day.verse || ''} required onChange={(event) => updatePlanDay(index, 'verse', event.target.value)} placeholder="Ejemplo: Isaías 41:10" /></label>
                  <label className="full"><span>Reflexión</span><textarea rows={8} value={day.text || ''} required onChange={(event) => updatePlanDay(index, 'text', event.target.value)} /></label>
                  <label className="full"><span>Interioriza</span><textarea rows={3} value={day.internalize || ''} required onChange={(event) => updatePlanDay(index, 'internalize', event.target.value)} placeholder="Ejemplo: ¿Qué verdad de esta reflexión necesitas guardar hoy en tu corazón?" /></label>
                  <label className="full"><span>Oración del día</span><textarea rows={4} value={day.prayer || ''} required onChange={(event) => updatePlanDay(index, 'prayer', event.target.value)} /></label>
                  <label className="full"><span>Acción práctica</span><textarea rows={3} value={day.action || ''} required onChange={(event) => updatePlanDay(index, 'action', event.target.value)} /></label>
                </div>
              </section>)}</div>
            </div>;
          }

          const commonProps = { id: field.name, value: value[field.name] || '', required: Boolean(field.required), placeholder: field.placeholder || '', onChange: (event) => updateField(field.name, event.target.value) };

          return <label key={field.name} className={field.type === 'editor' || field.type === 'textarea' ? 'full' : ''}>
            <span>{field.label}</span>
            {field.type === 'status' ? <select {...commonProps}><option value="draft">Borrador</option><option value="published">Publicado</option><option value="archived">Archivado</option></select>
              : field.type === 'select' ? <select {...commonProps}><option value="">Selecciona una opción</option>{(field.options || []).map((option) => <option key={option} value={option}>{option}</option>)}</select>
              : field.name === 'slug' ? <div className="slug-row"><input type="text" {...commonProps} /><button className="btn muted" type="button" onClick={generateSlug}>Generar</button></div>
              : field.type === 'textarea' || field.type === 'editor' ? <textarea rows={field.type === 'editor' ? 10 : 4} {...commonProps} />
              : <input type={field.type || 'text'} {...commonProps} />}
          </label>;
        })}
      </div>

      <div className="form-actions"><button type="button" className="btn muted" onClick={onCancel} disabled={saving}>Cancelar</button><button type="submit" className="btn primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button></div>
    </form>
  );
}
