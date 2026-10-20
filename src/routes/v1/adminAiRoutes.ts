import { Router } from 'express';
import {
  getAiConfig,
  updateAiConfig,
  getKnowledgeDocuments,
  createKnowledgeDocument,
  updateKnowledgeDocument,
  deleteKnowledgeDocument,
  fetchGatewayModels,
  checkAiGatewayHealth,
  testChatSandbox,
  getAiGatewayLogs,
  clearAiGatewayLogs,
  parseKnowledgeFile,
} from '../../controller/aiConfigController.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { UserRole } from '../../generated/prisma/client.js';

export const adminAiRouter: Router = Router();

// Seluruh endpoint AI & RAG Hub dibatasi khusus STAFF dan ADMIN
adminAiRouter.use(requireAuth);
adminAiRouter.use(requireRole(UserRole.ADMIN, UserRole.STAFF));

// Konfigurasi & Health Monitoring Gateway
adminAiRouter.get('/config', getAiConfig);
adminAiRouter.put('/config', updateAiConfig);
adminAiRouter.get('/models', fetchGatewayModels);
adminAiRouter.get('/health', checkAiGatewayHealth);
adminAiRouter.get('/logs', getAiGatewayLogs);
adminAiRouter.delete('/logs', clearAiGatewayLogs);

// Basis Pengetahuan (Knowledge Base RAG) & Parse File
adminAiRouter.get('/documents', getKnowledgeDocuments);
adminAiRouter.post('/documents', createKnowledgeDocument);
adminAiRouter.post('/documents/parse-file', parseKnowledgeFile);
adminAiRouter.put('/documents/:id', updateKnowledgeDocument);
adminAiRouter.delete('/documents/:id', deleteKnowledgeDocument);

// Test Chat Sandbox
adminAiRouter.post('/chat/test', testChatSandbox);
