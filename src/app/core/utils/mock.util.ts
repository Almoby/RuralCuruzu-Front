import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export function mockResponse<T>(data: T, delayMs = environment.mockDelayMs): Observable<T> {
  return of(structuredClone(data)).pipe(delay(delayMs));
}
