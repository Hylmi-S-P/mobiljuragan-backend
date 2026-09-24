import { Router } from 'express';
import { authRouter } from './auth.js';
import { adminAuthRouter } from './adminAuth.js';

export const v1Router: Router = Router();

// Customer Auth: /api/v1/auth/*
v1Router.use('/auth', authRouter);

// Admin Auth: /api/v1/admin/auth/*
v1Router.use('/admin/auth', adminAuthRouter);
