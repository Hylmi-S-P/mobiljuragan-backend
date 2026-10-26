import { documentModel } from '../model/documentModel.js';
import { DocumentStatus } from '../generated/prisma/client.js';
import { AppError } from '../lib/response.js';

export const documentService = {
  /**
   * Mengembalikan struktur teks resmi surat pernyataan sewa lepas kunci.
   */
  getStatementTemplateText() {
    return {
      title: 'SURAT PERNYATAAN SEWA ARMADA LEPAS KUNCI',
      company: 'PT MOBILJURAGAN TRANS MERAUKE',
      documentNumber: 'MJ-SP-LK/2026/OPS',
      introduction:
        'Saya yang bertanda tangan di bawah ini sebagai penyewa armada kendaraan roda empat di PT MobilJuragan Trans Merauke, menyatakan dengan sesungguhnya hal-hal sebagai berikut:',
      clauses: [
        {
          number: 1,
          title: 'Kepatuhan Hukum & Bebas Narkoba',
          text: 'Armada kendaraan MobilJuragan Merauke TIDAK AKAN DIGUNAKAN untuk kegiatan yang bertentangan dengan hukum Republik Indonesia, termasuk penyalahgunaan/peredaran narkotika, psikotropika, zat adiktif, minuman keras ilegal, maupun tindak kejahatan lainnya.',
        },
        {
          number: 2,
          title: 'Integritas Pengemudi & Larangan Pindah Tangan',
          text: 'Armada hanya dikemudikan oleh nama yang terdaftar sah dalam kontrak sewa ini yang memiliki SIM A asli aktif. Kendaraan dilarang keras dipindahtangankan, digadaikan, disewakan kembali, atau dipinjamkan ke pihak ketiga tanpa izin resmi.',
        },
        {
          number: 3,
          title: 'Wilayah Operasional & Pemakaian Wajar',
          text: 'Armada digunakan secara wajar pada rute dan wilayah yang disepakati. Perjalanan ke luar kota khusus (Sota, Muting, Bupul, dsb) wajib memperoleh persetujuan operasional admin terlebih dahulu.',
        },
        {
          number: 4,
          title: 'Tanggung Jawab Pemeliharaan & Kerusakan',
          text: 'Penyewa bertanggung jawab penuh menjaga keutuhan unit, kebersihan armada, kepatuhan batas kecepatan dan rambu lalu lintas, serta menyelesaikan biaya perbaikan jika terjadi insiden kelalaian.',
        },
      ],
      closing:
        'Demikian surat pernyataan ini saya buat dengan penuh kesadaran dan kejujuran tanpa paksaan untuk digunakan sebagai kelengkapan kontrak sewa sah MobilJuragan Merauke.',
      instructions: [
        'Cetak dokumen ini pada kertas A4.',
        'Isi identitas diri secara lengkap sesuai e-KTP.',
        'Bubuhkan tanda tangan basah dengan pena (disarankan bermeterai Rp 10.000).',
        'Foto dokumen dengan pencahayaan terang dan unggah ke aplikasi beserta foto e-KTP dan SIM A asli.',
        'Bila tidak memiliki printer, formulir fisik bermeterai juga disediakan secara gratis di Pool Kantor MobilJuragan Merauke saat serah terima unit.',
      ],
    };
  },

  /**
   * Menghasilkan berkas PDF standar universal (PDF 1.4) untuk dicetak penyewa.
   */
  getStatementTemplatePdfBuffer(): Buffer {
    const lines: string[] = [];
    const textData = this.getStatementTemplateText();

    // Stream konten PDF A4 (595 x 842 pt)
    let stream = '';

    // Header KOP Surat
    stream += '0.1 0.2 0.35 RG\n'; // Primary Navy
    stream += '40 790 m 555 790 l 2 w S\n'; // Garis pemisah kop
    stream += '40 787 m 555 787 l 0.5 w S\n';

    // Kotak Tanda Tangan / Meterai
    stream += '0.8 0.85 0.9 RG\n';
    stream += '360 140 180 130 re S\n'; // Kotak tanda tangan pemohon
    stream += '390 190 120 60 re S\n'; // Kotak meterai

    // Teks Dokumen
    stream += 'BT\n';
    // KOP Perusahaan
    stream += '/F2 16 Tf\n';
    stream += '40 812 Td (PT MOBILJURAGAN TRANS MERAUKE) Tj\n';
    stream += '/F1 9 Tf\n';
    stream += '0 -14 Td (Layanan Rental Mobil & Armada Operasional Terpercaya Merauke, Papua Selatan) Tj\n';

    // Judul Dokumen
    stream += '/F2 12 Tf\n';
    stream += '60 -36 Td (SURAT PERNYATAAN SEWA ARMADA LEPAS KUNCI) Tj\n';
    stream += '/F1 8 Tf\n';
    stream += '40 -12 Td (Nomor Dokumen Resmi: ' + textData.documentNumber + ') Tj\n';

    // Pengantar
    stream += '/F1 9 Tf\n';
    stream += '-100 -24 Td (Saya yang bertanda tangan di bawah ini sebagai penyewa armada lepas kunci MobilJuragan Merauke:) Tj\n';

    // Identitas
    stream += '0 -16 Td (Nama Lengkap Sesuai KTP  : .....................................................................................) Tj\n';
    stream += '0 -16 Td (Nomor Induk Kependudukan   : .....................................................................................) Tj\n';
    stream += '0 -16 Td (Nomor SIM A Aktif            : .....................................................................................) Tj\n';
    stream += '0 -16 Td (Nomor Telepon / WhatsApp    : .....................................................................................) Tj\n';

    // Klausul 1
    stream += '/F2 9 Tf\n';
    stream += '0 -22 Td (1. Kepatuhan Hukum, Bebas Narkoba & Minuman Keras) Tj\n';
    stream += '/F1 8.5 Tf\n';
    stream += '12 -12 Td (Armada TIDAK AKAN DIGUNAKAN untuk kegiatan melanggar hukum RI, termasuk penyalahgunaan) Tj\n';
    stream += '0 -11 Td (narkotika, psikotropika, zat adiktif, miras ilegal, maupun tindak kriminal lainnya.) Tj\n';

    // Klausul 2
    stream += '/F2 9 Tf\n';
    stream += '-12 -16 Td (2. Integritas Pengemudi & Larangan Pindah Tangan) Tj\n';
    stream += '/F1 8.5 Tf\n';
    stream += '12 -12 Td (Armada hanya dikemudikan oleh nama yang terdaftar dengan SIM A asli aktif. Kendaraan dilarang) Tj\n';
    stream += '0 -11 Td (keras digadaikan, dipindahtangankan, disewakan kembali, atau dipinjamkan ke pihak ketiga.) Tj\n';

    // Klausul 3
    stream += '/F2 9 Tf\n';
    stream += '-12 -16 Td (3. Wilayah Jelajah & Keselamatan Armada) Tj\n';
    stream += '/F1 8.5 Tf\n';
    stream += '12 -12 Td (Armada digunakan pada wilayah Merauke dan sekitarnya. Penggunaan rute luar kota khusus wajib) Tj\n';
    stream += '0 -11 Td (memperoleh izin operasional terlebih dahulu dari staf MobilJuragan Merauke.) Tj\n';

    // Klausul 4
    stream += '/F2 9 Tf\n';
    stream += '-12 -16 Td (4. Tanggung Jawab Kerusakan & Pelanggaran) Tj\n';
    stream += '/F1 8.5 Tf\n';
    stream += '12 -12 Td (Penyewa bertanggung jawab penuh menjaga keutuhan unit dan menyelesaikan biaya perbaikan) Tj\n';
    stream += '0 -11 Td (apabila terjadi insiden kelalaian selama periode penyewaan berlangsung.) Tj\n';

    // Penutup
    stream += '/F1 8.5 Tf\n';
    stream += '-12 -20 Td (Demikian surat pernyataan ini saya buat secara sadar, jujur, dan tanpa paksaan dari pihak mana pun.) Tj\n';

    // Kolom Tanda Tangan
    stream += '330 -30 Td (Merauke, .................................... 2026) Tj\n';
    stream += '0 -14 Td (Pemohon / Penyewa Sewa Mandiri,) Tj\n';
    stream += '25 -32 Td ([ Meterai Rp 10.000 ] Tj\n';
    stream += '0 -11 Td ((Disarankan)) Tj\n';
    stream += '-25 -42 Td (( .................................................... )) Tj\n';
    stream += '0 -11 Td (Nama Jelas & Tanda Tangan Basah) Tj\n';

    // Catatan Kaki Bawah
    stream += '-330 -35 Td (Informasi Privasi: Dokumen identitas disimpan terenkripsi dan hanya digunakan untuk kontrak resmi.) Tj\n';
    stream += '0 -10 Td (Jika tidak sempat mencetak, lembar formulir fisik bermeterai juga tersedia gratis di Pool Kantor.) Tj\n';

    stream += 'ET\n';

    // Rakit Objek PDF
    const objects: string[] = [];
    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objects[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
    objects[3] =
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>';
    objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
    objects[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
    objects[6] = `<< /Length ${Buffer.byteLength(stream, 'utf-8')} >>\nstream\n${stream}\nendstream`;

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [];

    for (let i = 1; i <= 6; i++) {
      offsets[i] = Buffer.byteLength(pdf, 'utf-8');
      pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
    }

    const xrefOffset = Buffer.byteLength(pdf, 'utf-8');
    pdf += 'xref\n0 7\n';
    pdf += '0000000000 65535 f \n';
    for (let i = 1; i <= 6; i++) {
      pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

    return Buffer.from(pdf, 'utf-8');
  },

  /**
   * Mengambil status dokumen pemesanan.
   */
  async getBookingDocuments(bookingIdOrCode: string) {
    const record = await documentModel.findByBookingIdOrCode(bookingIdOrCode);
    if (!record) {
      throw new AppError('BOOKING_NOT_FOUND', 'Pemesanan tidak ditemukan.', 404);
    }

    return {
      bookingId: record.booking.id,
      bookingCode: record.booking.bookingCode,
      rentalType: record.booking.rentalType,
      isSelfDrive: record.booking.rentalType === 'WITHOUT_DRIVER',
      document: record.document ?? {
        status: DocumentStatus.PENDING_UPLOAD,
        statementLetterUrl: null,
        ktpUrl: null,
        simUrl: null,
        rejectionReason: null,
        verifiedAt: null,
        verifiedBy: null,
      },
    };
  },

  /**
   * Mengunggah dokumen persyaratan sewa lepas kunci dari pelanggan.
   */
  async uploadBookingDocuments(
    bookingIdOrCode: string,
    data: {
      statementLetterUrl?: string | null;
      ktpUrl?: string | null;
      simUrl?: string | null;
    },
  ) {
    const record = await documentModel.findByBookingIdOrCode(bookingIdOrCode);
    if (!record) {
      throw new AppError('BOOKING_NOT_FOUND', 'Pemesanan tidak ditemukan.', 404);
    }

    const updated = await documentModel.upsertDocument(record.booking.id, data);
    return {
      bookingId: record.booking.id,
      bookingCode: record.booking.bookingCode,
      document: updated,
    };
  },

  /**
   * Verifikasi oleh admin / staf operasional.
   */
  async adminVerifyDocuments(
    bookingIdOrCode: string,
    input: {
      action: 'APPROVE' | 'REJECT';
      rejectionReason?: string;
      verifierName?: string;
    },
  ) {
    const record = await documentModel.findByBookingIdOrCode(bookingIdOrCode);
    if (!record) {
      throw new AppError('BOOKING_NOT_FOUND', 'Pemesanan tidak ditemukan.', 404);
    }

    const status =
      input.action === 'APPROVE' ? DocumentStatus.VERIFIED : DocumentStatus.REJECTED;

    const updated = await documentModel.updateVerification(record.booking.id, {
      status,
      rejectionReason: input.action === 'REJECT' ? input.rejectionReason ?? 'Dokumen belum memenuhi syarat.' : null,
      verifiedAt: new Date(),
      verifiedBy: input.verifierName ?? 'Admin MobilJuragan',
    });

    return {
      bookingId: record.booking.id,
      bookingCode: record.booking.bookingCode,
      document: updated,
    };
  },
};
