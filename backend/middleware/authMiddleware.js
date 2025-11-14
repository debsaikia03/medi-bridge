import jwt from "jsonwebtoken";

export const protect = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ **UPDATE THIS LINE**
    req.user = { id: decoded.id, role: decoded.role }; // Attach both id and role

    next();
  } catch (error) {
    res.status(401).json({ message: "Token failed", error: error.message });
  }
};
