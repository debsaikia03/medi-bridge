import Journal from '../models/journalModel.js';

// @desc    Get user's journal entries
// @route   GET /api/journals
// @access  Private
export const getJournals = async (req, res) => {
  try {
    const journals = await Journal.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json(journals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a journal entry
// @route   POST /api/journals
// @access  Private
export const createJournal = async (req, res) => {
  try {
    const { title, content, mood, tags } = req.body;

    if (!content) {
      return res.status(400).json({ message: 'Content is required' });
    }

    const journal = await Journal.create({
      user: req.user.id,
      title: title || 'Untitled Entry',
      content,
      mood,
      tags
    });

    res.status(201).json(journal);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a journal entry
// @route   PUT /api/journals/:id
// @access  Private
export const updateJournal = async (req, res) => {
  try {
    const journal = await Journal.findById(req.params.id);

    if (!journal) {
      return res.status(404).json({ message: 'Journal entry not found' });
    }

    // Ensure the logged-in user matches the journal user
    if (journal.user.toString() !== req.user.id.toString()) {
      return res.status(401).json({ message: 'User not authorized to update this entry' });
    }

    const updatedJournal = await Journal.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true } // Returns the updated document
    );

    res.status(200).json(updatedJournal);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a journal entry
// @route   DELETE /api/journals/:id
// @access  Private
export const deleteJournal = async (req, res) => {
  try {
    const journal = await Journal.findById(req.params.id);

    if (!journal) {
      return res.status(404).json({ message: 'Journal entry not found' });
    }

    // Ensure the logged-in user matches the journal user
    if (journal.user.toString() !== req.user.id.toString()) {
      return res.status(401).json({ message: 'User not authorized to delete this entry' });
    }

    await journal.deleteOne();

    res.status(200).json({ id: req.params.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};