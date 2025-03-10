import mongoose from "mongoose";

const PaperSchema = new mongoose.Schema({
  title: { type: String, required: true, unique: true },
  link: { type: String, required: true },
  snippet: { type: String },
  authors: { type: String, default: "Unknown" },
});

const Paper = mongoose.model("Paper", PaperSchema);

export default Paper;
