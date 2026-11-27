import { z } from 'zod';
import { db } from '../../db.js';
import {
  BookingStatus,
  OperationalStatus,
  PaymentStatus,
  RentalType,
  TicketCategory,
  TicketHandler,
  TicketStatus,
} from '../../generated/prisma/client.js';
import { BOOKING_BLOCKING_STATUSES, computeBookingBlockers, resolveBookingSubStage } from '../bookingStage.js';
import { NOMOR_WHATSAPP_KANTOR } from '../kontak.js';
import { getDriverDailyRate, hitungKomponenTarif } from '../tariff.js';
import { publishTicketEvent } from '../ticketEvents.js';
import { ticketModel } from '../../model/ticketModel.js';
import type { OpenAiToolDefinition } from './gatewayClient.js';

export interface AiToolContext {
  user?: {
    userId: string;
    role?: string;
  } | null;
  ticketId?: string | null;
  bookingId?: string | null;
  isSandbox?: boolean;
}

export interface ExecutedToolResult {
  name: string;
  ok: boolean;
  durationMs: number;
  summary: string;
  data: Record<string, unknown>;
}

const WIT_OFFSET_START = 'T08:00:00+09:00';
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function parseFlexibleDate(raw: string, fallbackEndFrom?: Date): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    if (fallbackEndFrom) {
      return new Date(fallbackEndFrom.getTime() + 24 * 60 * 60 * 1000);
    }
    return null;
  }

  const normalized = DATE_ONLY_REGEX.test(trimmed) ? `${trimmed}${WIT_OFFSET_START}` : trimmed;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function maskAccountNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\s+/g, '');
  if (digits.length <= 4) return '****';
  return `****${digits.slice(-4)}`;
}

function normalizeTicketCategory(raw: string | undefined): TicketCategory {
  const upper = (raw ?? 'GENERAL').trim().toUpperCase();
  switch (upper) {
    case 'PAYMENT':
    case 'PAYMENT_CONFIRMATION':
      return TicketCategory.PAYMENT_CONFIRMATION;
    case 'VEHICLE':
    case 'VEHICLE_ISSUE':
    case 'EMERGENCY':
      return TicketCategory.VEHICLE_ISSUE;
    case 'CANCELLATION':
      return TicketCategory.CANCELLATION;
    case 'COMPLAINT':
      return TicketCategory.COMPLAINT;
    case 'OTHER':
      return TicketCategory.OTHER;
    default:
      return TicketCategory.GENERAL;
  }
}

