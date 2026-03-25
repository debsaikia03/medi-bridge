import express from 'express';
import {
  getJournals,
  createJournal,
  updateJournal,
  deleteJournal,
} from '../controllers/journalController.js';

// Import your existing auth middleware
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .get(protect, getJournals)
  .post(protect, createJournal);

router.route('/:id')
  .put(protect, updateJournal)
  .delete(protect, deleteJournal);

export default router;