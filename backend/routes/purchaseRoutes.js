import express from 'express';
import {
  getAllPurchaseBills,
  getBillDetails,
  createPurchaseBill,
  deletePurchaseBill,
  updatePurchaseItem,
  deletePurchaseItem
} from '../controllers/purchaseController.js';

const router = express.Router();

router.get('/bills', getAllPurchaseBills);
router.get('/bills/:billId', getBillDetails);
router.post('/bills', createPurchaseBill);
router.delete('/bills/:id', deletePurchaseBill);
router.put('/items/:id', updatePurchaseItem);
router.delete('/items/:id', deletePurchaseItem);

export default router;
