import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  phone: String,
  place: String,
  password: String,
  searchHistory: [{ type: String }], // Store searched queries
});

export default mongoose.model("User", UserSchema);
