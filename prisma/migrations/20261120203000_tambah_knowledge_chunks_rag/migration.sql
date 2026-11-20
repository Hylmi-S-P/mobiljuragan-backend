-- Potongan pengetahuan (chunk) beserta vektor embedding untuk Hybrid RAG (Cosine + BM25).

CREATE TABLE `knowledge_chunks` (
  `id` VARCHAR(191) NOT NULL,
  `sourceType` ENUM('DOCUMENT', 'FAQ') NOT NULL,
  `documentId` VARCHAR(191) NULL,
  `faqId` VARCHAR(191) NULL,
  `chunkIndex` INTEGER NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  `content` TEXT NOT NULL,
  `contentHash` CHAR(64) NOT NULL,
  `tokenCount` INTEGER NOT NULL DEFAULT 0,
  `embeddingModel` VARCHAR(120) NULL,
  `embeddingDims` INTEGER NOT NULL DEFAULT 0,
  `embeddingJson` LONGTEXT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `knowledge_chunks_documentId_chunkIndex_key`(`documentId`, `chunkIndex`),
  UNIQUE INDEX `knowledge_chunks_faqId_chunkIndex_key`(`faqId`, `chunkIndex`),
  INDEX `knowledge_chunks_sourceType_isActive_idx`(`sourceType`, `isActive`),
  INDEX `knowledge_chunks_documentId_idx`(`documentId`),
  INDEX `knowledge_chunks_faqId_idx`(`faqId`),
  INDEX `knowledge_chunks_contentHash_idx`(`contentHash`),
  INDEX `knowledge_chunks_category_idx`(`category`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `knowledge_chunks`
  ADD CONSTRAINT `knowledge_chunks_documentId_fkey`
  FOREIGN KEY (`documentId`) REFERENCES `knowledge_documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `knowledge_chunks`
  ADD CONSTRAINT `knowledge_chunks_faqId_fkey`
  FOREIGN KEY (`faqId`) REFERENCES `faqs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
