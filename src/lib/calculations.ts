// src/lib/calculations.ts
import { CalculationResult, Material, CustomerMaterial, CalcParams } from '@/types';
import { calculateInstallationCost } from './installation';

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
      
      // ✅ FIX: Hitung panels berdasarkan PRINT WIDTH (bukan wall width)
      const panels = Math.ceil(printWidth / materialWidth);
      
      const areaPrint = printWidth * printHeight;
      const areaBahan = panels * materialWidth * printHeight;
      const waste = areaBahan - areaPrint;  // ✅ FIX: Langsung kurangi area
      
      volumePrint += areaPrint;
      volumeBahan += areaBahan;
      volumeWaste += Math.max(0, waste);
      numPanels += panels;
    });
    
    pricePerM2 = printServiceRate || 0;
    wastePricePerM2 = 0;
  }

  // ========== KREARTE MATERIAL (Reseller A) ==========
  else if (materialType === 'krearte' && material) {
    // Tentukan width material yang dipakai
    materialWidth = selectedWidth || material.width_material;
    
    // Harga berdasarkan priceType
    if (priceType === 'retail') {
      pricePerM2 = material.price_retail || material.price_designer;
    } else if (priceType === 'designer') {
      pricePerM2 = material.price_designer;
    } else if (priceType === 'reseller') {
      pricePerM2 = material.price_reseller;
    } else {
      // Fallback untuk reseller_partner atau lainnya
      pricePerM2 = material.price_partner || material.price_reseller;
    }
    
    wastePricePerM2 = material.waste_price;
    
    walls.forEach(wall => {
      const printWidth = wall.width + (bleedWidth * 2);
      const printHeight = wall.height + (bleedHeight * 2);
      
      // Hitung panels berdasarkan width yang dipilih
      const panels = Math.ceil(wall.width / materialWidth);
      
      const areaPrint = printWidth * printHeight;
      const areaBahan = panels * materialWidth * printHeight;
      const waste = ((panels * materialWidth) - printWidth) * printHeight;
      
      volumePrint += areaPrint;
      volumeBahan += areaBahan;
      volumeWaste += Math.max(0, waste);
      numPanels += panels;
    });
  } 
  // ========== CUSTOMER MATERIAL (Reseller B) ==========
  else if (materialType === 'customer' && customerMaterial) {
    // Tentukan width material yang dipakai
    materialWidth = selectedWidth || customerMaterial.width;
    
    pricePerM2 = customerMaterial.price_print;
    wastePricePerM2 = customerMaterial.waste_price;
    
    walls.forEach(wall => {
      const printWidth = wall.width + (bleedWidth * 2);
      const printHeight = wall.height + (bleedHeight * 2);
      
      // Hitung panels berdasarkan width yang dipilih
      const panels = Math.ceil(wall.width / materialWidth);
      
      const areaPrint = printWidth * printHeight;
      const areaBahan = panels * materialWidth * printHeight;
      const waste = ((panels * materialWidth) - printWidth) * printHeight;
      
      volumePrint += areaPrint;
      volumeBahan += areaBahan;
      volumeWaste += Math.max(0, waste);
      numPanels += panels;
    });
  }

  // ========== KALKULASI BIAYA ==========
  // Print service cost (khusus Reseller Partner)
  const costPrintService = priceType === 'reseller_partner' && printServiceRate
    ? volumePrint * printServiceRate
    : 0;

  // Material cost (hanya untuk Krearte/Customer material, BUKAN untuk Reseller Partner)
  const materialCost = priceType === 'reseller_partner' ? 0 : volumeBahan * pricePerM2;
  
  // Waste cost (hanya untuk Krearte material)
  const wasteCost = materialType === 'krearte' && priceType !== 'reseller_partner' 
    ? volumeWaste * wastePricePerM2 
    : 0;
  
  // Add-ons (prices from Goodrich PDF)
  const cost25d = addons.is25d ? volumePrint * 350000 : 0; // 2.5D Print: Rp 350.000/m²
  const costDesign = addons.designServicePrice || 0;
  const costEnhance = addons.imageEnhance ? 100000 : 0; // Enhanced Image: Rp 100.000
  const costSample = (addons.includeSample && addons.sampleQty && addons.samplePrice)
    ? addons.sampleQty * addons.samplePrice
    : 0;
  const costShutterstock = (addons.shutterstockQty || 0) * 80000; // Shutterstock: Rp 80.000/image
  
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
  const totalCost = materialCost + wasteCost + cost25d + costDesign + costEnhance + costShutterstock + costInstallation + costSample + costPrintService;

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
    costPrintService,  // ✅ For Reseller Partner print service
    totalCost,
    wastePrice: wastePricePerM2,
    wasteInfo: materialType === 'customer' && priceType !== 'reseller_partner' 
      ? `Waste ${volumeWaste.toFixed(2)}m² (Tidak ditagih)` 
      : undefined
  };
};

export { calculateInstallationCost };