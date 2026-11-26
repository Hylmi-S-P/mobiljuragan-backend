-- Indeks komposit untuk mempercepat kueri filter + sort utama tanpa mengubah struktur data

-- users
CREATE INDEX `users_role_createdAt_idx` ON `users`(`role`, `createdAt`);

-- bookings
CREATE INDEX `bookings_customerId_createdAt_idx` ON `bookings`(`customerId`, `createdAt`);
CREATE INDEX `bookings_status_createdAt_idx` ON `bookings`(`status`, `createdAt`);
CREATE INDEX `bookings_createdAt_idx` ON `bookings`(`createdAt`);
CREATE INDEX `bookings_vehicleId_status_startDateTime_endDateTime_idx` ON `bookings`(`vehicleId`, `status`, `startDateTime`, `endDateTime`);
CREATE INDEX `bookings_driverId_status_startDateTime_endDateTime_idx` ON `bookings`(`driverId`, `status`, `startDateTime`, `endDateTime`);
CREATE INDEX `bookings_status_endDateTime_idx` ON `bookings`(`status`, `endDateTime`);

-- support_tickets
CREATE INDEX `support_tickets_status_updatedAt_idx` ON `support_tickets`(`status`, `updatedAt`);
CREATE INDEX `support_tickets_assignedAdminId_updatedAt_idx` ON `support_tickets`(`assignedAdminId`, `updatedAt`);
CREATE INDEX `support_tickets_updatedAt_idx` ON `support_tickets`(`updatedAt`);
CREATE INDEX `support_tickets_customerId_status_updatedAt_idx` ON `support_tickets`(`customerId`, `status`, `updatedAt`);
CREATE INDEX `support_tickets_customerId_handledBy_status_updatedAt_idx` ON `support_tickets`(`customerId`, `handledBy`, `status`, `updatedAt`);
CREATE INDEX `support_tickets_bookingId_status_lastActivityAt_idx` ON `support_tickets`(`bookingId`, `status`, `lastActivityAt`);

-- payments
CREATE INDEX `payments_status_createdAt_idx` ON `payments`(`status`, `createdAt`);
CREATE INDEX `payments_createdAt_idx` ON `payments`(`createdAt`);
CREATE INDEX `payments_status_expiresAt_idx` ON `payments`(`status`, `expiresAt`);
CREATE INDEX `payments_status_verifiedAt_idx` ON `payments`(`status`, `verifiedAt`);

-- booking_refunds
CREATE INDEX `booking_refunds_status_dicatatPada_idx` ON `booking_refunds`(`status`, `dicatatPada`);
CREATE INDEX `booking_refunds_status_diselesaikanPada_idx` ON `booking_refunds`(`status`, `diselesaikanPada`);

-- knowledge_chunks
CREATE INDEX `knowledge_chunks_isActive_idx` ON `knowledge_chunks`(`isActive`);
