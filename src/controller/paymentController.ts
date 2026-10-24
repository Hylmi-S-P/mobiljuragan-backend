import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../lib/response.js';
import { paymentService } from '../services/payment.service.js';
import {
  adminVerifyPaymentSchema,
  createPaymentSchema,
  listPaymentQuerySchema,
  uploadPaymentProofSchema,
} from '../validators/paymentSchemas.js';

export const paymentController = {
  /**
   * POST /api/v1/payments
   * Inisiasi tagihan pembayaran untuk booking yang sudah memiliki tarif sewa.
   */
  async createPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = createPaymentSchema.parse(req.body);
      const actorUserId = req.user?.userId;

      const payment = await paymentService.createPayment({
        bookingId: body.bookingId,
        method: body.method,
        notes: body.notes,
        actorUserId,
      });

      sendSuccess(res, payment, 201);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/payments/booking/:bookingId
   * Mengambil detail dan status pembayaran berdasarkan ID booking atau kode booking.
   */
  async getPaymentByBookingId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { bookingId } = req.params;
      const payment = await paymentService.getPaymentByBookingId(bookingId);
      sendSuccess(res, payment);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/payments/:id
   * Mengambil detail pembayaran berdasarkan ID pembayaran.
   */
  async getPaymentById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const payment = await paymentService.getPaymentById(id);
      sendSuccess(res, payment);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/payments/:id/proof
   * Unggah bukti transfer pembayaran manual (Bank Transfer).
   */
  async uploadPaymentProof(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const body = uploadPaymentProofSchema.parse(req.body);
      const actorUserId = req.user?.userId;

      const updated = await paymentService.uploadPaymentProof(id, {
        proofImageUrl: body.proofImageUrl,
        senderAccount: body.senderAccount,
        bankName: body.bankName,
        actorUserId,
      });

      sendSuccess(res, updated);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/admin/payments
   * Antrean verifikasi pembayaran admin portal dengan filter tab & pagination.
   */
  async adminListPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listPaymentQuerySchema.parse(req.query);
      const result = await paymentService.adminListPayments({
        status: query.status,
        method: query.method,
        search: query.search,
        page: query.page,
        limit: query.limit,
      });

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/v1/admin/payments/:id/verify
   * Persetujuan atau penolakan bukti transfer oleh admin/staf.
   */
  async adminVerifyPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const body = adminVerifyPaymentSchema.parse(req.body);
      const verifierUserId = req.user?.userId || 'ADMIN_USER';
      const verifierName = req.user?.fullName || 'Admin MobilJuragan';
      const acknowledgedBy = req.user?.fullName
        ? `${req.user.fullName} (${verifierUserId})`
        : verifierUserId;

      const updated = await paymentService.adminVerifyPayment(id, {
        action: body.action,
        notes: body.notes,
        verifierUserId,
        verifierName,
        acknowledgedBy,
        acknowledgedAt: new Date(),
      });

      sendSuccess(res, updated);
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/v1/admin/payments/:id/reject
   * Shortcut penolakan pembayaran langsung.
   */
  async adminRejectPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const notes = (req.body?.notes as string) || 'Bukti transfer tidak valid';
      const verifierUserId = req.user?.userId || 'ADMIN_USER';
      const verifierName = req.user?.fullName || 'Admin MobilJuragan';

      const updated = await paymentService.adminVerifyPayment(id, {
        action: 'REJECT',
        notes,
        verifierUserId,
        verifierName,
      });

      sendSuccess(res, updated);
    } catch (error) {
      next(error);
    }
  },
};
