import express from "express";
import axios from "axios";
import Paper from "../models/Paper.js";

const router = express.Router();

// ✅ GET papers from MongoDB + Scrape new data
router.get("/", async (req, res) => {
  try {
    const query = req.query.query || "deep learning";
    
    // 🔹 Step 1: Fetch data from MongoDB
    const dbPapers = await Paper.find({ title: { $regex: query, $options: "i" } });

    // 🔹 Step 2: Fetch scraped data from Flask API
    const scrapedResponse = await axios.get(`http://127.0.0.1:5000/scrape?query=${query}`);
    const scrapedPapers = scrapedResponse.data;

    // 🔹 Step 3: Save new scraped data to MongoDB (avoid duplicates)
    for (const paper of scrapedPapers) {
      const exists = await Paper.findOne({ title: paper.title });
      if (!exists) {
        await Paper.create({
          title: paper.title,
          author: paper.author || "Unknown",
          abstract: paper.abstract || "No abstract available",
        });
      }
    }

    // 🔹 Step 4: Combine results & send response
    res.json({ dbPapers, scrapedPapers });
  } catch (error) {
    console.error("❌ Error fetching data:", error);
    res.status(500).json({ message: "Server Error" });
  }
});


export default router;
