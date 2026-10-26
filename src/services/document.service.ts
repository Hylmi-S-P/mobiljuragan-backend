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
        'Seluruh dokumen persyaratan wajib diunggah dan diverifikasi sebelum staf mengonfirmasi tarif pemesanan.',
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
    stream += '0 -10 Td (Seluruh dokumen persyaratan wajib diunggah dan diverifikasi sebelum konfirmasi tarif.) Tj\n';

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
   * Menghasilkan PDF Surat Pernyataan yang terisi otomatis (auto-filled)
   * dengan data reservasi resmi pelanggan, mobil, plat nomor, dan jadwal sewa.
   */
  async getBookingStatementPdfBuffer(bookingIdOrCode: string): Promise<{ buffer: Buffer; bookingCode: string }> {
    const booking = await documentModel.findBookingDetailForStatementPdf(bookingIdOrCode);
    if (!booking) {
      throw new AppError('BOOKING_NOT_FOUND', 'Pemesanan tidak ditemukan.', 404);
    }

    const clean = (str: string) => str.replace(/\\/g, '').replace(/\(/g, '[').replace(/\)/g, ']');

    const bookingCode = booking.bookingCode;
    const customerName = clean(booking.customer.fullName || 'Penyewa');
    const customerPhone = clean(booking.customer.phoneNumber || '-');
    const carName = clean(booking.vehicle.name);
    const plateNumber = clean(booking.vehicle.licensePlate);
    const pickupLoc = clean(booking.pickupLocation || 'Pool Kantor Merauke');

    const startStr = booking.startDateTime.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const endStr = booking.endDateTime.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const scheduleStr = clean(`${startStr} s/d ${endStr}`);

    let stream = '';

    // Header KOP Surat
    stream += '0.1 0.2 0.35 RG\n'; // Primary Navy
    stream += '40 790 m 555 790 l 2 w S\n';
    stream += '40 787 m 555 787 l 0.5 w S\n';

    // Kotak Tanda Tangan / Meterai
    stream += '0.8 0.85 0.9 RG\n';
    stream += '360 135 180 135 re S\n'; // Kotak tanda tangan
    stream += '390 185 120 60 re S\n'; // Kotak meterai

    // Teks Dokumen
    stream += 'BT\n';
    // KOP Perusahaan
    stream += '/F2 15 Tf\n';
    stream += '40 812 Td (PT MOBILJURAGAN TRANS MERAUKE) Tj\n';
    stream += '/F1 8.5 Tf\n';
    stream += '0 -13 Td (Layanan Rental Mobil & Armada Operasional Terpercaya Merauke, Papua Selatan) Tj\n';

    // Judul Dokumen
    stream += '/F2 11.5 Tf\n';
    stream += '50 -32 Td (SURAT PERNYATAAN SEWA ARMADA LEPAS KUNCI) Tj\n';
    stream += '/F1 8 Tf\n';
    stream += '35 -11 Td (Ref. Reservasi: ' + bookingCode + ' - Dokumen Hukum Resmi) Tj\n';

    // Pengantar
    stream += '/F1 8.5 Tf\n';
    stream += '-85 -20 Td (Saya yang bertanda tangan di bawah ini sebagai penyewa armada lepas kunci MobilJuragan Merauke:) Tj\n';

    // Identitas Terisi Otomatis
    stream += '0 -14 Td (Kode Reservasi Resmi   : ' + bookingCode + ') Tj\n';
    stream += '0 -14 Td (Nama Lengkap Penyewa   : ' + customerName + ' [Terverifikasi Akun Pelanggan]) Tj\n';
    stream += '0 -14 Td (Nomor Telepon / WA      : ' + customerPhone + ') Tj\n';
    stream += '0 -14 Td (Unit Armada & Plat      : ' + carName + ' [Plat: ' + plateNumber + ']) Tj\n';
    stream += '0 -14 Td (Jadwal Periode Sewa    : ' + scheduleStr + ' - Lokasi: ' + pickupLoc + ') Tj\n';
    stream += '0 -14 Td (Nomor NIK e-KTP         : .....................................................................................) Tj\n';
    stream += '0 -14 Td (Nomor SIM A Aktif       : .....................................................................................) Tj\n';

    // Klausul 1
    stream += '/F2 8.5 Tf\n';
    stream += '0 -20 Td (1. Kepatuhan Hukum, Bebas Minuman Keras & Bebas Narkoba) Tj\n';
    stream += '/F1 8 Tf\n';
    stream += '12 -11 Td (Armada TIDAK AKAN DIGUNAKAN untuk kegiatan melanggar hukum RI, termasuk penyalahgunaan) Tj\n';
    stream += '0 -10 Td (narkotika, psikotropika, miras ilegal, balap liar, maupun tindak kriminal lainnya.) Tj\n';

    // Klausul 2
    stream += '/F2 8.5 Tf\n';
    stream += '-12 -14 Td (2. Integritas Pengemudi, Larangan Gadai & Pindah Tangan) Tj\n';
    stream += '/F1 8 Tf\n';
    stream += '12 -11 Td (Armada hanya dikemudikan oleh nama yang terdaftar dengan SIM A asli aktif. Kendaraan dilarang) Tj\n';
    stream += '0 -10 Td (keras digadaikan, dipindahtangankan, disewakan kembali, atau dipinjamkan ke pihak ketiga.) Tj\n';

    // Klausul 3
    stream += '/F2 8.5 Tf\n';
    stream += '-12 -14 Td (3. Wilayah Jelajah Operasional & Keselamatan Armada) Tj\n';
    stream += '/F1 8 Tf\n';
    stream += '12 -11 Td (Armada digunakan pada wilayah Merauke dan sekitarnya. Penggunaan rute luar kota khusus wajib) Tj\n';
    stream += '0 -10 Td (memperoleh izin operasional terlebih dahulu dari staf resmi MobilJuragan Merauke.) Tj\n';

    // Klausul 4
    stream += '/F2 8.5 Tf\n';
    stream += '-12 -14 Td (4. Tanggung Jawab Kerusakan, Insiden & Pelanggaran Lalu Lintas) Tj\n';
    stream += '/F1 8 Tf\n';
    stream += '12 -11 Td (Penyewa bertanggung jawab penuh menjaga keutuhan unit dan menyelesaikan biaya perbaikan) Tj\n';
    stream += '0 -10 Td (apabila terjadi insiden kelalaian selama periode penyewaan berlangsung.) Tj\n';

    // Penutup
    stream += '/F1 8 Tf\n';
    stream += '-12 -17 Td (Demikian surat pernyataan ini saya buat secara sadar, jujur, dan tanpa paksaan dari pihak mana pun.) Tj\n';

    // Kolom Tanda Tangan
    const today = new Date();
    const todayStr = today.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    stream += '330 -26 Td (Merauke, ' + clean(todayStr) + ') Tj\n';
    stream += '0 -13 Td (Pemohon / Penyewa Sewa Mandiri,) Tj\n';
    stream += '25 -30 Td ([ Meterai Rp 10.000 ] Tj\n';
    stream += '0 -10 Td ((Disarankan)) Tj\n';
    stream += '-25 -38 Td (( ' + customerName + ' )) Tj\n';
    stream += '0 -10 Td (Nama Jelas & Tanda Tangan Basah) Tj\n';

    // Catatan Kaki Bawah
    stream += '-330 -30 Td (Informasi Privasi: Berkas identitas disimpan aman dan hanya digunakan untuk validasi kontrak sewa.) Tj\n';
    stream += '0 -9 Td (Dokumen ini wajib diunggah dan diverifikasi sebelum tarif dikonfirmasi dan pembayaran dibuka.) Tj\n';

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

    return {
      buffer: Buffer.from(pdf, 'utf-8'),
      bookingCode,
    };
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

    if (input.action === 'APPROVE') {
      const doc = record.document;
      const isComplete = Boolean(doc?.statementLetterUrl && doc?.ktpUrl && doc?.simUrl);
      if (!isComplete) {
        throw new AppError(
          'INCOMPLETE_DOCUMENTS',
          'Semua berkas (e-KTP, SIM A, dan Surat Pernyataan) harus sudah diunggah oleh pelanggan sebelum dapat disetujui.',
          400,
        );
      }
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