export const AI_TOOL_DEFINITIONS: OpenAiToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'checkVehicleAvailability',
      description:
        'Memeriksa ketersediaan unit mobil rental MobilJuragan Merauke pada tanggal tertentu beserta harga sewa harian dan tarif supir harian dari database.',
      parameters: {
        type: 'object',
        properties: {
          startDate: {
            type: 'string',
            description: 'Tanggal mulai sewa dalam format YYYY-MM-DD atau ISO-8601.',
          },
          endDate: {
            type: 'string',
            description: 'Tanggal selesai sewa dalam format YYYY-MM-DD atau ISO-8601 (opsional, default 1 hari).',
          },
          vehicleName: {
            type: 'string',
            description: 'Kata kunci nama/merek mobil yang dicari pelanggan (mis. Avanza, Innova, Fortuner, Pickup).',
          },
          passengerMin: {
            type: 'number',
            description: 'Jumlah minimal kapasitas kursi penumpang.',
          },
          transmission: {
            type: 'string',
            enum: ['AUTOMATIC', 'MANUAL'],
            description: 'Filter jenis transmisi bila pelanggan meminta matik atau manual.',
          },
          includeDriver: {
            type: 'boolean',
            description: 'Apakah pelanggan menanyakan opsi dengan supir.',
          },
        },
        required: ['startDate'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'estimateRentalPrice',
      description:
        'Menghitung estimasi resmi biaya sewa berdasarkan katalog kendaraan dan tarif supir global untuk rentang tanggal tertentu.',
      parameters: {
        type: 'object',
        properties: {
          vehicleQuery: {
            type: 'string',
            description: 'Nama, model, atau kata kunci unit mobil (mis. Avanza, Fortuner, Innova).',
          },
          startDate: {
            type: 'string',
            description: 'Tanggal mulai sewa (YYYY-MM-DD atau ISO-8601).',
          },
          endDate: {
            type: 'string',
            description: 'Tanggal selesai sewa (YYYY-MM-DD atau ISO-8601).',
          },
          rentalType: {
            type: 'string',
            enum: ['WITH_DRIVER', 'WITHOUT_DRIVER'],
            description: 'WITH_DRIVER (dengan supir) atau WITHOUT_DRIVER (lepas kunci).',
          },
        },
        required: ['vehicleQuery', 'startDate', 'endDate', 'rentalType'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getMyBookingStatus',
      description:
        'Mengambil status pesanan, pembayaran, dokumen, blocker tahap berikutnya, dan ringkasan refund milik pelanggan yang sedang login.',
      parameters: {
        type: 'object',
        properties: {
          bookingCode: {
            type: 'string',
            description: 'Kode pesanan opsional (mis. MJ-20261120-001). Kosongkan untuk melihat pesanan terbaru.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getDriverAssignment',
      description:
        'Mengecek supir yang ditugaskan pada pesanan bersupir milik pelanggan. Nomor telepon supir hanya ditampilkan bila pembayaran sudah lunas/berjalan.',
      parameters: {
        type: 'object',
        properties: {
          bookingCode: {
            type: 'string',
            description: 'Kode pesanan opsional milik pelanggan.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createSupportTicket',
      description:
        'HANYA digunakan apabila pelanggan secara eksplisit meminta di chat untuk dihubungkan atau berbicara dengan admin manusia, CS manusia, staf, atau operator. DILARANG memanggil tool ini untuk keluhan biasa, pertanyaan umum, atau tanpa permintaan eksplisit pelanggan.',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: [
              'GENERAL',
              'PAYMENT_CONFIRMATION',
              'VEHICLE_ISSUE',
              'CANCELLATION',
              'COMPLAINT',
              'OTHER',
            ],
            description: 'Kategori masalah tiket bantuan.',
          },
          title: {
            type: 'string',
            description: 'Judul singkat keluhan atau kebutuhan pelanggan.',
          },
          description: {
            type: 'string',
            description: 'Ringkasan jelas konteks masalah untuk dibaca admin.',
          },
          bookingCode: {
            type: 'string',
            description: 'Kode pesanan terkait jika ada.',
          },
        },
        required: ['category', 'title', 'description'],
      },
    },
  },
];

const CheckAvailabilitySchema = z.object({
  startDate: z.string().min(4),
  endDate: z.string().optional(),
  vehicleName: z.string().optional(),
  passengerMin: z.coerce.number().int().positive().optional(),
  transmission: z.string().optional(),
  includeDriver: z.boolean().optional(),
});

const EstimatePriceSchema = z.object({
  vehicleQuery: z.string().min(1),
  startDate: z.string().min(4),
  endDate: z.string().min(4),
  rentalType: z.enum(['WITH_DRIVER', 'WITHOUT_DRIVER']),
});

const BookingQuerySchema = z.object({
  bookingCode: z.string().optional(),
});

const CreateTicketSchema = z.object({
  category: z.string().optional(),
  title: z.string().min(3).max(160),
  description: z.string().min(5).max(2000),
  bookingCode: z.string().optional(),
});

async function handleCheckVehicleAvailability(
  rawArgs: unknown,
): Promise<Record<string, unknown>> {
  const parsed = CheckAvailabilitySchema.safeParse(rawArgs);
  if (!parsed.success) {
    return { ok: false, error: 'INVALID_ARGUMENTS', message: 'Tanggal mulai sewa wajib diisi (YYYY-MM-DD).' };
  }

  const args = parsed.data;
  const start = parseFlexibleDate(args.startDate);
  if (!start) {
    return { ok: false, error: 'INVALID_DATE', message: `Format startDate tidak valid: ${args.startDate}` };
  }

  const end = parseFlexibleDate(args.endDate ?? '', start);
  if (!end) {
    return { ok: false, error: 'INVALID_DATE', message: `Format endDate tidak valid: ${args.endDate}` };
  }

  if (end <= start) {
    return { ok: false, error: 'INVALID_RANGE', message: 'Tanggal selesai harus lebih besar dari tanggal mulai.' };
  }

  const [vehicles, driverDailyRate] = await Promise.all([
    db.vehicle.findMany({
      where: {
        operationalStatus: { not: OperationalStatus.UNAVAILABLE },
      },
      select: {
        name: true,
        brand: true,
        model: true,
        category: true,
        transmission: true,
        seatingCapacity: true,
        pricePerDay: true,
        operationalStatus: true,
        serviceExpectedDoneAt: true,
        bookings: {
          where: {
            status: { in: BOOKING_BLOCKING_STATUSES },
            startDateTime: { lt: end },
            endDateTime: { gt: start },
          },
          select: {
            id: true,
            status: true,
            startDateTime: true,
            endDateTime: true,
          },
        },
      },
      orderBy: [{ pricePerDay: 'asc' }, { name: 'asc' }],
    }),
    getDriverDailyRate(),
  ]);

  const queryName = args.vehicleName?.trim().toLowerCase();
  const queryTransmission = args.transmission?.trim().toUpperCase();

  const evaluated = vehicles
    .filter((v) => {
      if (queryName) {
        const hay = `${v.name} ${v.brand ?? ''} ${v.model ?? ''} ${v.category ?? ''}`.toLowerCase();
        if (!hay.includes(queryName)) return false;
      }
      if (args.passengerMin !== undefined && v.seatingCapacity < args.passengerMin) {
        return false;
      }
      if (queryTransmission && (v.transmission ?? '').toUpperCase() !== queryTransmission) {
        return false;
      }
      return true;
    })
    .map((v) => {
      let availableForDates = true;
      let unavailableReason: string | null = null;

      if (v.operationalStatus === OperationalStatus.MAINTENANCE) {
        availableForDates = false;
        unavailableReason = 'Unit sedang perawatan bengkel';
      } else if (v.operationalStatus === OperationalStatus.IN_SERVICE) {
        if (!v.serviceExpectedDoneAt || v.serviceExpectedDoneAt > start) {
          availableForDates = false;
          unavailableReason = 'Unit dalam inspeksi pasca-sewa';
        }
      } else if (v.bookings.length > 0) {
        availableForDates = false;
        unavailableReason = `Terdapat ${v.bookings.length} jadwal pesanan aktif yang bertabrakan`;
      }

      return {
        name: v.name,
        category: v.category,
        transmission: v.transmission,
        seatingCapacity: v.seatingCapacity,
        pricePerDay: v.pricePerDay,
        driverDailyRate: args.includeDriver ? driverDailyRate : undefined,
        operationalStatus: v.operationalStatus,
        availableForDates,
        unavailableReason,
      };
    });

  return {
    ok: true,
    requestedStart: start.toISOString(),
    requestedEnd: end.toISOString(),
    driverDailyRatePerDay: driverDailyRate,
    totalMatching: evaluated.length,
    availableCount: evaluated.filter((x) => x.availableForDates).length,
    unavailableCount: evaluated.filter((x) => !x.availableForDates).length,
    units: evaluated,
  };
}

async function handleEstimateRentalPrice(rawArgs: unknown): Promise<Record<string, unknown>> {
  const parsed = EstimatePriceSchema.safeParse(rawArgs);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'INVALID_ARGUMENTS',
      message: 'Isi nama kendaraan, startDate, endDate, dan rentalType (WITH_DRIVER / WITHOUT_DRIVER).',
    };
  }

  const args = parsed.data;
  const start = parseFlexibleDate(args.startDate);
  const end = parseFlexibleDate(args.endDate);
  if (!start || !end) {
    return { ok: false, error: 'INVALID_DATE', message: 'Format tanggal mulai atau selesai tidak valid.' };
  }
  if (end <= start) {
    return { ok: false, error: 'INVALID_RANGE', message: 'Tanggal selesai harus sesudah tanggal mulai.' };
  }

  const needle = args.vehicleQuery.trim();
  const matches = await db.vehicle.findMany({
    where: {
      operationalStatus: { not: OperationalStatus.UNAVAILABLE },
      OR: [
        { name: { contains: needle } },
        { brand: { contains: needle } },
        { model: { contains: needle } },
        { externalId: { contains: needle } },
      ],
    },
    select: {
      id: true,
      name: true,
      transmission: true,
      seatingCapacity: true,
      pricePerDay: true,
      operationalStatus: true,
    },
    orderBy: { pricePerDay: 'asc' },
    take: 5,
  });

  if (matches.length === 0) {
    const catalogNames = await db.vehicle.findMany({
      where: { operationalStatus: { not: OperationalStatus.UNAVAILABLE } },
      select: { name: true, pricePerDay: true },
      orderBy: { name: 'asc' },
      take: 10,
    });
    return {
      ok: false,
      error: 'VEHICLE_NOT_FOUND',
      message: `Unit dengan kata kunci "${needle}" tidak ditemukan di katalog aktif.`,
      availableCatalogSample: catalogNames,
    };
  }

  const vehicle = matches[0];
  const driverDailyRate = await getDriverDailyRate();
  const tarif = hitungKomponenTarif({
    pricePerDay: vehicle.pricePerDay,
    start,
    end,
    rentalType: args.rentalType === 'WITH_DRIVER' ? RentalType.WITH_DRIVER : RentalType.WITHOUT_DRIVER,
    driverDailyRate,
  });

  return {
    ok: true,
    vehicle: {
      name: vehicle.name,
      transmission: vehicle.transmission,
      seatingCapacity: vehicle.seatingCapacity,
      operationalStatus: vehicle.operationalStatus,
    },
    otherMatchesCount: Math.max(0, matches.length - 1),
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    rentalType: args.rentalType,
    hariSewa: tarif.hariSewa,
    hargaPerHari: tarif.hargaPerHari,
    hargaSewa: tarif.hargaSewa,
    tarifSupirPerHari: tarif.tarifSupirPerHari,
    jasaSupir: tarif.jasaSupir,
    estimasiSubtotal: tarif.subtotal,
    catatan:
      'Estimasi resmi berdasarkan harga katalog dasar + jasa supir (bila bersupir). Penyesuaian rute luar kota atau pengantaran ditetapkan admin saat konfirmasi tarif.',
  };
}

async function handleGetMyBookingStatus(
  rawArgs: unknown,
  ctx: AiToolContext,
): Promise<Record<string, unknown>> {
  if (!ctx.user?.userId) {
    return {
      ok: false,
      error: 'UNAUTHENTICATED',
      message:
        'Status pesanan pribadi hanya dapat diakses jika pelanggan sudah login di aplikasi MobilJuragan.',
    };
  }

  const parsed = BookingQuerySchema.safeParse(rawArgs ?? {});
  const code = parsed.success ? parsed.data.bookingCode?.trim().toUpperCase() : undefined;

  const bookings = await db.booking.findMany({
    where: {
      customerId: ctx.user.userId,
      ...(code ? { bookingCode: code } : ctx.bookingId && !code ? {} : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      vehicle: {
        select: { name: true, licensePlate: true, transmission: true, operationalStatus: true },
      },
      driver: {
        select: { fullName: true, phoneNumber: true, readiness: true },
      },
      payment: {
        select: { status: true, method: true, totalAmount: true, expiresAt: true, verifiedAt: true },
      },
      document: {
        select: { status: true, rejectionReason: true, rejectionTargets: true },
      },
      lineItems: {
        where: { dibatalkanPada: null },
        select: { kategori: true, deskripsi: true, nominal: true, arah: true },
      },
      refund: {
        select: {
          status: true,
          nominal: true,
          potongan: true,
          danaTerverifikasi: true,
          namaBank: true,
          nomorRekening: true,
        },
      },
    },
  });

  if (bookings.length === 0) {
    return {
      ok: true,
      count: 0,
      bookings: [],
      message: code
        ? `Tidak ditemukan pesanan dengan kode ${code} pada akun Anda.`
        : 'Anda belum memiliki pesanan sewa pada akun ini.',
    };
  }

  const sanitized = bookings.map((b) => {
    const canRevealDriverPhone =
      (b.status === BookingStatus.CONFIRMED && b.payment?.status === PaymentStatus.PAID) ||
      b.status === BookingStatus.IN_PROGRESS;
    const blockers = computeBookingBlockers(b);
    const subStage = resolveBookingSubStage(b.status, b.payment?.status);

    return {
      bookingCode: b.bookingCode,
      status: b.status,
      subStage,
      rentalType: b.rentalType,
      startDateTime: b.startDateTime.toISOString(),
      endDateTime: b.endDateTime.toISOString(),
      pickupLocation: b.pickupLocation,
      vehicle: {
        name: b.vehicle.name,
        licensePlate: b.vehicle.licensePlate,
        transmission: b.vehicle.transmission,
      },
      quotedAmount: b.quotedAmount ? Number(b.quotedAmount.toString()) : null,
      finalAmount: b.finalAmount ? Number(b.finalAmount.toString()) : null,
      payment: b.payment
        ? {
            status: b.payment.status,
            method: b.payment.method,
            totalAmount: Number(b.payment.totalAmount.toString()),
            expiresAt: b.payment.expiresAt?.toISOString() ?? null,
            verifiedAt: b.payment.verifiedAt?.toISOString() ?? null,
          }
        : null,
      document: b.document
        ? {
            status: b.document.status,
            rejectionReason: b.document.rejectionReason,
            rejectionTargets: b.document.rejectionTargets,
          }
        : null,
      driver: b.driver
        ? {
            fullName: b.driver.fullName,
            readiness: b.driver.readiness,
            phoneNumber: canRevealDriverPhone ? b.driver.phoneNumber : null,
          }
        : null,
      blockers,
      refund: b.refund
        ? {
            status: b.refund.status,
            nominal: Number(b.refund.nominal.toString()),
            potongan: Number(b.refund.potongan.toString()),
            danaTerverifikasi: b.refund.danaTerverifikasi,
            namaBank: b.refund.namaBank,
            nomorRekeningMasked: maskAccountNumber(b.refund.nomorRekening),
          }
        : null,
    };
  });

  return {
    ok: true,
    count: sanitized.length,
    bookings: sanitized,
  };
}

async function handleGetDriverAssignment(
  rawArgs: unknown,
  ctx: AiToolContext,
): Promise<Record<string, unknown>> {
  if (!ctx.user?.userId) {
    return {
      ok: false,
      error: 'UNAUTHENTICATED',
      message: 'Informasi supir hanya tersedia untuk pelanggan yang sudah login.',
    };
  }

  const parsed = BookingQuerySchema.safeParse(rawArgs ?? {});
  const code = parsed.success ? parsed.data.bookingCode?.trim().toUpperCase() : undefined;

  const booking = await db.booking.findFirst({
    where: {
      customerId: ctx.user.userId,
      ...(code ? { bookingCode: code } : { rentalType: RentalType.WITH_DRIVER }),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      vehicle: { select: { name: true, licensePlate: true } },
      driver: { select: { fullName: true, phoneNumber: true, readiness: true, routeScope: true } },
      payment: { select: { status: true } },
    },
  });

  if (!booking) {
    return {
      ok: false,
      error: 'BOOKING_NOT_FOUND',
      message: code
        ? `Pesanan ${code} tidak ditemukan pada akun Anda.`
        : 'Belum ada pesanan dengan layanan supir pada akun Anda.',
    };
  }

  if (booking.rentalType !== RentalType.WITH_DRIVER) {
    return {
      ok: true,
      bookingCode: booking.bookingCode,
      rentalType: booking.rentalType,
      driverAssigned: false,
      message: 'Pesanan ini adalah sewa lepas kunci (tanpa supir).',
    };
  }

  if (!booking.driver) {
    return {
      ok: true,
      bookingCode: booking.bookingCode,
      bookingStatus: booking.status,
      driverAssigned: false,
      message: 'Admin belum menugaskan supir untuk pesanan ini.',
    };
  }

  const canRevealPhone =
    (booking.status === BookingStatus.CONFIRMED && booking.payment?.status === PaymentStatus.PAID) ||
    booking.status === BookingStatus.IN_PROGRESS;

  return {
    ok: true,
    bookingCode: booking.bookingCode,
    bookingStatus: booking.status,
    paymentStatus: booking.payment?.status ?? null,
    vehicle: booking.vehicle,
    driverAssigned: true,
    driver: {
      fullName: booking.driver.fullName,
      readiness: booking.driver.readiness,
      routeScope: booking.driver.routeScope,
      phoneNumber: canRevealPhone ? booking.driver.phoneNumber : null,
    },
    phoneHiddenReason: canRevealPhone
      ? null
      : 'Nomor HP supir baru dibuka setelah pembayaran terverifikasi lunas.',
  };
}

async function handleCreateSupportTicket(
  rawArgs: unknown,
  ctx: AiToolContext,
): Promise<Record<string, unknown>> {
  const parsed = CreateTicketSchema.safeParse(rawArgs);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'INVALID_ARGUMENTS',
      message: 'Judul dan deskripsi keluhan diperlukan untuk membuat tiket.',
    };
  }

  const args = parsed.data;
  const category = normalizeTicketCategory(args.category);

  if (ctx.isSandbox) {
    return {
      ok: true,
      sandboxDryRun: true,
      category,
      title: args.title,
      message:
        'Mode Sandbox Admin: eskalasi ke admin disimulasikan tanpa menulis tiket ke database pelanggan.',
    };
  }

  if (!ctx.user?.userId) {
    return {
      ok: false,
      error: 'UNAUTHENTICATED',
      message: `Pelanggan belum login. Sarankan pelanggan login di aplikasi untuk membuka tiket resmi atau hubungi WhatsApp kantor ${NOMOR_WHATSAPP_KANTOR}.`,
    };
  }

  const now = new Date();

  // Jika pelanggan sudah berada dalam percakapan tiket terbuka, lakukan serah terima ke admin manusia
  if (ctx.ticketId) {
    const existing = await db.supportTicket.findFirst({
      where: { id: ctx.ticketId, customerId: ctx.user.userId },
      select: { id: true, ticketNumber: true, handledBy: true, status: true },
    });

    if (existing) {
      await ticketModel.handoverToHuman(existing.id, now);
      return {
        ok: true,
        escalatedExisting: true,
        ticketId: existing.id,
        ticketNumber: existing.ticketNumber,
        handledBy: TicketHandler.HUMAN,
        whatsappKantor: NOMOR_WHATSAPP_KANTOR,
      };
    }
  }

  let bookingIdToLink: string | null = null;
  if (args.bookingCode) {
    const foundBooking = await db.booking.findFirst({
      where: {
        bookingCode: args.bookingCode.trim().toUpperCase(),
        customerId: ctx.user.userId,
      },
      select: { id: true },
    });
    bookingIdToLink = foundBooking?.id ?? null;
  }

  const ticketNumber = await ticketModel.nextTicketNumber(now);
  const created = await db.$transaction(async (tx) => {
    const ticket = await tx.supportTicket.create({
      data: {
        ticketNumber,
        customer: { connect: { id: ctx.user!.userId } },
        ...(bookingIdToLink ? { booking: { connect: { id: bookingIdToLink } } } : {}),
        title: args.title.trim().slice(0, 160),
        category,
        description: args.description.trim().slice(0, 2000),
        handledBy: TicketHandler.HUMAN,
        handoverAt: now,
        status: TicketStatus.OPEN,
        lastActivityAt: now,
      },
    });

    await tx.ticketMessage.create({
      data: {
        ticket: { connect: { id: ticket.id } },
        sender: { connect: { id: ctx.user!.userId } },
        body: args.description.trim().slice(0, 2000),
        isCustomer: true,
        isAi: false,
        sequence: 1,
      },
    });

    return ticket;
  });

  publishTicketEvent({
    jenis: 'handover',
    ticketId: created.id,
    handoverAt: now.toISOString(),
    versi: now.toISOString(),
  });

  return {
    ok: true,
    escalatedExisting: false,
    ticketId: created.id,
    ticketNumber: created.ticketNumber,
    category: created.category,
    handledBy: created.handledBy,
    whatsappKantor: NOMOR_WHATSAPP_KANTOR,
  };
}

/**
 * Mengeksekusi satu pemanggilan tool operasional secara terisolasi dan aman.
 */
export async function executeAiTool(
  name: string,
  rawArgsJson: string,
  ctx: AiToolContext,
): Promise<ExecutedToolResult> {
  const t0 = Date.now();
  let parsedArgs: unknown = {};

  if (rawArgsJson && rawArgsJson.trim()) {
    try {
      parsedArgs = JSON.parse(rawArgsJson);
    } catch {
      return {
        name,
        ok: false,
        durationMs: Date.now() - t0,
        summary: 'Argumen JSON tidak valid',
        data: { ok: false, error: 'MALFORMED_JSON', message: 'Argumen JSON tidak dapat diparsing.' },
      };
    }
  }

  try {
    let data: Record<string, unknown>;
    switch (name) {
      case 'checkVehicleAvailability':
        data = await handleCheckVehicleAvailability(parsedArgs);
        break;
      case 'estimateRentalPrice':
        data = await handleEstimateRentalPrice(parsedArgs);
        break;
      case 'getMyBookingStatus':
        data = await handleGetMyBookingStatus(parsedArgs, ctx);
        break;
      case 'getDriverAssignment':
        data = await handleGetDriverAssignment(parsedArgs, ctx);
        break;
      case 'createSupportTicket':
        data = await handleCreateSupportTicket(parsedArgs, ctx);
        break;
      default:
        data = { ok: false, error: 'UNKNOWN_TOOL', message: `Tool "${name}" tidak terdaftar.` };
    }

    const ok = data.ok === true;
    const summary = ok
      ? `ok (${Object.keys(data).slice(0, 4).join(', ')})`
      : String(data.error ?? 'failed');

    return {
      name,
      ok,
      durationMs: Date.now() - t0,
      summary,
      data,
    };
  } catch (error) {
    return {
      name,
      ok: false,
      durationMs: Date.now() - t0,
      summary: error instanceof Error ? error.message : 'Execution error',
      data: {
        ok: false,
        error: 'INTERNAL_TOOL_ERROR',
        message: 'Gagal membaca data operasional sementara. Coba lagi atau hubungi admin.',
      },
    };
  }
}
