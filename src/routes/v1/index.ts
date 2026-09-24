import { Router } from 'express';
import { authRouter } from './auth.js';
import { adminAuthRouter } from './adminAuth.js';
import { vehicleRouter } from './vehicles.js';
import { bookingRouter } from './bookings.js';

export const v1Router: Router = Router();

// Customer Auth: /api/v1/auth/*
v1Router.use('/auth', authRouter);

// Admin Auth: /api/v1/admin/auth/*
v1Router.use('/admin/auth', adminAuthRouter);

// Vehicle Catalog & Availability: /api/v1/vehicles/*
v1Router.use('/vehicles', vehicleRouter);

// Booking Domain: /api/v1/bookings/*
v1Router.use('/bookings', bookingRouter);
