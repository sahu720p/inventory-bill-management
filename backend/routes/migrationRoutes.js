import express from 'express';
import {
  getHealthAndStats,
  importFromDexie,
  exportAllData,
  clearAllStoreData
} from '../controllers/migrationController.js';

const router = express.Router();

router.get('/health', getHealthAndStats);
router.post('/import', importFromDexie);
router.get('/export', exportAllData);
router.post('/clear-all', clearAllStoreData);

export default router;
