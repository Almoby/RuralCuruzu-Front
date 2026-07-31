export type BenefitRubroTone =
  | 'farmacia'
  | 'gastronomia'
  | 'libreria'
  | 'fitness'
  | 'cafeteria'
  | 'optica'
  | 'supermercado'
  | 'veterinaria'
  | 'otro';

export interface BenefitRubroIconConfig {
  icon: string;
  tone: BenefitRubroTone;
  backgroundColor: string;
  iconColor: string;
}

/** Canonical rubro labels used by Mi Panel / beneficios. */
export type BenefitRubroName =
  | 'Farmacia'
  | 'Gastronomía'
  | 'Restaurante'
  | 'Librería'
  | 'Salud y Fitness'
  | 'Gimnasio'
  | 'Cafetería'
  | 'Óptica'
  | 'Supermercado'
  | 'Veterinaria'
  | 'Otro';

const RUBRO_ICON_CONFIG: Record<BenefitRubroName, BenefitRubroIconConfig> = {
  Farmacia: {
    icon: 'pharmacy',
    tone: 'farmacia',
    backgroundColor: '#e8f5ef',
    iconColor: '#0f766e',
  },
  Gastronomía: {
    icon: 'utensils',
    tone: 'gastronomia',
    backgroundColor: '#fff4e8',
    iconColor: '#c2410c',
  },
  Restaurante: {
    icon: 'utensils',
    tone: 'gastronomia',
    backgroundColor: '#fff4e8',
    iconColor: '#c2410c',
  },
  Librería: {
    icon: 'book',
    tone: 'libreria',
    backgroundColor: '#eef2ff',
    iconColor: '#4338ca',
  },
  'Salud y Fitness': {
    icon: 'fitness',
    tone: 'fitness',
    backgroundColor: '#f0fdf4',
    iconColor: '#15803d',
  },
  Gimnasio: {
    icon: 'fitness',
    tone: 'fitness',
    backgroundColor: '#f0fdf4',
    iconColor: '#15803d',
  },
  Cafetería: {
    icon: 'coffee',
    tone: 'cafeteria',
    backgroundColor: '#faf5f0',
    iconColor: '#92400e',
  },
  Óptica: {
    icon: 'glasses',
    tone: 'optica',
    backgroundColor: '#ecfeff',
    iconColor: '#0e7490',
  },
  Supermercado: {
    icon: 'storefront',
    tone: 'supermercado',
    backgroundColor: '#fef3c7',
    iconColor: '#b45309',
  },
  Veterinaria: {
    icon: 'loyalty',
    tone: 'veterinaria',
    backgroundColor: '#fce7f3',
    iconColor: '#be185d',
  },
  Otro: {
    icon: 'storefront',
    tone: 'otro',
    backgroundColor: '#f3f4f6',
    iconColor: '#4b5563',
  },
};

const RUBRO_ALIASES: Record<string, BenefitRubroName> = {
  farmacia: 'Farmacia',
  gastronomía: 'Gastronomía',
  gastronomia: 'Gastronomía',
  restaurante: 'Restaurante',
  librería: 'Librería',
  libreria: 'Librería',
  'salud y fitness': 'Salud y Fitness',
  gimnasio: 'Gimnasio',
  cafetería: 'Cafetería',
  cafeteria: 'Cafetería',
  óptica: 'Óptica',
  optica: 'Óptica',
  supermercado: 'Supermercado',
  veterinaria: 'Veterinaria',
  otro: 'Otro',
};

export function resolveBenefitRubroIcon(category: string): BenefitRubroIconConfig {
  const normalized = category.trim().toLocaleLowerCase('es-AR');
  const known = RUBRO_ALIASES[normalized];
  if (known) {
    return RUBRO_ICON_CONFIG[known];
  }
  return RUBRO_ICON_CONFIG.Otro;
}
