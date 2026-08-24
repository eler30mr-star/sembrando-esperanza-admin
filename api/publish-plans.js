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

async function githubRequest(path, requestOptions = {}) {
  const token = process.env.GITHUB_TOKEN;
  const { allowNotFound = false, ...options } = requestOptions;

  if (!token) {
    const error = new Error('Falta configurar GITHUB_TOKEN en Vercel del admin.');
    error.status = 500;
    throw error;
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

  if (!response.ok && !(allowNotFound && response.status === 404)) {
    const text = await response.text();
    const error = new Error(`GitHub error ${response.status}: ${text}`);
    error.status = response.status;
    throw error;
  }

  return response;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requireAdmin(req) {
  const authorization = String(req.headers?.authorization || '');
  const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';

  if (!idToken) {
    const error = new Error('Sesión de administrador requerida.');
    error.status = 401;
    throw error;
  }

  const apiKey = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY;
  const allowedEmail = String(process.env.VITE_ADMIN_EMAIL || 'ceo.developer.appsem@gmail.com').toLowerCase();

  if (!apiKey) {
    const error = new Error('Falta configurar FIREBASE_API_KEY o VITE_FIREBASE_API_KEY en Vercel.');
    error.status = 500;
    throw error;
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    }
  );

  if (!response.ok) {
    const error = new Error('La sesión de Firebase no es válida o expiró.');
    error.status = 401;
    throw error;
  }

  const payload = await response.json();
  const user = payload.users?.[0];

  if (!user?.email || user.email.toLowerCase() !== allowedEmail) {
    const error = new Error('Este usuario no está autorizado para publicar.');
    error.status = 403;
    throw error;
  }

  return user;
}

async function getExistingFile(path) {
  const [owner, repo] = PUBLIC_REPO_FULL_NAME.split('/');
  const response = await githubRequest(
    `/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(PUBLIC_REPO_BRANCH)}`,
    { allowNotFound: true }
  );

  if (response.status === 404) return null;
  return response.json();
}

async function readJsonFile(path, fallback = []) {
  const file = await getExistingFile(path);
  if (!file?.content) return fallback;

  try {
    const text = Buffer.from(file.content.replace(/\\n/g, ''), 'base64').toString('utf8');
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function jsonFileChange(path, data) {
  return {
    path,
    mode: '100644',
    type: 'blob',
    content: `${JSON.stringify(data, null, 2)}\\n`
  };
}

async function commitJsonChanges(changes, message) {
  const [owner, repo] = PUBLIC_REPO_FULL_NAME.split('/');
  const encodedBranch = PUBLIC_REPO_BRANCH.split('/').map(encodeURIComponent).join('/');
  const maxAttempts = 4;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const refResponse = await githubRequest(
        `/repos/${owner}/${repo}/git/ref/heads/${encodedBranch}`
      );
      const ref = await refResponse.json();
      const headSha = ref.object?.sha;

      const commitResponse = await githubRequest(
        `/repos/${owner}/${repo}/git/commits/${headSha}`
      );
      const currentCommit = await commitResponse.json();
      const baseTreeSha = currentCommit.tree?.sha;

      const treeResponse = await githubRequest(
        `/repos/${owner}/${repo}/git/trees/${baseTreeSha}?recursive=1`
      );
      const currentTree = await treeResponse.json();
      const existingPaths = new Set(
        (currentTree.tree || [])
          .filter((entry) => entry.type === 'blob')
          .map((entry) => entry.path)
      );
      const applicableChanges = changes.filter(
        (change) => change.sha !== null || existingPaths.has(change.path)
      );

      const createTreeResponse = await githubRequest(
        `/repos/${owner}/${repo}/git/trees`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base_tree: baseTreeSha, tree: applicableChanges })
        }
      );
      const nextTree = await createTreeResponse.json();

      const createCommitResponse = await githubRequest(
        `/repos/${owner}/${repo}/git/commits`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            tree: nextTree.sha,
            parents: [headSha]
          })
        }
      );
      const nextCommit = await createCommitResponse.json();

      await githubRequest(
        `/repos/${owner}/${repo}/git/refs/heads/${encodedBranch}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sha: nextCommit.sha, force: false })
        }
      );

      return nextCommit.sha;
    } catch (error) {
      const branchMoved = error.status === 409 || error.status === 422;
      if (!branchMoved || attempt === maxAttempts) throw error;
      await sleep(150 * attempt);
    }
  }

  throw new Error('No se pudo actualizar la rama después de varios intentos.');
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
    await requireAdmin(req);

    const plans = Array.isArray(req.body?.plans) ? req.body.plans : [];
    const checkedPlans = plans.map(getPlanIssues);
    const validPlans = plans.filter((plan, index) => checkedPlans[index].issues.length === 0);
    const grouped = { es: [], en: [], pt: [], fr: [] };
    const changes = new Map();
    const deleted = [];

    for (const plan of validPlans) {
      for (const language of availableLanguages(plan)) {
        const detail = createPlanDetail(plan, language);
        if (!detail.title || !detail.slug || !detail.days.length) continue;

        if (grouped[language].some((current) => current.slug === detail.slug)) {
          const error = new Error(`Hay más de un plan con el slug "${detail.slug}" en ${language}.`);
          error.status = 400;
          throw error;
        }

        grouped[language].push(detail);
        const detailPath = `${PUBLIC_DATA_DIR}/${language}/plans/${detail.slug}.json`;
        changes.set(detailPath, jsonFileChange(detailPath, detail));
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
        changes.set(detailPath, {
          path: detailPath,
          mode: '100644',
          type: 'blob',
          sha: null
        });
        deleted.push(detailPath);
      }

      changes.set(indexPath, jsonFileChange(indexPath, nextSummaries));
    }

    const changedFiles = [...changes.keys()];
    const commit = await commitJsonChanges(
      [...changes.values()],
      'Publish plan JSON atomically from admin'
    );

    send(res, 200, {
      ok: true,
      count: validPlans.length,
      languages: Object.keys(grouped).filter((language) => grouped[language].length),
      commit,
      changedFiles,
      deleted
    });
  } catch (error) {
    const status = Number(error.status) || 500;
    send(res, status, { error: error.message || 'No se pudo publicar el JSON.' });
  }
}
