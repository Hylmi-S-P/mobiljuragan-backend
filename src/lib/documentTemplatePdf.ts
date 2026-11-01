import PDFDocument from 'pdfkit';
import type { IsiTemplateDokumen } from './documentTemplateDefault.js';

/**
 * Membentuk PDF Form Kesanggupan dari isi template.
 *
 * Tata letaknya mengikuti berkas acuan `PERNYATAAN-SEWA-MOBIL-20-10-2026.docx`:
 * A4, margin 1 cm atas-bawah dan 1,5 cm kiri-kanan, kop perusahaan, sepuluh
 * butir pernyataan bernomor, kotak tanda tangan dan meterai, lalu tabel Riwayat
 * Pembayaran.
 *
 * Font memakai Helvetica bawaan PDF, bukan Tahoma seperti di DOCX. Tahoma adalah
 * font berlisensi Microsoft dan tidak boleh disebarkan bersama aplikasi, jadi
 * tidak bisa ditanam di PDF. Helvetica sama-sama sans-serif dan lebar hurufnya
 * mirip, sehingga tata letak tetap rapi saat dicetak.
 */

const CM = 28.3465; // 1 cm dalam satuan poin PDF

const MARGIN_ATAS = 1.0 * CM;
const MARGIN_BAWAH = 1.0 * CM;
const MARGIN_KIRI = 1.5 * CM;
const MARGIN_KANAN = 1.5 * CM;

const UKURAN_JUDUL = 12;
const UKURAN_ISI = 10;
const UKURAN_KECIL = 7;

const WARNA_TINTA = '#111111';
const WARNA_REDUP = '#555555';
const WARNA_GARIS = '#9aa3ad';

/** Lebar kolom tabel pembayaran, dihitung dari lebar area cetak. */
function lebarTabel(lebarArea: number): number[] {
  return [0.09 * lebarArea, 0.47 * lebarArea, 0.24 * lebarArea, 0.2 * lebarArea];
}

export interface OpsiPdfFormKesanggupan {
  /** Data pemesan yang sudah diketahui, dicetak agar pelanggan tidak menulis ulang. */
  terisi?: {
    nama?: string | null;
    nomorHp?: string | null;
    alamat?: string | null;
    namaMobil?: string | null;
    kodeBooking?: string | null;
  };
}

/**
 * Menghasilkan PDF sebagai Buffer.
 *
 * `terisi` sengaja opsional. Template kosong dipakai pelanggan yang mengunduh
 * sebelum memesan, sedangkan versi terisi dipakai saat data pemesan sudah ada.
 */
