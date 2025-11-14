// routes/forum.js

import express from "express";
import {
  getAllPosts,
  createPost,
  createComment,
} from "../controllers/forumController.js";
import { protect } from "../middleware/authMiddleware.js";
import upload from "../middleware/multer.js"; 

const router = express.Router();

// All forum routes are protected, so we use the 'protect' middleware
router.use(protect);

// GET /api/v1/forum/posts
// Fetches all posts with their comments and replies
router.get("/posts", getAllPosts);

// POST /api/v1/forum/posts
// Creates a new top-level post
// ✅ USE MIDDLEWARE: 'upload.single("image")' handles one file with the field name "image"
router.post("/posts", upload.single("image"), createPost);

// POST /api/v1/forum/posts/:postId/comments
// Creates a new comment or a reply to a comment
router.post("/posts/:postId/comments", createComment);

export default router;