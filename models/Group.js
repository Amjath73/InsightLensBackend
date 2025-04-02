import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  senderName: String,
  content: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  description: String,
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  messages: [messageSchema],
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Add creator to members automatically when creating new group
groupSchema.pre('save', function(next) {
  if (this.isNew && !this.members.includes(this.creator)) {
    this.members.push(this.creator);
  }
  next();
});

const Group = mongoose.model('Group', groupSchema);

export default Group;
