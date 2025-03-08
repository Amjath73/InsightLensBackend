import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { exec } from "child_process";
import paperRoutes from "./routes/paperRoutes.js";
import User from "./models/User.js"; // Import User model
import jwt from 'jsonwebtoken';



// Load environment variables
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

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/papers", paperRoutes);

// Signup Route
app.post("/signup", async (req, res) => {
  try {
    const { name, email, phone, place, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

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

// API to fetch research papers from Google Scholar
app.get("/api/scholar", (req, res) => {
  const query = req.query.query || "machine learning"; // Default query

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

app.post("/signin", async (req, res) => {
    const { email, password } = req.body;
  
    try {
      // Check if user exists
      const user = await User.findOne({ email });
      if (!user) return res.status(400).json({ message: "Invalid email or password" });
  
      // Compare passwords
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(400).json({ message: "Invalid email or password" });
  
      // 🔍 Debugging: Check if JWT_SECRET is loaded
      console.log("JWT_SECRET:", process.env.JWT_SECRET);
  
      // Generate JWT token
      const payload = { userId: user._id };  // Define payload properly
      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
  
      res.status(200).json({ message: "Login successful!", token });
    } catch (error) {
      console.error("Signin Error:", error);
      res.status(500).json({ message: "Something went wrong", error: error.message });
    }
  });
  

  

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
