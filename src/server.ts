import { app } from './app.js';
import { startTicketCleanupJob } from './jobs/ticketCleanupJob.js';
import { startPaymentExpirationJob } from './jobs/paymentExpirationJob.js';

const port = Number(process.env.PORT ?? 4000);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`mobiljuragan-api listening on http://localhost:${port}`);
  startTicketCleanupJob();
  startPaymentExpirationJob();
});
