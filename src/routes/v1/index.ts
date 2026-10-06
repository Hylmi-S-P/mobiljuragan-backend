import { Router } from 'express';
import { authRouter } from './auth.js';
import { adminAuthRouter } from './adminAuth.js';
import { vehicleRouter } from './vehicles.js';
import { bookingRouter } from './bookings.js';
import { adminBookingRouter } from './adminBookings.js';
import { adminFleetRouter } from './adminFleet.js';
import { adminVehicleRouter } from './adminVehicles.js';
import { adminDriverRouter } from './adminDrivers.js';
import { adminUserRouter } from './adminUsers.js';

export const v1Router: Router = Router();

// Admin Accounts Management: /api/v1/admin/users/*
v1Router.use('/admin/users', adminUserRouter);

// Customer Auth: /api/v1/auth/*
v1Router.use('/auth', authRouter);

// Admin Auth: /api/v1/admin/auth/*
v1Router.use('/admin/auth', adminAuthRouter);

// Admin Bookings & Operations: /api/v1/admin/bookings/*
v1Router.use('/admin/bookings', adminBookingRouter);

// Admin Fleet Calendar: /api/v1/admin/fleet/*
v1Router.use('/admin/fleet', adminFleetRouter);

// Admin Vehicle Management: /api/v1/admin/vehicles/*
v1Router.use('/admin/vehicles', adminVehicleRouter);

// Admin Driver Roster: /api/v1/admin/drivers/*
v1Router.use('/admin/drivers', adminDriverRouter);

// Vehicle Catalog & Availability: /api/v1/vehicles/*
v1Router.use('/vehicles', vehicleRouter);

// Booking Domain: /api/v1/bookings/*
v1Router.use('/bookings', bookingRouter);

