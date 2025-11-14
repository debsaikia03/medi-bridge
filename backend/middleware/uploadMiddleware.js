import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";
import dotenv from 'dotenv';

dotenv.config({});

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ 1. CONFIGURE CLOUDINARY STORAGE
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  // ✅ FIX: 'params' itself should be a function that returns the object
  params: async (req, file) => {
    return {
      folder: "medi-bridge-forum", // Or any folder name you prefer
      format: 'auto', // Automatically detect format
      public_id: new Date().toISOString() + '-' + file.originalname, // Create a unique file name
    };
  },
});

// ✅ 2. Initialize Multer WITH the new storage
const upload = multer({
    storage: storage, // Use the Cloudinary storage engine
});

export default upload;