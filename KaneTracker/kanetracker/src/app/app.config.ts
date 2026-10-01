import { APP_INITIALIZER, ApplicationConfig, provideZoneChangeDetection, isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideServiceWorker } from '@angular/service-worker';
import { DexieService } from './services/dexie.service';
import { LockService } from './lock/lock.service';

export const appConfig: ApplicationConfig = {
  providers: [
    {
      // Create due recurring entries before any page reads the DB.
      provide: APP_INITIALIZER, multi: true, deps: [DexieService, LockService],
      useFactory: (db: DexieService, lock: LockService) => async () => {
        // Lock state first, so the PIN screen never flashes (or is skipped) on load.
        try { await lock.init(); } catch (e) { console.error('Lock init failed', e); }
        try { db.recurringAdded = await db.processRecurring(); } catch (e) { console.error('Recurring failed', e); }
      },
    },
    provideZoneChangeDetection({ eventCoalescing: true }), provideRouter(routes), provideServiceWorker('ngsw-worker.js', {
            enabled: !isDevMode(),
            registrationStrategy: 'registerWhenStable:30000'
          })]
};
