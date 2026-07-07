const PUBLIC_REPO_FULL_NAME = process.env.PUBLIC_REPO_FULL_NAME || 'eler30mr-star/sembrando-esperanza';
const PUBLIC_REPO_BRANCH = process.env.PUBLIC_REPO_BRANCH || 'main';
const PUBLIC_PLANS_PATH = process.env.PUBLIC_PLANS_PATH || 'src/data/plans.json';

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
    .map((day) => ({
      title: cleanString(day?.title),
      subtitle: cleanString(day?.subtitle),
      verse: cleanString(day?.verse),
      verseText: cleanString(day?.verseText),
      text: cleanString(day?.text),
      prayer: cleanString(day?.prayer),
      action: cleanString(day?.action)
    }))
    .filter((day) => day.title || day.verse || day.text || day.prayer || day.action);
}

function cleanPlan(plan) {
  const days = cleanDays(plan.days);
  return {
    id: cleanString(plan.id),
    title: cleanString(plan.title),
    slug: cleanString(plan.slug),
    category: cleanString(plan.category) || 'Fe',
    status: 'published',
    duration: cleanString(plan.duration) || `${days.length || 1} días`,
    time: cleanString(plan.time) || '5 min al día',
    coverImage: cleanString(plan.coverImage),
    shortDescription: cleanString(plan.shortDescription),
    learning: cleanStringList(plan.learning),
    gains: cleanStringList(plan.gains),
    days,
    updatedAtMs: Number(plan.updatedAtMs || Date.now())
  };
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

async function getExistingFileSha() {
  const [owner, repo] = PUBLIC_REPO_FULL_NAME.split('/');
  const response = await githubRequest(`/repos/${owner}/${repo}/contents/${PUBLIC_PLANS_PATH}?ref=${PUBLIC_REPO_BRANCH}`);

  if (response.status === 404) return null;

  const payload = await response.json();
  return payload.sha || null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    send(res, 405, { error: 'Método no permitido.' });
    return;
  }

  try {
    const plans = Array.isArray(req.body?.plans) ? req.body.plans : [];
    const publishedPlans = plans
      .filter((plan) => plan?.status === 'published')
      .map(cleanPlan)
      .filter((plan) => plan.title && plan.slug && plan.days.length > 0);

    const json = `${JSON.stringify(publishedPlans, null, 2)}\n`;
    const sha = await getExistingFileSha();
    const [owner, repo] = PUBLIC_REPO_FULL_NAME.split('/');

    const body = {
      message: 'Publish plans JSON from admin',
      content: Buffer.from(json, 'utf8').toString('base64'),
      branch: PUBLIC_REPO_BRANCH
    };

    if (sha) body.sha = sha;

    const response = await githubRequest(`/repos/${owner}/${repo}/contents/${PUBLIC_PLANS_PATH}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const result = await response.json();
    send(res, 200, {
      ok: true,
      count: publishedPlans.length,
      path: PUBLIC_PLANS_PATH,
      commit: result?.commit?.sha || null
    });
  } catch (error) {
    send(res, 500, { error: error.message || 'No se pudo publicar el JSON.' });
  }
}
