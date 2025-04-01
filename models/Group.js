import mongoose from "mongoose";

const GroupSchema = new mongoose.Schema({
  name: { type: String, required: true },
});

export default mongoose.model("Group", GroupSchema);
