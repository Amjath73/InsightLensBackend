import express from 'express';
import Group from '../models/Group.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log("GET /groups called");
    const groups = await Group.find()
      .populate('creator', 'name email')
      .populate('members', 'name email');
    console.log("Found groups:", groups);
    res.json(groups);
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ message: error.message });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const newGroup = new Group({
      name: req.body.name,
      creator: req.user.userId,
      members: [req.user.userId]
    });
    
    const savedGroup = await newGroup.save();
    res.status(201).json(savedGroup);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/:id/join', authenticateToken, async (req, res) => {
  try {
    console.log('Join attempt by user:', req.user.userId);
    
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is already a member
    if (group.members.includes(req.user.userId)) {
      console.log('User already a member');
      const populatedGroup = await Group.findById(group._id)
        .populate('creator', 'name email')
        .populate('members', 'name email');
      return res.json(populatedGroup);
    }

    // Add member using findByIdAndUpdate to avoid validation issues
    const updatedGroup = await Group.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { members: req.user.userId } },
      { new: true }
    ).populate('creator', 'name email')
      .populate('members', 'name email');

    if (!updatedGroup) {
      return res.status(404).json({ message: 'Group not found' });
    }

    console.log('Successfully joined group:', updatedGroup);
    res.json(updatedGroup);
  } catch (error) {
    console.error('Error joining group:', error);
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('creator', 'name email')
      .populate('members', 'name email');
      
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }
    
    res.json(group);
  } catch (error) {
    console.error('Error fetching group:', error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
