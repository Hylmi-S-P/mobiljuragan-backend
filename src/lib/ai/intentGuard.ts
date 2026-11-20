import { NOMOR_WHATSAPP_KANTOR } from '../kontak.js';

export type IntentGuardStatus = 'PASSED' | 'PROMPT_INJECTION' | 'ROADSIDE_EMERGENCY';

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
          'Percakapan ini kami tandai prioritas agar tim admin dapat langsung menindaklanjuti bantuan teknis maupun unit pengganti jika diperlukan.',
        ].join('\n'),
      };
    }
  }

  return { status: 'PASSED', blockedOrFastPath: false };
}
