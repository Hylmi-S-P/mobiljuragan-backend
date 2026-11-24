import { db } from '../db.js';
import { TicketCategory, TicketHandler, TicketStatus, type Prisma } from '../generated/prisma/client.js';
import { NOMOR_WHATSAPP_KANTOR, formatWaktuBantuan } from '../lib/kontak.js';
import { AppError } from '../lib/response.js';
import { publishTicketEvent } from '../lib/ticketEvents.js';

/** Status tiket yang sudah final dan tidak boleh menerima pesan baru. */
const STATUS_FINAL: TicketStatus[] = [TicketStatus.RESOLVED, TicketStatus.CLOSED];

/**
 * Menyusun pesan pembuka percakapan bantuan untuk satu pesanan.
 */
export function susunPesanPembukaBantuan(booking: {
  bookingCode: string;
  startDateTime: Date;
  endDateTime: Date;
  pickupLocation: string | null;
  rentalType: string;
  vehicle: { name: string; licensePlate: string };
  driver?: { fullName: string; phoneNumber: string | null } | null;
}): string {
  const baris = [
    `Halo, ini percakapan bantuan untuk pesanan ${booking.bookingCode}.`,
    '',
    `Unit: ${booking.vehicle.name} (${booking.vehicle.licensePlate})`,
    `Jadwal: ${formatWaktuBantuan(booking.startDateTime)} sampai ${formatWaktuBantuan(booking.endDateTime)}`,
    `Titik jemput: ${booking.pickupLocation ?? 'Kantor MobilJuragan'}`,
  ];

  if (booking.rentalType === 'WITH_DRIVER') {
    baris.push(
      booking.driver
        ? `Supir: ${booking.driver.fullName}${booking.driver.phoneNumber ? ` (${booking.driver.phoneNumber})` : ''}`
        : 'Supir: belum ditugaskan',
    );
  }

  baris.push(
    '',
    `Tulis kebutuhan Anda di sini. Bila perlu bicara langsung, kantor bisa dihubungi di ${NOMOR_WHATSAPP_KANTOR}.`,
  );

  return baris.join('\n');
}

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
  listWithCounts(filter?: { status?: TicketStatus; visibleToAdminId?: string }) {
    const where: Prisma.SupportTicketWhereInput = {
      ...(filter?.status ? { status: filter.status } : {}),
      ...(filter?.visibleToAdminId
        ? {
            OR: [
              { assignedAdminId: null },
              { assignedAdminId: filter.visibleToAdminId },
            ],
          }
        : {}),
    };

    return db.supportTicket.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: { updatedAt: 'desc' },
      include: {
        /* Nama penjawab supaya daftar bisa menandai tiket yang sedang dipegang
           admin lain. Hanya nama: tampilan tidak butuh data lain. */
        assignedAdmin: { select: { id: true, fullName: true } },
        customer: { select: { id: true, fullName: true, phoneNumber: true } },
        /* Kode pesanan supaya admin tahu tiket ini soal sewa yang mana tanpa
           harus membuka percakapannya lebih dulu. */
        booking: { select: { id: true, bookingCode: true, status: true } },
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
        booking: { select: { id: true, bookingCode: true, status: true } },
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
        assignedAdmin: { select: { id: true, fullName: true } },
        customer: { select: { id: true, fullName: true, phoneNumber: true } },
        booking: { select: { id: true, bookingCode: true, status: true } },
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

  /**
   * Tiket terbuka milik satu pesanan.
   *
   * Dipakai tombol "Chat dengan CS" supaya menekan tombol dua kali tidak
   * menghasilkan dua percakapan untuk pesanan yang sama. Tiket yang sudah
   * ditutup tidak dihitung: pelanggan yang kembali setelah lama diam berhak
   * memulai percakapan baru, dan riwayat lama tetap tersimpan.
   */
  findOpenByBooking(bookingId: string, customerId: string) {
    return db.supportTicket.findFirst({
      where: {
        bookingId,
        customerId,
        status: { notIn: STATUS_FINAL },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        messages: {
          orderBy: { sequence: 'asc' },
          include: {
            sender: { select: { id: true, fullName: true, role: true } },
          },
        },
      },
    });
  },

  /**
   * Membuat tiket dari satu pesanan beserta pesan pembuka dari asisten.
   *
   * Tiket dan pesan pertamanya dibuat dalam satu transaksi: tiket tanpa pesan
   * pembuka akan tampil sebagai percakapan kosong di aplikasi pelanggan, dan
   * pesan tanpa tiket tidak mungkin ada. Nomor tiket dihitung di luar transaksi
   * karena hanya membaca tabel yang sama sekali berbeda.
   */
  async createForBooking(input: {
    customerId: string;
    bookingId: string;
    title: string;
    category: Prisma.SupportTicketCreateInput['category'];
    description: string;
    openingMessage: string;
  }) {
    const ticketNumber = await ticketModel.nextTicketNumber(new Date());

    return db.$transaction(async (tx) => {
      const tiket = await tx.supportTicket.create({
        data: {
          ticketNumber,
          customer: { connect: { id: input.customerId } },
          booking: { connect: { id: input.bookingId } },
          title: input.title,
          category: input.category,
          description: input.description,
          /* Tiket pesanan selalu dibuka asisten: pesan pertama memang balasan
             otomatis berisi ringkasan sewa, dan pelanggan bisa langsung
             bertanya. Penyerahan ke petugas terjadi lewat `handoverToHuman`. */
          handledBy: TicketHandler.AI,
          status: TicketStatus.OPEN,
        },
      });

      await tx.ticketMessage.create({
        data: {
          ticket: { connect: { id: tiket.id } },
          body: input.openingMessage,
          isCustomer: false,
          isAi: true,
          sequence: 1,
        },
      });

      return tiket;
    });
  },

  /**
   * Memastikan tiket bantuan khusus pesanan dibuat otomatis saat pembayaran
   * disetujui Admin (`Payment.status = PAID`). Jika tiket terbuka untuk pesanan
   * tersebut sudah ada, dikembalikan apa adanya.
   */
  async ensureOpenTicketForBooking(booking: {
    id: string;
    customerId: string;
    bookingCode: string;
    startDateTime: Date;
    endDateTime: Date;
    pickupLocation: string | null;
    rentalType: string;
    vehicle: { name: string; licensePlate: string };
    driver?: { fullName: string; phoneNumber: string | null } | null;
  }) {
    const existing = await ticketModel.findOpenByBooking(booking.id, booking.customerId);
    if (existing) return existing;

    const title = `Bantuan pesanan ${booking.bookingCode}`.slice(0, 100);
    const openingMessage = susunPesanPembukaBantuan(booking);

    return ticketModel.createForBooking({
      customerId: booking.customerId,
      bookingId: booking.id,
      title,
      category: TicketCategory.GENERAL,
      description: `Percakapan bantuan untuk pesanan ${booking.bookingCode}.`,
      openingMessage,
    });
  },

  /**
   * Menutup otomatis seluruh tiket bantuan yang terikat pada satu pesanan ketika
   * pesanan tersebut selesai (`COMPLETED`) atau dibatalkan (`CANCELLED` / `REJECTED`).
   */
  async closeTicketsForBooking(bookingId: string, reasonMessage: string): Promise<number> {
    const kandidat = await db.supportTicket.findMany({
      where: {
        bookingId,
        status: { notIn: STATUS_FINAL },
      },
      select: { id: true },
    });

    if (kandidat.length === 0) return 0;

    const now = new Date();
    let ditutup = 0;

    for (const tiket of kandidat) {
      const hasil = await db.$transaction(async (tx) => {
        const terakhir = await tx.ticketMessage.findFirst({
          where: { ticketId: tiket.id },
          orderBy: { sequence: 'desc' },
          select: { sequence: true },
        });

        await tx.ticketMessage.create({
          data: {
            ticket: { connect: { id: tiket.id } },
            body: reasonMessage,
            isCustomer: false,
            isAi: true,
            sequence: (terakhir?.sequence ?? 0) + 1,
          },
        });

        return tx.supportTicket.updateMany({
          where: { id: tiket.id, status: { notIn: STATUS_FINAL } },
          data: {
            status: TicketStatus.CLOSED,
            closedAt: now,
            closedBySystem: true,
            lastActivityAt: now,
          },
        });
      });

      ditutup += hasil.count;

      if (hasil.count > 0) {
        publishTicketEvent({
          jenis: 'status',
          ticketId: tiket.id,
          status: TicketStatus.CLOSED,
          versi: now.toISOString(),
        });
      }
    }

    return ditutup;
  },

  /**
   * Membuka kembali tiket yang ditutup sistem ketika pelanggan menulis lagi.
   *
   * Hanya berlaku untuk tiket yang ditutup otomatis (`closedBySystem`), bukan
   * tiket yang ditutup pelanggan sendiri — yang terakhir itu keputusan sadar dan
   * tidak boleh dibatalkan diam-diam oleh satu pesan.
   */
  async reopenClosedBySystem(ticketId: string) {
    const hasil = await db.supportTicket.updateMany({
      where: { id: ticketId, status: TicketStatus.CLOSED, closedBySystem: true },
      data: { status: TicketStatus.OPEN, closedBySystem: false, closedAt: null },
    });

    if (hasil.count > 0) {
      publishTicketEvent({
        jenis: 'status',
        ticketId,
        status: TicketStatus.OPEN,
        versi: new Date().toISOString(),
      });
    }

    return hasil.count > 0;
  },

  async updateStatus(id: string, status: TicketStatus) {
    const tiket = await db.supportTicket.update({ where: { id }, data: { status } });
    publishTicketEvent({
      jenis: 'status',
      ticketId: id,
      status: tiket.status,
      versi: tiket.updatedAt.toISOString(),
    });
    return tiket;
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
      /* Penjagaan status diletakkan di model, bukan hanya di controller.
         Pesan bisa dibuat dari beberapa jalur (pelanggan, admin, asisten AI),
         dan satu jalur yang lupa memeriksa akan menyisipkan pesan ke tiket yang
         sudah tidak dipantau siapa pun: pelanggan mengira terkirim, admin tidak
         pernah melihatnya. */
      const tiket = await tx.supportTicket.findUnique({
        where: { id: ticketId },
        select: { status: true },
      });

      if (tiket && STATUS_FINAL.includes(tiket.status)) {
        throw new AppError(
          'TICKET_CLOSED',
          'Tiket ini sudah selesai dan tidak menerima pesan baru. Buat tiket baru untuk melanjutkan.',
          409,
        );
      }

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
    }).then((pesan) => {
      /* Disiarkan setelah transaksi selesai, bukan di dalamnya: penerima
         peristiwa akan membaca ulang tiket, dan pesannya harus sudah terlihat
         saat pembacaan itu terjadi. */
      publishTicketEvent({
        jenis: 'pesan',
        ticketId,
        sequence: pesan.sequence,
        jumlahPesan: pesan.sequence,
        versi: pesan.sentAt.toISOString(),
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
  /**
   * Mengambil tiket untuk satu admin.
   *
   * Syarat "assignedAdminId: null" pada where membuat operasi ini aman terhadap
   * dua admin yang menekan tombol hampir bersamaan: hanya satu yang berhasil,
   * dan yang lain mendapat hitungan 0. Kalau memakai update biasa, keduanya akan
   * berhasil dan yang terakhir menimpa yang pertama tanpa ada yang tahu.
   */
  async assignTo(ticketId: string, adminId: string) {
    const hasil = await db.supportTicket.updateMany({
      where: { id: ticketId, assignedAdminId: null },
      data: { assignedAdminId: adminId, assignedAt: new Date() },
    });

    /* Dibaca ulang apa pun hasilnya, supaya pemanggil selalu tahu keadaan
       sebenarnya — termasuk siapa pemegangnya kalau kalah cepat. */
    const sekarang = await db.supportTicket.findUnique({
      where: { id: ticketId },
      select: { assignedAdminId: true, assignedAt: true },
    });

    return {
      assignedAdminId: sekarang?.assignedAdminId ?? null,
      assignedAt: sekarang?.assignedAt ?? null,
      berhasil: hasil.count > 0,
    };
  },

  /** Melepas tiket supaya bisa diambil admin lain. */
  async releaseFrom(ticketId: string) {
    return db.supportTicket.update({
      where: { id: ticketId },
      data: { assignedAdminId: null, assignedAt: null },
    });
  },

  /**
   * Mengambil alih tiket yang sedang dipegang admin lain.
   *
   * Perbedaannya dengan `assignTo`: fungsi itu hanya berhasil bila tiket belum
   * dipegang siapa pun, sedangkan pengambilalihan justru menyasar tiket yang
   * sudah ada pemegangnya. Keduanya memakai pola yang sama — `updateMany`
   * bersyarat — supaya keputusan diambil dari keadaan baris saat itu, bukan dari
   * data yang dibaca beberapa milidetik sebelumnya.
   *
   * `expectedAdminId` adalah pemegang yang dilihat pemanggil. Kalau ternyata
   * sudah berganti, hitungannya 0 dan pemanggil tahu bahwa ia kalah cepat.
   */
  async takeOver(
    ticketId: string,
    nextAdminId: string,
    expectedAdminId: string | null,
  ) {
    const hasil = await db.supportTicket.updateMany({
      where: { id: ticketId, assignedAdminId: expectedAdminId },
      data: { assignedAdminId: nextAdminId, assignedAt: new Date() },
    });

    const sekarang = await db.supportTicket.findUnique({
      where: { id: ticketId },
      select: { assignedAdminId: true, assignedAt: true },
    });

    return {
      assignedAdminId: sekarang?.assignedAdminId ?? null,
      assignedAt: sekarang?.assignedAt ?? null,
      berhasil: hasil.count > 0,
    };
  },

  /**
   * Menutup tiket sekaligus mencatat pesan penutupnya dalam satu transaksi.
   *
   * Sebelumnya controller mengubah status lebih dulu, lalu memanggil
   * `createMessage` — yang menolak tiket berstatus final. Akibatnya penutupan
   * selalu berakhir 409 padahal barisnya sudah terlanjur CLOSED: pelanggan
   * melihat galat, tiketnya tetap tertutup, dan tidak ada catatan mengapa.
   * Urutannya dibalik di sini: pesan masuk saat tiket masih terbuka, lalu status
   * ditutup, semuanya atau tidak sama sekali.
   */
  async closeWithMessage(input: {
    ticketId: string;
    senderId: string;
    body: string;
    isCustomer: boolean;
  }) {
    return db.$transaction(async (tx) => {
      const tiket = await tx.supportTicket.findUnique({
        where: { id: input.ticketId },
        select: { status: true },
      });

      if (!tiket) return null;

      if (!STATUS_FINAL.includes(tiket.status)) {
        const terakhir = await tx.ticketMessage.findFirst({
          where: { ticketId: input.ticketId },
          orderBy: { sequence: 'desc' },
          select: { sequence: true },
        });

        await tx.ticketMessage.create({
          data: {
            ticket: { connect: { id: input.ticketId } },
            sender: { connect: { id: input.senderId } },
            body: input.body,
            isCustomer: input.isCustomer,
            sequence: (terakhir?.sequence ?? 0) + 1,
          },
        });
      }

      return tx.supportTicket.update({
        where: { id: input.ticketId },
        data: { status: TicketStatus.CLOSED },
      });
    }).then((tiket) => {
      if (tiket) {
        publishTicketEvent({
          jenis: 'status',
          ticketId: input.ticketId,
          status: tiket.status,
          versi: tiket.updatedAt.toISOString(),
        });
      }
      return tiket;
    });
  },

  async handoverToHuman(ticketId: string, at: Date) {
    const hasil = await db.supportTicket.updateMany({
      where: { id: ticketId, handledBy: TicketHandler.AI },
      data: { handledBy: TicketHandler.HUMAN, handoverAt: at },
    });

    if (hasil.count > 0) {
      publishTicketEvent({
        jenis: 'handover',
        ticketId,
        handoverAt: at.toISOString(),
        versi: at.toISOString(),
      });
    }

    return hasil.count > 0;
  },

  /**
   * Menutup otomatis tiket manual (`bookingId == null`) berstatus RESOLVED yang telah
   * melewati batas masa tenggang (default 24 jam) tanpa tanggapan baru.
   */
  async autoCloseResolvedTickets(olderThanHours = 24) {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    const now = new Date();

    const kandidat = await db.supportTicket.findMany({
      where: {
        bookingId: null,
        status: TicketStatus.RESOLVED,
        updatedAt: { lte: cutoff },
      },
      select: { id: true },
    });

    if (kandidat.length === 0) return 0;

    const result = await db.supportTicket.updateMany({
      where: {
        id: { in: kandidat.map((tiket) => tiket.id) },
        status: TicketStatus.RESOLVED,
      },
      data: {
        status: TicketStatus.CLOSED,
        closedAt: now,
        closedBySystem: true,
      },
    });

    for (const tiket of kandidat) {
      publishTicketEvent({
        jenis: 'status',
        ticketId: tiket.id,
        status: TicketStatus.CLOSED,
        versi: now.toISOString(),
      });
    }

    return result.count;
  },

  /**
   * Menutup tiket manual (`bookingId == null`) yang tidak bergerak selama lebih dari 24 jam.
   *
   * Tiket khusus pesanan (`bookingId != null`) dikecualikan dari auto-close 24 jam
   * agar tetap aktif selama masa sewa berjalan dan hanya ditutup otomatis ketika
   * pesanan selesai (`COMPLETED`) atau dibatalkan (`CANCELLED`).
   */
  async autoCloseIdleTickets(olderThanHours = 24) {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    const now = new Date();

    const kandidat = await db.supportTicket.findMany({
      where: {
        bookingId: null,
        status: { notIn: STATUS_FINAL },
        lastActivityAt: { lte: cutoff },
      },
      select: {
        id: true,
        messages: {
          orderBy: { sequence: 'desc' },
          take: 1,
          select: { isCustomer: true },
        },
      },
    });

    let ditutup = 0;
    for (const tiket of kandidat) {
      const terakhirDariPelanggan = tiket.messages[0]?.isCustomer === true;
      const catatan = terakhirDariPelanggan
        ? 'Tiket ditutup otomatis karena tidak ada balasan selama 24 jam. Pesan terakhir Anda belum sempat dijawab petugas; tulis lagi di tiket ini bila masih perlu dibantu.'
        : 'Tiket ditutup otomatis karena tidak ada aktivitas selama 24 jam. Tulis lagi di tiket ini bila masih perlu dibantu.';

      const hasil = await db.$transaction(async (tx) => {
        const terakhir = await tx.ticketMessage.findFirst({
          where: { ticketId: tiket.id },
          orderBy: { sequence: 'desc' },
          select: { sequence: true },
        });

        await tx.ticketMessage.create({
          data: {
            ticket: { connect: { id: tiket.id } },
            body: catatan,
            isCustomer: false,
            isAi: true,
            sequence: (terakhir?.sequence ?? 0) + 1,
          },
        });

        return tx.supportTicket.updateMany({
          where: { id: tiket.id, status: { notIn: STATUS_FINAL } },
          data: {
            status: TicketStatus.CLOSED,
            closedAt: now,
            closedBySystem: true,
          },
        });
      });

      ditutup += hasil.count;

      if (hasil.count > 0) {
        publishTicketEvent({
          jenis: 'status',
          ticketId: tiket.id,
          status: TicketStatus.CLOSED,
          versi: now.toISOString(),
        });
      }
    }

    return ditutup;
  },

  /**
   * Menutup otomatis sesi AI yang ditinggalkan tanpa pesan baru selama lebih dari 24 jam.
   *
   * Dipertahankan untuk pemanggil lama; perilakunya kini sama dengan
   * `autoCloseIdleTickets` karena penutupan berlaku untuk semua tiket.
   */
  async autoCloseStaleAiSessions(olderThanHours = 24) {
    return ticketModel.autoCloseIdleTickets(olderThanHours);
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
        closedAt: new Date(),
        closedBySystem: false,
      },
    });

    if (result.count > 0) {
      publishTicketEvent({
        jenis: 'status',
        ticketId,
        status: TicketStatus.CLOSED,
        versi: new Date().toISOString(),
      });
    }

    return result.count > 0;
  },
};
