import { Router } from 'express';
import { getFinanceSummary } from '../../controller/financeController.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { UserRole } from '../../generated/prisma/client.js';

export const adminFinanceRouter: Router = Router();

// Seluruh endpoint laporan keuangan dibatasi khusus role ADMIN dan SUPER_ADMIN
adminFinanceRouter.use(requireAuth);
adminFinanceRouter.use(requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN));

adminFinanceRouter.get('/summary', getFinanceSummary);
