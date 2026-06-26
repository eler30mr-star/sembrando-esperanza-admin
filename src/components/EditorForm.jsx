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

function createEmptyChapter(index) {
  return {
    title: '',
    content: ''
  };
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
      : [createEmptyChapter(0)];

    const nextChapters = chapters.map((chapter, chapterIndex) => (
      chapterIndex === index ? { ...chapter, [field]: fieldValue } : chapter
    ));

    onChange({ ...value, chapters: nextChapters });
  }

  function addChapter() {
    const chapters = Array.isArray(value.chapters) ? value.chapters : [];
    onChange({ ...value, chapters: [...chapters, createEmptyChapter(chapters.length)] });
  }

  function removeChapter(index) {
    const chapters = Array.isArray(value.chapters) ? value.chapters : [];
    const nextChapters = chapters.filter((_, chapterIndex) => chapterIndex !== index);
    onChange({ ...value, chapters: nextChapters.length ? nextChapters : [createEmptyChapter(0)] });
  }

  const storyChapters = Array.isArray(value.chapters) && value.chapters.length
    ? value.chapters
    : [createEmptyChapter(0)];

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
                          placeholder={`Ejemplo: El silencio no es abandono`}
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

          const commonProps = {
            id: field.name,
            value: value[field.name] || '',
            required: Boolean(field.required),
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
