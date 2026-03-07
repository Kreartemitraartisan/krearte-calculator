// src/lib/calculations.ts
import { CalculationResult, Material, CustomerMaterial } from '@/types';
import { calculateInstallationCost } from './installation';

interface CalcParams {
  walls: { width: number; height: number }[];
  materialType: 'krearte' | 'customer';
  material?: Material;
  customerMaterial?: CustomerMaterial;
  role: 'designer' | 'reseller';
  priceType: 'retail' | 'designer' | 'reseller'; // ✅ Tambahkan ini
  bleedWidth: number;
  bleedHeight: number;
  addons: {
    is25d: boolean;
    designServicePrice: number;
    imageEnhance: boolean;
    shutterstockQty: number;
    installation: boolean;
    installationCity?: string;
    installationType?: 'normal' | 'panel' | 'void';
    wallHeight?: number;
  };
}

export const calculatePrice = (params: CalcParams): CalculationResult => {
  const { walls, materialType, material, customerMaterial, role, priceType, bleedWidth, bleedHeight, addons } = params;
  
  let volumePrint = 0;
  let volumeBahan = 0;
  let volumeWaste = 0;
  let numPanels = 0;
  let pricePerM2 = 0;
  let wastePricePerM2 = 0;

  // ========== KREARTE MATERIAL ==========
  if (materialType === 'krearte' && material) {
    if (priceType === 'retail') {
      pricePerM2 = material.price_retail; 
    } else if (priceType === 'designer') {
      pricePerM2 = material.price_designer;
    } else {
      pricePerM2 = material.price_reseller;
    }
    
    wastePricePerM2 = material.waste_price;

    walls.forEach(wall => {
      const printWidth = wall.width + (bleedWidth * 2);
      const printHeight = wall.height + (bleedHeight * 2);
      
      const panels = Math.ceil(wall.width / material.width_material);
      
      const areaPrint = printWidth * printHeight;
      const areaBahan = panels * material.width_material * printHeight;
      const waste = ((panels * material.width_material) - printWidth) * printHeight;
      
      volumePrint += areaPrint;
      volumeBahan += areaBahan;
      volumeWaste += Math.max(0, waste);
      numPanels += panels;
    });
  } 
  // ========== CUSTOMER MATERIAL ==========
  else if (materialType === 'customer' && customerMaterial) {
    pricePerM2 = customerMaterial.price_print;
    wastePricePerM2 = customerMaterial.waste_price;
    
    walls.forEach(wall => {
      const printWidth = wall.width + bleedWidth;
      const printHeight = wall.height + bleedHeight;
      
      const panels = Math.ceil(wall.width / customerMaterial.width);
      
      const areaPrint = printWidth * printHeight;
      const areaBahan = panels * customerMaterial.width * printHeight;
      const waste = ((panels * customerMaterial.width) - printWidth) * printHeight;
      
      volumePrint += areaPrint;
      volumeBahan += areaBahan;
      volumeWaste += Math.max(0, waste);
      numPanels += panels;
    });
  }

  // ========== KALKULASI BIAYA ==========
  const materialCost = volumeBahan * pricePerM2;
  const wasteCost = materialType === 'krearte' ? volumeWaste * wastePricePerM2 : 0;
  
  const cost25d = addons.is25d ? volumePrint * 500000 : 0;
  const costDesign = addons.designServicePrice || 0;
  const costEnhance = addons.imageEnhance ? 50000 : 0;
  const costShutterstock = (addons.shutterstockQty || 0) * 80000;
  
  let costInstallation = 0;
  if (addons.installation && walls.length > 0) {
    const avgHeight = walls.reduce((sum, w) => sum + parseFloat(String(w.height)), 0) / walls.length;
    costInstallation = calculateInstallationCost(
      volumePrint,
      addons.installationCity || 'SURABAYA',
      avgHeight,
      false,
      addons.is25d
    );
  }

  const totalCost = materialCost + wasteCost + cost25d + costDesign + costEnhance + costShutterstock + costInstallation;

  return {
    volumePrint,
    volumeBahan,
    volumeWaste,
    numPanels,
    materialCost,
    wasteCost,
    cost25d,
    costDesign,
    costEnhance,
    costShutterstock,
    costInstallation,
    totalCost,
    wastePrice: wastePricePerM2,
    wasteInfo: materialType === 'customer' ? `Waste ${volumeWaste.toFixed(2)}m² (Tidak ditagih)` : undefined
  };
};

export { calculateInstallationCost };
