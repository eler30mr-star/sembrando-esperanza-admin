const PUBLIC_REPO_FULL_NAME = process.env.PUBLIC_REPO_FULL_NAME || 'eler30mr-star/sembrando-esperanza';
const PUBLIC_REPO_BRANCH = process.env.PUBLIC_REPO_BRANCH || 'main';
const PUBLIC_DATA_DIR = process.env.PUBLIC_DATA_DIR || 'public/data';
const STORY_LANGUAGE = 'es';

function send(res, status, payload) {
  res.status(status).json(payload);
}

function cleanString(value) {
  return String(value || '').trim();
}

function isPublished(story) {
  const status = cleanString(story?.status).toLowerCase();
  return status === 'published' || status === 'publicado';
}

function slugify(value) {
  return cleanString(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function normalizeChapters(chapters) {
  if (!Array.isArray(chapters)) return [];
  return chapters
    .map((chapter, index) => ({
      title: cleanString(chapter?.title) || `Capítulo ${index + 1}`,
      content: cleanString(chapter?.content)
    }))
    .filter((chapter) => chapter.content);
}

function createStoryDetail(story) {
  const slug = slugify(story.slug || story.id || story.title) || `story-${Date.now()}`;
  const shortDescription = cleanString(story.shortDescription || story.description);

  return {
    id: cleanString(story.id),
    slug,
    title: cleanString(story.title),
    category: cleanString(story.category) || 'Reflexión',
    coverImage: cleanString(story.coverImage || story.cover || story.image),
    shortDescription,
    description: shortDescription,
    chapters: normalizeChapters(story.chapters),
    status: 'published',
    language: STORY_LANGUAGE,
    updatedAtMs: Number(story.updatedAtMs || Date.now())
  };
}

function createStorySummary(story) {
  return {
    id: story.id,
    slug: story.slug,
    title: story.title,
    category: story.category,
    coverImage: story.coverImage,
    shortDescription: story.shortDescription,
    description: story.description,
    chapterCount: story.chapters.length,
    status: story.status,
    language: story.language,
    detailPath: `/data/${STORY_LANGUAGE}/stories/${story.slug}.json`,
    updatedAtMs: story.updatedAtMs
  };
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
    const text = Buffer.from(file.content.replace(/\n/g, ''), 'base64').toString('utf8');
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
    content: `${JSON.stringify(data, null, 2)}\n`
  };
}

async function commitJsonChanges(changes, message) {
  const [owner, repo] = PUBLIC_REPO_FULL_NAME.split('/');
  const encodedBranch = PUBLIC_REPO_BRANCH.split('/').map(encodeURIComponent).join('/');
  const maxAttempts = 4;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const refResponse = await githubRequest(`/repos/${owner}/${repo}/git/ref/heads/${encodedBranch}`);
      const ref = await refResponse.json();
      const headSha = ref.object?.sha;

      const commitResponse = await githubRequest(`/repos/${owner}/${repo}/git/commits/${headSha}`);
      const currentCommit = await commitResponse.json();
      const baseTreeSha = currentCommit.tree?.sha;

      const treeResponse = await githubRequest(`/repos/${owner}/${repo}/git/trees/${baseTreeSha}?recursive=1`);
      const currentTree = await treeResponse.json();
      const existingPaths = new Set(
        (currentTree.tree || []).filter((entry) => entry.type === 'blob').map((entry) => entry.path)
      );
      const applicableChanges = changes.filter((change) => change.sha !== null || existingPaths.has(change.path));

      const createTreeResponse = await githubRequest(`/repos/${owner}/${repo}/git/trees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base_tree: baseTreeSha, tree: applicableChanges })
      });
      const nextTree = await createTreeResponse.json();

      const createCommitResponse = await githubRequest(`/repos/${owner}/${repo}/git/commits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, tree: nextTree.sha, parents: [headSha] })
      });
      const nextCommit = await createCommitResponse.json();

      await githubRequest(`/repos/${owner}/${repo}/git/refs/heads/${encodedBranch}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sha: nextCommit.sha, force: false })
      });

      return nextCommit.sha;
    } catch (error) {
      const branchMoved = error.status === 409 || error.status === 422;
      if (!branchMoved || attempt === maxAttempts) throw error;
      await sleep(150 * attempt);
    }
  }

  throw new Error('No se pudo actualizar la rama después de varios intentos.');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    send(res, 405, { error: 'Método no permitido.' });
    return;
  }

  try {
    await requireAdmin(req);

    const stories = Array.isArray(req.body?.stories) ? req.body.stories : [];
    const publishedStories = stories
      .filter(isPublished)
      .map(createStoryDetail)
      .sort((a, b) => Number(b.updatedAtMs || 0) - Number(a.updatedAtMs || 0));

    const invalidStory = publishedStories.find(
      (story) => !story.id || !story.title || !story.slug || story.chapters.length === 0
    );
    if (invalidStory) {
      const error = new Error(
        `La historia "${invalidStory.title || invalidStory.id || 'sin título'}" necesita título y al menos un capítulo con contenido.`
      );
      error.status = 400;
      throw error;
    }

    const slugOwners = new Map();
    for (const story of publishedStories) {
      const currentOwner = slugOwners.get(story.slug);
      if (currentOwner && currentOwner !== story.id) {
        const error = new Error(`Hay más de una historia con el slug "${story.slug}".`);
        error.status = 400;
        throw error;
      }
      slugOwners.set(story.slug, story.id);
    }

    const indexPath = `${PUBLIC_DATA_DIR}/${STORY_LANGUAGE}/stories.json`;
    const previousIndex = await readJsonFile(indexPath, []);
    const nextSummaries = publishedStories.map(createStorySummary);
    const nextSlugs = new Set(nextSummaries.map((story) => story.slug));
    const changes = new Map();
    const deleted = [];

    for (const story of publishedStories) {
      const detailPath = `${PUBLIC_DATA_DIR}/${STORY_LANGUAGE}/stories/${story.slug}.json`;
      changes.set(detailPath, jsonFileChange(detailPath, story));
    }

    for (const previousStory of Array.isArray(previousIndex) ? previousIndex : []) {
      const previousSlug = cleanString(previousStory?.slug);
      if (!previousSlug || nextSlugs.has(previousSlug)) continue;
      const detailPath = `${PUBLIC_DATA_DIR}/${STORY_LANGUAGE}/stories/${previousSlug}.json`;
      changes.set(detailPath, { path: detailPath, mode: '100644', type: 'blob', sha: null });
      deleted.push(detailPath);
    }

    changes.set(indexPath, jsonFileChange(indexPath, nextSummaries));

    const commit = await commitJsonChanges(
      [...changes.values()],
      'Publish story JSON atomically from admin'
    );

    send(res, 200, {
      ok: true,
      count: publishedStories.length,
      language: STORY_LANGUAGE,
      commit,
      indexPath,
      changedFiles: [...changes.keys()],
      deleted
    });
  } catch (error) {
    const status = Number(error.status) || 500;
    send(res, status, { error: error.message || 'No se pudo publicar el JSON de historias.' });
  }
}
