export interface InstallationRate {
  normal: number;        // Bidang normal
  panel: number;         // Bidang panel
  embossed: number;      // Printing timbul / 2.5D effect
  void: number;          // Bidang void (tinggi > 3.7m)
  minChargeArea: number; // Minimum charge area (m²)
  minCharge: number;     // Minimum charge amount (Rp)
  maxNormalHeight: number; // Max height untuk harga normal (m)
}

export const installationRates: Record<string, InstallationRate> = {
  SURABAYA: {
    normal: 50000,
    panel: 55000,
    embossed: 55000,
    void: 0, // Will be calculated as normal * 2
    minChargeArea: 8,
    minCharge: 300000,
    maxNormalHeight: 3.7
  },
  LUAR_SURABAYA: {
    normal: 100000,
    panel: 110000,
    embossed: 110000,
    void: 0,
    minChargeArea: 8,
    minCharge: 600000,
    maxNormalHeight: 3.7
  },
  JAKARTA: {
    normal: 65000,
    panel: 70000,
    embossed: 70000,
    void: 0,
    minChargeArea: 10,
    minCharge: 550000,
    maxNormalHeight: 3.7
  },
  BANDUNG: {
    normal: 55000,
    panel: 70000,
    embossed: 70000,
    void: 0,
    minChargeArea: 0,
    minCharge: 0,
    maxNormalHeight: 3.5
  }
};

/**
 * Calculate installation cost based on area, city, wall height, and installation type
 * @param area - Print area in m²
 * @param city - Installation city (SURABAYA, JAKARTA, BANDUNG, LUAR_SURABAYA)
 * @param installationType - Type of installation: 'normal' | 'panel' | 'void'
 * @param wallHeight - Wall height in meters (for void detection)
 * @returns Total installation cost in Rupiah
 */
export const calculateInstallationCost = (
  area: number,
  city: string,
  installationType: 'normal' | 'panel' | 'void',  // ✅ Hanya 3 tipe
  wallHeight: number
): number => {
  const rate = installationRates[city.toUpperCase()];
  if (!rate) return 0;

  let pricePerM2 = rate.normal;

  // Determine price based on installation type
  if (installationType === 'void' || wallHeight > rate.maxNormalHeight) {
    // Void: double the normal rate for height > maxNormalHeight
    pricePerM2 = rate.normal * 2;
  } else if (installationType === 'panel') {
    pricePerM2 = rate.panel;
  }
  // ✅ HAPUS check untuk 'embossed' karena itu print service, bukan installation
  
  let totalCost = area * pricePerM2;

  // Apply minimum charge if area is below threshold
  if (rate.minChargeArea > 0 && area < rate.minChargeArea) {
    totalCost = Math.max(totalCost, rate.minCharge);
  }

  return totalCost;
};

export default calculateInstallationCost;