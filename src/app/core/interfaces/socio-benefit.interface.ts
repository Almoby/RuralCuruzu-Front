/**
 * Socio Beneficios — Swagger contracts:
 * - GET /api/socio/beneficios
 * - GET /api/socio/beneficios/comercios-con-beneficios
 * - GET /api/socio/beneficios/historial-beneficios (used by Socio Historial, not this screen)
 *
 * There is no Socio detail/image/categories endpoint.
 */

import { SocioBeneficioResumenDto } from './socio-panel.interface';

export type { SocioBeneficioResumenDto };

/** Query params shared by listarBeneficios / listarComercios. */
export interface ListarSocioBeneficiosParams {
  rubro?: string;
  busqueda?: string;
}

/** GET /api/socio/beneficios/comercios-con-beneficios item. */
export interface SocioComercioConBeneficiosDto {
  id?: string;
  nombreComercial?: string;
  rubro?: string;
  direccion?: string;
  telefono?: string;
  /** Logo path/URL when the backend provides one. */
  logo?: string;
  beneficios?: SocioBeneficioResumenDto[] | null;
}

/** Raw payloads before mapping to the Beneficios catalog ViewModel. */
export interface SocioBenefitsRawBundle {
  beneficios: SocioBeneficioResumenDto[];
  comercios: SocioComercioConBeneficiosDto[];
}
