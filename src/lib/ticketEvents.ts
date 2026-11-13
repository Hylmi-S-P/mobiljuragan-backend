import { EventEmitter } from 'node:events';

/**
 * Peristiwa perubahan tiket, disiarkan di dalam proses.
 *
 * Sebelumnya klien menanyakan perubahan lewat saluran SSE yang memeriksa
 * database setiap dua detik. Cara itu bekerja, tetapi biayanya tumbuh sebanding
 * jumlah penonton: dua ratus pelanggan membuka tiket berarti seratus kueri per
 * detik hanya untuk menjawab "ada yang baru?". Di sini perubahan disiarkan saat
 * terjadi, jadi tidak ada yang perlu ditanyakan berulang.
 *
 * Bentuk peristiwanya sengaja dipertahankan sama dengan saluran lama supaya
 * klien tidak perlu memetakan ulang arti setiap peristiwa.
 */
export type TicketEvent =
  | {
      jenis: 'pesan';
      ticketId: string;
      /** Nomor urut pesan terakhir. Klien memakainya untuk membuang peristiwa ganda. */
      sequence: number;
      jumlahPesan: number;
      versi: string;
    }
  | { jenis: 'status'; ticketId: string; status: string; versi: string }
  | { jenis: 'handover'; ticketId: string; handoverAt: string | null; versi: string };

const bus = new EventEmitter();

/* Jumlah penonton satu tiket tidak dibatasi di sini: batas bawaan EventEmitter
   (10) akan memunculkan peringatan kebocoran memori padahal ini pemakaian wajar. */
bus.setMaxListeners(0);

function namaKanal(ticketId: string): string {
  return `tiket:${ticketId}`;
}

/** Menyiarkan satu perubahan ke semua pelanggan tiket itu. */
export function publishTicketEvent(event: TicketEvent): void {
  bus.emit(namaKanal(event.ticketId), event);
}

/**
 * Berlangganan perubahan satu tiket.
 *
 * Mengembalikan fungsi pembatalan; pemanggil wajib memanggilnya saat sambungan
 * ditutup, kalau tidak pendengar menumpuk dan peristiwa dikirim ke soket mati.
 */
export function subscribeTicketEvents(
  ticketId: string,
  listener: (event: TicketEvent) => void,
): () => void {
  const kanal = namaKanal(ticketId);
  bus.on(kanal, listener);
  return () => {
    bus.off(kanal, listener);
  };
}
