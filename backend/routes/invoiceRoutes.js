import express from 'express';
import {
  getAllInvoices,
  getInvoiceById,
  getNextInvoiceNumber,
  createInvoice,
  cancelInvoice,
  deleteInvoice
} from '../controllers/invoiceController.js';

const router = express.Router();

router.get('/', getAllInvoices);
router.get('/next-number', getNextInvoiceNumber);
router.get('/:id', getInvoiceById);
router.post('/', createInvoice);
router.post('/:id/cancel', cancelInvoice);
router.delete('/:id', deleteInvoice);

export default router;
