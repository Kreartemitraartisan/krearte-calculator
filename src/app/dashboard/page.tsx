'use client';

import { useEffect, useState } from 'react';
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
  const [priceType, setPriceType] = useState<'retail' | 'designer' | 'reseller'>('designer');
  
  // State Kalkulator
  const [walls, setWalls] = useState<WallInput[]>([{ id: Date.now(), width: '', height: '' }]);
  const [materialType, setMaterialType] = useState<'krearte' | 'customer'>('krearte');
  const [selectedMaterialId, setSelectedMaterialId] = useState<number | null>(null);
  const [selectedCustomerMaterialId, setSelectedCustomerMaterialId] = useState<number | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [customerMaterials, setCustomerMaterials] = useState<CustomerMaterial[]>([]);
  
  // State untuk bleed/lebihan area (dalam cm)
  const [bleedWidth, setBleedWidth] = useState<number>(3);
  const [bleedHeight, setBleedHeight] = useState<number>(3);
  
  // Addons
  const [is25d, setIs25d] = useState(false);
  const [designService, setDesignService] = useState(0);
  const [imageEnhance, setImageEnhance] = useState(false);
  const [shutterstockQty, setShutterstockQty] = useState(0);
  const [installation, setInstallation] = useState(false);
  const [installationCity, setInstallationCity] = useState<string>('SURABAYA');
  const [installationType, setInstallationType] = useState<'normal' | 'panel' | 'void'>('normal');
  
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
        
        // Set default price type berdasarkan role
        if (profile.role === 'designer') {
          setPriceType('designer');
        } else if (profile.role === 'reseller') {
          setPriceType('reseller');
        } else {
          setPriceType('designer'); // Admin default
        }
        
        fetchMaterials();
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
    
    const validWalls = walls
        .filter(w => parseFloat(w.width) > 0 && parseFloat(w.height) > 0)
        .map(w => ({
        width: parseFloat(w.width),
        height: parseFloat(w.height)
        }));

    if (validWalls.length === 0) {
        setError('Masukkan minimal 1 dimensi dinding yang valid');
        return;
    }

    const material = materials.find(m => m.id === selectedMaterialId);
    
    const customerMaterial = materialType === 'customer' && selectedCustomerMaterialId 
        ? customerMaterials.find(m => m.id === selectedCustomerMaterialId)
        : undefined;

    // Convert cm to meters for bleed
    const bleedWidthM = bleedWidth / 100;
    const bleedHeightM = bleedHeight / 100;
    
    // Admin bisa pilih price type, user lain otomatis sesuai role
    const calculationRole = user.role === 'admin' 
        ? (priceType === 'retail' ? 'reseller' : priceType) 
        : user.role;

    try {
        const res = calculatePrice({
        walls: validWalls,
        materialType,
        material,
        customerMaterial,
        role: calculationRole as 'designer' | 'reseller',
        priceType,
        bleedWidth: bleedWidthM,
        bleedHeight: bleedHeightM,
        addons: {
            is25d,
            designServicePrice: designService,
            imageEnhance,
            shutterstockQty,
            installation,
            installationCity,        // ✅ Dynamic dari state
            installationType,        // ✅ Tambahkan ini
            wallHeight: validWalls.length > 0 
            ? validWalls.reduce((sum, w) => sum + w.height, 0) / validWalls.length  // ✅ Average height
            : 0
        }
        });

        setResult(res);
    } catch (err) {
        setError('Terjadi kesalahan saat menghitung. Silakan periksa input Anda.');
        console.error('Calculation error:', err);
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
                      <label className="block text-xs font-medium text-slate-400 mb-1">Width (m)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={wall.width}
                        onChange={(e) => updateWall(wall.id, 'width', e.target.value)}
                        placeholder="0.00"
                        className="w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-800 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-slate-400 mb-1">Height (m)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={wall.height}
                        onChange={(e) => updateWall(wall.id, 'height', e.target.value)}
                        placeholder="0.00"
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
            </div>

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

                <div className="p-4 border border-slate-700 rounded-xl">
                  <p className="font-medium text-slate-200 mb-2">Design Service</p>
                  <select 
                    onChange={(e) => setDesignService(Number(e.target.value))}
                    value={designService}
                    className="w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-800 text-white focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value={0}>No design service</option>
                    <option value={150000}>1 Day - Rp 150,000</option>
                    <option value={900000}>1 Week - Rp 900,000</option>
                    <option value={1800000}>2 Weeks - Rp 1,800,000</option>
                  </select>
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
              <h2 className="text-lg font-semibold text-white mb-6">Calculation Results</h2>
              
              {result ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                      <p className="text-sm text-slate-400 mb-1">Print Area</p>
                      <p className="text-2xl font-bold text-white">{result.volumePrint.toFixed(2)} m²</p>
                    </div>
                    <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                      <p className="text-sm text-slate-400 mb-1">Material Needed</p>
                      <p className="text-2xl font-bold text-white">{result.volumeBahan.toFixed(2)} m²</p>
                    </div>
                    <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                      <p className="text-sm text-slate-400 mb-1">Number of Panels</p>
                      <p className="text-2xl font-bold text-white">{result.numPanels}</p>
                    </div>
                    <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                      <p className="text-sm text-slate-400 mb-1">Waste</p>
                      <p className="text-2xl font-bold text-orange-400">{result.volumeWaste.toFixed(2)} m²</p>
                    </div>
                  </div>

                  <div className="border-t border-slate-700 pt-4 mt-6">
                    <h3 className="font-semibold text-white mb-3">Cost Breakdown</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between py-2">
                        <span className="text-slate-400">Material Cost</span>
                        <span className="font-semibold text-slate-200">Rp {result.materialCost.toLocaleString('id-ID')}</span>
                      </div>
                      {result.wasteCost > 0 && (
                        <div className="flex justify-between py-2">
                          <span className="text-slate-400">Waste Cost</span>
                          <span className="font-semibold text-slate-200">Rp {result.wasteCost.toLocaleString('id-ID')}</span>
                        </div>
                      )}
                      {result.cost25d > 0 && (
                        <div className="flex justify-between py-2">
                          <span className="text-slate-400">2.5D Print</span>
                          <span className="font-semibold text-slate-200">Rp {result.cost25d.toLocaleString('id-ID')}</span>
                        </div>
                      )}
                      {result.costDesign > 0 && (
                        <div className="flex justify-between py-2">
                          <span className="text-slate-400">Design Service</span>
                          <span className="font-semibold text-slate-200">Rp {result.costDesign.toLocaleString('id-ID')}</span>
                        </div>
                      )}
                      {result.costEnhance > 0 && (
                        <div className="flex justify-between py-2">
                          <span className="text-slate-400">Image Enhancement</span>
                          <span className="font-semibold text-slate-200">Rp {result.costEnhance.toLocaleString('id-ID')}</span>
                        </div>
                      )}
                      {result.costShutterstock > 0 && (
                        <div className="flex justify-between py-2">
                          <span className="text-slate-400">Shutterstock</span>
                          <span className="font-semibold text-slate-200">Rp {result.costShutterstock.toLocaleString('id-ID')}</span>
                        </div>
                      )}
                      {result.costInstallation > 0 && (
                        <div className="flex justify-between py-2">
                          <span className="text-slate-400">Installation</span>
                          <span className="font-semibold text-slate-200">Rp {result.costInstallation.toLocaleString('id-ID')}</span>
                        </div>
                      )}
                      
                      <div className="border-t border-slate-700 pt-3 mt-3">
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-bold text-white">Total</span>
                          <span className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                            Rp {result.totalCost.toLocaleString('id-ID')}
                          </span>
                        </div>
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
                  <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mb-4 border border-slate-700">
                    <svg className="w-12 h-12 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 3.666V14m-6.118 4.134l.789.789a2 2 0 002.828 0l4.243-4.243a2 2 0 000-2.828l-.789-.789M6.343 17.657l4.243-4.243" />
                    </svg>
                  </div>
                  <p className="text-slate-400 font-medium">Enter wall dimensions and click calculate</p>
                  <p className="text-slate-600 text-sm mt-1">Results will appear here</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}