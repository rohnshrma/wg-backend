import { Router } from 'express';
import authRoutes from './auth.routes';
import studentRoutes from './student.routes';
import leadRoutes from './lead.routes';
import courseRoutes from './course.routes';
import paymentRoutes from './payment.routes';
import testimonialRoutes from './testimonial.routes';
import blogRoutes from './blog.routes';
import galleryRoutes from './gallery.routes';
import notificationRoutes from './notification.routes';
import analyticsRoutes from './analytics.routes';
import uploadRoutes from './upload.routes';
import settingsRoutes from './settings.routes';
import enquiryRoutes from './enquiry.routes';
import userRoutes from './user.routes';
import webhookRoutes from './webhook.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/students', studentRoutes);
router.use('/leads', leadRoutes);
router.use('/courses', courseRoutes);
router.use('/payments', paymentRoutes);
router.use('/testimonials', testimonialRoutes);
router.use('/blogs', blogRoutes);
router.use('/gallery', galleryRoutes);
router.use('/notifications', notificationRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/upload', uploadRoutes);
router.use('/settings', settingsRoutes);
router.use('/enquiries', enquiryRoutes);
router.use('/users', userRoutes);
router.use('/webhooks', webhookRoutes);

export default router;
