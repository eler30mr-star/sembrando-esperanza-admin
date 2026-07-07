const PUBLIC_REPO_FULL_NAME = process.env.PUBLIC_REPO_FULL_NAME || 'eler30mr-star/sembrando-esperanza';
const PUBLIC_REPO_BRANCH = process.env.PUBLIC_REPO_BRANCH || 'main';
const PUBLIC_PLANS_INDEX_PATH = process.env.PUBLIC_PLANS_INDEX_PATH || 'src/data/plans.json';
const PUBLIC_PLAN_DETAIL_DIR = process.env.PUBLIC_PLAN_DETAIL_DIR || 'src/data/plans';

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

function cleanDays(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((day, index) => ({
      dayNumber: Number(day?.dayNumber || index + 1),
      title: cleanString(day?.title),
      subtitle: cleanString(day?.subtitle),
      verse: cleanString(day?.verse),
      text: cleanString(day?.text),
      prayer: cleanString(day?.prayer),
      action: cleanString(day?.action)
    }))
    .filter((day) => day.title || day.verse || day.text || day.prayer || day.action);
}

function formatDuration(plan, days) {
  const value = cleanString(plan.duration);
  if (!value) return `${days.length || 1} días`;
  return /día|dias|días/i.test(value) ? value : `${value} días`;
}

function formatTime(plan) {
  const value = cleanString(plan.time);
  if (!value) return '5 min al día';
  return /min|hora|día|dias|días/i.test(value) ? value : `${value} min al día`;
}

function createPlanDetail(plan) {
  const days = cleanDays(plan.days);
  return {
    id: cleanString(plan.id),
    title: cleanString(plan.title),
    slug: cleanString(plan.slug),
    category: cleanString(plan.category) || 'Fe',
    status: 'published',
    dayCount: days.length,
    duration: formatDuration(plan, days),
    time: formatTime(plan),
    coverImage: cleanString(plan.coverImage),
    shortDescription: cleanString(plan.shortDescription),
    learning: cleanStringList(plan.learning),
    gains: cleanStringList(plan.gains),
    days,
    updatedAtMs: Number(plan.updatedAtMs || Date.now())
  };
}

function createPlanSummary(plan) {
  return {
    id: plan.id,
    title: plan.title,
    slug: plan.slug,
    category: plan.category,
    status: plan.status,
    dayCount: plan.dayCount,
    duration: plan.duration,
    time: plan.time,
    coverImage: plan.coverImage,
    shortDescription: plan.shortDescription,
    detailPath: `${PUBLIC_PLAN_DETAIL_DIR}/${plan.slug}.json`,
    updatedAtMs: plan.updatedAtMs
  };
}

function isPublished(plan) {
  const status = cleanString(plan?.status).toLowerCase();
  return status === 'published' || status === 'publicado';
}

function getPlanIssues(plan) {
  const cleaned = createPlanDetail(plan);
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    send(res, 405, { error: 'Método no permitido.' });
    return;
  }

  try {
    const plans = Array.isArray(req.body?.plans) ? req.body.plans : [];
    const checkedPlans = plans.map(getPlanIssues);
    const publishedPlanDetails = checkedPlans
      .filter((item) => item.issues.length === 0)
      .map((item) => item.cleaned);

    if (!publishedPlanDetails.length) {
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

    const indexPlans = publishedPlanDetails.map(createPlanSummary);
    const commits = [];

    const indexCommit = await putJsonFile(
      PUBLIC_PLANS_INDEX_PATH,
      indexPlans,
      'Publish plans index JSON from admin'
    );
    commits.push({ path: PUBLIC_PLANS_INDEX_PATH, commit: indexCommit });

    for (const plan of publishedPlanDetails) {
      const detailPath = `${PUBLIC_PLAN_DETAIL_DIR}/${plan.slug}.json`;
      const commit = await putJsonFile(
        detailPath,
        plan,
        `Publish plan JSON: ${plan.slug}`
      );
      commits.push({ path: detailPath, commit });
    }

    send(res, 200, {
      ok: true,
      count: publishedPlanDetails.length,
      indexPath: PUBLIC_PLANS_INDEX_PATH,
      detailDir: PUBLIC_PLAN_DETAIL_DIR,
      commits
    });
  } catch (error) {
    send(res, 500, { error: error.message || 'No se pudo publicar el JSON.' });
  }
}
