import { db } from '../db.js';
import { UserRole, type Prisma } from '../generated/prisma/client.js';

/**
 * Lapisan model untuk tabel `users`.
 *
 * Sesuai pemisahan tanggung jawab, hanya lapisan ini yang berbicara ke database.
 * Controller memanggil fungsi di sini dan tidak pernah menyusun query sendiri.
 */

/** Kolom yang aman dikirim ke klien. `passwordHash` sengaja tidak pernah ikut. */
const PUBLIC_FIELDS = {
  id: true,
  fullName: true,
  phoneNumber: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Peran yang dikelola lewat portal: admin dan staf operasional, bukan pelanggan. */
const STAFF_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.STAFF];

export const userModel = {
  listStaffAndAdmin() {
    return db.user.findMany({
      where: { role: { in: STAFF_ROLES } },
      orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
      select: PUBLIC_FIELDS,
    });
  },

  findStaffOrAdminById(id: string) {
    return db.user.findFirst({
      where: { id, role: { in: STAFF_ROLES } },
      select: PUBLIC_FIELDS,
    });
  },

  findByPhoneNumber(phoneNumber: string) {
    return db.user.findUnique({ where: { phoneNumber } });
  },

  findById(id: string) {
    return db.user.findUnique({ where: { id } });
  },

  /** Login portal boleh memakai nama staf, bukan hanya nomor telepon. */
  findFirstByNameOrPhone(identifier: string) {
    return db.user.findFirst({
      where: {
        OR: [
          { phoneNumber: identifier },
          { fullName: { contains: identifier } },
        ],
      },
    });
  },

  createAuditLog(data: Prisma.AuditLogUncheckedCreateInput) {
    return db.auditLog.create({ data });
  },

  findActiveSessionUser(id: string) {
    return db.user.findUnique({
      where: { id },
      select: { id: true, fullName: true, phoneNumber: true, role: true, isActive: true },
    });
  },

  countActiveAdmins() {
    return db.user.count({ where: { role: UserRole.ADMIN, isActive: true } });
  },

  create(data: Prisma.UserCreateInput) {
    return db.user.create({ data, select: PUBLIC_FIELDS });
  },

  update(id: string, data: Prisma.UserUpdateInput) {
    return db.user.update({ where: { id }, data, select: PUBLIC_FIELDS });
  },

  delete(id: string) {
    return db.user.delete({ where: { id } });
  },

  /**
   * Membuat akun beserta catatan auditnya dalam satu transaksi.
   * Keduanya harus berhasil bersama, supaya tidak ada akun tanpa jejak pembuatnya.
   *
   * `entityId` dan metadata diisi dari hasil pembuatan, karena id akun baru belum ada
   * saat pemanggil menyusun permintaan.
   */
  createWithAudit(
    data: Prisma.UserCreateInput,
    audit: { actorId: string; action: string }
  ) {
    return db.$transaction(async (tx) => {
      const created = await tx.user.create({ data, select: PUBLIC_FIELDS });

      await tx.auditLog.create({
        data: {
          actorId: audit.actorId,
          action: audit.action,
          entityType: 'User',
          entityId: created.id,
          metadata: {
            fullName: created.fullName,
            phoneNumber: created.phoneNumber,
            role: created.role,
          },
        },
      });

      return created;
    });
  },

  /** Memperbarui akun beserta catatan auditnya dalam satu transaksi. */
  updateWithAudit(
    id: string,
    data: Prisma.UserUpdateInput,
    audit: {
      actorId: string;
      action: string;
      entityType: string;
      entityId?: string;
      metadata?: Prisma.InputJsonValue;
    }
  ) {
    return db.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id }, data, select: PUBLIC_FIELDS });
      await tx.auditLog.create({ data: audit });
      return updated;
    });
  },

  /**
   * Menghapus akun beserta catatan auditnya dalam satu transaksi.
   * Audit ditulis lebih dulu; actorId milik pelaku, bukan akun sasaran, sehingga
   * baris audit tetap utuh setelah akun sasaran hilang.
   */
  deleteWithAudit(
    id: string,
    audit: {
      actorId: string;
      action: string;
      entityType: string;
      entityId?: string;
      metadata?: Prisma.InputJsonValue;
    }
  ) {
    return db.$transaction(async (tx) => {
      await tx.auditLog.create({ data: audit });
      await tx.user.delete({ where: { id } });
    });
  },
  /** Hitungan relasi yang menghalangi penghapusan akun (FK memakai RESTRICT). */
  async countBlockingReferences(id: string) {
    const [bookingCount, ticketCount, messageCount, otpCount] = await Promise.all([
      db.booking.count({ where: { customerId: id } }),
      db.supportTicket.count({ where: { customerId: id } }),
      db.ticketMessage.count({ where: { senderId: id } }),
      db.otpVerification.count({ where: { userId: id } }),
    ]);

    return { bookingCount, ticketCount, messageCount, otpCount };
  },
};
