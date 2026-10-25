import { db } from '../db.js';
import { TicketHandler, TicketStatus, type Prisma } from '../generated/prisma/client.js';

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

  /** Daftar tiket milik pelanggan tertentu beserta riwayat pesan. */
  listForCustomer(customerId: string, filter?: { status?: TicketStatus }) {
    return db.supportTicket.findMany({
      where: {
        customerId,
        ...(filter?.status ? { status: filter.status } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        customer: { select: { id: true, fullName: true, phoneNumber: true } },
        messages: {
          orderBy: { sentAt: 'asc' },
          include: {
            sender: { select: { id: true, fullName: true, role: true } },
          },
        },
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
    const prefix = `TKT-${stamp}-`;

    const lastTicket = await db.supportTicket.findFirst({
      where: { ticketNumber: { startsWith: prefix } },
      orderBy: { ticketNumber: 'desc' },
      select: { ticketNumber: true },
    });

    let nextSeq = 1;
    if (lastTicket?.ticketNumber) {
      const match = lastTicket.ticketNumber.match(/(\d+)$/);
      if (match) {
        nextSeq = parseInt(match[1], 10) + 1;
      }
    }

    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
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

  /**
   * Mencari sesi percakapan AI yang masih terbuka untuk satu pelanggan.
   *
   * Dipakai supaya pertanyaan berikutnya memakai tiket yang sama, bukan membuat
   * tiket baru. Sesi dianggap selesai ketika tiket sudah RESOLVED atau CLOSED.
   */
  findOpenAiSession(customerId: string) {
    return db.supportTicket.findFirst({
      where: {
        customerId,
        handledBy: TicketHandler.AI,
        status: { notIn: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
      },
      orderBy: { updatedAt: 'desc' },
    });
  },

  /**
   * Menyimpan satu balasan asisten AI pada tiket.
   *
   * Pesan AI tidak punya pengirim manusia, jadi `senderId` sengaja dikosongkan dan
   * `isAi` diisi true. Dengan begitu riwayat bisa dibaca admin tanpa menebak mana
   * yang dijawab mesin.
   */
  createAiMessage(ticketId: string, body: string) {
    return db.ticketMessage.create({
      data: {
        ticket: { connect: { id: ticketId } },
        body,
        isCustomer: false,
        isAi: true,
      },
    });
  },

  /**
   * Menyerahkan tiket dari asisten AI ke admin.
   *
   * Hanya berlaku untuk tiket yang masih dipegang AI. Kalau dipanggil dua kali,
   * panggilan kedua tidak mengubah apa pun, sehingga waktu penyerahan yang
   * tercatat tetap yang pertama.
   */
  async handoverToHuman(ticketId: string, at: Date) {
    const hasil = await db.supportTicket.updateMany({
      where: { id: ticketId, handledBy: TicketHandler.AI },
      data: { handledBy: TicketHandler.HUMAN, handoverAt: at },
    });
    return hasil.count > 0;
  },

  /**
   * Menutup otomatis tiket berstatus RESOLVED yang telah melewati batas masa tenggang (default 24 jam)
   * tanpa adanya tanggapan atau pesan balasan baru dari pelanggan.
   */
  async autoCloseResolvedTickets(olderThanHours = 24) {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    const result = await db.supportTicket.updateMany({
      where: {
        status: TicketStatus.RESOLVED,
        updatedAt: { lte: cutoff },
      },
      data: {
        status: TicketStatus.CLOSED,
      },
    });
    return result.count;
  },

  /**
   * Menutup otomatis sesi AI yang ditinggalkan tanpa pesan baru selama lebih dari 24 jam.
   */
  async autoCloseStaleAiSessions(olderThanHours = 24) {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    const result = await db.supportTicket.updateMany({
      where: {
        handledBy: TicketHandler.AI,
        status: { notIn: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
        updatedAt: { lte: cutoff },
      },
      data: {
        status: TicketStatus.CLOSED,
      },
    });
    return result.count;
  },

  /**
   * Pelanggan menutup tiket bantuannya sendiri.
   */
  async closeTicketByCustomer(ticketId: string, customerId: string) {
    const result = await db.supportTicket.updateMany({
      where: {
        id: ticketId,
        customerId,
      },
      data: {
        status: TicketStatus.CLOSED,
      },
    });
    return result.count > 0;
  },
};
