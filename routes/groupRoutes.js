import express from 'express';
import Group from '../models/Group.js';
import Message from '../models/Message.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Get all groups
router.get('/', auth, async (req, res) => {
  try {
    const groups = await Group.find()
      .populate('creator', 'name')
      .populate('members', 'name')
      .exec();
    res.json(groups);
  } catch (error) {
    console.error("Error fetching groups:", error);
    res.status(500).json({ message: "Error fetching groups", error: error.message });
  }
});

// Create new group
router.post('/', auth, async (req, res) => {
  try {
    const newGroup = new Group({
      name: req.body.name,
      creator: req.user.userId,
      members: [req.user.userId]
    });
    
    const savedGroup = await newGroup.save();
    const populatedGroup = await Group.findById(savedGroup._id)
      .populate('creator', 'name')
      .populate('members', 'name');
    
    res.status(201).json(populatedGroup);
  } catch (error) {
    console.error("Error creating group:", error);
    res.status(500).json({ message: "Error creating group", error: error.message });
  }
});

// Join group - MUST be before the generic groupId routes
router.post('/:groupId/join', auth, async (req, res) => {
  console.log('hi')
  try {
    console.log('Join request received:', {
      groupId: req.params.groupId,
      userId: req.user.id || req.user.userId
    });

    const group = await Group.findById(req.params.groupId);
    if (!group) {
      console.log('Group not found:', req.params.groupId);
      return res.status(404).json({ message: "Group not found" });
    }

    const userId = req.user.id || req.user.userId;
    
    // Check if user is already a member
    if (group.members.includes(userId)) {
      console.log('User already a member');
      return res.status(200).json(await group.populate('members', 'name'));
    }

    // Add user to members array
    group.members.push(userId);
    await group.save();

    const updatedGroup = await Group.findById(group._id)
      .populate('creator', 'name')
      .populate('members', 'name');

    console.log('User joined successfully:', updatedGroup);
    res.status(200).json(updatedGroup);
  } catch (error) {
    console.error("Error joining group:", error);
    res.status(500).json({ message: "Error joining group", error: error.message });
  }
});

// Get group messages
router.get('/:groupId/messages', auth, async (req, res) => {
  try {
    const messages = await Message.find({ group: req.params.groupId })
      .populate('sender', 'name')
      .sort({ createdAt: 1 });
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Error fetching messages' });
  }
});

// Post message to group
router.post('/:groupId/messages', auth, async (req, res) => {
  try {
    const message = new Message({
      content: req.body.content,
      sender: req.user.userId,
      group: req.params.groupId
    });

    await message.save();
    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'name');

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error('Error creating message:', error);
    res.status(500).json({ message: 'Error creating message' });
  }
});

// Get single group - Keep this last
router.get('/:groupId', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId)
      .populate('creator', 'name')
      .populate('members', 'name');
    
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }
    
    res.json(group);
  } catch (error) {
    console.error("Error fetching group:", error);
    res.status(500).json({ message: "Error fetching group details" });
  }
});

export default router;
