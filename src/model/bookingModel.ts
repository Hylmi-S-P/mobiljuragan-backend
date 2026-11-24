import { db } from '../db.js';
import {
  BookingStatus,
  BookingStatusActor,
  DocumentDeadlineState,
  DocumentStatus,
  DriverReadiness,
  OperationalStatus,
  PaymentStatus,
  RefundStatus,
  RentalType,
  TariffStatus,
  Prisma,
} from '../generated/prisma/client.js';
import { assertBookingTransition, BOOKING_BLOCKING_STATUSES, JAM_TENGGAT_KONFIRMASI_ADMIN } from '../lib/bookingStage.js';
import { tenggatAwal } from '../lib/documentDeadline.js';
import { AppError } from '../lib/response.js';
import {
  hitungNominalRefund,
  jenisRefund,
  pembatalDari,
  statusMembukaRefund,
} from '../lib/refund.js';
import {
  getDriverDailyRate,
  hitungKomponenTarif,
  hitungTotalFinal,
  type KomponenTarif,
} from '../lib/tariff.js';
import { normalizePickupLocation } from '../lib/pickupPoints.js';
import { ticketModel } from './ticketModel.js';

/**
 * Lapisan model untuk tabel `bookings` beserta riwayat statusnya.
 *
 * Satu model memegang seluruh tabel `bookings` karena pemesanan pelanggan dan
 * pengelolaan admin menyentuh baris yang sama; memecahnya justru membuat aturan
 * bentrok jadwal tersebar di dua tempat.
 *
 * Sesuai pemisahan tanggung jawab, hanya lapisan ini yang berbicara ke database.
 * Controller memanggil fungsi di sini dan tidak pernah menyusun query sendiri.
 *
 * Aturan bisnis (transisi status, kewajiban supir, pelepasan supir) tetap dijaga
 * di controller, karena itu keputusan alur, bukan bentuk query.
 */

/** Status booking yang dianggap sudah selesai, sehingga supirnya dilepas kembali. */
const CLOSED_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.COMPLETED,
  BookingStatus.CANCELLED,
  BookingStatus.REJECTED,
];

/** Status booking yang mengunci jadwal armada maupun supir. */
const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.CONFIRMED,
  BookingStatus.IN_PROGRESS,
];

/** Bentuk ringkas armada yang dipakai daftar pesanan, cukup untuk kartu di dashboard. */
const bookingVehicleSummary = {
  select: {
    id: true,
    externalId: true,
    name: true,
    licensePlate: true,
    category: true,
    seatingCapacity: true,
    transmission: true,
    operationalStatus: true,
  },
} as const;

/** Bentuk ringkas pelanggan yang aman dikirim ke klien. */
const bookingCustomerSummary = {
  select: {
    id: true,
    fullName: true,
    phoneNumber: true,
  },
} as const;

/** Bentuk ringkas supir yang aman dikirim ke klien. */
const bookingDriverSummary = {
  select: {
    id: true,
    externalId: true,
    fullName: true,
    phoneNumber: true,
    routeScope: true,
    readiness: true,
  },
} as const;

/** Bentuk include detail pesanan untuk admin, dipakai juga oleh draf WhatsApp. */
const adminBookingDetailInclude = {
  customer: {
    select: {
      id: true,
      fullName: true,
      phoneNumber: true,
      role: true,
    },
  },
  vehicle: true,
  driver: bookingDriverSummary,
  statusHistory: {
    orderBy: { changedAt: 'asc' as const },
  },
  payment: true,
  document: true,
  /* Penyesuaian biaya manual ikut dibaca karena rinciannya kini hidup di
     database, bukan lagi hanya di state React. Baris yang sudah dibatalkan tetap
     diambil supaya riwayatnya bisa ditelusuri lewat `dibatalkanPada`. */
  lineItems: {
    orderBy: { createdAt: 'asc' as const },
  },
  /* Kewajiban pengembalian dana ikut dibaca supaya dashboard dan mobile
     menampilkan angka yang sama, bukan hitungan masing-masing. */
  refund: true,
} as const;

/**
 * Bentuk baris detail pesanan admin, diturunkan dari `adminBookingDetailInclude`
 * supaya controller tidak perlu menebak bentuk datanya.
 */
export type AdminBookingDetail = Prisma.BookingGetPayload<{
  include: typeof adminBookingDetailInclude;
}>;

