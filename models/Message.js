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

// Pre-save middleware to ensure timestamp is set
messageSchema.pre('save', function(next) {
  if (!this.timestamp) {
    this.timestamp = new Date();
  }
  next();
});

// Virtual for formatted timestamp
messageSchema.virtual('formattedTimestamp').get(function() {
  return new Date(this.timestamp).toLocaleString();
});

// Pre-find middleware to populate sender
messageSchema.pre(['find', 'findOne'], function() {
  this.populate('sender', 'name');
});

const Message = mongoose.model('Message', messageSchema);

export default Message;