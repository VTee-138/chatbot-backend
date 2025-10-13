const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const { authenticate } = require('../middleware/auth');

/**
 * @route   POST /api/v1/upload/image
 * @desc    Upload an image file
 * @access  Private (requires authentication)
 */
router.post('/image', authenticate, uploadController.uploadImage);

/**
 * @route   POST /api/v1/upload/file
 * @desc    Upload a file
 * @access  Private (requires authentication)
 */
router.post('/file', authenticate, uploadController.uploadFile);

/**
 * @route   DELETE /api/v1/upload/cleanup/:filename
 * @desc    Delete temporary uploaded file after Zalo stores it
 * @access  Private (requires authentication)
 * @query   type - 'image' or 'file'
 */
router.delete('/cleanup/:filename', authenticate, uploadController.deleteUploadedFile);

module.exports = router;
