import express from 'express';
import Message from '../models/Message.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Get messages for a group
router.get('/:groupId', auth, async (req, res) => {
  try {
    console.log('Fetching messages for group:', req.params.groupId);
    const messages = await Message.find({ group: req.params.groupId })
      .sort({ timestamp: 1 })
      .populate('sender', 'name');
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: error.message });
  }
});

// Post a new message
router.post('/:groupId', auth, async (req, res) => {
  try {
    console.log('Creating message:', {
      content: req.body.content,
      sender: req.user.id,
      group: req.params.groupId
    });

    const message = new Message({
      content: req.body.content,
      sender: req.user.id,
      group: req.params.groupId
    });

    const savedMessage = await message.save();
    const populatedMessage = await Message.findById(savedMessage._id)
      .populate('sender', 'name');

    console.log('Message created:', populatedMessage);
    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error('Error creating message:', error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
