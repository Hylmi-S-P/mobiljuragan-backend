import { db } from '../db.js';
import {
  BookingStatus,
  BookingStatusActor,
  DriverReadiness,
  RentalType,
  TariffStatus,
  type Prisma,
} from '../generated/prisma/client.js';

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
    rentalType: string;
    pickupLocation: string | null;
    customerRequest: string | null;
    numberGuests: number | null;
  }) {
    return db.$transaction(async (tx) => {
      const booking = await tx.booking.create({
        data: {
          bookingCode: input.bookingCode,
          customerId: input.customerId,
          vehicleId: input.vehicleId,
          startDateTime: input.start,
          endDateTime: input.end,
          rentalType: input.rentalType as never,
          pickupLocation: input.pickupLocation,
          customerRequest: input.customerRequest,
          numberGuests: input.numberGuests,
          // Tarif sengaja tetap null; angkanya baru diisi saat admin mengonfirmasi.
          tariffStatus: TariffStatus.PENDING_TEAM_CONFIRMATION,
          quotedAmount: null,
          status: BookingStatus.CREATED,
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

  /** Armada dicari lewat uuid atau externalId, karena pelanggan memakai slug. */
  findVehicleByIdOrExternalId(id: string) {
    return db.vehicle.findFirst({
      where: { OR: [{ id }, { externalId: id }] },
    });
  },

  /** Bentrok jadwal armada: hanya booking aktif yang mengunci tanggal. */
  findVehicleScheduleConflict(vehicleId: string, start: Date, end: Date) {
    return db.booking.findFirst({
      where: {
        vehicleId,
        status: { in: ACTIVE_BOOKING_STATUSES },
        startDateTime: { lt: end },
        endDateTime: { gt: start },
      },
    });
  },

  /** Pemeriksaan kode booking agar kode acak yang bentrok bisa diundi ulang. */
  findByBookingCode(bookingCode: string) {
    return db.booking.findUnique({ where: { bookingCode } });
  },

  /** Daftar pesanan milik pelanggan; staf dan admin melihat seluruh antrean. */
  listForActor(input: { customerId: string; isStaffOrAdmin: boolean }) {
    return db.booking.findMany({
      where: input.isStaffOrAdmin ? {} : { customerId: input.customerId },
      orderBy: { createdAt: 'desc' },
      include: {
        vehicle: bookingVehicleSummary,
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
        statusHistory: {
          orderBy: { changedAt: 'asc' },
        },
      },
    });
  },

  /* Sisi admin */

  countByFilter(where: Record<string, unknown>) {
    return db.booking.count({ where });
  },

  /** Antrean pesanan admin; `where`, `skip`, dan `take` disusun controller. */
  listPaged(input: { where: Record<string, unknown>; skip: number; take: number }) {
    return db.booking.findMany({
      where: input.where,
      skip: input.skip,
      take: input.take,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: bookingCustomerSummary,
        vehicle: bookingVehicleSummary,
        statusHistory: {
          orderBy: { changedAt: 'desc' },
          take: 1,
        },
      },
    });
  },

  /** Detail pesanan untuk admin: pelanggan ikut membawa peran untuk konteks staf. */
  findAdminDetail(id: string) {
    return db.booking.findFirst({
      where: { OR: [{ id }, { bookingCode: id }] },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            phoneNumber: true,
            role: true,
          },
        },
        vehicle: true,
        statusHistory: {
          orderBy: { changedAt: 'asc' },
        },
      },
    });
  },

  /**
   * Perubahan status oleh staf, dikonfirmasi dalam satu transaksi.
   *
   * Pemeriksaan bentrok dan kewajiban supir ikut di dalam transaksi supaya
   * keputusan konfirmasi tidak dibuat dari data yang sudah basi. Pelepasan supir
   * ke SIAGA juga menumpang transaksi yang sama (butir E4).
   */
  updateStatusWithHistoryAndAudit(input: {
    id: string;
    nextStatus: BookingStatus;
    quotedAmount: number | undefined;
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

      const isConfirming = input.nextStatus === BookingStatus.CONFIRMED;

      // Konfirmasi tidak boleh menabrak jadwal aktif pesanan lain di armada yang sama.
      if (isConfirming) {
        const conflict = await tx.booking.findFirst({
          where: {
            id: { not: booking.id },
            vehicleId: booking.vehicleId,
            status: { in: ACTIVE_BOOKING_STATUSES },
            startDateTime: { lt: booking.endDateTime },
            endDateTime: { gt: booking.startDateTime },
          },
        });

        if (conflict) return { kind: 'conflict' as const, booking };
      }

      /* Booking bersupir wajib punya supir terpilih sebelum dikonfirmasi (butir B8).
         Pesanan lepas kunci tidak terikat aturan ini. */
      if (
        isConfirming &&
        booking.rentalType === RentalType.WITH_DRIVER &&
        !booking.driverId
      ) {
        return { kind: 'driver_required' as const, booking };
      }

      const updateData: Prisma.BookingUpdateInput = { status: input.nextStatus };

      // Mengisi tarif sekaligus menandai tarif sudah dikonfirmasi tim.
      if (input.quotedAmount !== undefined) {
        updateData.quotedAmount = input.quotedAmount;
        updateData.tariffStatus = TariffStatus.CONFIRMED;
      }

      const updatedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: updateData,
        include: { vehicle: true, customer: true },
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
            quotedAmount: input.quotedAmount ?? booking.quotedAmount,
            note: input.note || null,
          },
        },
      });

      /* Supir dilepas kembali ke SIAGA saat pesanan selesai, batal, atau ditolak (butir E4),
         tetapi hanya kalau tidak ada pesanan aktif lain yang masih memegangnya. */
      if (booking.driverId && CLOSED_BOOKING_STATUSES.includes(input.nextStatus)) {
        const otherActiveBooking = await tx.booking.count({
          where: {
            driverId: booking.driverId,
            id: { not: booking.id },
            status: { in: ACTIVE_BOOKING_STATUSES },
          },
        });

        if (otherActiveBooking === 0) {
          await tx.driver.update({
            where: { id: booking.driverId },
            data: { readiness: DriverReadiness.SIAGA },
          });
        }
      }

      return { kind: 'ok' as const, booking: updatedBooking };
    });
  },

  /**
   * Penugasan supir ke pesanan, dikonfirmasi dalam satu transaksi.
   *
   * Penolakannya mengikuti daftar cara gagal modul supir pada
   * `docs(discontinueid)/DRIVER-MODULE-FAILURE-MODES.md` butir B3 sampai B7.
   * Pemeriksaan bentrok jadwal supir ada di dalam transaksi supaya dua penugasan
   * bersamaan tidak lolos bersamaan.
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
      if (CLOSED_BOOKING_STATUSES.includes(booking.status)) {
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
             sudah direncanakan sejak saat itu (butir B5). */
          status: { notIn: CLOSED_BOOKING_STATUSES },
          startDateTime: { lt: booking.endDateTime },
          endDateTime: { gt: booking.startDateTime },
        },
        select: { bookingCode: true, status: true },
      });

      if (clashingBooking) {
        return { kind: 'driver_already_assigned' as const, booking, driver, clashingBooking };
      }

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
};
