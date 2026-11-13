import type { Server } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { verifyAuthToken } from '../lib/auth.js';
import { userModel } from '../model/userModel.js';
import { ticketModel } from '../model/ticketModel.js';
import { subscribeTicketEvents, type TicketEvent } from '../lib/ticketEvents.js';
import { logger } from '../logger.js';

/**
 * Saluran peristiwa tiket lewat WebSocket.
 *
 * Menggantikan saluran SSE yang memeriksa database setiap dua detik. Bedanya
 * bukan hanya transport: di sini server mendorong peristiwa saat perubahan
 * terjadi, jadi biaya kueri tidak lagi tumbuh sebanding jumlah penonton.
 *
 * Satu soket boleh berlangganan beberapa tiket sekaligus. Aplikasi pelanggan
 * biasanya hanya membuka satu, tetapi admin bisa memantau beberapa percakapan
 * tanpa membuka satu sambungan per tiket.
 */

/** Jalur sengaja memuat prefiks API supaya aturan proxy yang sama berlaku. */
const JALUR = '/api/v1/ws/tickets';

/** Jeda pemeriksaan soket yang tidak menjawab ping. */
const INTERVAL_DETAK_MS = 30_000;

type Peran = 'CUSTOMER' | 'STAFF' | 'ADMIN';

interface Sesi {
  socket: WebSocket;
  userId: string;
  role: Peran;
  /** Pembatalan langganan per tiket, dipakai saat soket ditutup. */
  langganan: Map<string, () => void>;
  hidup: boolean;
}

interface PesanKlien {
  aksi?: string;
  ticketId?: string;
}

function kirim(socket: WebSocket, isi: Record<string, unknown>): void {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(isi));
}

/**
 * Memeriksa apakah akun ini boleh mengikuti peristiwa tiket tersebut.
 *
 * Aturannya sama dengan endpoint detail tiket: pelanggan hanya tiketnya sendiri,
 * staf dan admin boleh semua. Pemeriksaan dilakukan di sini, bukan hanya di
 * klien, karena soket tidak melewati middleware Express.
 */
async function bolehMengikuti(
  ticketId: string,
  userId: string,
  role: Peran,
): Promise<boolean> {
  const tiket = await ticketModel.findById(ticketId);
  if (!tiket) return false;
  if (role !== 'CUSTOMER') return true;
  return tiket.customerId === userId;
}

/**
 * Mengambil token dari query `?token=` atau header `Authorization`.
 *
 * Query dipakai karena sebagian klien WebSocket tidak bisa menyetel header saat
 * handshake. Token tetap diverifikasi tanda tangannya, jadi tidak ada jalan
 * pintas: token palsu ditolak sebelum soket diterima.
 */
