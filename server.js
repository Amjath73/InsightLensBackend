import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import http from 'http';
import { Server as SocketIO } from 'socket.io';
import bcrypt from "bcryptjs";
import path from 'path';
import { exec } from "child_process";
import axios from "axios";
import cookieParser from 'cookie-parser';
import jwt from "jsonwebtoken";
import paperRoutes from "./routes/paperRoutes.js";
import groupRoutes from './routes/groupRoutes.js';
import messageRoutes from './routes/messageRoutes.js'; // Import messageRoutes
import User from "./models/User.js"; // Import User model
import Paper from "./models/Paper.js"; // Import Paper model
import Group from "./models/Group.js";
import Message from "./models/Message.js";

dotenv.config();

// MongoDB Connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1); // Exit process if DB connection fails
  }
};

connectDB();

// Express app setup with Socket.IO
const app = express();
const server = http.createServer(app);
const io = new SocketIO(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: "http://localhost:3000",
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Test route to verify server is responding
app.get("/api/test", (req, res) => {
  res.json({ message: "Server is running" });
});

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  console.log('object')
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { userId: decoded.userId }; // Ensure userId is properly set
    next();
  } catch (error) {
    return res.status(403).json({ message: "Invalid token" });
  }
};

// Routes
app.use('/api/papers', paperRoutes);
app.use('/api/groups', authenticateToken, groupRoutes);
app.use('/api/messages', authenticateToken, messageRoutes); // Change this line

// 📌 **Fetch & Store Research Papers in MongoDB**
app.get("/api/scholar-papers", async (req, res) => {
  const query = req.query.query;
  const token = req.headers.authorization?.split(" ")[1]; // Extract token

  if (!query) {
    return res.status(400).json({ message: "Search query is required" });
  }

  try {
    let userId = null;
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.userId;

      // ✅ Store search query in search history (limit to 10 queries)
      await User.findByIdAndUpdate(
        userId,
        { 
          $push: { searchHistory: { $each: [query], $slice: -10 } } // Keep last 10 searches
        },
        { new: true }
      );
    }

    // ✅ Fetch papers from Python scraper
    const response = await axios.get(`http://127.0.0.1:5000/api/papers?query=${query}`);

    const papers = response.data.map((paper) => ({
      title: paper.title,
      link: paper.link,
      snippet: paper.snippet,
      authors: paper.authors || "Unknown",
    }));

    // Insert into MongoDB (Prevent duplicates)
    await Paper.insertMany(papers, { ordered: false }).catch((err) => {
      console.log("⚠️ Some duplicates skipped:", err.message);
    });

    res.json(papers);
  } catch (error) {
    console.error("Error fetching research papers:", error.message);
    res.status(500).json({ message: "Server Error" });
  }
});


// 📌 **Fetch Research Papers Using Python Scraper**
app.get("/api/scholar", (req, res) => {
  const query = req.query.query || "machine learning";

  exec(`python3 scraper.py "${query}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing script: ${error.message}`);
      return res.status(500).json({ error: "Error fetching data" });
    }
    if (stderr) console.error(`Python script error: ${stderr}`);

    try {
      const papers = JSON.parse(stdout); // Parse JSON output from Python
      res.json(papers);
    } catch (parseError) {
      console.error("Error parsing JSON:", parseError);
      res.status(500).json({ error: "Invalid JSON response from scraper" });
    }
  });
});

// 📌 **Signup Route**
app.post("/signup", async (req, res) => {
  try {
    const { name, email, phone, place, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = new User({ name, email, phone, place, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ message: "Signup successful!" });
  } catch (error) {
    console.error("Signup Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});


// 📌 **Signin Route**
app.post("/signin", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid email or password" });

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid email or password" });

    // Generate JWT token
    const payload = { userId: user._id };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" });

    res.status(200).json({ message: "Login successful!", token });
  } catch (error) {
    console.error("Signin Error:", error);
    res.status(500).json({ message: "Something went wrong", error: error.message });
  }
});

// 📌 **Fetch All Users**
app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find({}, "name email place phone");
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.get("/api/user/search-history", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1]; // Extract token

  try {
    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select("searchHistory");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user.searchHistory);
  } catch (error) {
    console.error("Error fetching search history:", error.message);
    res.status(500).json({ message: "Server Error" });
  }
});

app.delete('/api/groups/:groupId', authenticateToken, async (req, res) => {
  try {
    const groupId = req.params.groupId;
    const userId = req.user.userId;

    console.log('Delete request:', { groupId, userId });

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const creatorId = group.creator.toString();
    console.log('Creator check:', {
      groupId,
      groupName: group.name,
      creator: creatorId,
      requestingUser: userId,
      isMatch: creatorId === userId
    });

    if (creatorId !== userId) {
      return res.status(403).json({ message: "Not authorized to delete this group" });
    }

    await Message.deleteMany({ group: groupId });
    await Group.findByIdAndDelete(groupId);

    res.status(200).json({ message: "Group deleted successfully" });
  } catch (error) {
    console.error("Delete group error:", error);
    res.status(500).json({ message: "Error deleting group", error: error.message });
  }
});

app.get('/api/groups', authenticateToken, async (req, res) => {
  try {
    const groups = await Group.find()
      .populate('creator', 'name')
      .populate('members', 'name')
      .sort({ createdAt: -1 });
    res.json(groups);
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ message: 'Error fetching groups' });
  }
});

app.get('/api/groups/joined', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const groups = await Group.find({
      members: userId
    })
    .populate('creator', 'name')
    .populate('members', 'name')
    .sort({ createdAt: -1 });

    res.json(groups);
  } catch (error) {
    console.error('Error fetching joined groups:', error);
    res.status(500).json({ message: 'Error fetching joined groups' });
  }
});

app.post('/api/groups/:groupId/join', authenticateToken, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (!group.members.includes(req.user.userId)) {
      group.members.push(req.user.userId);
      await group.save();
    }

    res.json({ message: 'Successfully joined group' });
  } catch (error) {
    console.error('Error joining group:', error);
    res.status(500).json({ message: 'Error joining group' });
  }
});

// Socket.IO event handlers
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('joinGroup', (groupId) => {
    socket.join(groupId);
    console.log(`Socket ${socket.id} joined group ${groupId}`);
  });

  socket.on('leaveGroup', (groupId) => {
    socket.leave(groupId);
    console.log(`Socket ${socket.id} left group ${groupId}`);
  });

  socket.on('sendMessage', async (data) => {
    try {
      const { groupId, content, token } = data;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const user = await User.findById(decoded.userId);
      const message = new Message({
        content,
        sender: decoded.userId,
        group: groupId,
        timestamp: new Date()
      });
      
      await message.save();
      
      // Emit to all clients in the group
      const messageWithSender = {
        ...message.toObject(),
        sender: {
          _id: user._id,
          name: user.name
        },
        timestamp: new Date()
      };
      
      io.to(groupId).emit('receiveMessage', messageWithSender);
    } catch (error) {
      console.error('Socket message error:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({ message: 'Internal server error', error: err.message });
});

// Start server with Socket.IO
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});