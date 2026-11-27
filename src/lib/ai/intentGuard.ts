import { NOMOR_WHATSAPP_KANTOR } from '../kontak.js';

export type IntentGuardStatus =
  | 'PASSED'
  | 'PROMPT_INJECTION'
  | 'ROADSIDE_EMERGENCY'
  | 'HUMAN_HANDOVER_REQUEST';

export interface IntentGuardResult {
  status: IntentGuardStatus;
  blockedOrFastPath: boolean;
  reply?: string;
  reason?: string;
}

const PROMPT_INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions|prompts|rules)/i,
  /abaikan\s+(semua\s+)?(instruksi|aturan|perintah|prompt)\s*(sebelumnya|di atas)?/i,
  /(reveal|show|print|dump|tampilkan|sebutkan|bocorkan|keluarkan).{0,30}(system\s*prompt|prompt\s*sistem|instruksi\s*rahasia|api[\s_-]?key|secret\s*key|jwt_secret|\.env)/i,
  /\b(jailbreak|developer\s*mode|dan\s*mode|bypass\s*security|override\s*rules)\b/i,
  /(act\s+as|pretend\s+to\s+be|berpura[-\s]?pura\s+jadi)\s+(root|admin|system|sql\s*console|hacker)/i,
];

const ROADSIDE_EMERGENCY_PATTERNS: RegExp[] = [
  /\b(mogok|kecelakaan|tabrakan|ban\s+pecah|pecah\s+ban|rem\s+blong|mati\s+total|terjebak\s+banjir|mesin\s+terbakar|keluar\s+asap|darurat\s+jalan)\b/i,
];

const HUMAN_HANDOVER_NEGATION_PATTERNS: RegExp[] = [
  /\b(tidak|tak|gak|ga|nggak|engga|enggak|jangan|belum)\s+(perlu|butuh|usah|mau|ingin|alihkan|sambungkan|hubungkan|panggil|oper|teruskan|pindahkan)\b[^,.;!?\n]{0,35}\b(admin|cs|customer\s*service|staf|staff|operator|petugas|manusia)\b/i,
  /\b(gak|ga|nggak|tidak)\s+usah\b[^,.;!?\n]{0,25}\b(admin|cs|staf|staff|operator|petugas|manusia)\b/i,
];

const HUMAN_HANDOVER_POSITIVE_PATTERNS: RegExp[] = [
  /\b(hubungkan|dihubungkan|sambungkan|disambungkan|alihkan|dialihkan|pindahkan|dipindahkan|teruskan|diteruskan|oper|dioper|eskalasi|handover|handoff|panggil|panggilkan|bicara|berbicara|ngobrol|chat|berkomunikasi|berhubungan|talk|speak|connect|transfer)\b.{0,40}\b(admin|cs|customer\s*service|staf|staff|operator|petugas|manusia|orang\s*asli|human|real\s*person|live\s*agent)\b/i,
  /\b(minta|mau|ingin|pengen|pengin|tolong|mohon|butuh|perlu|cari|harus)\b.{0,30}\b(admin\s*(manusia|asli|langsung)|cs\s*(manusia|asli|langsung)|customer\s*service\s*(manusia|asli|langsung)|staf\s*(manusia|asli|langsung|operasional)|staff\s*(manusia|asli|langsung|operasional)|operator\s*(manusia|asli|langsung)|orang\s*asli|human\s*agent|live\s*agent|real\s*person)\b/i,
  /\b(tidak\s*mau|tak\s*mau|gak\s*mau|ga\s*mau|nggak\s*mau|gamau|bukan|jangan)\s+(sama\s+|dengan\s+|dijawab\s+|dilayani\s+|dibalas\s+)?(ai|bot|robot|asisten\s*virtual)\b/i,
  /\b(minta|tolong|mohon|panggil|panggilkan)\s+(di)?(balas|jawab|tangani|layan[in]?)\s+(oleh\s+|sama\s+)?(admin|cs|staf|staff|operator|petugas|manusia)\b/i,
  /\b(minta|tolong|mohon|panggil|panggilkan)\s+(admin|staf|staff|operator|cs)\b(?!\s+(jam|buka|tutup|nomor|no\.?|wa|whatsapp|berapa|dimana|di\s+mana|kapan|bagaimana|gimana))/i,
  /\b(ke|sama|dengan|biar)\s+(admin|cs|staf|staff|operator|manusia)\s+(manusia|asli|langsung|aja|saja)\b/i,
  /\b(admin|cs|staf|staff|operator)\s+(manusia|asli|aja|saja)(?:\s+(?:aja|saja))?\s+(dong|ya|please|pls|yang\s+(balas|jawab|tangani))\b/i,
];

/**
 * Memeriksa apakah pesan pelanggan secara eksplisit meminta dihubungkan/berbicara dengan admin manusia.
 */
export function isExplicitHumanHandoverRequest(rawMessage: string): boolean {
  const normalized = rawMessage.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    return false;
  }

  for (const negation of HUMAN_HANDOVER_NEGATION_PATTERNS) {
    if (negation.test(normalized)) {
      return false;
    }
  }

  for (const positive of HUMAN_HANDOVER_POSITIVE_PATTERNS) {
    if (positive.test(normalized)) {
      return true;
    }
  }

  return false;
}

/**
 * Memeriksa pesan pelanggan untuk mencegah prompt injection serta memicu jalur cepat darurat di jalan.
 */
export function inspectPromptSafety(rawMessage: string): IntentGuardResult {
  const message = rawMessage.trim();
  if (!message) {
    return { status: 'PASSED', blockedOrFastPath: false };
  }

  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(message)) {
      return {
        status: 'PROMPT_INJECTION',
        blockedOrFastPath: true,
        reason: 'Terdeteksi upaya manipulasi instruksi sistem atau ekstraksi kredensial.',
        reply: [
          'Maaf, saya tidak dapat memproses permintaan untuk mengubah aturan sistem atau menampilkan konfigurasi internal.',
          '',
          'Saya dapat membantu seputar armada tersedia, estimasi tarif sewa, syarat lepas kunci, status pesanan Anda, atau meneruskan kendala ke tim MobilJuragan Merauke.',
        ].join('\n'),
      };
    }
  }

  for (const pattern of ROADSIDE_EMERGENCY_PATTERNS) {
    if (pattern.test(message)) {
      return {
        status: 'ROADSIDE_EMERGENCY',
        blockedOrFastPath: true,
        reason: 'Terdeteksi laporan kondisi darurat kendaraan di jalan.',
        reply: [
          'LAPORAN DARURAT JALAN — Segera lakukan langkah pengamanan berikut terlebih dahulu:',
          '1. Tepikan kendaraan ke bahu jalan yang aman dan nyalakan lampu hazard.',
          '2. Pastikan seluruh penumpang turun ke area aman menjauh dari arus lalu lintas (pasang segitiga pengaman jika tersedia).',
          `3. Hubungi tim siaga MobilJuragan Merauke lewat WhatsApp/Telepon resmi ${NOMOR_WHATSAPP_KANTOR} serta kirimkan titik lokasi GPS (share location) dan foto kondisi kendaraan/pelat nomor.`,
          '',
          'Jika Anda membutuhkan bantuan langsung dari admin manusia di ruang chat ini, silakan balas dengan meminta dihubungkan ke admin manusia.',
        ].join('\n'),
      };
    }
  }

  return { status: 'PASSED', blockedOrFastPath: false };
}
