import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { STORAGE_KEYS } from '../constants/storage-keys.constant';
import { asDisplayableBusinessCode } from '../utils/display-identity.util';
import { AuthService } from './auth.service';
import { UserRole } from '../../shared/enums';

interface StoredSocioNumero {
  email: string;
  numeroSocio: string;
}

/**
 * Socio chrome identity (`numeroSocio`).
 * Primary source: LoginResponse / AuthSession.numeroSocio.
 * Legacy email cache + domain endpoints remain as fallback for old sessions.
 * Never stores or exposes Mongo/UUID technical ids from login `refId`.
 */
@Injectable({ providedIn: 'root' })
export class UserIdentityService {
  private readonly auth = inject(AuthService);
  private readonly socioNumeroSignal = signal<string | null>(null);

  readonly socioNumero = this.socioNumeroSignal.asReadonly();

  readonly sidebarIdentityLabel = computed(() => {
    const user = this.auth.currentUser();
    if (!user) {
      return '';
    }

    const fullName = user.fullName?.trim() || '';
    if (!fullName) {
      return '';
    }

    if (user.role === UserRole.Socio) {
      const numero =
        asDisplayableBusinessCode(this.socioNumeroSignal()) ||
        asDisplayableBusinessCode(user.memberCode);
      if (numero) {
        return `${numero} · ${fullName}`;
      }
      return fullName;
    }

    if (user.role === UserRole.Comercio) {
      return user.merchantName?.trim() || fullName;
    }

    return fullName;
  });

  constructor() {
    effect(() => {
      const session = this.auth.session();
      if (!session || session.role !== UserRole.Socio) {
        this.socioNumeroSignal.set(null);
        return;
      }

      const fromSession = asDisplayableBusinessCode(session.numeroSocio);
      if (fromSession) {
        this.socioNumeroSignal.set(fromSession);
        this.writeStored({ email: session.email, numeroSocio: fromSession });
        return;
      }

      const stored = this.readStoredForEmail(session.email);
      this.socioNumeroSignal.set(stored);
    });
  }

  /**
   * Persist a real Socio number from QR / cuotas / pagos when available.
   * Does not overwrite a different session.numeroSocio from login.
   */
  setSocioNumero(value: string | null | undefined): void {
    const numero = asDisplayableBusinessCode(value);
    if (!numero) {
      return;
    }

    const session = this.auth.getCurrentSession();
    if (!session || session.role !== UserRole.Socio) {
      return;
    }

    const fromSession = asDisplayableBusinessCode(session.numeroSocio);
    if (fromSession) {
      if (fromSession !== numero) {
        // Session from LoginResponse wins; keep chrome aligned with session.
        if (this.socioNumeroSignal() !== fromSession) {
          this.socioNumeroSignal.set(fromSession);
        }
      }
      return;
    }

    if (this.socioNumeroSignal() === numero) {
      return;
    }

    this.socioNumeroSignal.set(numero);
    this.writeStored({ email: session.email, numeroSocio: numero });
  }

  clear(): void {
    this.socioNumeroSignal.set(null);
    localStorage.removeItem(STORAGE_KEYS.socioNumero);
  }

  private readStoredForEmail(email: string): string | null {
    const raw = localStorage.getItem(STORAGE_KEYS.socioNumero);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as StoredSocioNumero;
      if (parsed.email?.trim().toLowerCase() !== email.trim().toLowerCase()) {
        return null;
      }
      return asDisplayableBusinessCode(parsed.numeroSocio);
    } catch {
      return null;
    }
  }

  private writeStored(payload: StoredSocioNumero): void {
    localStorage.setItem(STORAGE_KEYS.socioNumero, JSON.stringify(payload));
  }
}
