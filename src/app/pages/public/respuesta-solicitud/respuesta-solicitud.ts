import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { APP_ROUTES } from '../../../core/constants/routes.constant';
import { ApiError } from '../../../core/interfaces/api-response.interface';
import {
  ObservacionPendienteResponse,
  SelectedAttachment,
} from '../../../core/interfaces/respuesta-solicitud.interface';
import { RespuestaSolicitudService } from '../../../core/services/respuesta-solicitud.service';
import { AppAlert } from '../../../shared/components/alert/app-alert';
import { AppButton } from '../../../shared/components/button/app-button';
import { AppCard } from '../../../shared/components/card/app-card';
import { AppIcon } from '../../../shared/components/icon/app-icon';
import { AppLoading } from '../../../shared/components/loading/app-loading';
import { AppTextarea } from '../../../shared/components/textarea/app-textarea';
import { DateEsPipe } from '../../../shared/pipes';

type RespuestaSolicitudViewState =
  | 'loading'
  | 'ready'
  | 'submitting'
  | 'success'
  | 'invalid-link'
  | 'error';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png']);

function requiredTrimmed(control: AbstractControl): ValidationErrors | null {
  const value = typeof control.value === 'string' ? control.value.trim() : '';
  return value.length > 0 ? null : { required: true };
}

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

function looksLikeInvalidLinkMessage(message: string): boolean {
  return /inv[aá]lido|utilizado|ya\s+fue\s+usad|venci[oó]|expirad|enlace/i.test(
    message,
  );
}

