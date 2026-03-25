import mongoose from 'mongoose';

const journalSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User', // Matches your existing User model
    },
    title: {
      type: String,
      default: 'Untitled Entry',
    },
    content: {
      type: String,
      required: [true, 'Please add text for your journal entry'],
    },
    mood: {
      type: String,
      default: '',
    },
    tags: [
      {
        type: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

const Journal = mongoose.model('Journal', journalSchema);
export default Journal;