export interface Material {
  id: number;
  name: string;
  type: string;
  width_material: number;
  width_print: number;
  price_retail: number;
  price_designer: number;
  price_reseller: number;
  waste_price: number;
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

export interface WallInput {
  id: string;
  width: number;
  height: number;
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
  totalCost: number;
  wasteInfo?: string;
  bleedWidth?: number;  // optional, untuk display
  bleedHeight?: number; // optional, untuk display
}