import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, finalize, startWith, switchMap, tap } from 'rxjs';
import { MemberQrService } from '../../../core/services/member-qr.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ApiError } from '../../../core/interfaces/api-response.interface';
import { MemberQrResponse } from '../../../core/interfaces/member-qr.interface';
import {
  AppAlert,
  AppButton,
  AppEmptyState,
  AppIcon,
  AppLoading,
} from '../../../shared/components';

type QrViewState = 'loading' | 'success' | 'blocked' | 'empty' | 'error';

/** Refresh a few seconds before token expiry (Swagger: expires in a few seconds). */
const REFRESH_LEAD_MS = 2_000;
const MIN_REFRESH_DELAY_MS = 500;

function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    'message' in error &&
    typeof (error as ApiError).status === 'number' &&
    typeof (error as ApiError).message === 'string'
  );
}

@Component({
  selector: 'app-socio-qr',
  standalone: true,
  imports: [AppAlert, AppButton, AppEmptyState, AppIcon, AppLoading],
  templateUrl: './socio-qr.html',
  styleUrl: './socio-qr.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SocioQr {
  private readonly qrService = inject(MemberQrService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload$ = new Subject<void>();
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  readonly viewState = signal<QrViewState>('loading');
  readonly data = signal<MemberQrResponse | null>(null);
  readonly refreshing = signal(false);
  readonly sharing = signal(false);
  readonly errorMessage = signal('No pudimos cargar tu QR. Reintentá en unos segundos.');

  readonly profile = computed(() => this.data()?.profile ?? null);
  readonly qr = computed(() => this.data()?.qr ?? null);
  readonly summary = computed(() => this.data()?.summary ?? null);
  readonly available = computed(() => this.data()?.available === true);
  readonly codigoQr = computed(() => this.data()?.codigoQr?.trim() ?? '');
  readonly copyingCodigo = signal(false);

  /**
   * Visual QR from the exact backend token.
   * Uses the same image renderer already present in the UI.
   */
  readonly qrImageUrl = computed(() => {
    const value = this.qr()?.qrValue;
    if (!value || !this.available()) {
      return '';
    }
    const encoded = encodeURIComponent(value);
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=004A49&bgcolor=FFFFFF&data=${encoded}`;
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.clearRefreshTimer());

    this.reload$
      .pipe(
        startWith(undefined),
        tap(() => {
          if (!this.data()) {
            this.viewState.set('loading');
          }
        }),
        switchMap(() =>
          this.qrService.getSocioQr().pipe(
            catchError((error: unknown) => {
              this.clearRefreshTimer();
              this.data.set(null);
              this.viewState.set('error');
              this.errorMessage.set(
                isApiError(error)
                  ? error.message
                  : 'No pudimos cargar tu QR. Reintentá en unos segundos.',
              );
              this.notifications.error(this.errorMessage());
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((payload) => {
        this.applyPayload(payload);
      });
  }

  protected retry(): void {
    this.reload$.next();
  }

  protected refreshQr(): void {
    if (this.refreshing()) {
      return;
    }

    this.refreshing.set(true);
    this.clearRefreshTimer();
    this.qrService
      .refreshSocioQr()
      .pipe(
        finalize(() => this.refreshing.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (payload) => {
          this.applyPayload(payload);
          if (payload.available) {
            this.notifications.success('QR actualizado correctamente.');
          }
        },
        error: (error: unknown) => {
          this.notifications.error(
            isApiError(error) ? error.message : 'No se pudo actualizar el QR.',
          );
        },
      });
  }

  protected shareQr(): void {
    if (this.sharing() || !this.data()?.available) {
      return;
    }

    this.sharing.set(true);
    const payload = this.qrService.buildSocioQrSharePayload(this.data()!);

    void (async () => {
      try {
        if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
          await navigator.share({
            title: payload.title,
            text: payload.text,
            url: payload.url || undefined,
          });
          this.notifications.success('QR compartido.');
          return;
        }

        const clipboardText = payload.url
          ? `${payload.text}\n${payload.url}`
          : payload.text;
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(clipboardText);
          this.notifications.success('Datos del socio copiados al portapapeles.');
          return;
        }

        this.notifications.info(payload.text);
      } catch {
        this.notifications.error('No se pudo compartir el QR.');
      } finally {
        this.sharing.set(false);
      }
    })();
  }

  /** Copies only Swagger `codigoQr` — never the long JWT token. */
  protected copyCodigoQr(): void {
    const code = this.codigoQr();
    if (!code || this.copyingCodigo()) {
      return;
    }

    this.copyingCodigo.set(true);
    void (async () => {
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(code);
          this.notifications.success('Código copiado.');
          return;
        }

        // Fallback when Clipboard API is unavailable.
        const textarea = document.createElement('textarea');
        textarea.value = code;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (ok) {
          this.notifications.success('Código copiado.');
        } else {
          this.notifications.info(code);
        }
      } catch {
        this.notifications.error('No se pudo copiar el código.');
      } finally {
        this.copyingCodigo.set(false);
      }
    })();
  }

  private applyPayload(payload: MemberQrResponse): void {
    this.data.set(payload);

    if (payload.available && payload.qr?.qrValue) {
      this.viewState.set('success');
      this.scheduleAutoRefresh(payload.expiresAt);
      return;
    }

    this.clearRefreshTimer();

    if (payload.profile.memberNumber && payload.profile.memberNumber !== '—') {
      this.viewState.set('blocked');
      return;
    }

    this.viewState.set('empty');
  }

  private scheduleAutoRefresh(expiresAt: string | null): void {
    this.clearRefreshTimer();
    if (!expiresAt) {
      return;
    }

    const expiresMs = Date.parse(expiresAt);
    if (!Number.isFinite(expiresMs)) {
      return;
    }

    const delay = Math.max(expiresMs - Date.now() - REFRESH_LEAD_MS, MIN_REFRESH_DELAY_MS);
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      this.reload$.next();
    }, delay);
  }

  private clearRefreshTimer(): void {
    if (this.refreshTimer !== null) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}
