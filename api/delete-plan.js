const PUBLIC_REPO_FULL_NAME = process.env.PUBLIC_REPO_FULL_NAME || 'eler30mr-star/sembrando-esperanza';
const PUBLIC_REPO_BRANCH = process.env.PUBLIC_REPO_BRANCH || 'main';
const PUBLIC_DATA_DIR = process.env.PUBLIC_DATA_DIR || 'public/data';
const LANGUAGES = ['es', 'en', 'pt', 'fr'];

function send(res, status, payload) {
  res.status(status).json(payload);
}

function cleanString(value) {
  return String(value || '').trim();
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
    const error = new Error('Este usuario no está autorizado para eliminar planes públicos.');
    error.status = 403;
    throw error;
  }

  return user;
}

function repoPath(path) {
  const [owner, repo] = PUBLIC_REPO_FULL_NAME.split('/');
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  return `/repos/${owner}/${repo}/contents/${encodedPath}`;
}

async function getExistingFile(path) {
  const response = await githubRequest(
    `${repoPath(path)}?ref=${encodeURIComponent(PUBLIC_REPO_BRANCH)}`,
    { allowNotFound: true }
  );

  if (response.status === 404) return null;
  return response.json();
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

async function writeJsonFile(path, data, message) {
  const existing = await getExistingFile(path);
  const content = Buffer.from(`${JSON.stringify(data, null, 2)}\n`, 'utf8').toString('base64');
  const response = await githubRequest(repoPath(path), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content,
      branch: PUBLIC_REPO_BRANCH,
      ...(existing?.sha ? { sha: existing.sha } : {})
    })
  });
  const payload = await response.json();
  return payload.commit?.sha || null;
}

async function deleteExistingFile(path, message) {
  const existing = await getExistingFile(path);
  if (!existing?.sha) return null;

  const response = await githubRequest(repoPath(path), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      sha: existing.sha,
      branch: PUBLIC_REPO_BRANCH
    })
  });
  const payload = await response.json();
  return payload.commit?.sha || null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    send(res, 405, { error: 'Método no permitido.' });
    return;
  }

  try {
    await requireAdmin(req);

    const planId = cleanString(req.body?.planId);
    if (!planId) {
      send(res, 400, { error: 'Falta el id del plan que se quiere eliminar.' });
      return;
    }

    const commits = [];
    const changedFiles = [];
    const deletedFiles = [];

    for (const language of LANGUAGES) {
      const indexPath = `${PUBLIC_DATA_DIR}/${language}/plans.json`;
      const previousIndex = await readJsonFile(indexPath, []);
      const currentPlans = Array.isArray(previousIndex) ? previousIndex : [];
      const removedPlans = currentPlans.filter((plan) => cleanString(plan?.id) === planId);

      if (!removedPlans.length) continue;

      const nextIndex = currentPlans.filter((plan) => cleanString(plan?.id) !== planId);
      const indexCommit = await writeJsonFile(
        indexPath,
        nextIndex,
        `Remove plan ${planId} from ${language} index`
      );
      if (indexCommit) commits.push(indexCommit);
      changedFiles.push(indexPath);

      const removedSlugs = [...new Set(removedPlans.map((plan) => cleanString(plan?.slug)).filter(Boolean))];
      const remainingSlugs = new Set(nextIndex.map((plan) => cleanString(plan?.slug)).filter(Boolean));

      for (const slug of removedSlugs) {
        if (remainingSlugs.has(slug)) continue;

        const detailPath = `${PUBLIC_DATA_DIR}/${language}/plans/${slug}.json`;
        const detailCommit = await deleteExistingFile(
          detailPath,
          `Delete public plan ${planId} (${language})`
        );
        if (detailCommit) {
          commits.push(detailCommit);
          changedFiles.push(detailPath);
          deletedFiles.push(detailPath);
        }
      }
    }

    send(res, 200, {
      ok: true,
      planId,
      commits,
      changedFiles,
      deletedFiles
    });
  } catch (error) {
    const status = Number(error.status) || 500;
    send(res, status, { error: error.message || 'No se pudo eliminar el plan del JSON público.' });
  }
}
