export default function EditorForm({ config, value, onChange, onSubmit, onCancel, mode }) {
  function updateField(name, fieldValue) {
    onChange({ ...value, [name]: fieldValue });
  }

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
        <button type="button" className="btn muted" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn primary">Guardar</button>
      </div>
    </form>
  );
}
