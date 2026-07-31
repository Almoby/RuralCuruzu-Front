import { HttpContextToken } from '@angular/common/http';

/** Skip global error toasts (form screens handle messages locally). */
export const SKIP_ERROR_TOAST = new HttpContextToken<boolean>(() => false);

/** Do not attempt token refresh / retry for this request. */
export const SKIP_AUTH_REFRESH = new HttpContextToken<boolean>(() => false);

/** Marks a request that already failed once with 401 and was retried. */
export const AUTH_RETRY_DONE = new HttpContextToken<boolean>(() => false);
