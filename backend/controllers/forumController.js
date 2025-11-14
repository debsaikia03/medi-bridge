// controllers/forumController.js

import Post from "../models/postModel.js";
import Comment from "../models/commentModel.js";
import sharp from "sharp"
import cloudinary from "../utils/cloudinary.js";

/**
 * @desc    Helper function to capitalize user role
 * @param   {string} role - "user" or "doctor"
 * @returns {string} "User" or "Doctor"
 */
const capitalizeRole = (role) => {
  if (!role) return "User"; // Fallback
  return role.charAt(0).toUpperCase() + role.slice(1);
};

/**
 * @desc    Define recursive population options for comments and replies
 */
const commentPopulation = {
  path: "replies",
  // Populate the author of the reply
  populate: [
    {
      path: "author",
      // ✅ FIX 1: Remove the 'select' string
      // select: "name specialization", 
    },
    // Recursively populate replies of replies
    {
      path: "replies",
      populate: {
        path: "author",
        // ✅ FIX 2: Remove the 'select' string
        // select: "name specialization",
      },
    },
  ],
};

/**
 * @desc    Get all posts with nested comments and replies
 * @route   GET /api/v1/forum/posts
 * @access  Protected
 */
export const getAllPosts = async (req, res) => {
  try {
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      // ✅ FIX 3: Remove the 'select' string
      .populate("author"/*, "name specialization"*/) 
      .populate({
        path: "comments",
        populate: [
          {
            path: "author",
            // ✅ FIX 4: Remove the 'select' string
            // select: "name specialization",
          },
          commentPopulation,
        ],
        options: { sort: { createdAt: 1 } }, 
      });

    res.status(200).json(posts);
  } catch (error) {
    res.status(500).json({ message: "Error fetching posts", error: error.message });
  }
};

/**
 * @desc    Create a new post
 * @route   POST /api/v1/forum/posts
 * @access  Protected
 */
export const createPost = async (req, res) => {
  try {
    const { content } = req.body;
    const image = req.file;
    const authorId = req.user.id;
    const authorType = capitalizeRole(req.user.role);

    // allow either text or image
    if (!content?.trim() && !image) {
      return res.status(400).json({ message: "Content or image is required" });
    }

    let imageUrl;
    if (image) {
      const optimizedImageBuffer = await sharp(image.buffer)
        .resize({ width: 800, height: 800, fit: "inside" })
        .toFormat("jpeg", { quality: 80 })
        .toBuffer();

      const fileUri = `data:image/jpeg;base64,${optimizedImageBuffer.toString("base64")}`;
      const cloudResponse = await cloudinary.uploader.upload(fileUri, {
        folder: "medi-bridge/forum",
        resource_type: "image",
      });

      imageUrl = cloudResponse.secure_url;
    }

    const post = await Post.create({
      content: content?.trim() || "",
      imageUrl, // align with frontend/interface
      author: authorId,
      authorType,
    });

    // ✅ FIX 5: Remove the 'select' string
    const populatedPost = await Post.findById(post._id).populate("author"/*, "name specialization"*/);
    res.status(201).json(populatedPost);
  } catch (error) {
    console.error("Create post error:", error);
    res.status(500).json({ message: "Error creating post", error: error.message });
  }
};

/**
 * @desc    Create a new comment or reply
 * @route   POST /api/v1/forum/posts/:postId/comments
 * @access  Protected
 */
export const createComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { content, parentCommentId } = req.body; 
    const authorId = req.user.id;
    const authorType = capitalizeRole(req.user.role);

    if (!content) {
      return res.status(400).json({ message: "Comment content cannot be empty" });
    }

    const newComment = await Comment.create({
      content,
      author: authorId,
      authorType: authorType,
      post: postId,
      parentComment: parentCommentId || null,
    });

    if (parentCommentId) {
      await Comment.findByIdAndUpdate(parentCommentId, {
        $push: { replies: newComment._id },
      });
    } else {
      await Post.findByIdAndUpdate(postId, {
        $push: { comments: newComment._id },
      });
    }

    // ✅ FIX 6: Remove the 'select' string
    const populatedComment = await Comment.findById(newComment._id).populate(
      "author"/*,
      "name specialization"*/
    );

    res.status(201).json(populatedComment);
  } catch (error) {
    res.status(500).json({ message: "Error creating comment", error: error.message });
  }
};