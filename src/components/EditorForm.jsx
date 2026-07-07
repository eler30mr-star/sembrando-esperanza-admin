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
  return {
    title: '',
    content: ''
  };
}

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
    if (!slug) return;
    onChange({ ...value, slug });
  }

  function updateChapter(index, field, fieldValue) {
    const chapters = Array.isArray(value.chapters) && value.chapters.length
      ? value.chapters
      : [createEmptyChapter()];

    const nextChapters = chapters.map((chapter, chapterIndex) => (
      chapterIndex === index ? { ...chapter, [field]: fieldValue } : chapter
    ));

    onChange({ ...value, chapters: nextChapters });
  }

  function addChapter() {
    const chapters = Array.isArray(value.chapters) ? value.chapters : [];
    onChange({ ...value, chapters: [...chapters, createEmptyChapter()] });
  }

  function removeChapter(index) {
    const chapters = Array.isArray(value.chapters) ? value.chapters : [];
    const nextChapters = chapters.filter((_, chapterIndex) => chapterIndex !== index);
    onChange({ ...value, chapters: nextChapters.length ? nextChapters : [createEmptyChapter()] });
  }

  function updateListItem(name, index, itemValue) {
    const list = normalizeList(value[name]);
    const nextList = list.map((item, itemIndex) => itemIndex === index ? itemValue : item);
    onChange({ ...value, [name]: nextList });
  }

  function addListItem(name) {
    onChange({ ...value, [name]: [...normalizeList(value[name]), ''] });
  }

  function removeListItem(name, index) {
    const nextList = normalizeList(value[name]).filter((_, itemIndex) => itemIndex !== index);
    onChange({ ...value, [name]: nextList.length ? nextList : [''] });
  }

  function updatePlanDay(index, field, fieldValue) {
    const days = normalizePlanDays(value.days);
    const nextDays = days.map((day, dayIndex) => (
      dayIndex === index ? { ...day, [field]: fieldValue } : day
    ));
    onChange({ ...value, days: nextDays });
  }

  function addPlanDay() {
    onChange({ ...value, days: [...normalizePlanDays(value.days), createEmptyPlanDay()] });
  }

  function removePlanDay(index) {
    const nextDays = normalizePlanDays(value.days).filter((_, dayIndex) => dayIndex !== index);
    onChange({ ...value, days: nextDays.length ? nextDays : [createEmptyPlanDay()] });
  }

  const storyChapters = Array.isArray(value.chapters) && value.chapters.length
    ? value.chapters
    : [createEmptyChapter()];

  return (
    <form className="editor-form" onSubmit={onSubmit}>
      <div className="form-header">
        <div>
          <span>{mode === 'edit' ? 'Editar' : 'Nuevo contenido'}</span>
          <h2>{config.singular}</h2>
        </div>
      </div>

      <div className="form-grid">
        {config.fields.map((field) => {
          if (field.type === 'chapters') {
            return (
              <div key={field.name} className="chapter-editor full">
                <div className="chapter-editor-head">
                  <div>
                    <span>{field.label}</span>
                    <p>Crea capítulos independientes. El título del capítulo es opcional; si lo dejas vacío, la web usará Capítulo 1, Capítulo 2, etc.</p>
                  </div>
                  <button className="btn muted" type="button" onClick={addChapter}>Agregar capítulo</button>
                </div>

                <div className="chapter-list">
                  {storyChapters.map((chapter, index) => (
                    <section className="chapter-card" key={index}>
                      <div className="chapter-card-head">
                        <strong>Capítulo {index + 1}</strong>
                        <button type="button" className="danger-link" onClick={() => removeChapter(index)}>Eliminar</button>
                      </div>

                      <label>
                        <span>Título del capítulo opcional</span>
                        <input
                          value={chapter.title || ''}
                          onChange={(event) => updateChapter(index, 'title', event.target.value)}
                          placeholder="Ejemplo: El silencio no es abandono"
                        />
                      </label>

                      <label className="full">
                        <span>Contenido del capítulo</span>
                        <textarea
                          rows={12}
                          value={chapter.content || ''}
                          required
                          onChange={(event) => updateChapter(index, 'content', event.target.value)}
                          placeholder="Escribe aquí todo el contenido del capítulo. Si tiene miles de caracteres, la web lo dividirá automáticamente en páginas."
                        />
                      </label>
                    </section>
                  ))}
                </div>
              </div>
            );
          }

          if (field.type === 'list') {
            const list = normalizeList(value[field.name]);
            return (
              <div key={field.name} className="chapter-editor full">
                <div className="chapter-editor-head">
                  <div>
                    <span>{field.label}</span>
                    <p>Agrega una línea por cada punto que aparecerá en la página pública.</p>
                  </div>
                  <button className="btn muted" type="button" onClick={() => addListItem(field.name)}>Agregar punto</button>
                </div>
                <div className="chapter-list">
                  {list.map((item, index) => (
                    <section className="chapter-card compact-card" key={`${field.name}-${index}`}>
                      <div className="chapter-card-head">
                        <strong>Punto {index + 1}</strong>
                        <button type="button" className="danger-link" onClick={() => removeListItem(field.name, index)}>Eliminar</button>
                      </div>
                      <input
                        value={item || ''}
                        onChange={(event) => updateListItem(field.name, index, event.target.value)}
                        placeholder={field.itemPlaceholder || 'Escribe un punto'}
                      />
                    </section>
                  ))}
                </div>
              </div>
            );
          }

          if (field.type === 'planDays') {
            const days = normalizePlanDays(value.days);
            return (
              <div key={field.name} className="chapter-editor full">
                <div className="chapter-editor-head">
                  <div>
                    <span>{field.label}</span>
                    <p>Crea cada día del plan con título, subtítulo, versículo, reflexión, oración y acción práctica.</p>
                  </div>
                  <button className="btn muted" type="button" onClick={addPlanDay}>Agregar día</button>
                </div>
                <div className="chapter-list">
                  {days.map((day, index) => (
                    <section className="chapter-card" key={index}>
                      <div className="chapter-card-head">
                        <strong>Día {index + 1}</strong>
                        <button type="button" className="danger-link" onClick={() => removePlanDay(index)}>Eliminar</button>
                      </div>

                      <div className="nested-grid">
                        <label>
                          <span>Título del día</span>
                          <input value={day.title || ''} required onChange={(event) => updatePlanDay(index, 'title', event.target.value)} placeholder="Ejemplo: Dios está contigo" />
                        </label>
                        <label>
                          <span>Subtítulo</span>
                          <input value={day.subtitle || ''} onChange={(event) => updatePlanDay(index, 'subtitle', event.target.value)} placeholder="Ejemplo: Descubre cómo Dios te acompaña" />
                        </label>
                        <label>
                          <span>Referencia bíblica</span>
                          <input value={day.verse || ''} required onChange={(event) => updatePlanDay(index, 'verse', event.target.value)} placeholder="Ejemplo: Isaías 41:10" />
                        </label>
                        <label>
                          <span>Texto del versículo</span>
                          <input value={day.verseText || ''} required onChange={(event) => updatePlanDay(index, 'verseText', event.target.value)} placeholder="Texto bíblico del día" />
                        </label>
                        <label className="full">
                          <span>Reflexión</span>
                          <textarea rows={8} value={day.text || ''} required onChange={(event) => updatePlanDay(index, 'text', event.target.value)} placeholder="Escribe la reflexión del día. Puedes separar párrafos con líneas en blanco." />
                        </label>
                        <label className="full">
                          <span>Oración del día</span>
                          <textarea rows={4} value={day.prayer || ''} required onChange={(event) => updatePlanDay(index, 'prayer', event.target.value)} placeholder="Oración breve para cerrar el día del plan" />
                        </label>
                        <label className="full">
                          <span>Acción práctica</span>
                          <textarea rows={3} value={day.action || ''} required onChange={(event) => updatePlanDay(index, 'action', event.target.value)} placeholder="Ejemplo: Ora cinco minutos por una situación específica" />
                        </label>
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            );
          }

          const commonProps = {
            id: field.name,
            value: value[field.name] || '',
            required: Boolean(field.required),
            placeholder: field.placeholder || '',
            onChange: (event) => updateField(field.name, event.target.value)
          };

          return (
            <label key={field.name} className={field.type === 'editor' || field.type === 'textarea' ? 'full' : ''}>
              <span>{field.label}</span>
              {field.type === 'status' ? (
                <select {...commonProps}>
                  <option value="draft">Borrador</option>
                  <option value="published">Publicado</option>
                  <option value="archived">Archivado</option>
                </select>
              ) : field.type === 'select' ? (
                <select {...commonProps}>
                  <option value="">Selecciona una opción</option>
                  {(field.options || []).map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              ) : field.name === 'slug' ? (
                <div className="slug-row">
                  <input type="text" {...commonProps} />
                  <button className="btn muted" type="button" onClick={generateSlug}>Generar</button>
                </div>
              ) : field.type === 'textarea' || field.type === 'editor' ? (
                <textarea rows={field.type === 'editor' ? 10 : 4} {...commonProps} />
              ) : (
                <input type={field.type || 'text'} {...commonProps} />
              )}
            </label>
          );
        })}
      </div>

      <div className="form-actions">
        <button type="button" className="btn muted" onClick={onCancel} disabled={saving}>Cancelar</button>
        <button type="submit" className="btn primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
      </div>
    </form>
  );
}