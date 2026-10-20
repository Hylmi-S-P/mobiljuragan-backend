import { Router } from 'express';
import { getFinanceSummary } from '../../controller/financeController.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { UserRole } from '../../generated/prisma/client.js';

export const adminFinanceRouter: Router = Router();

// Seluruh endpoint laporan keuangan dibatasi khusus role STAFF dan ADMIN
adminFinanceRouter.use(requireAuth);
adminFinanceRouter.use(requireRole(UserRole.ADMIN, UserRole.STAFF));

adminFinanceRouter.get('/summary', getFinanceSummary);
