import express from 'express';
import {
  getAllSettings,
  updateSetting,
  bulkUpdateSettings
} from '../controllers/settingsController.js';

const router = express.Router();

router.get('/', getAllSettings);
router.post('/single', updateSetting);
router.post('/bulk', bulkUpdateSettings);

export default router;
