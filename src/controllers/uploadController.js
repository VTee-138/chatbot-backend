const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for image uploads
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../public/uploads/images');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp_randomstring.ext
    const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `image_${uniqueSuffix}${ext}`);
  }
});

// Configure multer for file uploads
const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../public/uploads/files');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp_randomstring.ext
    const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `file_${uniqueSuffix}${ext}`);
  }
});

// File filter for images
const imageFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'), false);
  }
};

// File filter for general files
const fileFilter = (req, file, cb) => {
  // Allow most common file types
  const allowedMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/gif',
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type.'), false);
  }
};

// Multer middleware
const uploadImage = multer({
  storage: imageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for images
  },
  fileFilter: imageFilter,
}).single('image');

const uploadFile = multer({
  storage: fileStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for files
  },
  fileFilter: fileFilter,
}).single('file');

class UploadController {
  /**
   * Upload image
   * POST /api/v1/upload/image
   */
  async uploadImage(req, res) {
    uploadImage(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        console.error('❌ Multer error:', err);
        return res.status(400).json({
          success: false,
          error: err.message,
        });
      } else if (err) {
        console.error('❌ Upload error:', err);
        return res.status(400).json({
          success: false,
          error: err.message,
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
        });
      }

      // Generate public URL
      const protocol = req.protocol; // http or https
      const host = req.get('host'); // domain:port
      const fileUrl = `${protocol}://${host}/uploads/images/${req.file.filename}`;

      console.log('✅ Image uploaded:', {
        filename: req.file.filename,
        size: req.file.size,
        url: fileUrl,
      });

      return res.json({
        success: true,
        data: {
          filename: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size,
          mimeType: req.file.mimetype,
          url: fileUrl,
        },
      });
    });
  }

  /**
   * Upload file
   * POST /api/v1/upload/file
   */
  async uploadFile(req, res) {
    uploadFile(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        console.error('❌ Multer error:', err);
        return res.status(400).json({
          success: false,
          error: err.message,
        });
      } else if (err) {
        console.error('❌ Upload error:', err);
        return res.status(400).json({
          success: false,
          error: err.message,
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
        });
      }

      // Generate public URL
      const protocol = req.protocol; // http or https
      const host = req.get('host'); // domain:port
      const fileUrl = `${protocol}://${host}/uploads/files/${req.file.filename}`;

      console.log('✅ File uploaded:', {
        filename: req.file.filename,
        size: req.file.size,
        url: fileUrl,
      });

      return res.json({
        success: true,
        data: {
          filename: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size,
          mimeType: req.file.mimetype,
          url: fileUrl,
        },
      });
    });
  }

  /**
   * Delete uploaded file (cleanup after Zalo stores it)
   * DELETE /api/v1/upload/cleanup/:filename
   */
  async deleteUploadedFile(req, res) {
    try {
      const { filename } = req.params;
      const { type } = req.query; // 'image' or 'file'

      if (!filename) {
        return res.status(400).json({
          success: false,
          error: 'Filename is required',
        });
      }

      // Determine folder based on type
      const folder = type === 'image' ? 'images' : 'files';
      const filePath = path.join(__dirname, '../../public/uploads', folder, filename);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.log('⚠️ File not found, might be already deleted:', filename);
        return res.json({
          success: true,
          message: 'File not found (might be already deleted)',
        });
      }

      // Delete file
      fs.unlinkSync(filePath);
      console.log('🗑️ Temporary file deleted:', filename);

      return res.json({
        success: true,
        message: 'File deleted successfully',
        filename,
      });
    } catch (error) {
      console.error('❌ Error deleting file:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

module.exports = new UploadController();
