/**
 * In-memory job tracker voor auto-cluster runs. Gedeeld door de POST
 * (die een job start) en de GET status endpoint (die de voortgang leest).
 *
 * LET OP: dit leeft in het module scope van de Node process. Op een
 * serverless platform (Vercel) werkt dit alleen zolang dezelfde
 * function instance warm blijft. Voor productie-gebruik later vervangen
 * door een DB-backed tracker of een echte job queue. Voor lokaal
 * development + het huidige gebruik (Sem draait 'm 1x per week) is
 * in-memory prima.
 */

export interface AutoClusterJob {
  id: string;
  gebruikerId: number;
  status: "running" | "done" | "error";
  totaal: number;
  bijgewerkt: number;
  perCluster: Record<string, number>;
  gestartOp: string; // ISO
  klaarOp: string | null;
  fout: string | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __autoClusterJobs: Map<string, AutoClusterJob> | undefined;
}

// Gebruik globalThis zodat HMR/reload dezelfde Map houdt tijdens dev
function getJobsMap(): Map<string, AutoClusterJob> {
  if (!globalThis.__autoClusterJobs) {
    globalThis.__autoClusterJobs = new Map();
  }
  return globalThis.__autoClusterJobs;
}

export function createJob(gebruikerId: number): AutoClusterJob {
  const id = crypto.randomUUID();
  const job: AutoClusterJob = {
    id,
    gebruikerId,
    status: "running",
    totaal: 0,
    bijgewerkt: 0,
    perCluster: {},
    gestartOp: new Date().toISOString(),
    klaarOp: null,
    fout: null,
  };
  getJobsMap().set(id, job);
  // Oude jobs opruimen na 30 min zodat de map niet eindeloos groeit
  setTimeout(() => {
    getJobsMap().delete(id);
  }, 30 * 60 * 1000);
  return job;
}

export function getJob(id: string): AutoClusterJob | null {
  return getJobsMap().get(id) ?? null;
}

export function updateJob(id: string, patch: Partial<AutoClusterJob>): void {
  const job = getJobsMap().get(id);
  if (!job) return;
  Object.assign(job, patch);
}

export function markJobDone(
  id: string,
  result: { totaal: number; bijgewerkt: number; perCluster: Record<string, number> }
): void {
  updateJob(id, {
    ...result,
    status: "done",
    klaarOp: new Date().toISOString(),
  });
}

export function markJobError(id: string, fout: string): void {
  updateJob(id, {
    status: "error",
    fout,
    klaarOp: new Date().toISOString(),
  });
}
