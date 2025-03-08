import mongoose from "mongoose";

const paperSchema = mongoose.Schema(
  {
    title: { type: String, required: true },
    author: { type: String, required: true },
    abstract: { type: String, required: true },
  },
  { timestamps: true }
);

const Paper = mongoose.model("Paper", paperSchema);
export default Paper;