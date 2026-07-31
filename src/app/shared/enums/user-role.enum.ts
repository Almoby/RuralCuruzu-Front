export enum UserRole {
  Admin = 'ADMIN',
  Socio = 'SOCIO',
  Comercio = 'COMERCIO',
}

export type AppRole = `${UserRole}`;

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.Admin]: 'Administrador',
  [UserRole.Socio]: 'Socio',
  [UserRole.Comercio]: 'Comercio',
};

export function isUserRole(value: string | null | undefined): value is UserRole {
  return value === UserRole.Admin || value === UserRole.Socio || value === UserRole.Comercio;
}
