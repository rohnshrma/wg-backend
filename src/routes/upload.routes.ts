import { Router, Request, Response } from 'express';
import multer from 'multer';
import { protect } from '../middleware/auth.middleware';
import cloudinary from '../config/cloudinary';
import asyncHandler from '../utils/asyncHandler';
import { sendResponse } from '../utils/apiResponse';
import { BadRequestError } from '../utils/apiError';

const router = Router();

// Multer memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: JPEG, PNG, WebP, GIF, PDF'));
    }
  },
});

// Upload single image
router.post('/image', protect, upload.single('file'), asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new BadRequestError('No file uploaded');

  const folder = (req.query.folder as string) || 'webigeeks/general';

  const result = await new Promise<any>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        transformation: [
          { width: 1200, crop: 'limit' },
          { quality: 'auto', fetch_format: 'auto' },
        ],
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    uploadStream.end(req.file!.buffer);
  });

  sendResponse(res, {
    statusCode: 201,
    message: 'Image uploaded successfully',
    data: {
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
    },
  });
}));

// Upload document (PDF)
router.post('/document', protect, upload.single('file'), asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new BadRequestError('No file uploaded');

  const folder = (req.query.folder as string) || 'webigeeks/documents';

  const result = await new Promise<any>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'raw',
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    uploadStream.end(req.file!.buffer);
  });

  sendResponse(res, {
    statusCode: 201,
    message: 'Document uploaded successfully',
    data: {
      url: result.secure_url,
      publicId: result.public_id,
    },
  });
}));

export default router;
