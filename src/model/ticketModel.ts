import { db } from '../db.js';
import { TicketHandler, TicketStatus, type Prisma } from '../generated/prisma/client.js';

/**
 * Mengambil id tiket dari berbagai bentuk relasi yang diterima Prisma.
 *
 * `TicketMessageCreateInput` menerima relasi tiket dalam beberapa bentuk
 * (`connect`, `connectOrCreate`, `create`). Nomor urut hanya bisa dihitung kalau
 * tiketnya sudah ada, jadi hanya bentuk `connect` yang bisa dipakai.
 */
function extractTicketId(data: { ticket?: unknown }): string | undefined {
  const relasi = data.ticket as { connect?: { id?: string } } | undefined;
  return relasi?.connect?.id;
}

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
          orderBy: { sequence: 'asc' },
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
          orderBy: { sequence: 'asc' },
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

  /**
   * Riwayat pesan satu tiket, urut menurut `sequence`.
   *
   * Dipakai asisten AI untuk menyusun konteks percakapan, dan dipakai admin untuk
   * membaca riwayat yang sama. Keduanya sengaja memakai fungsi ini supaya yang
   * dijawab AI sama dengan yang dilihat admin.
   */
  listMessages(ticketId: string) {
    return db.ticketMessage.findMany({
      where: { ticketId },
      orderBy: { sequence: 'asc' },
      select: { id: true, body: true, isCustomer: true, isAi: true, sequence: true, sentAt: true },
    });
  },

  /**
   * Menyimpan satu pesan pada tiket, dengan nomor urut yang dihitung di dalam
   * transaksi yang sama.
   *
   * Nomor urut tidak boleh dihitung di luar transaksi. Kalau dihitung di luar,
   * dua pesan yang masuk hampir bersamaan bisa membaca angka terakhir yang sama
   * lalu bentrok pada indeks unik `[ticketId, sequence]`. Dengan menghitung di
   * dalam transaksi, pembacaan dan penulisan terjadi sebagai satu langkah.
   */
  async createMessage(data: Omit<Prisma.TicketMessageCreateInput, 'sequence'>) {
    const ticketId = extractTicketId(data);
    if (!ticketId) {
      // Tanpa id tiket, nomor urut tidak bisa dihitung. Biarkan Prisma yang
      // melaporkan galatnya, karena ini berarti pemanggilnya salah.
      return db.ticketMessage.create({ data: data as Prisma.TicketMessageCreateInput });
    }

    return db.$transaction(async (tx) => {
      const terakhir = await tx.ticketMessage.findFirst({
        where: { ticketId },
        orderBy: { sequence: 'desc' },
        select: { sequence: true },
      });

      const pesan = await tx.ticketMessage.create({
        data: { ...data, sequence: (terakhir?.sequence ?? 0) + 1 },
      });

      /* Setiap pesan baru menandai percakapan masih hidup.
       *
       * Tanpa ini, `lastActivityAt` hanya terisi saat tiket dibuat, sehingga tiket
       * yang sedang aktif dibalas pun tetap terhitung diam dan akan ditutup
       * otomatis pada siklus berikutnya. Diperbarui di dalam transaksi yang sama
       * supaya pesan dan penandanya tidak pernah terpisah. */
      await tx.supportTicket.update({
        where: { id: ticketId },
        data: { lastActivityAt: new Date() },
      });

      return pesan;
    });
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
    return ticketModel.createMessage({
      ticket: { connect: { id: ticketId } },
      body,
      isCustomer: false,
      isAi: true,
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