function ambilToken(
  url: string | undefined,
  headerAuthorization: string | undefined,
): string | null {
  if (headerAuthorization?.startsWith('Bearer ')) {
    return headerAuthorization.slice(7).trim();
  }
  if (!url) return null;
  try {
    const alamat = new URL(url, 'http://localhost');
    const token = alamat.searchParams.get('token');
    return token && token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

/**
 * Memasang server WebSocket pada server HTTP yang sudah berjalan.
 *
 * Dipanggil dari `server.ts` setelah `app.listen`, supaya soket dan API berbagi
 * port yang sama — satu port lebih mudah dibuka di firewall dan di proxy.
 */
export function startTicketSocket(server: Server): { stop: () => void } {
  const wss = new WebSocketServer({ server, path: JALUR });

  wss.on('connection', async (socket, request) => {
    const token = ambilToken(request.url, request.headers.authorization);

    if (!token) {
      kirim(socket, {
        jenis: 'galat',
        kode: 'UNAUTHORIZED',
        pesan: 'Token autentikasi diperlukan untuk membuka saluran peristiwa.',
      });
      socket.close(4401, 'UNAUTHORIZED');
      return;
    }

    let sesi: Sesi;
    try {
      const payload = verifyAuthToken(token);
      const user = await userModel.findActiveSessionUser(payload.userId);

      if (!user || !user.isActive) {
        kirim(socket, {
          jenis: 'galat',
          kode: 'ACCOUNT_INACTIVE',
          pesan: 'Akun tidak ditemukan atau tidak aktif.',
        });
        socket.close(4401, 'ACCOUNT_INACTIVE');
        return;
      }

      /* Versi token diperiksa seperti pada permintaan HTTP: mengganti kata sandi
         harus memutus soket yang sudah terbuka, bukan hanya permintaan baru. */
      if ((payload.ver ?? 0) !== user.tokenVersion) {
        kirim(socket, {
          jenis: 'galat',
          kode: 'SESSION_REVOKED',
          pesan: 'Sesi ini sudah tidak berlaku. Silakan masuk kembali.',
        });
        socket.close(4401, 'SESSION_REVOKED');
        return;
      }

      sesi = {
        socket,
        userId: user.id,
        role: user.role as Peran,
        langganan: new Map(),
        hidup: true,
      };
    } catch {
      kirim(socket, {
        jenis: 'galat',
        kode: 'INVALID_TOKEN',
        pesan: 'Token autentikasi tidak valid atau sudah kedaluwarsa.',
      });
      socket.close(4401, 'INVALID_TOKEN');
      return;
    }

    kirim(socket, { jenis: 'siap', userId: sesi.userId });

    socket.on('pong', () => {
      sesi.hidup = true;
    });

    socket.on('message', async (mentah) => {
      let pesan: PesanKlien;
      try {
        pesan = JSON.parse(mentah.toString()) as PesanKlien;
      } catch {
        kirim(socket, { jenis: 'galat', kode: 'INVALID_MESSAGE', pesan: 'Isi pesan bukan JSON.' });
        return;
      }

      if (pesan.aksi === 'detak') {
        kirim(socket, { jenis: 'detak' });
        return;
      }

      if (pesan.aksi === 'lepas') {
        const ticketId = pesan.ticketId;
        if (!ticketId) return;
        sesi.langganan.get(ticketId)?.();
        sesi.langganan.delete(ticketId);
        kirim(socket, { jenis: 'lepas', ticketId });
        return;
      }

      if (pesan.aksi !== 'langganan' || !pesan.ticketId) {
        kirim(socket, {
          jenis: 'galat',
          kode: 'INVALID_ACTION',
          pesan: 'Aksi yang dikenal: langganan, lepas, detak.',
        });
        return;
      }

      const ticketId = pesan.ticketId;

      if (sesi.langganan.has(ticketId)) {
        kirim(socket, { jenis: 'siap', ticketId });
        return;
      }

      const boleh = await bolehMengikuti(ticketId, sesi.userId, sesi.role);
      if (!boleh) {
        kirim(socket, {
          jenis: 'galat',
          kode: 'TICKET_NOT_FOUND',
          pesan: 'Tiket tidak ditemukan atau bukan milik akun ini.',
          ticketId,
        });
        return;
      }

      const batal = subscribeTicketEvents(ticketId, (peristiwa: TicketEvent) => {
        kirim(socket, peristiwa);

        /* Tiket final tidak akan berubah lagi. Langganannya dilepas supaya
           pendengar tidak menumpuk, tetapi soketnya tetap terbuka untuk tiket
           lain yang mungkin dipantau akun yang sama. */
        if (peristiwa.jenis === 'status' && (peristiwa.status === 'CLOSED' || peristiwa.status === 'RESOLVED')) {
          sesi.langganan.get(ticketId)?.();
          sesi.langganan.delete(ticketId);
        }
      });

      sesi.langganan.set(ticketId, batal);
      kirim(socket, { jenis: 'siap', ticketId });
    });

    socket.on('close', () => {
      for (const batal of sesi.langganan.values()) batal();
      sesi.langganan.clear();
    });

    socket.on('error', (galat) => {
      logger.warn({ galat, userId: sesi.userId }, 'Galat pada saluran peristiwa tiket');
    });
  });

  /* Soket yang tidak menjawab ping dianggap mati. Tanpa ini, sambungan yang
     terputus sepihak (HP hilang sinyal, laptop ditutup) tetap dihitung hidup
     dan peristiwa terus dikirim ke sana. */
  const pemeriksa = setInterval(() => {
    for (const klien of wss.clients) {
      const sesi = klien as WebSocket & { hidup?: boolean };
      if (sesi.hidup === false) {
        klien.terminate();
        continue;
      }
      sesi.hidup = false;
      klien.ping();
    }
  }, INTERVAL_DETAK_MS);

  logger.info({ jalur: JALUR }, 'Saluran peristiwa tiket (WebSocket) aktif');

  return {
    stop: () => {
      clearInterval(pemeriksa);
      for (const klien of wss.clients) klien.close(1001, 'Server berhenti');
      wss.close();
    },
  };
}