export const bookingModel = {
  /* Sisi pelanggan */

  /**
   * Pembuatan pemesanan sekaligus riwayat status awalnya.
   *
   * Dibungkus transaksi supaya pesanan tidak pernah lahir tanpa jejak riwayat,
   * dan supaya pemeriksaan bentrok jadwal serta ketersediaan armada dibaca pada
   * snapshot yang sama dengan saat penulisan.
   */
  createWithHistory(input: {
    bookingCode: string;
    customerId: string;
    vehicleId: string;
    start: Date;
    end: Date;
    rentalType: RentalType;
    pickupLocation: string | null;
    customerRequest: string | null;
    numberGuests: number | null;
  }) {
    return db.$transaction(async (tx) => {
      /*
       * Tenggat dokumen dihitung dari satu titik waktu yang sama dengan
       * `createdAt`, supaya jam yang dilihat pelanggan tidak meleset beberapa
       * milidetik dari jam yang dipakai penjadwal.
       */
      const sekarang = new Date();

      const booking = await tx.booking.create({
        data: {
          bookingCode: input.bookingCode,
          customerId: input.customerId,
          vehicleId: input.vehicleId,
          startDateTime: input.start,
          endDateTime: input.end,
          rentalType: input.rentalType,
          // Label titik jemput selalu memakai nama resmi; sebutan lama ikut
          // dinormalkan supaya tidak ada dua nama untuk satu tempat.
          pickupLocation: normalizePickupLocation(input.pickupLocation),
          customerRequest: input.customerRequest,
          numberGuests: input.numberGuests,
          // Tarif sengaja tetap null; angkanya baru diisi saat admin mengonfirmasi.
          tariffStatus: TariffStatus.PENDING_TEAM_CONFIRMATION,
          quotedAmount: null,
          status: BookingStatus.CREATED,
          createdAt: sekarang,
          /*
           * Tenggat unggah dokumen hanya berlaku untuk sewa lepas kunci.
           * Sewa dengan supir tidak meminta berkas apa pun, jadi tidak boleh
           * ikut dibatalkan oleh sapuan tenggat dokumen.
           */
          documentDeadlineAt:
            input.rentalType === RentalType.WITHOUT_DRIVER
              ? tenggatAwal(sekarang, input.start)
              : null,
          documentDeadlineState:
            input.rentalType === RentalType.WITHOUT_DRIVER
              ? DocumentDeadlineState.RUNNING
              : DocumentDeadlineState.NONE,
        },
        include: { vehicle: bookingVehicleSummary },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: booking.id,
          fromStatus: null,
          toStatus: BookingStatus.CREATED,
          actor: BookingStatusActor.CUSTOMER,
          actorUserId: input.customerId,
          note: 'Pemesanan sewa dibuat oleh pelanggan. Menunggu konfirmasi tarif dan armada oleh tim.',
        },
      });

      return booking;
    });
  },

  /** Armada dicari lewat uuid, externalId lengkap, atau awalan slug armada. */
  findVehicleByIdOrExternalId(id: string) {
    return db.vehicle.findFirst({
      where: {
        OR: [
          { id },
          { externalId: id },
          { externalId: { startsWith: `${id}-` } },
          { externalId: { startsWith: id } },
          { externalId: { contains: id } },
        ],
      },
    });
  },

  /** Bentrok jadwal armada: status yang menahan unit sama dengan yang dipakai katalog. */
  findVehicleScheduleConflict(vehicleId: string, start: Date, end: Date) {
    return db.booking.findFirst({
      where: {
        vehicleId,
        status: { in: BOOKING_BLOCKING_STATUSES },
        startDateTime: { lt: end },
        endDateTime: { gt: start },
      },
    });
  },

  /** Pemeriksaan kode booking agar kode acak yang bentrok bisa diundi ulang. */
  findByBookingCode(bookingCode: string) {
    return db.booking.findUnique({ where: { bookingCode } });
  },

  /**
   * Menghitung pesanan hidup milik satu nomor telepon.
   *
   * Dipakai untuk menahan satu nomor yang menumpuk pesanan tanpa pernah
   * membayar: setiap pesanan hidup menahan satu unit armada dari katalog.
   */
  countActiveBookingsByPhone(phoneNumber: string) {
    return db.booking.count({
      where: {
        status: { in: BOOKING_BLOCKING_STATUSES },
        customer: { phoneNumber },
      },
    });
  },

  /** Daftar pesanan milik pelanggan; staf dan admin melihat seluruh antrean. */
  listForActor(input: { customerId: string; isStaffOrAdmin: boolean }) {
    return db.booking.findMany({
      where: input.isStaffOrAdmin ? {} : { customerId: input.customerId },
      orderBy: { createdAt: 'desc' },
      include: {
        vehicle: bookingVehicleSummary,
        driver: bookingDriverSummary,
        document: true,
        payment: true,
        refund: true,
        statusHistory: {
          orderBy: { changedAt: 'desc' },
          take: 1,
        },
      },
    });
  },

  /** Timeline pelacakan pesanan: hanya kolom ringkas, tanpa relasi berat. */
  findStatusTimeline(input: { id: string; customerId: string; isStaffOrAdmin: boolean }) {
    return db.booking.findFirst({
      where: {
        OR: [{ id: input.id }, { bookingCode: input.id }],
        ...(input.isStaffOrAdmin ? {} : { customerId: input.customerId }),
      },
      select: {
        id: true,
        bookingCode: true,
        status: true,
        tariffStatus: true,
        quotedAmount: true,
        startDateTime: true,
        endDateTime: true,
        createdAt: true,
        documentDeadlineAt: true,
        documentDeadlineState: true,
        documentRejectedAt: true,
        statusHistory: {
          orderBy: { changedAt: 'asc' },
          select: {
            id: true,
            fromStatus: true,
            toStatus: true,
            actor: true,
            note: true,
            changedAt: true,
          },
        },
      },
    });
  },

  /** Detail satu pesanan milik pelanggan, lengkap dengan armada dan riwayat status. */
  findCustomerDetail(input: { id: string; customerId: string; isStaffOrAdmin: boolean }) {
    return db.booking.findFirst({
      where: {
        OR: [{ id: input.id }, { bookingCode: input.id }],
        ...(input.isStaffOrAdmin ? {} : { customerId: input.customerId }),
      },
      include: {
        vehicle: true,
        customer: bookingCustomerSummary,
        driver: bookingDriverSummary,
        statusHistory: {
          orderBy: { changedAt: 'asc' },
        },
        payment: true,
        document: true,
        refund: true,
        /* Rincian penyesuaian ikut dikirim supaya aplikasi bisa menampilkan
           dasar angka yang sama dengan dashboard. Tanpa ini pelanggan hanya
           melihat satu total tanpa tahu diskon atau biaya tambahannya. */
        lineItems: {
          where: { dibatalkanPada: null },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  },

  /* Sisi admin */

  countByFilter(where: Prisma.BookingWhereInput) {
    return db.booking.count({ where });
  },

  /** Antrean pesanan admin; `where`, `skip`, dan `take` disusun controller. */
  listPaged(input: { where: Prisma.BookingWhereInput; skip: number; take: number }) {
    return db.booking.findMany({
      where: input.where,
      skip: input.skip,
      take: input.take,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: bookingCustomerSummary,
        vehicle: bookingVehicleSummary,
        driver: bookingDriverSummary,
        document: true,
        refund: true,
        statusHistory: {
          orderBy: { changedAt: 'desc' },
          take: 1,
        },
        payment: {
          select: {
            id: true,
            status: true,
            proofImageUrl: true,
            method: true,
            totalAmount: true,
          },
        },
      },
    });
  },

  /** Detail pesanan untuk admin: pelanggan ikut membawa peran untuk konteks staf. */
  findAdminDetail(id: string) {
    return db.booking.findFirst({
      where: { OR: [{ id }, { bookingCode: id }] },
      include: adminBookingDetailInclude,
    });
  },

  /**
   * Perubahan status oleh staf, dikonfirmasi dalam satu transaksi.
   *
   * Pemeriksaan bentrok dan kewajiban supir ikut di dalam transaksi supaya
   * keputusan konfirmasi tidak dibuat dari data yang sudah basi. Pelepasan supir
   * ke SIAGA juga menumpang transaksi yang sama.
   */
  updateStatusWithHistoryAndAudit(input: {
    id: string;
    nextStatus: BookingStatus;
    note: string | null;
    /** Null untuk perubahan yang dipicu sistem, bukan orang. */
    actorUserId: string | null;
    actor: BookingStatusActor;
    actorFullName: string;
    actorRole: string;
    /**
     * Rekening tujuan pengembalian dana yang diisi pelanggan saat membatalkan.
     * Hanya dipakai bila pembatalan itu memang memunculkan baris refund.
     */
    refundAccount?: {
      bankName: string;
      accountNumber: string;
      accountHolderName: string;
    };
  }) {
    return db.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({
        where: { OR: [{ id: input.id }, { bookingCode: input.id }] },
        include: { vehicle: true, customer: true, payment: true },
      });

      if (!booking) return null;

      /* Urutan tahap dijaga di satu tempat (lib/bookingStage): pesanan tidak boleh
         meloncat dari permintaan masuk langsung ke pembayaran. */
      assertBookingTransition(booking.status, input.nextStatus);

      /* Admin/staf tidak boleh membatalkan atau menolak pesanan ketika bukti
         pembayaran pelanggan sedang menunggu verifikasi (PENDING_VERIFICATION).
         Staf wajib memverifikasi bukti pembayaran terlebih dahulu. */
      if (
        (input.nextStatus === BookingStatus.CANCELLED ||
          input.nextStatus === BookingStatus.REJECTED) &&
        (input.actor === BookingStatusActor.SUPER_ADMIN ||
          input.actor === BookingStatusActor.ADMIN) &&
        booking.payment?.status === PaymentStatus.PENDING_VERIFICATION
      ) {
        throw new AppError(
          'PAYMENT_VERIFICATION_REQUIRED',
          'Bukti pembayaran sedang menunggu verifikasi. Verifikasi bukti pembayaran terlebih dahulu sebelum membatalkan atau menolak pesanan.',
          409,
        );
      }

      /* Nominal tarif tidak lagi diketik staf. Komponen dasarnya dihitung dari
         harga katalog unit dan tarif supir global, sehingga dua pesanan untuk unit
         dan durasi yang sama selalu berharga sama. Penyesuaian (diskon, tambahan
         medan) masuk lewat baris penyesuaian biaya yang punya justifikasi. */
      let komponenTarif: KomponenTarif | null = null;

      if (input.nextStatus === BookingStatus.CONFIRMED) {
        komponenTarif = hitungKomponenTarif({
          pricePerDay: booking.vehicle.pricePerDay,
          start: booking.startDateTime,
          end: booking.endDateTime,
          rentalType: booking.rentalType,
          driverDailyRate: await getDriverDailyRate(),
        });

        if (komponenTarif.subtotal <= 0) {
          return { kind: 'tariff_required' as const, booking };
        }
      }

      /* Armada hanya boleh diserahkan setelah pembayaran diverifikasi staff. */
      if (input.nextStatus === BookingStatus.IN_PROGRESS) {
        const payment = await tx.payment.findUnique({ where: { bookingId: booking.id } });
        if (payment?.status !== PaymentStatus.PAID) {
          return { kind: 'payment_unverified' as const, booking };
        }
      }

      const isConfirming = input.nextStatus === BookingStatus.CONFIRMED;
      const isStartingRental = input.nextStatus === BookingStatus.IN_PROGRESS;

      // Konfirmasi tidak boleh menabrak jadwal pesanan lain di armada yang sama.
      if (isConfirming) {
        const conflict = await tx.booking.findFirst({
          where: {
            id: { not: booking.id },
            vehicleId: booking.vehicleId,
            status: { in: BOOKING_BLOCKING_STATUSES },
            startDateTime: { lt: booking.endDateTime },
            endDateTime: { gt: booking.startDateTime },
          },
        });

        if (conflict) return { kind: 'conflict' as const, booking };
      }

      /* Booking bersupir wajib punya supir terpilih sebelum dikonfirmasi.
         Pesanan lepas kunci tidak terikat aturan ini. */
      if (isConfirming && booking.rentalType === RentalType.WITH_DRIVER && !booking.driverId) {
        return { kind: 'driver_required' as const, booking };
      }

      /* Booking lepas kunci wajib memiliki seluruh dokumen yang telah diverifikasi sebelum dikonfirmasi tarif. */
      if (isConfirming && booking.rentalType === RentalType.WITHOUT_DRIVER) {
        const doc = await tx.bookingDocument.findUnique({
          where: { bookingId: booking.id },
        });
        const isVerified = doc?.status === DocumentStatus.VERIFIED;
        if (!isVerified) {
          return { kind: 'documents_unverified' as const, booking };
        }
      }

      /* Menerima permintaan berarti pesanan naik ke tahap penetapan tarif dan
         otomatis menahan satu unit dari katalog selama 24 jam. Untuk sewa lepas
         kunci, syaratnya dokumen sudah diperiksa lebih dulu: kalau tidak, admin
         bisa menerima permintaan yang dokumennya masih ditolak, unitnya hilang
         dari katalog, lalu pesanan batal sendiri karena tarif tak kunjung
         ditetapkan sementara pelanggan belum memperbaiki berkasnya. */
      if (
        input.nextStatus === BookingStatus.PENDING_CONFIRMATION &&
        booking.rentalType === RentalType.WITHOUT_DRIVER
      ) {
        const doc = await tx.bookingDocument.findUnique({
          where: { bookingId: booking.id },
        });
        if (doc?.status !== DocumentStatus.VERIFIED) {
          return { kind: 'documents_unverified' as const, booking };
        }
      }

      /* Armada tidak boleh diserahkan sebelum uangnya benar-benar masuk.
         Sebelumnya tombol "Serahkan Armada" bisa ditekan pada pesanan yang
         pembayarannya belum diverifikasi: status berubah menjadi IN_PROGRESS,
         unit keluar dari kantor, dan tidak ada satu pun pemeriksaan yang menahan
         langkah itu. Pemeriksaan ini sengaja hanya menjaga transisi MASUK ke
         IN_PROGRESS, bukan seluruh status sesudahnya, supaya pesanan yang sudah
         berjalan tetap bisa diselesaikan menjadi COMPLETED walaupun data
         pembayarannya kemudian berubah. */
      if (isStartingRental && booking.payment?.status !== PaymentStatus.PAID) {
        return { kind: 'payment_unverified' as const, booking };
      }

      if (
        isStartingRental &&
        (booking.vehicle.operationalStatus === OperationalStatus.IN_SERVICE ||
          booking.vehicle.operationalStatus === OperationalStatus.MAINTENANCE ||
          booking.vehicle.operationalStatus === OperationalStatus.UNAVAILABLE)
      ) {
        throw new AppError(
          'VEHICLE_NOT_READY',
          `Armada '${booking.vehicle.name}' sedang berstatus ${booking.vehicle.operationalStatus} dan belum siap diserahkan. Selesaikan masa pemeriksaan atau servis terlebih dahulu.`,
          409,
        );
      }

      const updateData: Prisma.BookingUpdateInput = { status: input.nextStatus };

      /* Tenggat admin hanya berlaku selama pesanan menunggu penetapan tarif.
         Begitu keluar dari tahap itu, tenggatnya dikosongkan supaya penjadwal
         tidak pernah membatalkan pesanan yang sudah diproses. */
      if (input.nextStatus === BookingStatus.PENDING_CONFIRMATION) {
        updateData.adminDeadlineAt = new Date(
          Date.now() + JAM_TENGGAT_KONFIRMASI_ADMIN * 60 * 60 * 1000,
        );
      } else {
        updateData.adminDeadlineAt = null;
      }

      if (
        input.nextStatus === BookingStatus.CANCELLED ||
        input.nextStatus === BookingStatus.REJECTED
      ) {
        updateData.documentDeadlineState = DocumentDeadlineState.NONE;
        updateData.documentDeadlineAt = null;
      }

      // Mengisi tarif sekaligus menandai tarif sudah dikonfirmasi tim.
      if (isConfirming && komponenTarif) {
        /* Total final dikunci di sini, sekali. `quotedAmount` tetap subtotal
           katalog (harga sewa + jasa supir) supaya rinciannya masih terbaca;
           `finalAmount` adalah angka yang benar-benar ditagihkan. */
        const barisPenyesuaian = await tx.bookingLineItem.findMany({
          where: { bookingId: booking.id, dibatalkanPada: null },
          select: { nominal: true, arah: true, dibatalkanPada: true },
        });

        updateData.quotedAmount = komponenTarif.subtotal;
        updateData.finalAmount = hitungTotalFinal(
          komponenTarif.subtotal,
          barisPenyesuaian.map((item) => ({
            nominal: Number(item.nominal),
            arah: item.arah,
            dibatalkanPada: item.dibatalkanPada,
          })),
        );
        updateData.tariffStatus = TariffStatus.CONFIRMED;
      }

      /* Mencatat kapan unit benar-benar diserahkan. Jadwal yang diisi pelanggan
         hanya rencana; waktu serah terima adalah kejadian yang perlu dibuktikan
         bila penyewa mengembalikan unit di luar jadwal. */
      if (isStartingRental) {
        updateData.handedOverAt = new Date();
      }

      /* Pesanan yang dibatalkan atau ditolak SETELAH dibayar menimbulkan kewajiban
         mengembalikan uang. Catatan ini dulu tidak pernah dibuat: nominal refund
         hanya dihitung di aplikasi mobile lalu disimpan di cache perangkat, jadi
         kantor tidak punya daftar siapa yang harus ditransfer balik.

         Pesanan juga bisa ditutup saat bukti transfer masih menunggu pemeriksaan.
         Dulu kasus itu tidak menghasilkan catatan apa pun: pembayarannya
         menggantung selamanya di PENDING_VERIFICATION dan uang pelanggan hilang
         dari pandangan kantor. Sekarang catatannya tetap dibuat, hanya ditandai
         `danaTerverifikasi: false` supaya nominalnya dicocokkan dengan mutasi bank
         lebih dulu.

         Dicatat sebelum pembacaan akhir di bawah supaya respons status langsung
         membawa angka pengembaliannya, bukan menunggu satu permintaan lagi. */
      const jenis = booking.payment && statusMembukaRefund(input.nextStatus)
        ? jenisRefund(booking.payment.status)
        : null;

      if (jenis && booking.payment) {
        const dibatalkanOleh = pembatalDari(input.actor);
        const totalDibayar = Number(booking.payment.totalAmount);
        const terverifikasi = jenis === 'TERVERIFIKASI';

        /* Potongan pembatalan hanya berlaku untuk uang yang benar-benar sudah
           masuk. Kalau bukti transfernya belum diperiksa, nominal penuh dicatat
           dulu dan kantor yang memutuskan setelah melihat mutasi. */
        const hitungan = terverifikasi
          ? hitungNominalRefund(totalDibayar, dibatalkanOleh)
          : { totalDibayar, potongan: 0, nominal: totalDibayar };

        const alasan = terverifikasi
          ? input.note
          : [input.note, 'Bukti transfer belum diverifikasi; cocokkan mutasi bank sebelum mentransfer balik.']
              .filter(Boolean)
              .join(' ');

        /* Rekening yang diisi pelanggan saat membatalkan ikut disimpan supaya
           kantor tidak perlu menelepon untuk menanyakan tujuan transfer. */
        const rekening = input.refundAccount
          ? {
              namaBank: input.refundAccount.bankName,
              nomorRekening: input.refundAccount.accountNumber,
              namaPemilik: input.refundAccount.accountHolderName,
            }
          : {};

        /* Pembatalan oleh admin/sistem tidak memotong apa pun, tetapi admin tetap
           boleh menimpa nominalnya saat memproses pengembalian. */
        await tx.bookingRefund.upsert({
          where: { bookingId: booking.id },
          create: {
            bookingId: booking.id,
            paymentId: booking.payment.id,
            totalDibayar: new Prisma.Decimal(hitungan.totalDibayar),
            potongan: new Prisma.Decimal(hitungan.potongan),
            nominal: new Prisma.Decimal(hitungan.nominal),
            dibatalkanOleh,
            alasan,
            danaTerverifikasi: terverifikasi,
            status: RefundStatus.MENUNGGU,
            dicatatOleh: input.actorUserId,
            ...rekening,
          },
          update: {
            totalDibayar: new Prisma.Decimal(hitungan.totalDibayar),
            potongan: new Prisma.Decimal(hitungan.potongan),
            nominal: new Prisma.Decimal(hitungan.nominal),
            dibatalkanOleh,
            alasan,
            danaTerverifikasi: terverifikasi,
            ...rekening,
          },
        });

        await tx.payment.update({
          where: { id: booking.payment.id },
          data: {
            status: terverifikasi ? PaymentStatus.REFUNDED : PaymentStatus.FAILED,
            notes: terverifikasi
              ? booking.payment.notes
              : 'Pesanan dibatalkan sebelum bukti transfer diverifikasi.',
          },
        });
      }

      const updatedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: updateData,
        include: {
          vehicle: true,
          customer: true,
          driver: bookingDriverSummary,
          /* Pengembalian dana ikut dikirim supaya aplikasi langsung tahu nominal
             yang harus ditransfer balik, tanpa menebak dari status pembayaran. */
          refund: true,
        },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: booking.id,
          fromStatus: booking.status,
          toStatus: input.nextStatus,
          actor: input.actor,
          actorUserId: input.actorUserId,
          note:
            input.note ||
            `Status pesanan diperbarui oleh ${input.actorFullName} (${input.actorRole}) menjadi ${input.nextStatus}.`,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: input.actorUserId,
          action: 'UPDATE_BOOKING_STATUS',
          entityType: 'Booking',
          entityId: booking.id,
          metadata: {
            bookingCode: booking.bookingCode,
            fromStatus: booking.status,
            toStatus: input.nextStatus,
            quotedAmount: komponenTarif?.subtotal ?? booking.quotedAmount,
            komponenTarif: komponenTarif ? { ...komponenTarif } : null,
            note: input.note || null,
          },
        },
      });

      /* Supir dilepas kembali ke SIAGA saat pesanan selesai, batal, atau ditolak,
         tetapi hanya kalau tidak ada pesanan aktif/terencana lain yang masih memegangnya. */
      if (booking.driverId && CLOSED_BOOKING_STATUSES.includes(input.nextStatus)) {
        const otherActiveBooking = await tx.booking.count({
          where: {
            driverId: booking.driverId,
            id: { not: booking.id },
            status: { in: BOOKING_BLOCKING_STATUSES },
          },
        });

        if (otherActiveBooking === 0) {
          await tx.driver.update({
            where: { id: booking.driverId },
            data: { readiness: DriverReadiness.SIAGA },
          });
        }
      }

      /* Sinkronisasi status armada mengikuti tahap pesanan, supaya dashboard tidak
         menjadi satu-satunya penentu status dan tidak ada dua sumber kebenaran. */
      if (input.nextStatus === BookingStatus.IN_PROGRESS) {
        await tx.vehicle.update({
          where: { id: booking.vehicleId },
          data: { operationalStatus: OperationalStatus.BOOKED },
        });
      }

      if (input.nextStatus === BookingStatus.COMPLETED) {
        const now = new Date();
        const serviceExpectedDoneAt = new Date(now.getTime() + 6 * 60 * 60 * 1000);

        const vehicleState = await tx.vehicle.findUnique({
          where: { id: booking.vehicleId },
          select: { operationalStatus: true },
        });

        const bolehDiubahSistem =
          vehicleState?.operationalStatus !== OperationalStatus.MAINTENANCE &&
          vehicleState?.operationalStatus !== OperationalStatus.UNAVAILABLE;

        if (bolehDiubahSistem) {
          /* Kalau masih ada pesanan aktif lain yang mulai sebelum masa in-service
             berakhir, armada tetap dianggap terpakai, bukan masuk pemeriksaan. */
          const upcomingBooking = await tx.booking.count({
            where: {
              id: { not: booking.id },
              vehicleId: booking.vehicleId,
              status: { in: ACTIVE_BOOKING_STATUSES },
              startDateTime: { lte: serviceExpectedDoneAt },
              endDateTime: { gte: now },
            },
          });

          await tx.vehicle.update({
            where: { id: booking.vehicleId },
            data:
              upcomingBooking > 0
                ? {
                    operationalStatus: OperationalStatus.BOOKED,
                    serviceStartedAt: null,
                    serviceExpectedDoneAt: null,
                  }
                : {
                    operationalStatus: OperationalStatus.IN_SERVICE,
                    serviceStartedAt: now,
                    serviceExpectedDoneAt,
                  },
          });
        }
      }

      /* Pengembalian armada ke AVAILABLE saat pesanan dibatalkan/ditolak hanya
         berlaku bila armada saat ini berstatus BOOKED, sehingga tidak menimpa
         IN_SERVICE, MAINTENANCE, atau UNAVAILABLE. */
      if (
        input.nextStatus === BookingStatus.CANCELLED ||
        input.nextStatus === BookingStatus.REJECTED
      ) {
        const otherActive = await tx.booking.count({
          where: {
            id: { not: booking.id },
            vehicleId: booking.vehicleId,
            status: { in: ACTIVE_BOOKING_STATUSES },
          },
        });

        if (otherActive === 0) {
          await tx.vehicle.updateMany({
            where: {
              id: booking.vehicleId,
              operationalStatus: OperationalStatus.BOOKED,
            },
            data: { operationalStatus: OperationalStatus.AVAILABLE },
          });
        }
      }

      return { kind: 'ok' as const, booking: updatedBooking, komponenTarif };
    }).then(async (hasil) => {
      if (hasil && hasil.kind === 'ok' && CLOSED_BOOKING_STATUSES.includes(input.nextStatus)) {
        const pesanPenutup =
          input.nextStatus === BookingStatus.COMPLETED
            ? 'Tiket bantuan pesanan ditutup otomatis karena masa sewa telah selesai. Terima kasih telah menggunakan layanan MobilJuragan.'
            : 'Tiket bantuan pesanan ditutup otomatis karena pesanan telah dibatalkan.';
        await ticketModel.closeTicketsForBooking(hasil.booking.id, pesanPenutup);
      }
      return hasil;
    });
  },

  /**
   * Penugasan supir ke pesanan, dikonfirmasi dalam satu transaksi.
   *
   * Penolakan terjadi saat supir tidak berstatus SIAGA, sudah terikat pesanan lain,
   * jadwalnya bentrok, atau pesanannya bertipe lepas kunci. Pemeriksaan bentrok
   * jadwal supir ada di dalam transaksi supaya dua penugasan bersamaan tidak lolos
   * bersamaan.
   */
  assignDriverWithAudit(input: {
    id: string;
    driverId: string;
    note: string | null;
    actorUserId: string;
    actor: BookingStatusActor;
    actorFullName: string;
    actorRole: string;
  }) {
    return db.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({
        where: { OR: [{ id: input.id }, { bookingCode: input.id }] },
        include: { vehicle: true, customer: true },
      });

      if (!booking) return null;

      if (booking.rentalType !== RentalType.WITH_DRIVER) {
        return { kind: 'not_with_driver' as const, booking };
      }
      if (
        booking.status !== BookingStatus.CREATED &&
        booking.status !== BookingStatus.PENDING_CONFIRMATION
      ) {
        return { kind: 'not_assignable' as const, booking };
      }

      const driver = await tx.driver.findFirst({
        where: { OR: [{ id: input.driverId }, { externalId: input.driverId }] },
      });

      if (!driver) return { kind: 'driver_not_found' as const, booking };
      if (!driver.isActive) return { kind: 'driver_inactive' as const, booking, driver };
      if (driver.readiness === DriverReadiness.LIBUR) {
        return { kind: 'driver_not_available' as const, booking, driver };
      }

      const clashingBooking = await tx.booking.findFirst({
        where: {
          id: { not: booking.id },
          driverId: driver.id,
          /* Termasuk pesanan yang masih menunggu konfirmasi, karena penugasan supir
             sudah direncanakan sejak saat itu. */
          status: { notIn: CLOSED_BOOKING_STATUSES },
          startDateTime: { lt: booking.endDateTime },
          endDateTime: { gt: booking.startDateTime },
        },
        select: { bookingCode: true, status: true },
      });

      if (clashingBooking) {
        return { kind: 'driver_already_assigned' as const, booking, driver, clashingBooking };
      }

      const driverLamaId = booking.driverId;

      const updatedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: { driverId: driver.id },
        include: { vehicle: true, customer: true, driver: true },
      });

      /* Supir yang diikat langsung berstatus SEDANG_TUGAS, bukan menunggu konfirmasi. */
      await tx.driver.update({
        where: { id: driver.id },
        data: { readiness: DriverReadiness.SEDANG_TUGAS },
      });

      /* Supir yang diganti harus dilepas. Tanpa ini, supir itu tetap SEDANG_TUGAS
         selamanya sehingga hilang dari daftar supir siaga walaupun tidak lagi
         memegang pesanan apa pun. */
      if (driverLamaId && driverLamaId !== driver.id) {
        const sisaPesanan = await tx.booking.count({
          where: {
            driverId: driverLamaId,
            status: { notIn: CLOSED_BOOKING_STATUSES },
          },
        });

        if (sisaPesanan === 0) {
          await tx.driver.update({
            where: { id: driverLamaId },
            data: { readiness: DriverReadiness.SIAGA },
          });
        }
      }

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: booking.id,
          fromStatus: booking.status,
          toStatus: booking.status,
          actor: input.actor,
          actorUserId: input.actorUserId,
          note:
            input.note ||
            `Supir ${driver.fullName} ditugaskan oleh ${input.actorFullName} (${input.actorRole}).`,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: input.actorUserId,
          action: 'ASSIGN_DRIVER',
          entityType: 'Booking',
          entityId: booking.id,
          metadata: {
            bookingCode: booking.bookingCode,
            driverId: driver.id,
            driverExternalId: driver.externalId,
            driverName: driver.fullName,
            note: input.note || null,
          },
        },
      });

      return { kind: 'ok' as const, booking: updatedBooking, driver };
    });
  },

  /* Penyesuaian biaya manual (surcharge) */

  /**
   * Menambah satu penyesuaian biaya pada booking, sekaligus mencatat audit.
   *
   * Nominal disimpan positif; arahnya ada di kolom `arah`. Justifikasi ikut
   * disimpan karena itu yang diminta dashboard sebagai catatan internal — dan
   * justru bagian itulah yang dulu hilang tanpa jejak.
   */
  createLineItem(input: {
    bookingId: string;
    kategori: string;
    deskripsi: string;
    nominal: number;
    arah: 'TAMBAH' | 'KURANG';
    justifikasi: string;
    actorUserId: string;
  }) {
    return db.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({
        where: { OR: [{ id: input.bookingId }, { bookingCode: input.bookingId }] },
        select: { id: true, bookingCode: true, status: true },
      });

      if (!booking) return { kind: 'not_found' as const };

      /* Penyesuaian biaya hanya boleh di tahap penetapan tarif. Begitu admin
         menekan "Tetapkan Tarif & Lanjutkan", totalnya sudah dikunci dan
         ditagihkan; menambah baris sesudah itu akan membuat tagihan dan angka
         di layar pelanggan berbeda. */
      if (booking.status !== BookingStatus.PENDING_CONFIRMATION) {
        return { kind: 'wrong_stage' as const, status: booking.status };
      }

      const item = await tx.bookingLineItem.create({
        data: {
          bookingId: booking.id,
          kategori: input.kategori,
          deskripsi: input.deskripsi,
          nominal: input.nominal,
          arah: input.arah,
          justifikasi: input.justifikasi,
          dibuatOleh: input.actorUserId,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: input.actorUserId,
          action: 'BOOKING_LINE_ITEM_ADDED',
          entityType: 'Booking',
          entityId: booking.id,
          metadata: {
            bookingCode: booking.bookingCode,
            lineItemId: item.id,
            kategori: input.kategori,
            nominal: input.nominal,
            arah: input.arah,
            justifikasi: input.justifikasi,
          },
        },
      });

      return { kind: 'ok' as const, item, bookingId: booking.id };
    });
  },

  /**
   * Membatalkan penyesuaian biaya.
   *
   * Barisnya TIDAK dihapus. Penyesuaian yang sudah pernah menagih pelanggan harus
   * tetap bisa ditelusuri setelah dibatalkan, jadi yang diisi adalah
   * `dibatalkanPada`. Pembatalan kedua kalinya ditolak supaya jejaknya tidak
   * tertimpa.
   */
  cancelLineItem(input: { lineItemId: string; actorUserId: string }) {
    return db.$transaction(async (tx) => {
      const item = await tx.bookingLineItem.findUnique({
        where: { id: input.lineItemId },
        include: {
          booking: { select: { id: true, bookingCode: true, status: true } },
        },
      });

      if (!item) return { kind: 'not_found' as const };
      if (item.dibatalkanPada) return { kind: 'already_cancelled' as const };

      /* Sama seperti penambahan: setelah tarif ditetapkan, totalnya sudah
         dikunci. Membatalkan baris sesudah itu akan mengubah rincian tanpa
         mengubah angka yang ditagihkan. */
      if (item.booking.status !== BookingStatus.PENDING_CONFIRMATION) {
        return { kind: 'wrong_stage' as const, status: item.booking.status };
      }

      const updated = await tx.bookingLineItem.update({
        where: { id: item.id },
        data: { dibatalkanPada: new Date(), dibatalkanOleh: input.actorUserId },
      });

      await tx.auditLog.create({
        data: {
          actorId: input.actorUserId,
          action: 'BOOKING_LINE_ITEM_CANCELLED',
          entityType: 'Booking',
          entityId: item.booking.id,
          metadata: {
            bookingCode: item.booking.bookingCode,
            lineItemId: item.id,
            kategori: item.kategori,
            nominal: item.nominal.toString(),
            arah: item.arah,
          },
        },
      });

      return { kind: 'ok' as const, item: updated };
    });
  },

  /**
   * Membatalkan pesanan yang tenggat unggah dokumennya sudah lewat.
   *
   * Hanya pesanan yang jamnya sedang berjalan yang ikut disapu. Pesanan yang
   * dijeda menunggu pemeriksaan admin sengaja dilewati: pelanggan sudah
   * mengunggah, yang kurang adalah admin membuka berkasnya.
   *
   * Setiap pesanan dibatalkan dalam transaksinya sendiri supaya satu baris yang
   * bermasalah tidak menggagalkan sapuan untuk pesanan lain.
   */
  async expireOverdueDocumentDeadlines(now: Date = new Date()): Promise<number> {
    const kedaluwarsa = await db.booking.findMany({
      where: {
        documentDeadlineState: DocumentDeadlineState.RUNNING,
        documentDeadlineAt: { lt: now },
        status: { in: [BookingStatus.CREATED, BookingStatus.PENDING_CONFIRMATION] },
        /* Hanya sewa lepas kunci yang punya kewajiban unggah dokumen. */
        rentalType: RentalType.WITHOUT_DRIVER,
      },
      select: { id: true, bookingCode: true, status: true },
    });

    let dibatalkan = 0;

    for (const booking of kedaluwarsa) {
      try {
        await db.$transaction(async (tx) => {
          /* Dibaca ulang di dalam transaksi: pelanggan bisa saja mengunggah
             berkas tepat saat sapuan berjalan, dan berkas itu mengubah keadaan
             tenggat menjadi PAUSED. */
          const terkini = await tx.booking.findUnique({
            where: { id: booking.id },
            select: {
              bookingCode: true,
              documentDeadlineState: true,
              documentDeadlineAt: true,
              status: true,
              driverId: true,
              vehicleId: true,
            },
          });

          if (
            !terkini ||
            terkini.documentDeadlineState !== DocumentDeadlineState.RUNNING ||
            !terkini.documentDeadlineAt ||
            terkini.documentDeadlineAt >= now ||
            (terkini.status !== BookingStatus.CREATED &&
              terkini.status !== BookingStatus.PENDING_CONFIRMATION)
          ) {
            return;
          }

          await tx.booking.update({
            where: { id: booking.id },
            data: {
              status: BookingStatus.CANCELLED,
              documentDeadlineState: DocumentDeadlineState.NONE,
              documentDeadlineAt: null,
              adminDeadlineAt: null,
            },
          });

          await tx.bookingStatusHistory.create({
            data: {
              bookingId: booking.id,
              fromStatus: terkini.status,
              toStatus: BookingStatus.CANCELLED,
              actor: BookingStatusActor.SYSTEM,
              note: 'Dibatalkan otomatis: dokumen persyaratan sewa tidak diunggah sebelum batas waktu.',
            },
          });

          if (terkini.driverId) {
            const supirMasihDipakai = await tx.booking.count({
              where: {
                driverId: terkini.driverId,
                id: { not: booking.id },
                status: { in: BOOKING_BLOCKING_STATUSES },
              },
            });

            if (supirMasihDipakai === 0) {
              await tx.driver.update({
                where: { id: terkini.driverId },
                data: { readiness: DriverReadiness.SIAGA },
              });
            }
          }

          const armadaMasihDipakai = await tx.booking.count({
            where: {
              vehicleId: terkini.vehicleId,
              id: { not: booking.id },
              status: { in: ACTIVE_BOOKING_STATUSES },
            },
          });

          if (armadaMasihDipakai === 0) {
            await tx.vehicle.updateMany({
              where: {
                id: terkini.vehicleId,
                operationalStatus: OperationalStatus.BOOKED,
              },
              data: { operationalStatus: OperationalStatus.AVAILABLE },
            });
          }

          await tx.auditLog.create({
            data: {
              actorId: null,
              action: 'EXPIRE_DOCUMENT_DEADLINE',
              entityType: 'Booking',
              entityId: booking.id,
              metadata: {
                bookingCode: terkini.bookingCode,
                fromStatus: terkini.status,
                toStatus: BookingStatus.CANCELLED,
                documentDeadlineAt: terkini.documentDeadlineAt.toISOString(),
              },
            },
          });

          dibatalkan += 1;
        });

        await ticketModel.closeTicketsForBooking(
          booking.id,
          'Tiket bantuan pesanan ditutup otomatis karena pesanan telah dibatalkan.',
        );
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`[BookingDeadline] Gagal membatalkan ${booking.bookingCode}:`, error);
      }
    }

    return dibatalkan;
  },

  /**
   * Membatalkan permintaan yang tidak kunjung ditetapkan tarifnya oleh admin.
   *
   * Pesanan di PENDING_CONFIRMATION menahan unit armada dari katalog. Kalau admin
   * tidak pernah menetapkan tarif, unit itu tidak pernah bisa dipesan orang lain.
   * Tenggat 24 jam membuat penahanan itu berbatas.
   */
  async expireUnconfirmedBookings(now: Date = new Date()): Promise<number> {
    const kedaluwarsa = await db.booking.findMany({
      where: {
        status: BookingStatus.PENDING_CONFIRMATION,
        adminDeadlineAt: { lt: now },
      },
      select: { id: true, bookingCode: true },
    });

    let dibatalkan = 0;

    for (const booking of kedaluwarsa) {
      try {
        const hasil = await bookingModel.updateStatusWithHistoryAndAudit({
          id: booking.id,
          nextStatus: BookingStatus.CANCELLED,
          note: 'Dibatalkan otomatis: admin tidak menetapkan tarif dalam 24 jam.',
          actorUserId: null,
          actor: BookingStatusActor.SYSTEM,
          actorFullName: 'Sistem',
          actorRole: 'SYSTEM',
        });

        if (hasil?.kind === 'ok') dibatalkan += 1;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`[BookingLifecycle] Gagal membatalkan ${booking.bookingCode}:`, error);
      }
    }

    return dibatalkan;
  },

  /**
   * Menyelesaikan sendiri sewa yang jadwalnya sudah lewat.
   *
   * Sebelumnya pesanan hanya berubah menjadi COMPLETED kalau admin menekan
   * tombol. Akibatnya pesanan yang ditinggalkan tetap berstatus "sewa berjalan"
   * berhari-hari, armadanya tidak pernah masuk masa pemeriksaan, dan laporan
   * pendapatan menahan pesanan itu di kolom yang salah.
   *
   * Tombol manual tetap ada untuk penyelesaian lebih awal; fungsi ini hanya
   * menutup pesanan yang memang sudah lewat waktunya.
   */
  async autoCompleteFinishedRentals(now: Date = new Date()): Promise<number> {
    const selesai = await db.booking.findMany({
      where: {
        status: BookingStatus.IN_PROGRESS,
        endDateTime: { lt: now },
      },
      select: { id: true, bookingCode: true },
    });

    let diselesaikan = 0;

    for (const booking of selesai) {
      try {
        const hasil = await bookingModel.updateStatusWithHistoryAndAudit({
          id: booking.id,
          nextStatus: BookingStatus.COMPLETED,
          note: 'Diselesaikan otomatis: jadwal sewa sudah berakhir.',
          actorUserId: null,
          actor: BookingStatusActor.SYSTEM,
          actorFullName: 'Sistem',
          actorRole: 'SYSTEM',
        });

        if (hasil?.kind === 'ok') diselesaikan += 1;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`[BookingLifecycle] Gagal menyelesaikan ${booking.bookingCode}:`, error);
      }
    }

    return diselesaikan;
  },

  /**
   * Membatalkan tagihan yang melewati batas waktu bayar.
   *
   * Batas waktu sudah ditulis ke `Payment.expiresAt` sejak tagihan dibuat, tetapi
   * sebelumnya tidak ada yang membacanya: pelanggan yang menutup aplikasi bisa
   * meninggalkan pesanan berstatus CONFIRMED tanpa pembayaran selamanya, dan
   * armadanya tetap terlihat terpakai di katalog.
   *
   * Yang dikerjakan per tagihan: pembayaran menjadi FAILED, pesanan menjadi
   * CANCELLED dengan riwayat beraktor SYSTEM, supir dilepas ke SIAGA, dan armada
   * dikembalikan ke AVAILABLE bila tidak ada pesanan aktif lain.
   */
  async expireOverduePayments(now: Date = new Date()): Promise<number> {
    const kedaluwarsa = await db.payment.findMany({
      where: {
        status: { in: [PaymentStatus.UNPAID, PaymentStatus.FAILED] },
        expiresAt: { lt: now },
        booking: {
          status: { notIn: CLOSED_BOOKING_STATUSES },
        },
      },
      select: { id: true, bookingId: true },
    });

    let dibatalkan = 0;

    for (const tagihan of kedaluwarsa) {
      try {
        await db.$transaction(async (tx) => {
          /* Dibaca ulang di dalam transaksi: pelanggan bisa saja mengunggah bukti
             transfer tepat saat sapuan berjalan, dan unggahan itu mengubah status
             menjadi PENDING_VERIFICATION. */
          const terkini = await tx.payment.findUnique({
            where: { id: tagihan.id },
            select: {
              id: true,
              status: true,
              expiresAt: true,
              notes: true,
              booking: {
                select: {
                  id: true,
                  bookingCode: true,
                  status: true,
                  driverId: true,
                  vehicleId: true,
                },
              },
            },
          });

          if (
            !terkini ||
            (terkini.status !== PaymentStatus.UNPAID &&
              terkini.status !== PaymentStatus.FAILED) ||
            !terkini.expiresAt ||
            terkini.expiresAt >= now ||
            CLOSED_BOOKING_STATUSES.includes(terkini.booking.status)
          ) {
            return;
          }

          await tx.payment.update({
            where: { id: terkini.id },
            data: {
              status: PaymentStatus.FAILED,
              notes: terkini.notes
                ? `${terkini.notes} | Kedaluwarsa otomatis: batas waktu pembayaran terlewati.`
                : 'Kedaluwarsa otomatis: batas waktu pembayaran terlewati.',
            },
          });

          const pesanan = terkini.booking;

          if (!CLOSED_BOOKING_STATUSES.includes(pesanan.status)) {
            await tx.booking.update({
              where: { id: pesanan.id },
              data: {
                status: BookingStatus.CANCELLED,
                documentDeadlineState: DocumentDeadlineState.NONE,
                documentDeadlineAt: null,
                adminDeadlineAt: null,
              },
            });

            await tx.bookingStatusHistory.create({
              data: {
                bookingId: pesanan.id,
                fromStatus: pesanan.status,
                toStatus: BookingStatus.CANCELLED,
                actor: BookingStatusActor.SYSTEM,
                note: 'Dibatalkan otomatis: pembayaran tidak diselesaikan sebelum batas waktu.',
              },
            });

            if (pesanan.driverId) {
              const supirMasihDipakai = await tx.booking.count({
                where: {
                  driverId: pesanan.driverId,
                  id: { not: pesanan.id },
                  status: { in: BOOKING_BLOCKING_STATUSES },
                },
              });

              if (supirMasihDipakai === 0) {
                await tx.driver.update({
                  where: { id: pesanan.driverId },
                  data: { readiness: DriverReadiness.SIAGA },
                });
              }
            }

            const armadaMasihDipakai = await tx.booking.count({
              where: {
                vehicleId: pesanan.vehicleId,
                id: { not: pesanan.id },
                status: { in: ACTIVE_BOOKING_STATUSES },
              },
            });

            if (armadaMasihDipakai === 0) {
              await tx.vehicle.updateMany({
                where: {
                  id: pesanan.vehicleId,
                  operationalStatus: OperationalStatus.BOOKED,
                },
                data: { operationalStatus: OperationalStatus.AVAILABLE },
              });
            }
          }

          await tx.auditLog.create({
            data: {
              actorId: null,
              action: 'EXPIRE_PAYMENT',
              entityType: 'Payment',
              entityId: terkini.id,
              metadata: {
                bookingCode: pesanan.bookingCode,
                bookingStatus: pesanan.status,
                expiresAt: terkini.expiresAt.toISOString(),
              },
            },
          });

          dibatalkan += 1;
        });

        await ticketModel.closeTicketsForBooking(
          tagihan.bookingId,
          'Tiket bantuan pesanan ditutup otomatis karena pesanan telah dibatalkan.',
        );
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`[BookingLifecycle] Gagal membatalkan tagihan ${tagihan.id}:`, error);
      }
    }

    return dibatalkan;
  },

  /**
   * Melepas armada yang tertahan di status BOOKED tanpa pesanan aktif.
   *
   * Status BOOKED hanya dinaikkan sistem saat pesanan masuk IN_PROGRESS dan
   * diturunkan di beberapa jalur terpisah: COMPLETED, CANCELLED/REJECTED lewat
   * perubahan status, kedaluwarsa pembayaran, dan penolakan bukti bayar. Jalur
   * yang terlewat meninggalkan unit BOOKED selamanya — katalog menampilkannya
   * "Disewa" padahal tidak ada pesanan yang memakainya, dan karena
   * `POST /bookings` menolak armada yang status operasionalnya bukan AVAILABLE,
   * unit itu tidak bisa dipesan lagi.
   *
   * Sapuan ini membandingkan kenyataan (tidak ada pesanan yang mengunci) dengan
   * kolomnya, jadi ia juga membereskan sisa data yang dihapus di luar alur biasa.
   * Armada MAINTENANCE, IN_SERVICE, dan UNAVAILABLE tidak disentuh: status itu
   * memang dipilih admin.
   */
  async releaseOrphanedBookedVehicles(): Promise<number> {
    const hasil = await db.vehicle.updateMany({
      where: {
        operationalStatus: OperationalStatus.BOOKED,
        bookings: { none: { status: { in: BOOKING_BLOCKING_STATUSES } } },
      },
      data: { operationalStatus: OperationalStatus.AVAILABLE },
    });

    return hasil.count;
  },
};
