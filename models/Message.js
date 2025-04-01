import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true,
    trim: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Virtual for formatted timestamp
messageSchema.virtual('formattedTimestamp').get(function() {
  return new Date(this.timestamp).toLocaleString();
});

const Message = mongoose.model('Message', messageSchema);

export default Message;