const PUBLIC_REPO_FULL_NAME = process.env.PUBLIC_REPO_FULL_NAME || 'eler30mr-star/sembrando-esperanza';
const PUBLIC_REPO_BRANCH = process.env.PUBLIC_REPO_BRANCH || 'main';
const PUBLIC_DATA_DIR = process.env.PUBLIC_DATA_DIR || 'public/data';

const PLAN_CATEGORIES = [
  'Fe',
  'Oración',
  'Vida Espiritual',
  'Paz',
  'Sanidad Interior',
  'Amor',
  'Familia',
  'Propósito',
  'Jóvenes',
  'Gratitud'
];

const LEGACY_CATEGORY_MAP = {
  Ansiedad: 'Sanidad Interior',
  Esperanza: 'Paz',
  Perdón: 'Sanidad Interior',
  Lectura: 'Vida Espiritual',
  Meditación: 'Vida Espiritual',
  Estudio: 'Vida Espiritual',
  Reflexión: 'Vida Espiritual'
};

function send(res, status, payload) {
  res.status(status).json(payload);
}

function cleanString(value) {
  return String(value || '').trim();
}

function normalizeCategory(value) {
  const category = cleanString(value);
  if (PLAN_CATEGORIES.includes(category)) return category;
  return LEGACY_CATEGORY_MAP[category] || 'Fe';
}

function cleanStringList(value) {
  return Array.isArray(value)
    ? value.map(cleanString).filter(Boolean)
    : [];
}

function cleanReferences(day) {
  if (Array.isArray(day?.verses) && day.verses.length) return cleanStringList(day.verses);
  if (Array.isArray(day?.references) && day.references.length) return cleanStringList(day.references);
  const verse = cleanString(day?.verse);
  return verse ? [verse] : [];
}

function cleanDays(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((day, index) => {
      const verses = cleanReferences(day);
      return {
        dayNumber: Number(day?.dayNumber || index + 1),
        title: cleanString(day?.title),
        verse: verses[0] || '',
        verses,
        references: verses,
        text: cleanString(day?.text),
        internalize: cleanString(day?.internalize || day?.question || day?.meditation),
        prayer: cleanString(day?.prayer),
        action: cleanString(day?.action)
      };
    })
    .filter((day) => day.title || day.verse || day.text || day.internalize || day.prayer || day.action);
}

function formatDuration(plan, days) {
  const value = cleanString(plan.duration);
  if (!value) return `${days.length || 1} días`;
  return /día|dias|días|day|days|jour|jours|dia/i.test(value) ? value : `${value} días`;
}

function formatTime(plan) {
  const value = cleanString(plan.time);
  if (!value) return '5 min al día';
  return /min|hora|hour|heure|día|dias|días|day|days|jour/i.test(value) ? value : `${value} min al día`;
}

function mergeLanguagePlan(plan, language) {
  if (language === 'es') return plan;
  return { ...plan, ...(plan.translations?.[language] || {}) };
}

function createPlanDetail(plan, language) {
  const source = mergeLanguagePlan(plan, language);
  const days = cleanDays(source.days);
  return {
    id: cleanString(plan.id),
    title: cleanString(source.title),
    slug: cleanString(source.slug || plan.slug),
    category: normalizeCategory(source.category || plan.category),
    status: 'published',
    language,
    dayCount: days.length,
    duration: formatDuration(source, days),
    time: formatTime(source),
    coverImage: cleanString(source.coverImage || plan.coverImage),
    shortDescription: cleanString(source.shortDescription),
    learning: cleanStringList(source.learning),
    gains: cleanStringList(source.gains),
    days,
    updatedAtMs: Number(plan.updatedAtMs || Date.now())
  };
}

function createPlanSummary(plan, language) {
  return {
    id: plan.id,
    title: plan.title,
    slug: plan.slug,
    category: plan.category,
    status: plan.status,
    language,
    dayCount: plan.dayCount,
    duration: plan.duration,
    time: plan.time,
    coverImage: plan.coverImage,
    shortDescription: plan.shortDescription,
    detailPath: `/data/${language}/plans/${plan.slug}.json`,
    updatedAtMs: plan.updatedAtMs
  };
}

function isPublished(plan) {
  const status = cleanString(plan?.status).toLowerCase();
  return status === 'published' || status === 'publicado';
}

function getPlanIssues(plan) {
  const cleaned = createPlanDetail(plan, 'es');
  const issues = [];

  if (!isPublished(plan)) issues.push('no está publicado');
  if (!cleaned.title) issues.push('falta título');
  if (!cleaned.slug) issues.push('falta slug');
  if (!cleaned.days.length) issues.push('no tiene días');

  return { cleaned, issues };
}

