import { UserRole } from '../../shared/enums';

/** CSS layout keys — decoupled from enum display names. */
export type LayoutThemeKey = 'admin' | 'member' | 'commerce';

export interface LayoutThemeDefinition {
  key: LayoutThemeKey;
  /** BEM class applied on the shell, e.g. `layout--member`. */
  className: `layout--${LayoutThemeKey}`;
}

export const LAYOUT_THEME_BY_ROLE: Record<UserRole, LayoutThemeDefinition> = {
  [UserRole.Admin]: {
    key: 'admin',
    className: 'layout--admin',
  },
  [UserRole.Socio]: {
    key: 'member',
    className: 'layout--member',
  },
  [UserRole.Comercio]: {
    key: 'commerce',
    className: 'layout--commerce',
  },
};

export function resolveLayoutTheme(role: UserRole | null | undefined): LayoutThemeDefinition {
  if (!role) {
    return LAYOUT_THEME_BY_ROLE[UserRole.Admin];
  }
  return LAYOUT_THEME_BY_ROLE[role];
}
