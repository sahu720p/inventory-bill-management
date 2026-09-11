import express from 'express';
import { login, updatePassword, getProfile } from '../controllers/authController.js';

const router = express.Router();

router.post('/login', login);
router.post('/update-password', updatePassword);
router.get('/profile', getProfile);

export default router;
