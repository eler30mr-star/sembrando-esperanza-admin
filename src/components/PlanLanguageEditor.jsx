import { useRef, useState } from 'react';
import EditorForm from './EditorForm.jsx';

const languages = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'Inglés' },
  { code: 'pt', label: 'Portugués' },
  { code: 'fr', label: 'Francés' }
];

function emptyLanguagePlan(base = {}) {
  return {
    title: '',
    slug: '',
    category: '',
    duration: '',
    time: '',
    coverImage: base.coverImage || '',
    shortDescription: '',
    learning: [''],
    gains: [''],
    status: base.status || 'draft',
    days: []
  };
}

function getValue(plan, lang) {
  if (lang === 'es') return plan;
  return plan.translations && plan.translations[lang] ? plan.translations[lang] : emptyLanguagePlan(plan);
}

function setValue(plan, lang, nextValue) {
  if (lang === 'es') return { ...plan, ...nextValue };
  return {
    ...plan,
    translations: {
      ...(plan.translations || {}),
      [lang]: nextValue
    }
  };
}

function normalizeReferences(day) {
  if (Array.isArray(day?.verses) && day.verses.length) {
    return day.verses.map((item) => String(item || '').trim()).filter(Boolean);
  }

  if (Array.isArray(day?.references) && day.references.length) {
    return day.references.map((item) => String(item || '').trim()).filter(Boolean);
  }

  const verse = String(day?.verse || '').trim();
  return verse ? [verse] : [];
}

function normalizeUploadedPlan(data) {
  const plan = Array.isArray(data) ? data[0] : data;
  if (!plan || typeof plan !== 'object') throw new Error('El JSON no contiene un plan válido.');
  return {
    title: plan.title || '',
    slug: plan.slug || '',
    category: plan.category || '',
    duration: plan.duration || '',
    time: plan.time || '',
    coverImage: plan.coverImage || plan.image || '',
    shortDescription: plan.shortDescription || plan.description || '',
    learning: Array.isArray(plan.learning) ? plan.learning : [''],
    gains: Array.isArray(plan.gains) ? plan.gains : [''],
    days: Array.isArray(plan.days) ? plan.days.map((day) => {
      const verses = normalizeReferences(day);
      return {
        title: day.title || '',
        verse: verses.join('; '),
        verses: verses.length ? verses : [''],
        text: day.text || '',
        internalize: day.internalize || day.question || day.meditation || '',
        prayer: day.prayer || '',
        action: day.action || ''
      };
    }) : []
  };
}

export default function PlanLanguageEditor(props) {
  const { config, draft, setDraft, onSubmit, onCancel, mode, saving, setMessage } = props;
  const [lang, setLang] = useState('es');
  const fileInputRef = useRef(null);

  async function loadJsonFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const nextPlan = normalizeUploadedPlan(json);
      setDraft((current) => setValue(current, lang, nextPlan));
      if (setMessage) setMessage(`JSON cargado en ${languages.find((item) => item.code === lang)?.label || lang}. Revisa y guarda.`);
    } catch (error) {
      if (setMessage) setMessage(error.message || 'No se pudo leer el JSON.');
    }
  }

  return (
    <>
      <div className="language-panel">
        <div className="language-tabs">
          {languages.map((item) => (
            <button key={item.code} type="button" className={lang === item.code ? 'active' : ''} onClick={() => setLang(item.code)}>
              {item.label}
            </button>
          ))}
        </div>
        <div className="json-upload-actions">
          <input ref={fileInputRef} type="file" accept="application/json,.json" hidden onChange={loadJsonFile} />
          <button className="btn muted" type="button" onClick={() => fileInputRef.current?.click()} disabled={saving}>
            Subir JSON del idioma
          </button>
        </div>
      </div>
      <EditorForm
        config={config}
        value={getValue(draft, lang)}
        onChange={(nextValue) => setDraft((current) => setValue(current, lang, nextValue))}
        onSubmit={onSubmit}
        onCancel={onCancel}
        mode={mode}
        saving={saving}
      />
    </>
  );
}
