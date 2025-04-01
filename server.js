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

const app = express();
const server = http.createServer(app);
const io = new SocketIO(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
    transports: ['polling', 'websocket']
  },
  allowEIO3: true
});

// Middleware
app.use(cors());
app.use(express.json());

// Test route to verify server is responding
app.get("/api/test", (req, res) => {
  res.json({ message: "Server is running" });
});

// Authentication Middleware
const authenticateToken = (req, res, next) => {
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
app.use("/api/papers", paperRoutes);
app.use('/api/groups', groupRoutes);

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

app.get("/api/user/search-history", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
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

app.get("/api/messages/:groupId", authenticateToken, async (req, res) => {
  try {
    const messages = await Message.find({ group: req.params.groupId })
      .populate('sender', 'name')  // Populate sender information
      .sort({ createdAt: 1 });
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Error fetching messages' });
  }
});

// 📌 **Delete Group**
app.delete("/api/groups/:groupId", authenticateToken, async (req, res) => {
  try {
    console.log('Attempting to delete group:', req.params.groupId);
    console.log('User ID:', req.user.userId);

    const group = await Group.findById(req.params.groupId);
    
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (!group.creator) {
      return res.status(400).json({ message: "Group has no creator specified" });
    }

    console.log('Group creator:', group.creator);
    console.log('Request user:', req.user.userId);

    // Check if user is the group creator
    if (group.creator.toString() !== req.user.userId.toString()) {
      return res.status(403).json({ message: "Not authorized to delete this group" });
    }

    // Delete all messages first
    await Message.deleteMany({ group: req.params.groupId });
    
    // Delete the group
    const deletedGroup = await Group.findByIdAndDelete(req.params.groupId);
    
    if (!deletedGroup) {
      throw new Error("Failed to delete group");
    }

    res.status(200).json({ message: "Group deleted successfully" });
  } catch (error) {
    console.error("Error in delete group:", error);
    res.status(500).json({ 
      message: "Error deleting group",
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// 📌 **Socket.IO Setup**
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('joinGroup', (groupId) => {
    socket.join(groupId);
    console.log(`Socket ${socket.id} joined group ${groupId}`);
  });

  socket.on('sendMessage', async (data) => {
    try {
      const { groupId, content, token } = data;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user info
      const user = await User.findById(decoded.userId);
      
      const message = new Message({
        content,
        sender: decoded.userId,
        group: groupId
      });
      
      await message.save();
      
      // Send message with user name
      io.to(groupId).emit('receiveMessage', {
        ...message._doc,
        sender: {
          _id: decoded.userId,
          name: user.name
        }
      });
    } catch (error) {
      console.error('Message error:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));