const PUBLIC_REPO_FULL_NAME = process.env.PUBLIC_REPO_FULL_NAME || 'eler30mr-star/sembrando-esperanza';
const PUBLIC_REPO_BRANCH = process.env.PUBLIC_REPO_BRANCH || 'main';
const PUBLIC_DATA_DIR = process.env.PUBLIC_DATA_DIR || 'public/data';

function send(res, status, payload) {
  res.status(status).json(payload);
}

function cleanString(value) {
  return String(value || '').trim();
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
        subtitle: cleanString(day?.subtitle),
        verse: verses.join('; '),
        verses,
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
    category: cleanString(source.category) || cleanString(plan.category) || 'Fe',
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

async function getExistingFileSha(path) {
  const [owner, repo] = PUBLIC_REPO_FULL_NAME.split('/');
  const response = await githubRequest(`/repos/${owner}/${repo}/contents/${path}?ref=${PUBLIC_REPO_BRANCH}`);

  if (response.status === 404) return null;

  const payload = await response.json();
  return payload.sha || null;
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

    if (!validPlans.length) {
      const invalid = checkedPlans.map((item) => ({
        title: item.cleaned.title || 'Plan sin título',
        issues: item.issues
      }));

      send(res, 400, {
        error: 'No se publicó el JSON porque no hay planes válidos. Revisa que el plan esté en Publicado, tenga slug y tenga al menos un día.',
        received: plans.length,
        invalid
      });
      return;
    }

    const grouped = { es: [], en: [], pt: [], fr: [] };
    const commits = [];

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
      if (!grouped[language].length) continue;
      const indexPath = `${PUBLIC_DATA_DIR}/${language}/plans.json`;
      const indexCommit = await putJsonFile(
        indexPath,
        grouped[language].map((plan) => createPlanSummary(plan, language)),
        `Publish ${language} plans index JSON from admin`
      );
      commits.push({ path: indexPath, commit: indexCommit });
    }

    send(res, 200, {
      ok: true,
      count: validPlans.length,
      languages: Object.keys(grouped).filter((language) => grouped[language].length),
      commits
    });
  } catch (error) {
    send(res, 500, { error: error.message || 'No se pudo publicar el JSON.' });
  }
}
