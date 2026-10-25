import { ticketModel } from '../model/ticketModel.js';

/**
 * Worker periodik untuk menutup otomatis tiket RESOLVED yang telah melewati batas 24 jam
 * dan sesi AI yang tidak aktif lebih dari 24 jam.
 */
export function startTicketCleanupJob(intervalMs = 30 * 60 * 1000) {
  const runCleanup = async () => {
    try {
      const closedResolved = await ticketModel.autoCloseResolvedTickets(24);
      const closedAi = await ticketModel.autoCloseStaleAiSessions(24);
      if (closedResolved > 0 || closedAi > 0) {
        // eslint-disable-next-line no-console
        console.log(
          `[TicketCleanupJob] Auto-closed: ${closedResolved} resolved tickets, ${closedAi} stale AI sessions.`,
        );
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[TicketCleanupJob] Error running ticket cleanup:', error);
    }
  };

  // Jalankan sekali saat startup
  runCleanup();

  // Jalankan berulang secara periodik
  const timer = setInterval(runCleanup, intervalMs);

  return {
    stop() {
      clearInterval(timer);
    },
  };
}
