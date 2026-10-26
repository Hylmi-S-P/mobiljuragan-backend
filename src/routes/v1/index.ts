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
import { adminTicketRouter } from './adminTickets.js';
import { adminFinanceRouter } from './financeRoutes.js';
import { adminAiRouter } from './adminAiRoutes.js';
import { faqRouter } from './faqs.js';
import { adminFaqRouter } from './adminFaqs.js';
import { paymentRouter } from './paymentRoutes.js';
import { adminPaymentRouter } from './adminPaymentRoutes.js';
import { ticketRouter } from './tickets.js';
import { customerAiRouter } from './customerAiRoutes.js';

export const v1Router: Router = Router();

// Manajemen pembayaran admin portal: /api/v1/admin/payments/*
v1Router.use('/admin/payments', adminPaymentRouter);

// Pemrosesan pembayaran & mutasi: /api/v1/payments/*
v1Router.use('/payments', paymentRouter);

// Laporan keuangan pemasukan: /api/v1/admin/finance/*
v1Router.use('/admin/finance', adminFinanceRouter);

// Modul AI Gateway & RAG Hub: /api/v1/admin/ai/*
v1Router.use('/admin/ai', adminAiRouter);

// Manajemen FAQ admin portal: /api/v1/admin/faqs/*
v1Router.use('/admin/faqs', adminFaqRouter);

// Manajemen akun staf & admin: /api/v1/admin/users/*
v1Router.use('/admin/users', adminUserRouter);

// Autentikasi pelanggan berbasis OTP: /api/v1/auth/*
v1Router.use('/auth', authRouter);

// Login staf & admin portal: /api/v1/admin/auth/*
v1Router.use('/admin/auth', adminAuthRouter);

// Antrean pesanan & konfirmasi admin: /api/v1/admin/bookings/*
v1Router.use('/admin/bookings', adminBookingRouter);

// Kalender jadwal armada: /api/v1/admin/fleet/*
v1Router.use('/admin/fleet', adminFleetRouter);

// Status operasional armada: /api/v1/admin/vehicles/*
v1Router.use('/admin/vehicles', adminVehicleRouter);

// Roster supir & penugasannya: /api/v1/admin/drivers/*
v1Router.use('/admin/drivers', adminDriverRouter);

// Tiket bantuan pelanggan: /api/v1/admin/tickets/*
v1Router.use('/admin/tickets', adminTicketRouter);

// Katalog armada & ketersediaannya: /api/v1/vehicles/*
v1Router.use('/vehicles', vehicleRouter);

// Pemesanan sewa sisi pelanggan: /api/v1/bookings/*
v1Router.use('/bookings', bookingRouter);

// Tanya jawab resmi dinamis (FAQ): /api/v1/faqs/*
v1Router.use('/faqs', faqRouter);

// Tiket bantuan sisi pelanggan: /api/v1/tickets/*
v1Router.use('/tickets', ticketRouter);

// Asisten AI interaktif sisi pelanggan / mobile: /api/v1/ai/*
v1Router.use('/ai', customerAiRouter);

// Pengunduhan template & verifikasi dokumen lepas kunci: /api/v1/documents/*, /api/v1/bookings/:id/documents
import { documentRouter } from './documentRoutes.js';
v1Router.use('/', documentRouter);


