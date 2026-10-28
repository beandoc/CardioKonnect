import { toast } from 'sonner'

/**
 * Surfaces a failed registry load. Pages must not fall back to empty data on
 * error — an unavailable database is not the same as a registry with no events.
 */
export function notifyLoadError(err: unknown, context = 'Registry data'): void {
  console.error(`${context} failed to load:`, err)
  toast.error(`${context} could not be loaded`, {
    description: err instanceof Error ? err.message : 'The database is unavailable. Figures shown may be incomplete.',
  })
}
