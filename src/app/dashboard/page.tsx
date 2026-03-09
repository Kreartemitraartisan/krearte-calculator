'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase, UserProfile } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Material, CustomerMaterial, CalculationResult } from '@/types';
import { calculatePrice, calculateInstallationCost } from '@/lib/calculations';

interface WallInput {
  id: number;
  width: string;
  height: string;
}

interface Addons {
  is25d: boolean;
  designServicePrice: number;
  imageEnhance: boolean;
  shutterstockQty: number;
  installation: boolean;
}

export default function Dashboard() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // State untuk price type - hanya bisa diubah oleh admin
  const [priceType, setPriceType] = useState<'retail' | 'designer' | 'reseller' | 'reseller_partner'>('designer');
  // State Kalkulator
  const [walls, setWalls] = useState<WallInput[]>([{ id: Date.now(), width: '', height: '' }]);
  const [materialType, setMaterialType] = useState<'krearte' | 'customer'>('krearte');
  const [selectedMaterialId, setSelectedMaterialId] = useState<number | null>(null);
  const [selectedCustomerMaterialId, setSelectedCustomerMaterialId] = useState<number | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [customerMaterials, setCustomerMaterials] = useState<CustomerMaterial[]>([]);
  const [printServices, setPrintServices] = useState<PrintServicePrice[]>([]);
  const [selectedPrintServiceId, setSelectedPrintServiceId] = useState<number | null>(null);
  const [selectedPrintWidth, setSelectedPrintWidth] = useState<number | null>(null);
  const [selectedWidth, setSelectedWidth] = useState<number | null>(null);
  
  // State untuk bleed/lebihan area (dalam cm)
  const [bleedWidth, setBleedWidth] = useState<number>(3);
  const [bleedHeight, setBleedHeight] = useState<number>(3);
  
  // Addons
  const [is25d, setIs25d] = useState(false);
  const [designService, setDesignService] = useState<number>(0);
  const [designServiceCustom, setDesignServiceCustom] = useState<string>(''); // ✅ Tambahkan ini
  const [isDesignCustom, setIsDesignCustom] = useState<boolean>(false); // ✅ Tambahkan ini
  const [imageEnhance, setImageEnhance] = useState(false);
  const [shutterstockQty, setShutterstockQty] = useState(0);
  const [installation, setInstallation] = useState(false);
  const [installationCity, setInstallationCity] = useState<string>('SURABAYA');
  const [installationType, setInstallationType] = useState<'normal' | 'panel' | 'void'>('normal');
  const [includeSample, setIncludeSample] = useState<boolean>(false);
  const [sampleQty, setSampleQty] = useState<number>(0);
  const selectedMaterial = useMemo(() => {
    return materials.find(m => m.id === selectedMaterialId);
  }, [materials, selectedMaterialId]);
  const fetchPrintServices = async () => {
    const { data: services } = await supabase
      .from('print_service_prices')
      .select('*')
      .eq('category', 'print')
      .eq('is_active', true);
    if (services) setPrintServices(services);
  };

  // Result
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [projectName, setProjectName] = useState('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
        
      if (profile) {
        setUser(profile);
        
        if (profile.role === 'designer') {
          setPriceType('designer');
        } else if (profile.role === 'reseller') {
          setPriceType('reseller');
        } else if (profile.role === 'reseller_partner') {
          setPriceType('reseller_partner');
        } else {
          setPriceType('designer');
        }
        
        await Promise.all([fetchMaterials(), fetchPrintServices()]);
      }
      setLoading(false);
    };
    checkUser();
  }, [router]);

  const fetchMaterials = async () => {
    const { data: mats } = await supabase
      .from('materials')
      .select('*')
      .eq('is_active', true);
    if (mats) setMaterials(mats);
    
    const { data: custMats } = await supabase
      .from('customer_materials')
      .select('*');
    if (custMats) setCustomerMaterials(custMats);
  };

  const handleCalculate = () => {
    if (!user) return;
    setError('');

    // 1. Filter & parse valid walls (input dalam CM, convert ke meter)
    const validWalls = walls
      .filter(w => parseFloat(w.width) > 0 && parseFloat(w.height) > 0)
      .map(w => ({
        width: parseFloat(w.width) / 100, // cm → meter
        height: parseFloat(w.height) / 100 // cm → meter
      }));

    if (validWalls.length === 0) {
      setError('Masukkan minimal 1 dimensi dinding yang valid');
      return;
    }

    // 2. Get selected material (Krearte)
    const material = materials.find(m => m.id === selectedMaterialId);
    
    // 3. Get customer material (Reseller B)
    const customerMaterial = materialType === 'customer' && selectedCustomerMaterialId
      ? customerMaterials.find(m => m.id === selectedCustomerMaterialId)
      : undefined;

    // 4. Get print service price (khusus Reseller Partner)
    const selectedPrintService = printServices.find(s => s.id === selectedPrintServiceId);
    const printServiceRate = selectedPrintService?.price_per_m2 || 0;

    // 5. Convert bleed from cm to meters (per side, total = ×2 di calculations)
    const bleedWidthM = bleedWidth / 100;
    const bleedHeightM = bleedHeight / 100;

    // 🔍 DEBUG: Log values untuk troubleshooting
    console.log('=== CALCULATION DEBUG ===');
    console.log('Price Type:', priceType);
    console.log('Material Type:', materialType);
    console.log('Bleed (m):', bleedWidthM, '×', bleedHeightM);
    console.log('Valid Walls (m):', validWalls);
    console.log('Print Service Rate:', printServiceRate);
    console.log('Selected Print Width:', priceType === 'reseller_partner' ? selectedPrintWidth : selectedWidth);
    console.log('=========================');

    // 6. Determine role for calculation (admin can override via priceType)
    const calculationRole = user.role === 'admin' ? priceType : user.role;

    try {
      // 7. Call calculatePrice dengan ALL params
      const res = calculatePrice({
        walls: validWalls,
        materialType,
        material,
        customerMaterial,
        role: calculationRole as 'designer' | 'reseller' | 'reseller_partner',
        priceType,
        bleedWidth: bleedWidthM,
        bleedHeight: bleedHeightM,
        selectedWidth: priceType === 'reseller_partner' ? selectedPrintWidth : selectedWidth, // ✅ Width untuk kalkulasi panels
        printServicePrice: priceType === 'reseller_partner' ? printServiceRate : undefined,
        addons: {
          is25d,
          designServicePrice: isDesignCustom
            ? parseInt(designServiceCustom || '0')
            : designService,
          imageEnhance,
          shutterstockQty,
          installation,
          installationCity,
          installationType,
          includeSample,
          sampleQty,
          samplePrice: material?.sample_price || 0,
          wallHeight: validWalls.length > 0
            ? validWalls.reduce((sum, w) => sum + w.height, 0) / validWalls.length
            : 0
        }
      });

      // 8. Set result to state
      setResult(res);

      // 🔍 Debug result
      console.log('=== CALCULATION RESULT ===');
      console.log('Print Area:', res.volumePrint.toFixed(2), 'm²');
      console.log('Material Needed:', res.volumeBahan.toFixed(2), 'm²');
      console.log('Waste:', res.volumeWaste.toFixed(2), 'm²');
      console.log('Panels:', res.numPanels);
      console.log('Print Service Cost:', res.costPrintService);
      console.log('Total Cost:', res.totalCost);
      console.log('=========================');

      // 9. Save to History (Supabase)
      saveToHistory(res, {
        projectName,
        walls: walls.map(w => ({
          width: parseFloat(w.width), // simpan dalam cm untuk history
          height: parseFloat(w.height)
        })).filter(w => w.width > 0 && w.height > 0),
        materialType,
        materialId: materialType === 'krearte' ? selectedMaterialId : null,
        customerMaterialId: materialType === 'customer' ? selectedCustomerMaterialId : null,
        priceType,
        printServiceId: priceType === 'reseller_partner' ? selectedPrintServiceId : null,
        selectedWidth: priceType === 'reseller_partner' ? selectedPrintWidth : selectedWidth,
        bleedWidth,
        bleedHeight,
        addons: {
          is25d,
          designService,
          imageEnhance,
          shutterstockQty,
          installation,
          installationCity,
          installationType,
          includeSample,
          sampleQty
        }
      });

    } catch (err) {
      setError('Terjadi kesalahan saat menghitung. Silakan periksa input Anda.');
      console.error('Calculation error:', err);
    }
  };

  // Fungsi untuk save calculation ke database Supabase
  const saveToHistory = async (
    result: CalculationResult,
    metadata: {
      projectName: string;
      walls: Array<{ width: number; height: number }>;
      materialType: 'krearte' | 'customer';
      materialId: number | null;
      customerMaterialId: number | null;
      priceType: 'retail' | 'designer' | 'reseller';
      bleedWidth: number; // dalam cm
      bleedHeight: number; // dalam cm
      addons: {
        is25d: boolean;
        designService: number;
        imageEnhance: boolean;
        shutterstockQty: number;
        installation: boolean;
        installationCity: string;
        installationType: 'normal' | 'panel' | 'void';
        includeSample?: boolean;
        sampleQty?: number;
      };
    }
  ) => {
    if (!user) return;

    // Convert cm to meters untuk database
    const bleedWidthM = metadata.bleedWidth / 100;
    const bleedHeightM = metadata.bleedHeight / 100;

    const roomData = {
      walls: metadata.walls, // dalam cm (akan disimpan sebagai cm)
      bleedWidth: bleedWidthM, // dalam meter
      bleedHeight: bleedHeightM // dalam meter
    };

    // Hitung design service cost (custom atau fixed)
    const designServiceCost = isDesignCustom
      ? parseInt(designServiceCustom || '0')
      : metadata.addons.designService;

    const { error } = await supabase
      .from('calculations')
      .insert({
        user_id: user.id,
        project_name: metadata.projectName || null,
        room_data: roomData,
        material_type: metadata.materialType,
        material_id: metadata.materialId,
        customer_material_id: metadata.customerMaterialId,
        price_type: metadata.priceType,
        volume_print: result.volumePrint,
        volume_bahan: result.volumeBahan,
        volume_waste: result.volumeWaste,
        num_panels: result.numPanels,
        material_cost: result.materialCost,
        waste_cost: result.wasteCost,
        cost_25d: result.cost25d,
        cost_design_service: designServiceCost,
        cost_image_enhance: metadata.addons.imageEnhance ? 50000 : 0,
        cost_shutterstock: metadata.addons.shutterstockQty * 80000,
        cost_sample: result.costSample,
        cost_installation: result.costInstallation,
        total_cost: result.totalCost
      });

    if (error) {
      console.error('Failed to save to history:', error);
      // Jangan tampilkan error ke user, karena kalkulasi tetap berhasil
    }
  };

  // Helper function untuk get installation rate
  const getInstallationRate = () => {
    const rates: Record<string, Record<string, number>> = {
        SURABAYA: { normal: 50000, panel: 55000, void: 0 },
        LUAR_SURABAYA: { normal: 100000, panel: 110000, void: 180000 },
        JAKARTA: { normal: 65000, panel: 70000, void: 130000 },
        BANDUNG: { normal: 55000, panel: 70000, void: 70000 }
    };

    const cityRates = rates[installationCity] || rates.SURABAYA;
    let rate = cityRates[installationType];
    
    // Void = double normal rate untuk Surabaya
    if (installationType === 'void' && installationCity === 'SURABAYA') {
        rate = cityRates.normal * 2;
    }
    
    return rate;
  };

 // Helper function untuk calculate installation cost
  const calculateInstallationCost = (area: number) => {
    const rate = getInstallationRate();
    let cost = area * rate;
    
    // Apply minimum charge
    if (installationCity === 'SURABAYA') {
        const minCharge = installationType === 'normal' ? 300000 : 350000;
        const minArea = 8;
        if (area < minArea) {
        cost = Math.max(cost, minCharge);
        }
    } else if (installationCity === 'JAKARTA') {
        const minCharge = 550000;
        const minArea = 10;
        if (area < minArea) {
        cost = Math.max(cost, minCharge);
        }
    }
    
    return cost;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const addWall = () => {
    setWalls([...walls, { id: Date.now(), width: '', height: '' }]);
  };

  const removeWall = (id: number) => {
    if (walls.length > 1) {
      setWalls(walls.filter(w => w.id !== id));
    }
  };

  const updateWall = (id: number, field: 'width' | 'height', value: string) => {
    setWalls(walls.map(w => w.id === id ? { ...w, [field]: value } : w));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }
  
  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-64 bg-slate-900 border-r border-slate-800 z-10">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Krearte
          </h1>
          <p className="text-sm text-slate-500 mt-1">Calculator Pro</p>
        </div>
        
        <nav className="p-4 space-y-2">
          <a href="/dashboard" className="flex items-center gap-3 px-4 py-3 bg-indigo-600/10 text-indigo-400 rounded-xl font-medium transition border border-indigo-600/20">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 3.666V14m-6.118 4.134l.789.789a2 2 0 002.828 0l4.243-4.243a2 2 0 000-2.828l-.789-.789M6.343 17.657l4.243-4.243" />
            </svg>
            Calculator
          </a>
          
          <a href="/history" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-slate-200 rounded-xl font-medium transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            History
          </a>
          
          {user.role === 'admin' && (
            <a href="/admin" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-slate-200 rounded-xl font-medium transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Admin Panel
            </a>
          )}
        </nav>
        
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <span className="text-white font-bold">{user.username[0].toUpperCase()}</span>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-200">{user.username}</p>
              <p className="text-xs text-slate-500 capitalize">{user.role}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full mt-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-64 p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Wallpaper Calculator</h1>
              <p className="text-slate-400 mt-1">Calculate material and pricing for your project</p>
            </div>
            {user.role === 'admin' && (
              <span className="px-3 py-1 bg-purple-500/20 text-purple-400 text-sm rounded-full border border-purple-500/20">
                Admin Mode
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="space-y-6">
            {/* Project Info */}
            <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Project Information</h2>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Project Name</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g., Master Bedroom Renovation"
                  className="w-full px-4 py-2.5 border border-slate-700 rounded-xl bg-slate-800/50 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
              </div>
            </div>

            {/* Price Type Selection - ONLY FOR ADMIN */}
            {user.role === 'admin' && (
              <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white">Price Type</h2>
                  <span className="px-3 py-1 bg-indigo-500/20 text-indigo-400 text-xs rounded-full">
                    Admin Only
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setPriceType('retail')}
                    className={`px-4 py-3 rounded-xl font-medium transition ${
                      priceType === 'retail'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    Retail
                  </button>
                  <button
                    onClick={() => setPriceType('designer')}
                    className={`px-4 py-3 rounded-xl font-medium transition ${
                      priceType === 'designer'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    Designer
                  </button>
                  <button
                    onClick={() => setPriceType('reseller')}
                    className={`px-4 py-3 rounded-xl font-medium transition ${
                      priceType === 'reseller'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    Reseller
                  </button>
                </div>
              </div>
            )}

            {/* Price Type Display - For Non-Admin Users */}
            {user.role !== 'admin' && (
              <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Your Price Type</h2>
                    <p className="text-sm text-slate-400 mt-1">
                      Pricing is based on your account role
                    </p>
                  </div>
                  <div className={`px-4 py-2 rounded-xl font-semibold ${
                    user.role === 'designer' 
                      ? 'bg-purple-500/20 text-purple-400' 
                      : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {user.role === 'designer' ? 'Designer' : 'Reseller'} Pricing
                  </div>
                </div>
              </div>
            )}

            {/* Walls Input */}
            <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-white">Wall Dimensions</h2>
                <button
                  onClick={addWall}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Wall
                </button>
              </div>

              <div className="space-y-3">
                {walls.map((wall) => (
                  <div key={wall.id} className="flex gap-3 items-start p-3 bg-slate-800/50 rounded-xl border border-slate-700">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        Width (cm)
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={wall.width}
                        onChange={(e) => updateWall(wall.id, 'width', e.target.value)}
                        placeholder="e.g., 273"
                        className="w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-800 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        Height (cm)
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={wall.height}
                        onChange={(e) => updateWall(wall.id, 'height', e.target.value)}
                        placeholder="e.g., 300"
                        className="w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-800 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                      />
                    </div>
                    {walls.length > 1 && (
                      <button
                        onClick={() => removeWall(wall.id)}
                        className="mt-5 p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Bleed/Overlap Settings */}
            <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Bleed/Overlap Settings</h2>
              <p className="text-sm text-slate-400 mb-4">
                Tambahkan area lebihan untuk trimming dan pemasangan
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Bleed Width (cm)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="10"
                    value={bleedWidth}
                    onChange={(e) => setBleedWidth(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2.5 border border-slate-700 rounded-xl bg-slate-800/50 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <p className="text-xs text-slate-500 mt-1">Per sisi (kiri + kanan)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Bleed Height (cm)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="10"
                    value={bleedHeight}
                    onChange={(e) => setBleedHeight(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2.5 border border-slate-700 rounded-xl bg-slate-800/50 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <p className="text-xs text-slate-500 mt-1">Per sisi (atas + bawah)</p>
                </div>
              </div>

              <div className="mt-4 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                <p className="text-sm text-indigo-300">
                  <span className="font-semibold">Total tambahan:</span> {bleedWidth * 2}cm (lebar) × {bleedHeight * 2}cm (tinggi)
                </p>
              </div>
            </div>

            {/* Material Selection
            <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Material Source</h2>
                <span className="text-xs text-slate-400">
                  Using: <span className="text-indigo-400 font-semibold capitalize">{priceType}</span> pricing
                </span>
              </div>
              
              <div className="flex gap-4 mb-4">
                <button
                  onClick={() => setMaterialType('krearte')}
                  className={`flex-1 px-4 py-3 rounded-xl font-medium transition ${
                    materialType === 'krearte' 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span>Krearte Material</span>
                    <span className="text-xs opacity-75">(Reseller A)</span>
                  </div>
                </button>
                {(user.role === 'reseller' || user.role === 'admin') && (
                  <button
                    onClick={() => setMaterialType('customer')}
                    className={`flex-1 px-4 py-3 rounded-xl font-medium transition ${
                      materialType === 'customer' 
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span>Customer Material</span>
                      <span className="text-xs opacity-75">(Reseller B)</span>
                    </div>
                  </button>
                )}
              </div>

              {materialType === 'krearte' ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Select Material
                    </label>
                    <select 
                      onChange={(e) => setSelectedMaterialId(Number(e.target.value))} 
                      value={selectedMaterialId || ''}
                      className="w-full px-4 py-3 border border-slate-700 rounded-xl bg-slate-800 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="">Choose material...</option>
                      {materials.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name} - {m.type}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Select Print Service
                    </label>
                    <select 
                      onChange={(e) => setSelectedCustomerMaterialId(Number(e.target.value))} 
                      value={selectedCustomerMaterialId || ''}
                      className="w-full px-4 py-3 border border-slate-700 rounded-xl bg-slate-800 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="">Choose service...</option>
                      {customerMaterials.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.category === 'standard' ? 'Standard' : 'Karpet/Blind'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div> */}

            {/* Material Selection */}
            <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Material Source</h2>
                <span className="text-xs text-slate-400">
                  Using: <span className="text-indigo-400 font-semibold capitalize">{priceType}</span> pricing
                </span>
              </div>
              
              <div className="flex gap-4 mb-4">
                <button
                  onClick={() => setMaterialType('krearte')}
                  className={`flex-1 px-4 py-3 rounded-xl font-medium transition ${
                    materialType === 'krearte' 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span>Krearte Material</span>
                    <span className="text-xs opacity-75">(Reseller A)</span>
                  </div>
                </button>
                {(user.role === 'reseller' || user.role === 'admin' || user.role === 'reseller_partner') && (
                  <button
                    onClick={() => setMaterialType('customer')}
                    className={`flex-1 px-4 py-3 rounded-xl font-medium transition ${
                      materialType === 'customer' 
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span>Customer Material</span>
                      <span className="text-xs opacity-75">(Reseller B)</span>
                    </div>
                  </button>
                )}
              </div>

              {materialType === 'krearte' ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Select Material
                    </label>
                    <select 
                      onChange={(e) => setSelectedMaterialId(Number(e.target.value))} 
                      value={selectedMaterialId || ''}
                      className="w-full px-4 py-3 border border-slate-700 rounded-xl bg-slate-800 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="">Choose material...</option>
                      {materials.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name} - {m.type}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : materialType === 'customer' && priceType === 'reseller_partner' ? (
                // ✅ Khusus Reseller Partner - Pilih Print Service
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Select Print Service Type
                    </label>
                    <select 
                      onChange={(e) => setSelectedPrintServiceId(Number(e.target.value))} 
                      value={selectedPrintServiceId || ''}
                      className="w-full px-4 py-3 border border-slate-700 rounded-xl bg-slate-800 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="">Choose print service...</option>
                      {printServices.map(service => (
                        <option key={service.id} value={service.id}>
                          {service.service_name} - Rp {service.price_per_m2.toLocaleString('id-ID')}/m²
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {selectedPrintServiceId && (
                    <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                      <p className="text-sm text-indigo-300">
                        <span className="font-semibold">Print Service:</span>{' '}
                        {printServices.find(s => s.id === selectedPrintServiceId)?.service_name}
                      </p>
                      <p className="text-sm text-indigo-300 mt-1">
                        <span className="font-semibold">Price:</span> Rp {' '}
                        {printServices.find(s => s.id === selectedPrintServiceId)?.price_per_m2.toLocaleString('id-ID')}/m²
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                // Customer Material biasa (bukan Partner)
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Select Print Service
                    </label>
                    <select 
                      onChange={(e) => setSelectedCustomerMaterialId(Number(e.target.value))} 
                      value={selectedCustomerMaterialId || ''}
                      className="w-full px-4 py-3 border border-slate-700 rounded-xl bg-slate-800 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="">Choose service...</option>
                      {customerMaterials.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.category === 'standard' ? 'Standard' : 'Karpet/Blind'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
            {/* Width Selection - Khusus Reseller Partner */}
            {priceType === 'reseller_partner' && selectedPrintServiceId && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Select Material Width
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {printServices
                    .find(s => s.id === selectedPrintServiceId)
                    ?.width_options?.map((option, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedPrintWidth(option.width)}
                        className={`px-4 py-3 rounded-xl font-medium transition ${
                          selectedPrintWidth === option.width
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                </div>
                {selectedPrintWidth && (
                  <p className="text-xs text-indigo-400 mt-2">
                    Selected width: {(selectedPrintWidth * 100).toFixed(0)}cm ({selectedPrintWidth.toFixed(2)}m)
                  </p>
                )}
              </div>
            )}

            {/* Add-ons */}
            <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Add-on Services</h2>
              
              <div className="space-y-3">
                <label className="flex items-center justify-between p-4 border border-slate-700 rounded-xl hover:bg-slate-800/50 cursor-pointer transition">
                  <div>
                    <p className="font-medium text-slate-200">2.5D Print</p>
                    <p className="text-sm text-slate-500">Embossed effect (+Rp 500,000/m²)</p>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={is25d} 
                    onChange={(e) => setIs25d(e.target.checked)}
                    className="w-5 h-5 text-indigo-600 rounded border-slate-700 bg-slate-800 focus:ring-indigo-500"
                  />
                </label>

                <label className="flex items-center justify-between p-4 border border-slate-700 rounded-xl hover:bg-slate-800/50 cursor-pointer transition">
                  <div>
                    <p className="font-medium text-slate-200">Image Enhancement</p>
                    <p className="text-sm text-slate-500">Improve image quality (+Rp 50,000)</p>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={imageEnhance} 
                    onChange={(e) => setImageEnhance(e.target.checked)}
                    className="w-5 h-5 text-indigo-600 rounded border-slate-700 bg-slate-800 focus:ring-indigo-500"
                  />
                </label>

                <div className="flex items-center justify-between p-4 border border-slate-700 rounded-xl">
                  <div>
                    <p className="font-medium text-slate-200">Shutterstock</p>
                    <p className="text-sm text-slate-500">Stock images (Rp 80,000/image)</p>
                  </div>
                  <input 
                    type="number" 
                    min="0"
                    value={shutterstockQty}
                    onChange={(e) => setShutterstockQty(Number(e.target.value))}
                    className="w-20 px-3 py-2 border border-slate-700 rounded-lg bg-slate-800 text-white text-center"
                  />
                </div>

                {/* Sample Add-on */}
                <label className="flex items-center justify-between p-4 border border-slate-700 rounded-xl hover:bg-slate-800/50 cursor-pointer transition">
                  <div>
                    <p className="font-medium text-slate-200">Sample Material</p>
                    <p className="text-sm text-slate-500">Physical sample for preview</p>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={includeSample} 
                    onChange={(e) => {
                      setIncludeSample(e.target.checked);
                      if (!e.target.checked) setSampleQty(0);
                    }}
                    className="w-5 h-5 text-indigo-600 rounded border-slate-700 bg-slate-800 focus:ring-indigo-500"
                  />
                </label>

                {includeSample && selectedMaterial && (
                  <div className="p-4 border border-slate-700 rounded-xl bg-slate-800/30 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Number of Samples
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={sampleQty}
                        onChange={(e) => setSampleQty(Math.max(1, Math.min(10, Number(e.target.value))))}
                        className="w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-800 text-white focus:ring-2 focus:ring-indigo-500"
                      />
                      <p className="text-xs text-slate-500 mt-1">Max 10 samples</p>
                    </div>

                    <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                      <p className="text-sm text-indigo-300">
                        <span className="font-semibold">Price per sample:</span> Rp {selectedMaterial.sample_price?.toLocaleString('id-ID') || 0}
                      </p>
                      <p className="text-sm text-indigo-300 mt-1">
                        <span className="font-semibold">Total:</span> Rp {(sampleQty * (selectedMaterial.sample_price || 0)).toLocaleString('id-ID')}
                      </p>
                    </div>
                  </div>
                )}

                <div className="p-4 border border-slate-700 rounded-xl">
                  <p className="font-medium text-slate-200 mb-2">Design Service</p>
                  <select 
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === 'custom') {
                        setIsDesignCustom(true);
                        setDesignService(0);
                      } else {
                        setIsDesignCustom(false);
                        setDesignService(Number(value));
                      }
                    }}
                    value={isDesignCustom ? 'custom' : designService.toString()}
                    className="w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-800 text-white focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value={0}>No design service</option>
                    <option value={150000}>1 Day - Rp 150,000</option>
                    <option value={900000}>1 Week - Rp 900,000</option>
                    <option value={1800000}>2 Weeks - Rp 1,800,000</option>
                    <option value="custom">Custom Amount</option>
                  </select>

                  {isDesignCustom && (
                    <div className="mt-3">
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        Enter Custom Amount (Rp)
                      </label>
                      <input
                        type="number"
                        value={designServiceCustom}
                        onChange={(e) => setDesignServiceCustom(e.target.value)}
                        placeholder="e.g., 500000"
                        className="w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-800 text-white focus:ring-2 focus:ring-indigo-500"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Current: <span className="text-indigo-400 font-semibold">Rp {parseInt(designServiceCustom || '0').toLocaleString('id-ID')}</span>
                      </p>
                    </div>
                  )}
                </div>

                {/* Installation */}
                <div className="space-y-3">
                <label className="flex items-center justify-between p-4 border border-slate-700 rounded-xl hover:bg-slate-800/50 cursor-pointer transition">
                    <div>
                    <p className="font-medium text-slate-200">Installation Service</p>
                    <p className="text-sm text-slate-500">Professional installation service</p>
                    </div>
                    <input 
                    type="checkbox" 
                    checked={installation} 
                    onChange={(e) => setInstallation(e.target.checked)}
                    className="w-5 h-5 text-indigo-600 rounded border-slate-700 bg-slate-800 focus:ring-indigo-500"
                    />
                </label>

                {installation && (
                    <div className="p-4 border border-slate-700 rounded-xl bg-slate-800/30 space-y-4">
                    {/* City Selection */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                        Installation Location
                        </label>
                        <select
                        value={installationCity}
                        onChange={(e) => setInstallationCity(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-800 text-white focus:ring-2 focus:ring-indigo-500"
                        >
                        <option value="SURABAYA">Surabaya</option>
                        <option value="LUAR_SURABAYA">Luar Surabaya</option>
                        <option value="JAKARTA">Jakarta</option>
                        <option value="BANDUNG">Bandung</option>
                        </select>
                    </div>

                    {/* Installation Type */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                        Installation Type
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                        <button
                            type="button"
                            onClick={() => setInstallationType('normal')}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                            installationType === 'normal'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                        >
                            Normal
                        </button>
                        <button
                            type="button"
                            onClick={() => setInstallationType('panel')}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                            installationType === 'panel'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                        >
                            Panel
                        </button>
                        <button
                            type="button"
                            onClick={() => setInstallationType('void')}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                            installationType === 'void'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                        >
                            Void (&gt;3.7m)
                        </button>
                        </div>
                    </div>

                    {/* Price Info */}
                    <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                        <p className="text-sm text-indigo-300">
                        <span className="font-semibold">Rate:</span> Rp {getInstallationRate().toLocaleString('id-ID')}/m²
                        </p>
                        {installationCity === 'SURABAYA' && installationType === 'normal' && (
                        <p className="text-xs text-slate-400 mt-1">Min. charge 8m² = Rp 300.000</p>
                        )}
                        {installationCity === 'JAKARTA' && installationType === 'normal' && (
                        <p className="text-xs text-slate-400 mt-1">Min. charge 10m² = Rp 550.000</p>
                        )}
                    </div>
                    </div>
                )}
                </div>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}

            <button 
              onClick={handleCalculate}
              className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition shadow-lg shadow-indigo-600/20"
            >
              Calculate Price
            </button>
          </div>

          {/* Results Section */}
          <div className="space-y-6">
            <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-6 min-h-[600px]">
              <h2 className="text-xl font-semibold text-white mb-6">Calculation Results</h2>
              
              {result ? (
                <div className="space-y-6">
                  {/* Project Info */}
                  {projectName && (
                    <div className="pb-4 border-b border-slate-800">
                      <p className="text-sm text-slate-400">Project Name</p>
                      <p className="text-lg font-semibold text-white">{projectName}</p>
                    </div>
                  )}

                  {/* Wall Dimensions Detail */}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">Wall Dimensions</h3>
                    <div className="space-y-2">
                      {walls.filter(w => parseFloat(w.width) > 0 && parseFloat(w.height) > 0).map((wall, idx) => {
                        const widthCm = parseFloat(wall.width);
                        const heightCm = parseFloat(wall.height);
                        const widthWithBleed = widthCm + (bleedWidth * 2);
                        const heightWithBleed = heightCm + (bleedHeight * 2);
                        const areaPrint = (widthWithBleed / 100) * (heightWithBleed / 100);
                        
                        return (
                          <div key={wall.id} className="space-y-1 py-2 px-3 bg-slate-800/30 rounded-lg">
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-400">Wall {idx + 1}</span>
                              <span className="text-slate-200 font-medium">
                                {widthCm} cm × {heightCm} cm
                              </span>
                            </div>
                            <div className="flex justify-between text-sm pl-4 border-l-2 border-indigo-500/30">
                              <span className="text-indigo-400 text-xs">With bleed (+{bleedWidth * 2}cm × +{bleedHeight * 2}cm)</span>
                              <span className="text-indigo-400 font-medium text-xs">
                                {widthWithBleed} cm × {heightWithBleed} cm = {areaPrint.toFixed(2)} m²
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Bleed Settings Info */}
                  <div className="pb-4 border-b border-slate-800">
                    <h3 className="text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wider">Bleed Applied (Per Wall)</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex justify-between py-2 px-3 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                        <span className="text-slate-400">Bleed Width</span>
                        <span className="text-indigo-400 font-medium">{bleedWidth} cm × 2 sisi = {bleedWidth * 2} cm</span>
                      </div>
                      <div className="flex justify-between py-2 px-3 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                        <span className="text-slate-400">Bleed Height</span>
                        <span className="text-indigo-400 font-medium">{bleedHeight} cm × 2 sisi = {bleedHeight * 2} cm</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      * Setiap wall mendapat tambahan bleed {bleedWidth * 2}cm (lebar) × {bleedHeight * 2}cm (tinggi)
                    </p>
                  </div>
                  {/* Area Calculations */}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">Area Calculations</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between py-2 px-3 bg-slate-800/30 rounded-lg">
                        <span className="text-slate-400">Print Area</span>
                        <span className="text-white font-medium">{result.volumePrint.toFixed(2)} m²</span>
                      </div>
                      <div className="flex justify-between py-2 px-3 bg-slate-800/30 rounded-lg">
                        <span className="text-slate-400">Material Needed</span>
                        <span className="text-white font-medium">{result.volumeBahan.toFixed(2)} m²</span>
                      </div>
                      <div className="flex justify-between py-2 px-3 bg-slate-800/30 rounded-lg">
                        <span className="text-slate-400">Number of Panels</span>
                        <span className="text-white font-medium">{result.numPanels} panels</span>
                      </div>
                      <div className="flex justify-between py-2 px-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                        <span className="text-orange-400">Waste</span>
                        <span className="text-orange-400 font-medium">{result.volumeWaste.toFixed(2)} m²</span>
                      </div>
                    </div>
                  </div>

                  {/* Cost Breakdown */}
                  <div className="pb-4 border-b border-slate-800">
                    <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">Cost Breakdown</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between py-2">
                        <span className="text-slate-400">Material Cost</span>
                        <div className="text-right">
                          <p className="text-slate-200">Rp {result.materialCost.toLocaleString('id-ID')}</p>
                          <p className="text-xs text-slate-500">{result.volumeBahan.toFixed(2)} m² × Rp {(result.materialCost / result.volumeBahan).toLocaleString('id-ID')}/m²</p>
                        </div>
                      </div>
                      
                      {result.wasteCost > 0 && (
                        <div className="flex justify-between py-2 pl-4 border-l-2 border-orange-500/30">
                          <span className="text-orange-400">Waste Cost</span>
                          <div className="text-right">
                            <p className="text-orange-400">Rp {result.wasteCost.toLocaleString('id-ID')}</p>
                            <p className="text-xs text-orange-400/70">
                              {result.volumeWaste.toFixed(2)} m² × Rp {result.wastePrice?.toLocaleString('id-ID')}/m²
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {result.cost25d > 0 && (
                        <div className="flex justify-between py-2">
                          <span className="text-slate-400">2.5D Print</span>
                          <div className="text-right">
                            <p className="text-slate-200">Rp {result.cost25d.toLocaleString('id-ID')}</p>
                            <p className="text-xs text-slate-500">{result.volumePrint.toFixed(2)} m² × Rp 500.000/m²</p>
                          </div>
                        </div>
                      )}
                      
                      {result.costDesign > 0 && (
                        <div className="flex justify-between py-2">
                          <span className="text-slate-400">Design Service</span>
                          <span className="text-slate-200">Rp {result.costDesign.toLocaleString('id-ID')}</span>
                        </div>
                      )}
                      
                      {result.costEnhance > 0 && (
                        <div className="flex justify-between py-2">
                          <span className="text-slate-400">Image Enhancement</span>
                          <span className="text-slate-200">Rp {result.costEnhance.toLocaleString('id-ID')}</span>
                        </div>
                      )}
                      
                      {result.costShutterstock > 0 && (
                        <div className="flex justify-between py-2">
                          <span className="text-slate-400">Shutterstock</span>
                          <div className="text-right">
                            <p className="text-slate-200">Rp {result.costShutterstock.toLocaleString('id-ID')}</p>
                            <p className="text-xs text-slate-500">{shutterstockQty} images × Rp 80.000</p>
                          </div>
                        </div>
                      )}

                      {result.costSample > 0 && (
                        <div className="flex justify-between py-2">
                          <span className="text-slate-400">Sample Material</span>
                          <div className="text-right">
                            <p className="text-slate-200">Rp {result.costSample.toLocaleString('id-ID')}</p>
                            <p className="text-xs text-slate-500">
                              {sampleQty} sample(s) × Rp {selectedMaterial?.sample_price?.toLocaleString('id-ID')}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {result.costInstallation > 0 && (
                        <div className="flex justify-between py-2">
                          <span className="text-slate-400">Installation</span>
                          <div className="text-right">
                            <p className="text-slate-200">Rp {result.costInstallation.toLocaleString('id-ID')}</p>
                            <p className="text-xs text-slate-500">{result.volumePrint.toFixed(2)} m² × Rp 100.000/m²</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Total */}
                  <div className="bg-gradient-to-r from-indigo-600/20 to-purple-600/20 rounded-xl border border-indigo-500/20 p-6">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-slate-400 mb-1">Total Cost</p>
                        <p className="text-xs text-slate-500">Including all services and materials</p>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                          Rp {result.totalCost.toLocaleString('id-ID')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {result.wasteInfo && (
                    <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                      <p className="text-orange-400 text-sm">{result.wasteInfo}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-96 text-center">
                  <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-4 border border-slate-700">
                    <svg className="w-10 h-10 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 3.666V14m-6.118 4.134l.789.789a2 2 0 002.828 0l4.243-4.243a2 2 0 000-2.828l-.789-.789M6.343 17.657l4.243-4.243" />
                    </svg>
                  </div>
                  <p className="text-slate-400 font-medium">Enter wall dimensions and click calculate</p>
                  <p className="text-slate-600 text-sm mt-1">Detailed results will appear here</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}