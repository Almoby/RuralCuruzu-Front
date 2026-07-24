import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { AppBadge, AppCard, AppPageHeader } from '../../../shared/components';

@Component({
  selector: 'app-socio-qr',
  standalone: true,
  imports: [AppPageHeader, AppCard, AppBadge],
  templateUrl: './socio-qr.html',
  styleUrl: './socio-qr.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SocioQr {
  private readonly auth = inject(AuthService);

  readonly user = this.auth.currentUser;
  readonly memberCode = computed(() => this.user()?.memberCode ?? 'S-0000');
  readonly memberName = computed(() => this.user()?.fullName ?? 'Socio');
  readonly qrUrl = computed(() => {
    const data = encodeURIComponent(this.memberCode());
    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${data}`;
  });
}
