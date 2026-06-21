import cron from 'node-cron'
import type { AppSettings } from '../src/types'

let task: cron.ScheduledTask | null = null

// Local in-app scheduler (runs while the app is open). Mirrors the prototype's
// daily cron, but self-contained in the desktop process.
export function applySchedule(settings: AppSettings, run: () => void): void {
  if (task) {
    task.stop()
    task = null
  }
  if (settings.scheduleEnabled && cron.validate(settings.scheduleCron)) {
    task = cron.schedule(settings.scheduleCron, () => {
      try {
        run()
      } catch {
        /* never let a scheduled tick crash the app */
      }
    })
  }
}
