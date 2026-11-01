/**
 * Isi bawaan template dokumen resmi.
 *
 * Seluruh teks di bawah disalin dari berkas acuan perusahaan
 * `PERNYATAAN-SEWA-MOBIL-20-10-2026.docx` supaya dokumen yang dicetak pelanggan
 * benar-benar sama dengan surat resmi yang dipakai selama ini.
 *
 * Setelah versi pertama masuk database, admin bebas mengubahnya lewat dashboard.
 * Berkas ini hanya dipakai sekali, saat template belum ada di database.
 */

export interface ButirPernyataan {
  nomor: number;
  teks: string;
}

export interface BarisIdentitas {
  label: string;
  /** Nilai kosong berarti pelanggan mengisi tangan saat mencetak. */
  nilai: string;
  /** Petunjuk pengisian yang dicetak miring, misalnya [dalam/luar kota]. */
  petunjuk?: string;
  /** Penanda tampilan khusus. `bbm` mencetak kotak angka 1 sampai 6. */
  tipe?: 'teks' | 'bbm';
}

export interface IsiTemplateDokumen {
  kop: {
    nama: string;
    tagline: string;
    alamat: string;
    telepon: string;
  };
  judul: string;
  pembuka: string;
  identitas: BarisIdentitas[];
  pengantarDetail: string;
  detailSewa: BarisIdentitas[];
  pembukaPernyataan: string;
  butir: ButirPernyataan[];
  penutup: string;
  tempatTanggal: string;
  tandaTangan: {
    peran: string;
    keterangan: string;
  };
  tabelPembayaran: {
    judul: string;
    kolom: string[];
    jumlahBarisKosong: number;
  };
  keteranganTabel: string;
  catatanVersi: string;
}

export const ISI_BAWAAN_FORM_KESANGGUPAN: IsiTemplateDokumen = {
  kop: {
    nama: 'CV. MOBIL JURAGAN EXPRESS TRANSPORT',
    tagline: 'Solusi Kebutuhan Mobil Anda',
    alamat: 'Jl. Pendidikan, Gg. IV Perumahan Pemda Merauke, Papua Selatan',
    telepon: 'HP1. 0822 4843 9393, HP2. 0823 1164 1010',
  },

  judul: 'SURAT PERNYATAAN SEWA MOBIL',

  pembuka: 'Yang bertanda tangan di bawah ini :',

  identitas: [
    { label: 'Nama', nilai: '' },
    { label: 'Nomor HP.', nilai: '' },
    { label: 'Alamat', nilai: '' },
  ],

  pengantarDetail:
    'Saya menyewa kendaraan mobil dari CV. Mobil Juragan Express Transport Merauke dengan detail sebagai berikut :',

  detailSewa: [
    { label: 'Rute Jalan/Arah', nilai: '', petunjuk: '[dalam/luar kota]' },
    { label: 'Lama Sewa', nilai: '', petunjuk: '[hari/minggu/bulan]' },
    { label: 'Nama Mobil', nilai: '' },
    { label: 'Indikator BBM', nilai: '', tipe: 'bbm' },
  ],

  pembukaPernyataan: 'Dengan ini, saya menyatakan bahwa :',

  butir: [
    {
      nomor: 1,
      teks: 'Bersedia mematuhi seluruh ketentuan sewa CV. Mobil Juragan Express Transport serta bertanggung jawab atas segala pelanggaran sesuai hukum yang berlaku.',
    },
    {
      nomor: 2,
      teks: 'Menjamin seluruh data yang diberikan benar dan dapat dipertanggungjawabkan secara hukum.',
    },
    {
      nomor: 3,
      teks: 'Tidak menjual, menggadaikan, meminjamkan, atau mengalihkan kendaraan kepada pihak lain.',
    },
    {
      nomor: 4,
      teks: 'Bertanggung jawab penuh atas kerusakan kendaraan akibat tindakan saya serta kehilangan perlengkapan kendaraan, termasuk STNK, kunci, ban cadangan, dan perlengkapan lainnya.',
    },
    {
      nomor: 5,
      teks: 'Mematuhi rute yang disepakati dan wajib memperoleh persetujuan pihak rental sebelum mengubah rute.',
    },
    {
      nomor: 6,
      teks: 'Tidak mengemudi dalam keadaan mabuk, melakukan kebut-kebutan, atau melanggar peraturan lalu lintas.',
    },
    {
      nomor: 7,
      teks: 'Tidak merusak, mengganti, atau menukar komponen kendaraan, baik interior maupun eksterior.',
    },
    {
      nomor: 8,
      teks: 'Tidak membawa muatan berlebih (ODOL), bahan berbahaya, berbau menyengat, atau barang yang berpotensi merusak kendaraan.',
    },
    {
      nomor: 9,
      teks: 'Mengembalikan kendaraan tepat waktu, dalam kondisi bersih dan dengan jumlah BBM setara saat pengambilan. Perpanjangan sewa wajib mendapat persetujuan pihak rental; pelanggaran dapat mengakibatkan penarikan kendaraan.',
    },
    {
      nomor: 10,
      teks: 'Tidak menggunakan kendaraan untuk kegiatan melanggar hukum serta memahami bahwa barang pribadi yang tertinggal bukan tanggung jawab pihak rental.',
    },
  ],

  penutup:
    'Demikian pernyataan ini saya buat dengan sadar, tanpa paksaan, dan bersedia bertanggung jawab atas segala pelanggaran ketentuan di atas.',

  tempatTanggal: 'Merauke, ..................................',

  tandaTangan: {
    peran: 'Penyewa',
    keterangan: 'Nama lengkap',
  },

  tabelPembayaran: {
    judul: 'Riwayat Pembayaran',
    kolom: ['No.', 'Uraian', 'Jumlah (Rp.)', 'Paraf Petugas'],
    jumlahBarisKosong: 5,
  },

  keteranganTabel:
    'Isi sesuai Riwayat Pembayaran yang terjadi, tambahkan keterangan lunas bila biaya sewa telah dibayarkan semua/lunas.',

  catatanVersi: 'update: 20 Oktober 2026',
};

/** Kode template yang dipakai kode program. */
export const KODE_FORM_KESANGGUPAN = 'FORM_KESANGGUPAN';
