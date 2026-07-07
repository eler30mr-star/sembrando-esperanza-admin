import { useState } from 'react';
import EditorForm from './EditorForm.jsx';

const languages = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'Inglés' },
  { code: 'pt', label: 'Portugués' }
];

function getValue(plan, lang) {
  if (lang === 'es') return plan;
  return { ...plan, ...(plan.translations && plan.translations[lang] ? plan.translations[lang] : {}) };
}

function setValue(plan, lang, nextValue) {
  if (lang === 'es') return nextValue;
  return {
    ...plan,
    translations: {
      ...(plan.translations || {}),
      [lang]: nextValue
    }
  };
}

export default function PlanLanguageEditor(props) {
  const { config, draft, setDraft, onSubmit, onCancel, mode, saving, setMessage } = props;
  const [lang, setLang] = useState('es');
  const [loading, setLoading] = useState(false);

  async function runTranslate() {
    setLoading(true);
    if (setMessage) setMessage('');
    try {
      const response = await fetch('/api/translate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: draft, targets: ['en', 'pt'] })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'No se pudo traducir el plan.');
      setDraft((current) => ({
        ...current,
        translations: {
          ...(current.translations || {}),
          ...(payload.translations || {})
        }
      }));
      if (setMessage) setMessage('Traducción creada. Revisa las pestañas antes de publicar.');
    } catch (error) {
      if (setMessage) setMessage(error.message || 'No se pudo traducir el plan.');
    } finally {
      setLoading(false);
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
        <button className="btn muted" type="button" onClick={runTranslate} disabled={loading || saving}>
          {loading ? 'Traduciendo...' : 'Traducir'}
        </button>
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
