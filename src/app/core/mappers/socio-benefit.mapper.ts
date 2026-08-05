import {
  Benefit,
  BenefitCategoryFilter,
  BenefitMerchantCard,
  BenefitOfferType,
  BenefitsViewModeOption,
  SocioBenefitsCatalogResponse,
} from '../interfaces/benefit.interface';
import {
  BeneficioTipoDto,
  SocioBeneficioResumenDto,
  SocioBenefitsRawBundle,
  SocioComercioConBeneficiosDto,
} from '../interfaces/socio-benefit.interface';

function text(value: string | null | undefined, fallback = ''): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

/** Formats LocalDate `YYYY-MM-DD` as `d/m/yyyy` without UTC shift. */
function formatLocalDateLabel(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) {
    return value.trim();
  }
  return `${Number(match[3])}/${Number(match[2])}/${match[1]}`;
}

function mapOfferType(tipo: BeneficioTipoDto | undefined): {
  offerType: BenefitOfferType;
  offerTypeLabel: string;
  offerTypeIcon: string;
} {
  switch (tipo) {
    case 'DESCUENTO_PORCENTAJE':
      return {
        offerType: 'descuento',
        offerTypeLabel: 'Descuento',
        offerTypeIcon: 'local_offer',
      };
    case 'DOS_POR_UNO':
    case 'TRES_POR_DOS':
      return {
        offerType: 'promocion',
        offerTypeLabel: 'Promoción',
        offerTypeIcon: 'gift',
      };
    case 'GRATIS':
      return {
        offerType: 'fijo',
        offerTypeLabel: 'Gratis',
        offerTypeIcon: 'gift',
      };
    case 'OTRO':
    default:
      return {
        offerType: 'promocion',
        offerTypeLabel: 'Promoción',
        offerTypeIcon: 'local_offer',
      };
  }
}

function parseDiscountPercent(valor: string): number | undefined {
  const match = /^(\d+(?:[.,]\d+)?)\s*%$/.exec(valor.trim());
  if (!match) {
    return undefined;
  }
  const parsed = Number(match[1].replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function mapSocioBeneficioDtoToViewModel(
  dto: SocioBeneficioResumenDto,
  index: number,
): Benefit {
  const offer = mapOfferType(dto.tipo);
  const valor = text(dto.valor, '—');
  const validTo = text(dto.fechaFinVigencia);
  const validToDisplay = formatLocalDateLabel(validTo);
  const categoryName = text(dto.comercioRubro, 'General');

  return {
    id: text(dto.id, `beneficio-${index}`),
    merchantId: text(dto.comercioId, ''),
    merchantName: text(dto.comercioNombre, 'No informado'),
    title: text(dto.titulo, 'Beneficio'),
    description: text(dto.descripcion, 'Sin descripción'),
    categoryId: categoryName.toLowerCase().replace(/\s+/g, '-'),
    categoryName,
    discountLabel: valor,
    discountPercent: parseDiscountPercent(valor),
    badgeLabel: valor,
    offerType: offer.offerType,
    offerTypeLabel: offer.offerTypeLabel,
    offerTypeIcon: offer.offerTypeIcon,
    validToLabel: validToDisplay ? `Hasta ${validToDisplay}` : 'Vigencia no informada',
    // BeneficioResumenResponse has no image field — UI uses rubro icons.
    imageUrl: undefined,
    isActive: true,
    validFrom: '',
    validTo: validTo || undefined,
  };
}

export function mapSocioComercioDtoToViewModel(
  dto: SocioComercioConBeneficiosDto,
  index: number,
): BenefitMerchantCard {
  const beneficios = dto.beneficios ?? [];
  const count = beneficios.length;
  const badges = beneficios
    .map((item) => text(item.valor))
    .filter((value) => value.length > 0)
    .slice(0, 4);

  return {
    id: text(dto.id, `comercio-${index}`),
    name: text(dto.nombreComercial, 'Comercio'),
    categoryName: text(dto.rubro, 'General'),
    address: text(dto.direccion, 'No informado'),
    phone: text(dto.telefono, 'No informado'),
    benefitsCount: count,
    benefitsCountLabel:
      count === 1 ? '1 beneficio activo' : `${count} beneficios activos`,
    badges,
  };
}

function buildCategories(
  beneficios: SocioBeneficioResumenDto[],
  comercios: SocioComercioConBeneficiosDto[],
): BenefitCategoryFilter[] {
  const rubros = new Set<string>();

  for (const item of beneficios) {
    const rubro = text(item.comercioRubro);
    if (rubro) {
      rubros.add(rubro);
    }
  }

  for (const item of comercios) {
    const rubro = text(item.rubro);
    if (rubro) {
      rubros.add(rubro);
    }
  }

  const chips: BenefitCategoryFilter[] = [
    { id: 'cat-all', label: 'Todos', value: 'all' },
  ];

  Array.from(rubros)
    .sort((a, b) => a.localeCompare(b, 'es'))
    .forEach((rubro, index) => {
      chips.push({
        id: `cat-${index}-${rubro.toLowerCase().replace(/\s+/g, '-')}`,
        label: rubro,
        value: rubro,
      });
    });

  return chips;
}

const VIEW_MODES: BenefitsViewModeOption[] = [
  { id: 'promotions', label: 'Promociones' },
  { id: 'merchants', label: 'Comercios' },
];

/**
 * Maps Socio beneficios + comercios responses into the Beneficios catalog ViewModel.
 * Pass `categories` to preserve chips when the request was filtered by `rubro`.
 */
export function mapSocioBenefitsBundleToCatalog(
  bundle: SocioBenefitsRawBundle,
  options?: { categories?: BenefitCategoryFilter[] },
): SocioBenefitsCatalogResponse {
  const promotions = bundle.beneficios.map((item, index) =>
    mapSocioBeneficioDtoToViewModel(item, index),
  );
  const merchants = bundle.comercios.map((item, index) =>
    mapSocioComercioDtoToViewModel(item, index),
  );

  const categories =
    options?.categories && options.categories.length > 0
      ? options.categories
      : buildCategories(bundle.beneficios, bundle.comercios);

  return {
    title: 'Beneficios y Comercios',
    subtitle: '',
    searchPlaceholder: 'Buscar beneficios o comercios...',
    categories,
    viewModes: VIEW_MODES,
    promotions,
    merchants,
  };
}
