import publishPlans from './publish-plans.js';

// Compatibility endpoint: use the same atomic, targeted publication path as the editor.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }
  const planId = typeof req.body?.planId === 'string' ? req.body.planId.trim() : '';
  if (!planId) {
    res.status(400).json({ error: 'Falta el identificador del plan.' });
    return;
  }
  req.body = { operation: 'delete', targetId: planId, plans: [] };
  return publishPlans(req, res);
}
