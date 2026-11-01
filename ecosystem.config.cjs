/**
 * Konfigurasi PM2 untuk backend MobilJuragan di laptop server.
 *
 * Dijalankan dari folder backend setelah `npm run build`:
 *
 *   pm2 start ecosystem.config.cjs --env production
 *   pm2 save
 *
 * Catatan penting: `instances` sengaja 1, bukan `max`. Penjadwal tiket dan
 * pembersihan tiket berjalan di dalam proses API, jadi menjalankan beberapa
 * instance akan membuat tiap instance ikut menutup tiket yang sama.
 */
module.exports = {
  apps: [
    {
      name: 'mobiljuragan-api',
      script: 'dist/server.js',
      cwd: __dirname,

      // Satu proses saja, karena penjadwal berjalan di dalam proses ini.
      instances: 1,
      exec_mode: 'fork',

      // Restart otomatis bila proses keluar tanpa sengaja, tetapi berhenti
      // mencoba kalau gagal terus-menerus dalam waktu singkat. Tanpa batas ini,
      // konfigurasi yang salah akan membuat PM2 restart tanpa henti dan
      // menutupi pesan galat sebenarnya di log.
      autorestart: true,
      max_restarts: 10,
      min_uptime: '20s',
      restart_delay: 2000,

      // Beri waktu koneksi yang sedang berjalan ditutup sebelum SIGKILL.
      kill_timeout: 12000,
      listen_timeout: 10000,

      // Log dipisah supaya galat mudah dibaca tanpa tenggelam di akses rutin.
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      merge_logs: true,
      time: true,
      max_size: '20M',
      retain: 7,

      env_production: {
        NODE_ENV: 'production',
        PORT: 4000,
        HOST: '127.0.0.1',
        TRUST_PROXY: '1',
        APP_VERSION: '1.0.0',
        LOG_LEVEL: 'info',
      },
    },
  ],
};
