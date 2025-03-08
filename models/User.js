import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  phone: String,
  place: String,
  password: String, // Hashed password
});

const User = mongoose.model("User", userSchema);

export default User;
