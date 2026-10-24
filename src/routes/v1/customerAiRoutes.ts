import { Router } from 'express';
import { handleCustomerAiChat } from '../../controller/aiCustomerChatController.js';
import { optionalAuth } from '../../middleware/auth.js';
import { aiChatRateLimiter } from '../../middleware/rateLimiter.js';

export const customerAiRouter: Router = Router();

// Endpoint chat publik/pelanggan (opsional autentikasi untuk mendeteksi user login)
customerAiRouter.post('/chat', aiChatRateLimiter, optionalAuth, handleCustomerAiChat);