export function buatPdfFormKesanggupan(
  isi: IsiTemplateDokumen,
  opsi: OpsiPdfFormKesanggupan = {},
): Promise<Buffer> {
  const terisi = opsi.terisi ?? {};

  return new Promise<Buffer>((resolve, reject) => {
    const dokumen = new PDFDocument({
      size: 'A4',
      margins: {
        top: MARGIN_ATAS,
        bottom: MARGIN_BAWAH,
        left: MARGIN_KIRI,
        right: MARGIN_KANAN,
      },
      info: {
        Title: isi.judul,
        Author: isi.kop.nama,
        Subject: 'Formulir kesanggupan penyewa',
      },
    });

    const potongan: Buffer[] = [];
    dokumen.on('data', (bagian: Buffer) => potongan.push(bagian));
    dokumen.on('end', () => resolve(Buffer.concat(potongan)));
    dokumen.on('error', reject);

    const lebarArea = dokumen.page.width - MARGIN_KIRI - MARGIN_KANAN;

    /*
     * Batas bawah area cetak. Dipakai untuk memenggal halaman sendiri, karena
     * sebagian besar isi digambar pada posisi y yang dihitung manual sehingga
     * PDFKit tidak otomatis membuat halaman baru.
     */
    const batasBawah = dokumen.page.height - MARGIN_BAWAH;

    /** Menambah halaman bila ruang tersisa tidak cukup untuk satu blok. */
    const pastikanRuang = (tinggiDibutuhkan: number): void => {
      if (dokumen.y + tinggiDibutuhkan <= batasBawah) return;
      dokumen.addPage();
      dokumen.x = MARGIN_KIRI;
      // Jarak tambahan supaya baris pertama tidak menempel di tepi atas kertas.
      dokumen.y = MARGIN_ATAS + 6;
    };

    /** Mengukur tinggi teks tanpa menggambarnya. */
    const tinggiTeks = (teks: string, lebar: number, ukuran = UKURAN_ISI): number => {
      dokumen.font('Helvetica').fontSize(ukuran);
      return dokumen.heightOfString(teks, { width: lebar, align: 'justify' });
    };

    // ---------------------------------------------------------------- KOP
    dokumen
      .font('Helvetica-Bold')
      .fontSize(UKURAN_ISI)
      .fillColor(WARNA_TINTA)
      .text(isi.kop.nama, MARGIN_KIRI, dokumen.y, { width: lebarArea, align: 'center' });

    dokumen
      .font('Helvetica-Oblique')
      .fontSize(UKURAN_KECIL + 1)
      .fillColor(WARNA_REDUP)
      .text(isi.kop.tagline, { width: lebarArea, align: 'center' });

    dokumen
      .font('Helvetica')
      .fontSize(UKURAN_KECIL)
      .fillColor(WARNA_REDUP)
      .text(isi.kop.alamat, { width: lebarArea, align: 'center' });

    dokumen.text(isi.kop.telepon, { width: lebarArea, align: 'center' });

    // Garis ganda di bawah kop, seperti pada berkas acuan.
    const yGaris = dokumen.y + 4;
    dokumen
      .moveTo(MARGIN_KIRI, yGaris)
      .lineTo(MARGIN_KIRI + lebarArea, yGaris)
      .lineWidth(1.2)
      .strokeColor(WARNA_TINTA)
      .stroke();
    dokumen
      .moveTo(MARGIN_KIRI, yGaris + 2)
      .lineTo(MARGIN_KIRI + lebarArea, yGaris + 2)
      .lineWidth(0.5)
      .strokeColor(WARNA_GARIS)
      .stroke();

    dokumen.y = yGaris + 12;
    dokumen.fillColor(WARNA_TINTA);

    // ---------------------------------------------------------------- JUDUL
    dokumen
      .font('Helvetica-Bold')
      .fontSize(UKURAN_JUDUL)
      .text(isi.judul, { width: lebarArea, align: 'center' });

    dokumen.moveDown(0.6);

    // ---------------------------------------------------------------- PEMBUKA
    dokumen.font('Helvetica').fontSize(UKURAN_ISI).text(isi.pembuka);
    dokumen.moveDown(0.3);

    // ---------------------------------------------------------------- IDENTITAS
    const posisiLabel = MARGIN_KIRI + 0.6 * CM;
    const posisiTitikDua = MARGIN_KIRI + 3.4 * CM;
    const posisiNilai = MARGIN_KIRI + 3.9 * CM;

    const cetakBarisIsian = (
      label: string,
      nilai: string,
      petunjuk: string | undefined,
      tipe: string | undefined,
    ) => {
      const yBaris = dokumen.y;
      dokumen.font('Helvetica').fontSize(UKURAN_ISI).fillColor(WARNA_TINTA);
      dokumen.text(label, posisiLabel, yBaris, { width: 2.8 * CM });
      dokumen.text(':', posisiTitikDua, yBaris, { width: 0.5 * CM });

      if (tipe === 'bbm') {
        // Kotak angka 1 sampai 6 untuk menandai level BBM saat serah terima.
        let xKotak = posisiNilai;
        for (let angka = 1; angka <= 6; angka += 1) {
          dokumen
            .rect(xKotak, yBaris - 1, 0.55 * CM, 0.55 * CM)
            .lineWidth(0.6)
            .strokeColor(WARNA_GARIS)
            .stroke();
          dokumen
            .font('Helvetica')
            .fontSize(UKURAN_KECIL + 2)
            .fillColor(WARNA_TINTA)
            .text(String(angka), xKotak, yBaris + 1, { width: 0.55 * CM, align: 'center' });
          xKotak += 0.75 * CM;
        }
        dokumen.y = yBaris + 0.55 * CM + 4;
        return;
      }

      const lebarNilai = posisiLabel + 2.8 * CM + lebarArea - posisiNilai - 2.6 * CM;

      if (nilai) {
        dokumen.text(nilai, posisiNilai, yBaris, { width: lebarNilai });
      } else {
        /*
         * Garis titik-titik dihitung lebih dulu, lalu petunjuk pengisian
         * diletakkan di sisa kanan. Kalau urutannya dibalik, petunjuk akan
         * tercetak mendahului titik-titik dan terlihat seperti bagian label.
         */
        const lebarPetunjuk = petunjuk
          ? dokumen
              .font('Helvetica-Oblique')
              .fontSize(UKURAN_KECIL + 1)
              .widthOfString(petunjuk)
          : 0;

        const lebarTitik = Math.max(0, lebarNilai - lebarPetunjuk - 6);
        const jumlahTitik = Math.max(0, Math.floor(lebarTitik / 3.4));

        dokumen
          .font('Helvetica')
          .fontSize(UKURAN_ISI)
          .fillColor(WARNA_GARIS)
          .text('.'.repeat(jumlahTitik), posisiNilai, yBaris, {
            width: lebarTitik,
            lineBreak: false,
          });

        if (petunjuk) {
          dokumen
            .font('Helvetica-Oblique')
            .fontSize(UKURAN_KECIL + 1)
            .fillColor(WARNA_REDUP)
            .text(petunjuk, posisiNilai + lebarTitik + 4, yBaris, { lineBreak: false });
        }

        dokumen.font('Helvetica').fontSize(UKURAN_ISI).fillColor(WARNA_TINTA);
      }

      if (nilai && petunjuk) {
        const lebarPetunjuk = dokumen
          .font('Helvetica-Oblique')
          .fontSize(UKURAN_KECIL + 1)
          .widthOfString(petunjuk);
        dokumen
          .font('Helvetica-Oblique')
          .fontSize(UKURAN_KECIL + 1)
          .fillColor(WARNA_REDUP)
          .text(petunjuk, posisiNilai + lebarNilai - lebarPetunjuk, yBaris, { lineBreak: false });
        dokumen.font('Helvetica').fontSize(UKURAN_ISI).fillColor(WARNA_TINTA);
      }

      dokumen.x = MARGIN_KIRI;
      dokumen.y = yBaris + 14;
    };

    for (const baris of isi.identitas) {
      pastikanRuang(16);

      const nilaiTerisi =
        baris.label.toLowerCase().includes('nama') && terisi.nama
          ? terisi.nama
          : baris.label.toLowerCase().includes('hp') && terisi.nomorHp
            ? terisi.nomorHp
            : baris.label.toLowerCase().includes('alamat') && terisi.alamat
              ? terisi.alamat
              : baris.nilai;

      cetakBarisIsian(baris.label, nilaiTerisi ?? '', baris.petunjuk, baris.tipe);
    }

    dokumen.moveDown(0.4);

    // ---------------------------------------------------------------- DETAIL SEWA
    pastikanRuang(tinggiTeks(isi.pengantarDetail, lebarArea) + 10);
    dokumen.x = MARGIN_KIRI;
    dokumen.font('Helvetica').fontSize(UKURAN_ISI).text(isi.pengantarDetail);
    dokumen.moveDown(0.3);

    for (const baris of isi.detailSewa) {
      pastikanRuang(16);

      const nilaiTerisi =
        baris.label.toLowerCase().includes('mobil') && terisi.namaMobil
          ? terisi.namaMobil
          : (baris.nilai ?? '');

      cetakBarisIsian(baris.label, nilaiTerisi, baris.petunjuk, baris.tipe);
    }

    dokumen.moveDown(0.4);

    // ---------------------------------------------------------------- BUTIR
    /*
     * `dokumen.x` dikembalikan ke margin kiri sebelum setiap blok. Menggambar
     * sel tabel dan teks berposisi memindahkan kursor, dan PDFKit memakai posisi
     * itu untuk `text()` berikutnya bila x tidak disebutkan.
     */
    dokumen.x = MARGIN_KIRI;
    dokumen.font('Helvetica').fontSize(UKURAN_ISI).text(isi.pembukaPernyataan);
    dokumen.moveDown(0.3);

    for (const butir of isi.butir) {
      const lebarButir = lebarArea - 0.8 * CM;
      const tinggiButir = tinggiTeks(butir.teks, lebarButir);

      // Satu butir tidak boleh terbelah dua halaman.
      pastikanRuang(tinggiButir + 6);

      const yButir = dokumen.y;
      dokumen
        .font('Helvetica')
        .fontSize(UKURAN_ISI)
        .fillColor(WARNA_TINTA)
        .text(`${butir.nomor}.`, posisiLabel, yButir, { width: 0.8 * CM });
      dokumen.text(butir.teks, posisiLabel + 0.8 * CM, yButir, {
        width: lebarButir,
        align: 'justify',
      });
      dokumen.x = MARGIN_KIRI;
      dokumen.moveDown(0.25);
    }

    dokumen.moveDown(0.3);
    pastikanRuang(tinggiTeks(isi.penutup, lebarArea) + 10);
    dokumen.x = MARGIN_KIRI;
    dokumen.text(isi.penutup, { width: lebarArea, align: 'justify' });
    dokumen.moveDown(0.6);

    // ---------------------------------------------------------------- TANDA TANGAN
    /*
     * Blok tanda tangan, tempat dan tanggal, serta tabel pembayaran dianggap satu
     * kesatuan. Kalau dipisah halaman, tanda tangan bisa tertinggal sendirian di
     * halaman berikutnya dan dokumen jadi tidak layak dicetak.
     */
    const tinggiBarisTabel = 0.62 * CM;
    const jumlahBarisTabel = 2 + Math.max(1, isi.tabelPembayaran.jumlahBarisKosong);
    const tinggiTabel = jumlahBarisTabel * tinggiBarisTabel;

    /*
     * Ruang yang benar-benar dibutuhkan blok penutup: baris tempat dan tanggal,
     * kotak tanda tangan, tabel pembayaran, dan keterangan di bawahnya. Dihitung
     * pas tanpa kelonggaran berlebih, karena kelebihan beberapa poin saja bisa
     * memaksa pindah halaman padahal isinya masih muat.
     */
    pastikanRuang(14 + 3.6 * CM + 14 + tinggiTabel + 22);

    const yTandaTangan = dokumen.y;

    dokumen
      .font('Helvetica')
      .fontSize(UKURAN_ISI)
      .text(isi.tempatTanggal, MARGIN_KIRI, yTandaTangan, { width: lebarArea, align: 'right' });

    const lebarKotak = 5.4 * CM;
    const xKotak = MARGIN_KIRI + lebarArea - lebarKotak;
    const yKotak = yTandaTangan + 14;
    const tinggiKotak = 3.6 * CM;

    dokumen
      .rect(xKotak, yKotak, lebarKotak, tinggiKotak)
      .lineWidth(0.7)
      .strokeColor(WARNA_GARIS)
      .stroke();

    // Kotak meterai di dalam kotak tanda tangan.
    const lebarMeterai = 2.4 * CM;
    dokumen
      .rect(xKotak + (lebarKotak - lebarMeterai) / 2, yKotak + 0.5 * CM, lebarMeterai, 1.6 * CM)
      .lineWidth(0.5)
      .dash(2, { space: 2 })
      .strokeColor(WARNA_GARIS)
      .stroke()
      .undash();

    dokumen
      .font('Helvetica-Oblique')
      .fontSize(UKURAN_KECIL)
      .fillColor(WARNA_REDUP)
      .text('meterai', xKotak, yKotak + 1.15 * CM, { width: lebarKotak, align: 'center' });

    dokumen
      .font('Helvetica')
      .fontSize(UKURAN_ISI)
      .fillColor(WARNA_TINTA)
      .text(isi.tandaTangan.peran, xKotak, yKotak + 2.3 * CM, {
        width: lebarKotak,
        align: 'center',
      });

    dokumen
      .font('Helvetica')
      .fontSize(UKURAN_KECIL + 1)
      .fillColor(WARNA_REDUP)
      .text(`( ${isi.tandaTangan.keterangan} )`, xKotak, yKotak + 2.85 * CM, {
        width: lebarKotak,
        align: 'center',
      });

    dokumen.y = yKotak + tinggiKotak + 14;
    dokumen.fillColor(WARNA_TINTA);

    // ---------------------------------------------------------------- TABEL PEMBAYARAN
    const lebarKolom = lebarTabel(lebarArea);
    const tinggiBaris = 0.62 * CM;
    const xTabel = MARGIN_KIRI;

    const gambarBarisTabel = (yBaris: number, sel: string[], tebal: boolean, tinggi: number) => {
      let xSel = xTabel;
      for (let i = 0; i < sel.length; i += 1) {
        const lebar = lebarKolom[i];

        dokumen.rect(xSel, yBaris, lebar, tinggi).lineWidth(0.6).strokeColor(WARNA_GARIS).stroke();

        dokumen
          .font(tebal ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(UKURAN_ISI - 1)
          .fillColor(WARNA_TINTA)
          .text(sel[i], xSel + 3, yBaris + (tinggi - UKURAN_ISI) / 2 + 1, {
            width: lebar - 6,
            align: i === 0 ? 'center' : 'left',
            lineBreak: false,
          });

        xSel += lebar;
      }
    };

    // Judul tabel digabung pada baris pertama.
    const yJudulTabel = dokumen.y;
    dokumen
      .rect(xTabel, yJudulTabel, lebarArea, tinggiBaris)
      .lineWidth(0.6)
      .strokeColor(WARNA_GARIS)
      .stroke();
    dokumen
      .font('Helvetica-Bold')
      .fontSize(UKURAN_ISI - 1)
      .fillColor(WARNA_TINTA)
      .text(isi.tabelPembayaran.judul, xTabel, yJudulTabel + 3, {
        width: lebarArea,
        align: 'center',
      });

    gambarBarisTabel(yJudulTabel + tinggiBaris, isi.tabelPembayaran.kolom, true, tinggiBaris);

    let yBarisIsi = yJudulTabel + tinggiBaris * 2;
    const jumlahBaris = Math.max(1, isi.tabelPembayaran.jumlahBarisKosong);

    for (let i = 1; i <= jumlahBaris; i += 1) {
      gambarBarisTabel(yBarisIsi, [String(i), '', '', ''], false, tinggiBaris);
      yBarisIsi += tinggiBaris;
    }

    dokumen.y = yBarisIsi + 8;
    dokumen.x = MARGIN_KIRI;

    // ---------------------------------------------------------------- KETERANGAN
    dokumen
      .font('Helvetica-Oblique')
      .fontSize(UKURAN_KECIL)
      .fillColor(WARNA_REDUP)
      .text(`Keterangan: ${isi.keteranganTabel}`, MARGIN_KIRI, dokumen.y, {
        width: lebarArea,
        align: 'justify',
      });

    dokumen.moveDown(0.2);
    dokumen.text(isi.catatanVersi, MARGIN_KIRI, dokumen.y, { width: lebarArea });

    // Kode booking dicetak kecil di bawah bila ada, untuk mencocokkan berkas
    // cetak dengan pesanan di sistem.
    if (terisi.kodeBooking) {
      dokumen.moveDown(0.2);
      dokumen
        .font('Helvetica')
        .fontSize(UKURAN_KECIL)
        .fillColor(WARNA_REDUP)
        .text(`Ref. Pesanan: ${terisi.kodeBooking}`, MARGIN_KIRI, dokumen.y, {
          width: lebarArea,
        });
    }

    dokumen.end();
  });
}
