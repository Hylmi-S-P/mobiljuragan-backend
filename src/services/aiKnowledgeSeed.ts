import { db } from '../db.js';
import { logger } from '../logger.js';

export async function ensureAiDefaults(): Promise<void> {
  try {
    // 1. Inisialisasi AiSetting jika belum ada
    const existingSetting = await db.aiSetting.findUnique({
      where: { id: 'default' },
    });

    if (!existingSetting) {
      await db.aiSetting.create({
        data: {
          id: 'default',
          gatewayUrl: 'http://localhost:20128/v1',
          apiKey: '',
          activeModel: 'MJ',
          temperature: 0.7,
          maxTokens: 1000,
          enableRag: true,
          systemPrompt: `Anda adalah Asisten Virtual Resmi MobilJuragan (CV. Mobil Juragan Express Transport, Merauke).
Tugas Anda adalah melayani pertanyaan pelanggan seputar rental mobil di Merauke, rekomendasi unit armada, persyaratan sewa (lepas kunci & dengan supir), aturan rute, dan tarif sewa.
Gunakan Bahasa Indonesia yang ramah, sopan, lugas, dan akurat berdasarkan Dokumen Konteks Pengetahuan Resmi MobilJuragan di bawah ini.
Jika pelanggan menanyakan hal di luar konteks atau membutuhkan bantuan darurat/negosiasi khusus, tawarkan untuk menyambungkan percakapan ke staf admin manusia.`,
        },
      });
      logger.info('Pengaturan awal AI Gateway MobilJuragan berhasil dibuat.');
    }

    // 2. Inisialisasi Dokumen Pengetahuan Awal jika tabel masih kosong
    const docCount = await db.knowledgeDocument.count();
    if (docCount === 0) {
      const initialDocs = [
        {
          title: 'SOP & Ketentuan Sewa Lepas Kunci (Tanpa Supir)',
          category: 'SOP',
          content: `1. Persyaratan Utama:
- Pelanggan wajib menunjukkan dokumen identitas asli (e-KTP asli Merauke atau Surat Tugas Instansi Kedinasan/Perusahaan).
- Memiliki Surat Izin Mengemudi (SIM A) yang masih berlaku sah.
- Memberikan deposit jaminan sewa (jaminan dikembalikan 100% setelah unit dicek kembali dalam keadaan baik).

2. Ketentuan Pemakaian & Pengembalian:
- Unit hanya boleh dikemudikan oleh nama terdaftar dalam kontrak sewa.
- Toleransi keterlambatan pengembalian maksimal 60 menit. Keterlambatan lebih dari 1 jam dikenakan biaya overtime Rp 50.000/jam, atau terhitung sewa 1 hari penuh jika melebihi 6 jam.
- Kebijakan Bahan Bakar: Sistem *same-to-same* (level BBM saat kembali wajib sama seperti saat pengambilan awal).`,
        },
        {
          title: 'Panduan Rute Wilayah Operasional Merauke & Luar Kota',
          category: 'ROUTE',
          content: `1. Rute Dalam Kota:
Mencakup area perkotaan Merauke, Bandara Mopah, Pelabuhan Merauke, Distrik Semangga, dan Pantai Lampu Satu. Seluruh unit armada (MPV, SUV, Pickup) dapat beroperasi tanpa syarat tambahan.

2. Rute Luar Kota (Trans-Papua):
- Rute Distrik Sota & Pos Lintas Batas Negara (PLBN) Sota (~80 km): Wajib menggunakan supir siaga berpengalaman atau izin konfirmasi khusus lepas kunci dengan armada bersuspensi prima (Avanza, Xpander, Rush, Terios, Fortuner).
- Rute Boven Digoel / Tanah Merah: Mengingat kondisi medan jalan tanah dan jembatan kayu musiman, sangat direkomendasikan memilih armada 4x4 atau berpenggerak tinggi seperti Toyota Hilux G Double Cabin atau Fortuner VRZ TRD.`,
        },
        {
          title: 'Struktur Tarif Sewa & Penyesuaian Biaya Resmi',
          category: 'TARIFF',
          content: `1. Estimasi Tarif Harian (Lepas Kunci):
- Suzuki Carry Pickup: Rp 350.000 / hari
- Toyota Avanza G / Daihatsu Terios / Toyota Rush: Rp 450.000 - Rp 550.000 / hari
- Mitsubishi Xpander Exceed / Toyota Veloz: Rp 500.000 - Rp 600.000 / hari
- Toyota Innova Reborn G: Rp 650.000 - Rp 750.000 / hari
- Toyota Fortuner VRZ TRD / Toyota Hilux G: Rp 1.500.000 - Rp 2.000.000 / hari

2. Biaya Tambahan Jasa Supir:
- Rute Dalam Kota: Penambahan jasa supir Rp 150.000 - Rp 200.000 / hari.
- Rute Luar Kota (Sota/Boven Digoel): Penambahan jasa supir disesuaikan dengan uang saku perjalanan dan akomodasi supir jika menginap.`,
        },
        {
          title: 'Protokol Darurat & Prosedur Human Handoff (Customer Care)',
          category: 'EMERGENCY',
          content: `1. Keadaan Darurat di Jalan:
Jika mengalami mogok, pecah ban di jalan Trans-Papua, atau insiden operasional, pelanggan diminta segera menghubungi Hotline Siaga MobilJuragan di nomor 0812-3456-7890 atau membuat tiket bantuan prioritas di menu Customer Care.

2. Prosedur Pengalihan ke Staf Manusia (Human Handoff):
Jika pelanggan meminta negosiasi harga rombongan instansi dinas, armada darurat pengganti, atau menyampaikan keluhan yang tidak dapat diselesaikan oleh sistem bot, sistem akan mengirimkan pesan transisi resmi:
"Baik, untuk pertanyaan atau negosiasi ini akan segera saya teruskan ke staf admin operasional MobilJuragan. Mohon ditunggu sebentar, staf kami akan segera merespons di sini."
Tiket chat akan otomatis beralih status menjadi WAITING_HUMAN dan notifikasi dikirimkan ke admin.`,
        },
      ];

      for (const doc of initialDocs) {
        await db.knowledgeDocument.create({ data: doc });
      }
      logger.info('4 Dokumen Konteks Pengetahuan (RAG) awal berhasil di-seed.');
    }
  } catch (err) {
    logger.warn({ err }, 'Peringatan saat inisialisasi default AI settings / Knowledge documents');
  }
}
