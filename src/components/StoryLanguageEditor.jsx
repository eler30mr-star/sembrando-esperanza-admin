import { useRef, useState } from 'react';
import EditorForm from './EditorForm.jsx';

const languages = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'Inglés' },
  { code: 'pt', label: 'Portugués' },
  { code: 'fr', label: 'Francés' }
];

function createEmptyChapter() {
  return { title: '', content: '' };
}

function emptyLanguageStory(base = {}) {
  return {
    title: '',
    slug: '',
    category: '',
    coverImage: base.coverImage || '',
    shortDescription: '',
    chapters: [createEmptyChapter()],
    status: base.status || 'draft'
  };
}

function getValue(story, lang) {
  if (lang === 'es') return story;
  return story.translations && story.translations[lang]
    ? story.translations[lang]
    : emptyLanguageStory(story);
}

function setValue(story, lang, nextValue) {
  if (lang === 'es') return { ...story, ...nextValue };
  return {
    ...story,
    translations: {
      ...(story.translations || {}),
      [lang]: nextValue
    }
  };
}

function normalizeChapters(value) {
  if (!Array.isArray(value)) return [];
  return value.map((chapter) => ({
    title: String(chapter?.title || '').trim(),
    content: String(chapter?.content || chapter?.text || '').trim()
  }));
}

function normalizeUploadedStory(data) {
  const raw = Array.isArray(data) ? data[0] : (data?.story || data);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('El JSON no contiene una historia válida.');
  }

  const chapters = normalizeChapters(raw.chapters);
  const story = {
    title: String(raw.title || '').trim(),
    slug: String(raw.slug || '').trim(),
    category: String(raw.category || '').trim(),
    coverImage: String(raw.coverImage || raw.cover || raw.image || '').trim(),
    shortDescription: String(raw.shortDescription || raw.description || '').trim(),
    chapters: chapters.length ? chapters : [createEmptyChapter()]
  };

  if (!story.title) throw new Error('El JSON de la historia necesita "title".');
  if (!story.slug) throw new Error('El JSON de la historia necesita "slug".');
  if (!story.category) throw new Error('El JSON de la historia necesita "category".');
  if (!chapters.some((chapter) => chapter.content)) {
    throw new Error('El JSON de la historia necesita al menos un capítulo con "content".');
  }

  return story;
}

export default function StoryLanguageEditor(props) {
  const { config, draft, setDraft, onSubmit, onCancel, mode, saving, setMessage } = props;
  const [lang, setLang] = useState('es');
  const fileInputRef = useRef(null);
  const currentStatus = draft.status || 'draft';
  const currentLanguage = languages.find((item) => item.code === lang);

  async function loadJsonFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const nextStory = normalizeUploadedStory(json);
      setDraft((current) => setValue(current, lang, nextStory));
      if (setMessage) {
        setMessage(`JSON de historia cargado en ${currentLanguage?.label || lang}. Revisa los campos y guarda.`);
      }
    } catch (error) {
      if (setMessage) setMessage(error.message || 'No se pudo leer el JSON de la historia.');
    }
  }

  return (
    <>
      <div className="language-panel">
        <div className="language-tabs">
          {languages.map((item) => (
            <button
              key={item.code}
              type="button"
              className={lang === item.code ? 'active' : ''}
              onClick={() => setLang(item.code)}
              disabled={saving}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div
          className="json-upload-actions"
          style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', gap: 12, flexWrap: 'wrap' }}
        >
          <label style={{ minWidth: 180 }}>
            <span>Estado</span>
            <select
              value={currentStatus}
              onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}
              disabled={saving}
            >
              <option value="draft">Borrador</option>
              <option value="published">Publicado</option>
            </select>
          </label>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={loadJsonFile}
          />
          <button
            className="btn muted"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={saving}
          >
            Subir JSON del idioma
          </button>
          <button className="btn muted" type="button" onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
          <button className="btn primary" type="submit" form="story-editor-form" disabled={saving}>
            {saving ? 'Guardando...' : currentStatus === 'published' ? 'Guardar y publicar' : 'Guardar borrador'}
          </button>
        </div>
      </div>

      <p className="admin-message">
        JSON esperado: title, slug, category, coverImage, shortDescription y chapters[] con title/content.
        El archivo se carga únicamente en la pestaña de idioma seleccionada.
      </p>

      <EditorForm
        config={config}
        value={getValue(draft, lang)}
        onChange={(nextValue) => setDraft((current) => setValue(current, lang, nextValue))}
        onSubmit={onSubmit}
        onCancel={onCancel}
        mode={mode}
        saving={saving}
        hideStatus
        hideActions
        formId="story-editor-form"
      />
    </>
  );
}
