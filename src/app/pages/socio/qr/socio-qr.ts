import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { MemberQrService } from '../../../core/services/member-qr.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  MemberQrResponse,
} from '../../../core/interfaces/member-qr.interface';
import {
  AppAlert,
  AppButton,
  AppEmptyState,
  AppIcon,
  AppLoading,
} from '../../../shared/components';

type QrViewState = 'loading' | 'success' | 'empty' | 'error';

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

  readonly viewState = signal<QrViewState>('loading');
  readonly data = signal<MemberQrResponse | null>(null);
  readonly refreshing = signal(false);
  readonly sharing = signal(false);

  readonly profile = computed(() => this.data()?.profile ?? null);
  readonly qr = computed(() => this.data()?.qr ?? null);
  readonly summary = computed(() => this.data()?.summary ?? null);

  readonly qrImageUrl = computed(() => {
    const value = this.qr()?.qrValue;
    if (!value) {
      return '';
    }
    const encoded = encodeURIComponent(value);
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=004A49&bgcolor=FFFFFF&data=${encoded}`;
  });

  constructor() {
    this.load();
  }

  protected retry(): void {
    this.load();
  }

  protected refreshQr(): void {
    if (this.refreshing()) {
      return;
    }

    this.refreshing.set(true);
    this.qrService
      .refreshMemberQr()
      .pipe(
        finalize(() => this.refreshing.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          this.data.update((current) =>
            current
              ? {
                  ...current,
                  qr: response.qr,
                }
              : current,
          );
          this.viewState.set('success');
          this.notifications.success('QR actualizado correctamente.');
        },
        error: () => {
          this.notifications.error('No se pudo actualizar el QR.');
        },
      });
  }

  protected shareQr(): void {
    if (this.sharing()) {
      return;
    }

    this.sharing.set(true);
    this.qrService
      .shareMemberQr()
      .pipe(
        finalize(() => this.sharing.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: async (payload) => {
          try {
            if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
              await navigator.share({
                title: payload.title,
                text: payload.text,
                url: payload.url,
              });
              this.notifications.success('QR compartido.');
              return;
            }

            const clipboardText = `${payload.text}\n${payload.url}`;
            if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
              await navigator.clipboard.writeText(clipboardText);
              this.notifications.success('Datos del QR copiados al portapapeles.');
              return;
            }

            this.notifications.info(payload.text);
          } catch {
            this.notifications.error('No se pudo compartir el QR.');
          }
        },
        error: () => {
          this.notifications.error('No se pudo preparar el contenido para compartir.');
        },
      });
  }

  private load(): void {
    this.viewState.set('loading');
    this.qrService
      .getMemberQr()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (payload) => {
          this.data.set(payload);
          if (!payload.qr?.qrValue) {
            this.viewState.set('empty');
            return;
          }
          this.viewState.set('success');
        },
        error: () => {
          this.data.set(null);
          this.viewState.set('error');
        },
      });
  }
}
