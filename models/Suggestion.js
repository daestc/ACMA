const mongoose = require('mongoose');

const suggestionSchema = new mongoose.Schema({
  university: { type: String, required: true, trim: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorName: { type: String, required: true, trim: true },
  category: {
    type: String,
    enum: ['academic', 'facility', 'service', 'other'],
    default: 'other',
  },
  title: { type: String, required: true, trim: true },
  content: { type: String, required: true, trim: true },
  images: [{ type: String, trim: true }],
  status: {
    type: String,
    enum: ['pending', 'completed'],
    default: 'pending',
  },
  staffReply: { type: String, default: null, trim: true },
  repliedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  repliedByName: { type: String, default: null, trim: true },
  repliedAt: { type: Date, default: null },
}, { timestamps: true });

suggestionSchema.index({ university: 1, status: 1, createdAt: -1 });
suggestionSchema.index({ authorId: 1, createdAt: -1 });

module.exports = mongoose.model('Suggestion', suggestionSchema);
