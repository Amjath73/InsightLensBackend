import express from 'express';
import Message from '../models/Message.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Get messages for a group
router.get('/group/:groupId', auth, async (req, res) => {
  try {
    const messages = await Message.find({ group: req.params.groupId })
      .populate('sender', 'name')
      .sort({ timestamp: 1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new message
router.post('/', auth, async (req, res) => {
  try {
    const { content, group } = req.body;
    const message = new Message({
      content,
      sender: req.user.id,
      group,
      timestamp: new Date()
    });
    
    await message.save();
    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'name');
    
    res.status(201).json(populatedMessage);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

export default router;
