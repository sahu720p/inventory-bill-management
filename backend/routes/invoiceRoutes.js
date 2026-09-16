import express from 'express';
import {
  getAllInvoices,
  getInvoiceById,
  getNextInvoiceNumber,
  createInvoice,
  updateInvoice,
  resetInvoiceCounter,
  repairInvoices,
  cancelInvoice,
  deleteInvoice
} from '../controllers/invoiceController.js';

const router = express.Router();

router.get('/', getAllInvoices);
router.get('/next-number', getNextInvoiceNumber);
router.post('/reset-counter', resetInvoiceCounter);
router.post('/repair', repairInvoices);
router.get('/:id', getInvoiceById);
router.post('/', createInvoice);
router.put('/:id', updateInvoice);
router.post('/:id/cancel', cancelInvoice);
router.delete('/:id', deleteInvoice);

export default router;
