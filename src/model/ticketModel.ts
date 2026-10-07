import { db } from '../db.js';
import { TicketStatus, type Prisma } from '../generated/prisma/client.js';

/**
 * Lapisan model untuk tabel `support_tickets` dan `ticket_messages`.
 *
 * Modul customer care sebelumnya belum punya endpoint sama sekali di backend,
 * padahal tabelnya sudah ada sejak migrasi awal. Model ini yang menjadi satu-satunya
 * tempat query ke kedua tabel tersebut.
 */
export const ticketModel = {
  /** Daftar tiket beserta jumlah pesan, diurutkan dari yang paling baru diperbarui. */
  listWithCounts(filter?: { status?: TicketStatus }) {
    return db.supportTicket.findMany({
      where: filter?.status ? { status: filter.status } : undefined,
      orderBy: { updatedAt: 'desc' },
      include: {
        customer: { select: { id: true, fullName: true, phoneNumber: true } },
        _count: { select: { messages: true } },
      },
    });
  },

  findById(id: string) {
    return db.supportTicket.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, fullName: true, phoneNumber: true } },
        messages: {
          orderBy: { sentAt: 'asc' },
          include: {
            sender: { select: { id: true, fullName: true, role: true } },
          },
        },
      },
    });
  },

  /** Nomor tiket berurutan per hari, mis. TKT-20261006-0001. */
  async nextTicketNumber(now: Date): Promise<string> {
    const stamp = now.toISOString().slice(0, 10).replace(/-/g, '');
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const createdToday = await db.supportTicket.count({
      where: { createdAt: { gte: startOfDay } },
    });

    return `TKT-${stamp}-${String(createdToday + 1).padStart(4, '0')}`;
  },

  create(data: Prisma.SupportTicketCreateInput) {
    return db.supportTicket.create({ data });
  },

  updateStatus(id: string, status: TicketStatus) {
    return db.supportTicket.update({ where: { id }, data: { status } });
  },

  createMessage(data: Prisma.TicketMessageCreateInput) {
    return db.ticketMessage.create({ data });
  },
};
