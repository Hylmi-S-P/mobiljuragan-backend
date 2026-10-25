import { app } from './app.js';
import { mulaiPenjadwalTiket } from './lib/autoCloseTickets.js';

const port = Number(process.env.PORT ?? 4000);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`mobiljuragan-api listening on http://localhost:${port}`);

  /* Penutupan otomatis tiket dijalankan di proses yang sama dengan API.
     Proyek ini berjalan satu proses, jadi menambah worker terpisah hanya
     menambah bagian yang bisa lupa dinyalakan. */
  mulaiPenjadwalTiket();
});
