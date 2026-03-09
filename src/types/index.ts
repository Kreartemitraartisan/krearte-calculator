export interface Material {
  id: number;
  name: string;
  type: string;
  width_material: number;
  width_print: number;
  price_retail: number;
  price_designer: number;
  price_reseller: number;
  price_partner?: number;
  waste_price: number;
  sample_price?: number;
  is_active?: boolean;
}

export interface CustomerMaterial {
  id: number;
  name: string;
  width: number;
  width_print: number;
  price_print: number;
  waste_price: number;
  category: 'standard' | 'karpet_blind';
}

// ✅ Tambahkan interface untuk Print Service
export interface PrintServicePrice {
  id: number;
  service_name: string;
  price_per_m2: number;
  category: 'print' | 'addon';
  description: string | null;
  is_active: boolean;
  width_options?: WidthOption[];
}

export interface WallInput {
  id: number | string;
  width: string | number;
  height: string | number;
}

export interface CalculationResult {
  volumePrint: number;
  volumeBahan: number;
  volumeWaste: number;
  numPanels: number;
  materialCost: number;
  wasteCost: number;
  cost25d: number;
  costDesign: number;
  costEnhance: number;
  costShutterstock: number;
  costInstallation: number;
  costSample: number;
  costPrintService: number;  // ✅ Untuk Reseller Partner
  totalCost: number;
  wasteInfo?: string;
  wastePrice?: number;
  bleedWidth?: number;
  bleedHeight?: number;
}

export interface WidthOption {
  width: number;  // dalam meter
  label: string;
}

export type Role = 'admin' | 'designer' | 'reseller' | 'reseller_partner';

export interface UserProfile {
  id: string;
  username: string;
  role: Role;
}

export type PriceType = 'retail' | 'designer' | 'reseller' | 'reseller_partner';

export interface CalcParams {
  walls: { width: number; height: number }[];
  materialType: 'krearte' | 'customer';
  material?: Material;
  customerMaterial?: CustomerMaterial;
  role: 'designer' | 'reseller' | 'reseller_partner';
  priceType: 'retail' | 'designer' | 'reseller' | 'reseller_partner';
  bleedWidth: number;
  bleedHeight: number;
  printServiceId?: number;
  selectedWidth?: number | null;
  printServicePrice?: number;
  addons: {
    is25d: boolean;
    designServicePrice: number;
    imageEnhance: boolean;
    shutterstockQty: number;
    installation: boolean;
    installationCity?: string;
    installationType?: 'normal' | 'panel' | 'void';
    wallHeight?: number;
    includeSample?: boolean;
    sampleQty?: number;
    samplePrice?: number;
  };
}