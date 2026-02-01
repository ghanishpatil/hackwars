/**
 * Service Templates API. Admin only.
 * POST/GET/PATCH/DELETE /api/service-templates, POST upload-dockerfile.
 */

import express from 'express';
import multer from 'multer';
import { adminGuard } from '../middleware/adminGuard.js';
import {
  createServiceTemplate,
  getServiceTemplate,
  updateServiceTemplate,
  deleteServiceTemplate,
  listServiceTemplates,
} from '../services/serviceTemplateService.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 }, // 1MB
});

const router = express.Router();

/** POST /api/service-templates — create template (adminGuard applied at mount) */
router.post('/', async (req, res) => {
  try {
    const template = await createServiceTemplate(req.user?.uid, req.body || {});
    return res.json({ success: true, template });
  } catch (err) {
    if (err.message === 'INVALID_INPUT') return res.status(400).json({ error: err.message });
    if (err.message === 'DOCKER_BUILD_FAILED') return res.status(500).json({ error: err.message });
    if (err.message === 'DUPLICATE_NAME') return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /api/service-templates/upload-dockerfile — upload Dockerfile, returns base64 */
router.post('/upload-dockerfile', upload.single('dockerfile'), async (req, res) => {
  try {
    if (!req.file?.buffer) return res.status(400).json({ error: 'No file provided' });
    const dockerfileContent = req.file.buffer.toString('utf8');
    const base64 = Buffer.from(dockerfileContent).toString('base64');
    return res.json({ success: true, dockerfile: base64 });
  } catch (err) {
    return res.status(500).json({ error: 'Upload failed' });
  }
});

/** GET /api/service-templates — list with optional filters (type, difficulty, isActive) */
router.get('/', async (req, res) => {
  try {
    const filters = {};
    if (req.query.type) filters.type = req.query.type;
    if (req.query.difficulty) filters.difficulty = req.query.difficulty;
    if (req.query.isActive !== undefined) filters.isActive = req.query.isActive === 'true';
    const templates = await listServiceTemplates(filters);
    return res.json({ success: true, templates });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

/** GET /api/service-templates/:templateId */
router.get('/:templateId', async (req, res) => {
  try {
    const template = await getServiceTemplate(req.params.templateId);
    return res.json({ success: true, template });
  } catch (err) {
    if (err.message === 'NOT_FOUND') return res.status(404).json({ error: 'Template not found' });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/** PATCH /api/service-templates/:templateId */
router.patch('/:templateId', async (req, res) => {
  try {
    const template = await updateServiceTemplate(req.params.templateId, req.body || {});
    return res.json({ success: true, template });
  } catch (err) {
    if (err.message === 'NOT_FOUND') return res.status(404).json({ error: 'Template not found' });
    if (err.message === 'DOCKER_BUILD_FAILED') return res.status(500).json({ error: err.message });
    return res.status(500).json({ error: 'Update failed' });
  }
});

/** DELETE /api/service-templates/:templateId — soft delete */
router.delete('/:templateId', async (req, res) => {
  try {
    await deleteServiceTemplate(req.params.templateId);
    return res.json({ success: true });
  } catch (err) {
    if (err.message === 'IN_USE') return res.status(400).json({ error: 'Template is in use' });
    return res.status(500).json({ error: 'Delete failed' });
  }
});

export default router;
