import { CalculationResult, Material, CustomerMaterial, CalcParams } from '@/types';
import { calculateInstallationCost } from './installation';

const get25DPrice = (priceType: string): number => {
  switch (priceType) {
    case 'retail': return 625000;
    case 'designer': return 500000;
    case 'reseller': return 500000;
    case 'reseller_partner': return 350000;
    default: return 350000;
  }
};

export const calculatePrice = (params: CalcParams): CalculationResult => {
  const { 
    walls, 
    materialType, 
    material, 
    customerMaterial, 
    role, 
    priceType, 
    bleedWidth, 
    bleedHeight, 
    printServicePrice: printServiceRate,
    selectedWidth,
    addons 
  } = params;
  
  let volumePrint = 0;
  let volumeBahan = 0;
  let volumeWaste = 0;
  let numPanels = 0;
  let pricePerM2 = 0;
  let wastePricePerM2 = 0;
  let materialWidth = 0;

  // ========== RESELLER PARTNER (Print Service Only) ==========
  if (priceType === 'reseller_partner') {
    materialWidth = selectedWidth || 1.24;
    
    walls.forEach(wall => {
      const printWidth = wall.width + (bleedWidth * 2);
      const printHeight = wall.height + (bleedHeight * 2);
      
      const panels = Math.ceil(printWidth / materialWidth);
      
      const areaPrint = printWidth * printHeight;
      const areaBahan = panels * materialWidth * printHeight;
      const waste = areaBahan - areaPrint;
      
      volumePrint += areaPrint;
      volumeBahan += areaBahan;
      volumeWaste += Math.max(0, waste);
      numPanels += panels;
    });
    
    pricePerM2 = printServiceRate || 0;
    wastePricePerM2 = 0;
  }
  // ========== KREARTE MATERIAL (Retail, Designer, Reseller A) ==========
  else if (materialType === 'krearte' && material) {
    materialWidth = selectedWidth || material.width_material;
    
    // Harga material berdasarkan role
    if (priceType === 'retail') {
      pricePerM2 = material.price_retail || material.price_designer;
    } else if (priceType === 'designer') {
      pricePerM2 = material.price_designer;
    } else if (priceType === 'reseller') {
      pricePerM2 = material.price_reseller;
    } else {
      pricePerM2 = material.price_partner || material.price_reseller;
    }
    
    wastePricePerM2 = material.waste_price;
    
    walls.forEach(wall => {
      const printWidth = wall.width + (bleedWidth * 2);
      const printHeight = wall.height + (bleedHeight * 2);
      
      const panels = Math.ceil(printWidth / materialWidth);
      
      const areaPrint = printWidth * printHeight;
      const areaBahan = panels * materialWidth * printHeight;
      const waste = areaBahan - areaPrint;
      
      volumePrint += areaPrint;
      volumeBahan += areaBahan;
      volumeWaste += Math.max(0, waste);
      numPanels += panels;
    });
  } 
  // ========== CUSTOMER MATERIAL (Reseller B) ==========
  else if (materialType === 'customer' && customerMaterial) {
    materialWidth = selectedWidth || customerMaterial.width;
    
    pricePerM2 = customerMaterial.price_print;
    wastePricePerM2 = customerMaterial.waste_price;
    
    walls.forEach(wall => {
      const printWidth = wall.width + (bleedWidth * 2);
      const printHeight = wall.height + (bleedHeight * 2);
      
      const panels = Math.ceil(printWidth / materialWidth);
      
      const areaPrint = printWidth * printHeight;
      const areaBahan = panels * materialWidth * printHeight;
      const waste = areaBahan - areaPrint;
      
      volumePrint += areaPrint;
      volumeBahan += areaBahan;
      volumeWaste += Math.max(0, waste);
      numPanels += panels;
    });
  }

  // ========== KALKULASI BIAYA ==========
  
  // Print service cost (hanya untuk Reseller Partner & Reseller B)
  const costPrintService = (priceType === 'reseller_partner' || (materialType === 'customer' && priceType === 'reseller')) && printServiceRate
    ? volumePrint * printServiceRate
    : 0;

  // Material cost (hanya untuk Krearte material - Retail, Designer, Reseller A)
  const materialCost = materialType === 'krearte' ? volumePrint * pricePerM2 : 0;
  
  // Waste cost (hanya untuk Krearte material)
  const wasteCost = materialType === 'krearte' ? volumeWaste * wastePricePerM2 : 0;
  
  // ✅ 2.5D Print ADD-ON (harga berbeda per role - dari PDF Goodrich)
  const cost25d = addons.is25d ? volumePrint * get25DPrice(priceType) : 0;
  
  // Add-ons lainnya
  const costDesign = addons.designServicePrice || 0;
  const costEnhance = addons.imageEnhance ? 100000 : 0;
  const costSample = (addons.includeSample && addons.sampleQty && addons.samplePrice)
    ? addons.sampleQty * addons.samplePrice
    : 0;
  const costShutterstock = (addons.shutterstockQty || 0) * 80000;
  
  // Installation cost
  let costInstallation = 0;
  if (addons.installation && walls.length > 0) {
    const avgHeight = walls.reduce((sum, w) => sum + parseFloat(String(w.height)), 0) / walls.length;
    costInstallation = calculateInstallationCost(
      volumePrint,
      addons.installationCity || 'SURABAYA',
      addons.installationType || 'normal',
      avgHeight
    );
  }

  // Total cost
  const totalCost = materialCost + wasteCost + costPrintService + cost25d + costDesign + costEnhance + costShutterstock + costInstallation + costSample;

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
    costSample,
    costPrintService,
    totalCost,
    wastePrice: wastePricePerM2,
    wasteInfo: materialType === 'customer' && priceType !== 'reseller_partner' 
      ? `Waste ${volumeWaste.toFixed(2)}m² (Tidak ditagih)` 
      : priceType === 'reseller_partner'
        ? `Waste ${volumeWaste.toFixed(2)}m² (Dihitung, tidak ditagih)`
        : undefined
  };
};

export { calculateInstallationCost };