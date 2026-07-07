const TRANSLATOR_ENDPOINT = process.env.MS_TRANSLATOR_ENDPOINT || 'https://api.cognitive.microsofttranslator.com';

function send(res, status, payload) {
  res.status(status).json(payload);
}

function cleanString(value) {
  return String(value || '').trim();
}

function createSlug(text) {
  return cleanString(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function collectPlanTexts(plan) {
  const entries = [];

  function add(path, value) {
    const text = cleanString(value);
    if (text) entries.push({ path, text });
  }

  add(['title'], plan.title);
  add(['category'], plan.category);
  add(['duration'], plan.duration);
  add(['time'], plan.time);
  add(['shortDescription'], plan.shortDescription);

  (Array.isArray(plan.learning) ? plan.learning : []).forEach((item, index) => add(['learning', index], item));
  (Array.isArray(plan.gains) ? plan.gains : []).forEach((item, index) => add(['gains', index], item));

  (Array.isArray(plan.days) ? plan.days : []).forEach((day, index) => {
    add(['days', index, 'title'], day.title);
    add(['days', index, 'subtitle'], day.subtitle);
    add(['days', index, 'text'], day.text);
    add(['days', index, 'prayer'], day.prayer);
    add(['days', index, 'action'], day.action);
  });

  return entries;
}

function clonePlanForTranslation(plan) {
  return {
    title: cleanString(plan.title),
    slug: cleanString(plan.slug),
    category: cleanString(plan.category),
    duration: cleanString(plan.duration),
    time: cleanString(plan.time),
    coverImage: cleanString(plan.coverImage),
    shortDescription: cleanString(plan.shortDescription),
    learning: Array.isArray(plan.learning) ? [...plan.learning] : [],
    gains: Array.isArray(plan.gains) ? [...plan.gains] : [],
    days: Array.isArray(plan.days) ? plan.days.map((day) => ({
      title: cleanString(day.title),
      subtitle: cleanString(day.subtitle),
      verse: cleanString(day.verse),
      text: cleanString(day.text),
      prayer: cleanString(day.prayer),
      action: cleanString(day.action)
    })) : []
  };
}

function setPath(target, path, value) {
  let cursor = target;
  for (let index = 0; index < path.length - 1; index += 1) {
    cursor = cursor[path[index]];
  }
  cursor[path[path.length - 1]] = value;
}

async function translateTexts(texts, to) {
  const key = process.env.MS_TRANSLATOR_KEY;
  const region = process.env.MS_TRANSLATOR_REGION;

  if (!key) throw new Error('Falta configurar MS_TRANSLATOR_KEY en Vercel del admin.');
  if (!region) throw new Error('Falta configurar MS_TRANSLATOR_REGION en Vercel del admin.');
  if (!texts.length) return [];

  const response = await fetch(`${TRANSLATOR_ENDPOINT}/translate?api-version=3.0&from=es&to=${to}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Ocp-Apim-Subscription-Key': key,
      'Ocp-Apim-Subscription-Region': region
    },
    body: JSON.stringify(texts.map((text) => ({ text })))
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Microsoft Translator error ${response.status}: ${detail}`);
  }

  const payload = await response.json();
  return payload.map((item) => item?.translations?.[0]?.text || '');
}

async function translatePlan(plan, language) {
  const entries = collectPlanTexts(plan);
  const translatedTexts = await translateTexts(entries.map((entry) => entry.text), language);
  const translated = clonePlanForTranslation(plan);

  entries.forEach((entry, index) => setPath(translated, entry.path, translatedTexts[index]));
  translated.slug = createSlug(translated.title || plan.title);
  return translated;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    send(res, 405, { error: 'Método no permitido.' });
    return;
  }

  try {
    const plan = req.body?.plan || {};
    const targets = Array.isArray(req.body?.targets) && req.body.targets.length ? req.body.targets : ['en', 'pt', 'fr'];
    const translations = {};

    for (const language of targets) {
      if (!['en', 'pt', 'fr'].includes(language)) continue;
      translations[language] = await translatePlan(plan, language);
    }

    send(res, 200, { ok: true, translations });
  } catch (error) {
    send(res, 500, { error: error.message || 'No se pudo traducir el plan.' });
  }
}
