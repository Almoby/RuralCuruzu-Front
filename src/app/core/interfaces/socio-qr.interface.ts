/**
 * Backend DTO for GET /api/socio/perfil/mi-qr (Swagger MiQrResponse).
 * There is no separate refresh/download/share endpoint for Socio QR.
 */

export type SocioQrCategoria = 'ACTIVO' | 'ADHERENTE';

export type SocioQrEstado =
  | 'ACTIVO'
  | 'INACTIVO_POR_DEUDA'
  | 'INACTIVO_POR_SUSPENSION'
  | 'VENCIDO'
  | 'BLOQUEADO';

export interface MiQrResponseDto {
  token?: string;
  expiraEn?: string;
  numeroSocio?: string;
  nombre?: string;
  categoria?: SocioQrCategoria;
  estado?: SocioQrEstado;
  mensaje?: string;
  fechaValidez?: string;
  ultimoPago?: string;
}