@Component({
  selector: 'app-respuesta-solicitud',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AppAlert,
    AppButton,
    AppCard,
    AppIcon,
    AppLoading,
    AppTextarea,
    DateEsPipe,
  ],
  templateUrl: './respuesta-solicitud.html',
  styleUrl: './respuesta-solicitud.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RespuestaSolicitud implements AfterViewChecked {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(RespuestaSolicitudService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('statusHeading')
  private readonly statusHeading?: ElementRef<HTMLHeadingElement>;

  private focusPending = false;

  protected readonly viewState = signal<RespuestaSolicitudViewState>('loading');
  protected readonly token = signal('');
  protected readonly observation = signal<ObservacionPendienteResponse | null>(null);
  protected readonly attachments = signal<SelectedAttachment[]>([]);
  protected readonly fileError = signal('');
  protected readonly submitError = signal('');
  protected readonly loadError = signal('');
  protected readonly invalidLinkMessage = signal(
    'El enlace no es válido, ya fue utilizado o venció.',
  );
  protected readonly successMessage = signal(
    'Tu respuesta y la documentación fueron enviadas correctamente.',
  );

  protected readonly loginRoute = ['/', ...APP_ROUTES.auth.login.split('/')];
  protected readonly dateTimeFormat: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  };

  protected readonly form = this.fb.nonNullable.group({
    texto: ['', [Validators.required, requiredTrimmed]],
  });

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const nextToken = (params.get('token') ?? '').trim();
      this.token.set(nextToken);

      if (!nextToken) {
        this.observation.set(null);
        this.invalidLinkMessage.set('El enlace no es válido, ya fue utilizado o venció.');
        this.viewState.set('invalid-link');
        this.requestStatusFocus();
        return;
      }

      this.loadObservation(nextToken);
    });
  }

  ngAfterViewChecked(): void {
    if (!this.focusPending || !this.statusHeading) {
      return;
    }

    this.statusHeading.nativeElement.focus();
    this.focusPending = false;
  }

  protected fieldError(): string {
    const control = this.form.controls.texto;
    if (!control.touched || !control.invalid) {
      return '';
    }

    if (control.hasError('required')) {
      return 'Escribí una respuesta antes de enviar.';
    }

    return 'Dato inválido';
  }

  protected canSubmit(): boolean {
    return !!this.token() && this.viewState() === 'ready' && this.form.valid;
  }

  protected isFormLocked(): boolean {
    const state = this.viewState();
    return state !== 'ready';
  }

  protected retryLoad(): void {
    const currentToken = this.token();
    if (!currentToken) {
      this.viewState.set('invalid-link');
      this.requestStatusFocus();
      return;
    }

    this.loadObservation(currentToken);
  }

  protected openFilePicker(input: HTMLInputElement): void {
    if (this.isFormLocked()) {
      return;
    }

    input.click();
  }

  protected onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    this.addFiles(files);
    input.value = '';
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (this.isFormLocked()) {
      return;
    }

    const files = event.dataTransfer?.files ? Array.from(event.dataTransfer.files) : [];
    this.addFiles(files);
  }

  protected removeAttachment(id: string): void {
    if (this.isFormLocked()) {
      return;
    }

    this.attachments.update((items) => items.filter((item) => item.id !== id));
    this.fileError.set('');
  }

  protected formatFileSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  protected iconForFile(file: File): string {
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      return 'file';
    }

    return 'file';
  }

  protected onSubmit(): void {
    this.submitError.set('');
    this.form.markAllAsTouched();

    const currentToken = this.token();
    if (!currentToken || this.viewState() !== 'ready' || this.form.invalid) {
      return;
    }

    const texto = this.form.controls.texto.value.trim();
    if (!texto) {
      this.form.controls.texto.setErrors({ required: true });
      return;
    }

    this.viewState.set('submitting');
    this.form.disable({ emitEvent: false });

    const files = this.attachments().map((item) => item.file);

    this.service
      .sendResponse(currentToken, texto, files)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const message = response.mensaje?.trim();
          if (message) {
            this.successMessage.set(message);
          }
          this.viewState.set('success');
          this.requestStatusFocus();
        },
        error: (error: unknown) => {
          this.form.enable({ emitEvent: false });
          this.handleSubmitError(error);
        },
      });
  }

  private loadObservation(token: string): void {
    this.viewState.set('loading');
    this.loadError.set('');
    this.submitError.set('');
    this.fileError.set('');
    this.observation.set(null);
    this.attachments.set([]);
    this.form.reset({ texto: '' });
    this.form.enable({ emitEvent: false });

    this.service
      .getPendingObservation(token)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (payload) => {
          this.observation.set(payload);
          this.viewState.set('ready');
        },
        error: (error: unknown) => {
          this.handleLoadError(error);
        },
      });
  }

  private handleLoadError(error: unknown): void {
    if (isApiError(error) && error.status === 400) {
      this.invalidLinkMessage.set(
        error.message || 'El enlace no es válido, ya fue utilizado o venció.',
      );
      this.viewState.set('invalid-link');
      this.requestStatusFocus();
      return;
    }

    this.loadError.set(
      isApiError(error)
        ? error.message || 'No pudimos cargar la solicitud. Intentá nuevamente.'
        : 'No pudimos cargar la solicitud. Intentá nuevamente.',
    );
    this.viewState.set('error');
    this.requestStatusFocus();
  }

  private handleSubmitError(error: unknown): void {
    if (!isApiError(error)) {
      this.submitError.set('No pudimos enviar tu respuesta. Intentá nuevamente.');
      this.viewState.set('ready');
      return;
    }

    if (error.status === 413) {
      this.submitError.set('Los archivos seleccionados superan el tamaño permitido.');
      this.viewState.set('ready');
      return;
    }

    if (error.status === 400 && looksLikeInvalidLinkMessage(error.message)) {
      this.invalidLinkMessage.set(
        error.message || 'El enlace no es válido, ya fue utilizado o venció.',
      );
      this.viewState.set('invalid-link');
      this.requestStatusFocus();
      return;
    }

    if (error.status === 0 || error.status >= 500) {
      this.submitError.set('No pudimos enviar tu respuesta. Intentá nuevamente.');
      this.viewState.set('ready');
      return;
    }

    this.submitError.set(
      error.message || 'No pudimos enviar tu respuesta. Intentá nuevamente.',
    );
    this.viewState.set('ready');
  }

  private addFiles(files: File[]): void {
    if (files.length === 0) {
      return;
    }

    const rejected: string[] = [];
    const accepted: SelectedAttachment[] = [];
    const current = this.attachments();

    for (const file of files) {
      if (!this.isAllowedFile(file)) {
        rejected.push(file.name);
        continue;
      }

      const isDuplicate = [...current, ...accepted].some(
        (item) =>
          item.file.name === file.name &&
          item.file.size === file.size &&
          item.file.lastModified === file.lastModified,
      );

      if (isDuplicate) {
        continue;
      }

      accepted.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
      });
    }

    if (accepted.length > 0) {
      this.attachments.update((items) => [...items, ...accepted]);
    }

    if (rejected.length > 0) {
      this.fileError.set(
        rejected.length === 1
          ? `El archivo “${rejected[0]}” no es un tipo permitido. Usá PDF, JPG o PNG.`
          : 'Algunos archivos no son tipos permitidos. Solo se aceptan PDF, JPG y PNG.',
      );
    } else {
      this.fileError.set('');
    }
  }

  private isAllowedFile(file: File): boolean {
    const mimeOk = file.type ? ALLOWED_MIME_TYPES.has(file.type) : false;
    const extension = this.fileExtension(file.name);
    const extensionOk = ALLOWED_EXTENSIONS.has(extension);

    if (mimeOk) {
      return true;
    }

    return extensionOk;
  }

  private fileExtension(name: string): string {
    const index = name.lastIndexOf('.');
    if (index < 0) {
      return '';
    }

    return name.slice(index).toLowerCase();
  }

  private requestStatusFocus(): void {
    this.focusPending = true;
  }
}
