import jwt from 'jsonwebtoken';

const auth = (req, res, next) => {
  try {
    const token = req.header('Authorization').replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { 
      id: decoded.userId,
      userId: decoded.userId  // Add both formats for compatibility
    };
    next();
  } catch (error) {
    res.status(401).json({ message: 'Please authenticate' });
  }
};

export default auth;