async function githubRequest(path, options = {}) {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error('Falta configurar GITHUB_TOKEN en Vercel del admin.');
  }

  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {})
    }
  });

  if (!response.ok && response.status !== 404) {
    const text = await response.text();
    throw new Error(`GitHub error ${response.status}: ${text}`);
  }

  return response;
}

async function getExistingFile(path) {
  const [owner, repo] = PUBLIC_REPO_FULL_NAME.split('/');
  const response = await githubRequest(`/repos/${owner}/${repo}/contents/${path}?ref=${PUBLIC_REPO_BRANCH}`);

  if (response.status === 404) return null;

  const payload = await response.json();
  return payload || null;
}

async function getExistingFileSha(path) {
  const file = await getExistingFile(path);
  return file?.sha || null;
}

async function readJsonFile(path, fallback = []) {
  const file = await getExistingFile(path);
  if (!file?.content) return fallback;

  try {
    const text = Buffer.from(file.content.replace(/\n/g, ''), 'base64').toString('utf8');
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

async function putJsonFile(path, data, message) {
  const sha = await getExistingFileSha(path);
  const [owner, repo] = PUBLIC_REPO_FULL_NAME.split('/');
  const json = `${JSON.stringify(data, null, 2)}\n`;

  const body = {
    message,
    content: Buffer.from(json, 'utf8').toString('base64'),
    branch: PUBLIC_REPO_BRANCH
  };

  if (sha) body.sha = sha;

  const response = await githubRequest(`/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const result = await response.json();
  return result?.commit?.sha || null;
}

async function deleteJsonFile(path, message) {
  const sha = await getExistingFileSha(path);
  if (!sha) return null;

  const [owner, repo] = PUBLIC_REPO_FULL_NAME.split('/');
  const response = await githubRequest(`/repos/${owner}/${repo}/contents/${path}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sha, branch: PUBLIC_REPO_BRANCH })
  });

  const result = await response.json();
  return result?.commit?.sha || null;
}

function availableLanguages(plan) {
  const languages = ['es'];
  if (plan.translations?.en) languages.push('en');
  if (plan.translations?.pt) languages.push('pt');
  if (plan.translations?.fr) languages.push('fr');
  return languages;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    send(res, 405, { error: 'Método no permitido.' });
    return;
  }

  try {
    const plans = Array.isArray(req.body?.plans) ? req.body.plans : [];
    const checkedPlans = plans.map(getPlanIssues);
    const validPlans = plans.filter((plan, index) => checkedPlans[index].issues.length === 0);
    const grouped = { es: [], en: [], pt: [], fr: [] };
    const commits = [];
    const deleted = [];

    for (const plan of validPlans) {
      for (const language of availableLanguages(plan)) {
        const detail = createPlanDetail(plan, language);
        if (!detail.title || !detail.slug || !detail.days.length) continue;
        grouped[language].push(detail);

        const detailPath = `${PUBLIC_DATA_DIR}/${language}/plans/${detail.slug}.json`;
        const commit = await putJsonFile(
          detailPath,
          detail,
          `Publish ${language} plan JSON: ${detail.slug}`
        );
        commits.push({ path: detailPath, commit });
      }
    }

    for (const language of Object.keys(grouped)) {
      const indexPath = `${PUBLIC_DATA_DIR}/${language}/plans.json`;
      const previousIndex = await readJsonFile(indexPath, []);
      const nextSummaries = grouped[language].map((plan) => createPlanSummary(plan, language));
      const nextSlugs = new Set(nextSummaries.map((plan) => plan.slug));

      for (const previousPlan of Array.isArray(previousIndex) ? previousIndex : []) {
        const previousSlug = cleanString(previousPlan?.slug);
        if (!previousSlug || nextSlugs.has(previousSlug)) continue;

        const detailPath = `${PUBLIC_DATA_DIR}/${language}/plans/${previousSlug}.json`;
        const commit = await deleteJsonFile(
          detailPath,
          `Remove archived ${language} plan JSON: ${previousSlug}`
        );
        if (commit) deleted.push({ path: detailPath, commit });
      }

      const indexCommit = await putJsonFile(
        indexPath,
        nextSummaries,
        `Publish ${language} plans index JSON from admin`
      );
      commits.push({ path: indexPath, commit: indexCommit });
    }

    send(res, 200, {
      ok: true,
      count: validPlans.length,
      languages: Object.keys(grouped).filter((language) => grouped[language].length),
      commits,
      deleted
    });
  } catch (error) {
    send(res, 500, { error: error.message || 'No se pudo publicar el JSON.' });
  }
}
