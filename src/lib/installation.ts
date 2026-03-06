export interface InstallationRate {
  normal: number;        // Bidang normal
  panel: number;         // Bidang panel
  embossed: number;      // Printing timbul
  void: number;          // Bidang void (tinggi > 3.7m)
  minChargeArea: number; // Minimum charge area
  minCharge: number;     // Minimum charge amount
  maxNormalHeight: number; // Max height untuk harga normal
}

export const installationRates: Record<string, InstallationRate> = {
  SURABAYA: {
    normal: 50000,
    panel: 55000,
    embossed: 55000,
    void: 0, // DOUBLE dari normal
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
    minChargeArea: 0, // Tidak ada info
    minCharge: 0,
    maxNormalHeight: 3.5
  }
};

export const calculateInstallationCost = (
  area: number,
  city: string,
  wallHeight: number,
  isPanel: boolean = false,
  isEmbossed: boolean = false
): number => {
  const rate = installationRates[city];
  if (!rate) return 0;

  let pricePerM2 = rate.normal;

  // Cek tinggi untuk void
  if (wallHeight > rate.maxNormalHeight) {
    pricePerM2 = rate.normal * 2; // DOUBLE
  } else if (isPanel) {
    pricePerM2 = rate.panel;
  } else if (isEmbossed) {
    pricePerM2 = rate.embossed;
  }

  let totalCost = area * pricePerM2;

  // Apply minimum charge
  if (rate.minChargeArea > 0 && area < rate.minChargeArea) {
    totalCost = Math.max(totalCost, rate.minCharge);
  }

  return totalCost;
};