import mongoose from "mongoose";

const searchSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userEmail: { type: String, required: true },
    query: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  });

const Search = mongoose.model("Search", searchSchema);

export default Search;