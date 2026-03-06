// src/app/history/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

// Type definitions
interface UserProfile {
  id: string;
  username: string;
  role: 'admin' | 'designer' | 'reseller';
}

interface RoomData {
  walls: Array<{
    width: number;
    height: number;
  }>;
  bleedWidth?: number;
  bleedHeight?: number;
}

interface CalculationHistory {
  id: number;
  user_id: string;
  project_name: string | null;
  room_data: RoomData;
  material_type: 'krearte' | 'customer';
  material_id: number | null;
  customer_material_id: number | null;
  price_type: 'retail' | 'designer' | 'reseller';
  volume_print: number;
  volume_bahan: number;
  volume_waste: number;
  num_panels: number;
  material_cost: number;
  waste_cost: number;
  cost_25d: number;
  cost_design_service: number;
  cost_image_enhance: number;
  cost_shutterstock: number;
  cost_installation: number;
  total_cost: number;
  created_at: string;
}

interface Material {
  id: number;
  name: string;
  type: string;
  width_material: number;
  width_print: number;
  price_designer: number;
  price_reseller: number;
  waste_price: number;
}

interface CustomerMaterial {
  id: number;
  name: string;
  width: number;
  width_print: number;
  price_print: number;
  waste_price: number;
  category: 'standard' | 'karpet_blind';
}

export default function HistoryPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [history, setHistory] = useState<CalculationHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCalc, setSelectedCalc] = useState<CalculationHistory | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [customerMaterials, setCustomerMaterials] = useState<CustomerMaterial[]>([]);
  const [deleting, setDeleting] = useState<number | null>(null);
  const router = useRouter();

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
        setUser(profile as UserProfile);
        await Promise.all([fetchHistory(profile as UserProfile), fetchMaterials()]);
      }
      setLoading(false);
    };
    checkUser();
  }, [router]);

  const fetchHistory = async (profile: UserProfile) => {
    let query = supabase
      .from('calculations')
      .select('*')
      .order('created_at', { ascending: false });

    if (profile.role !== 'admin') {
      query = query.eq('user_id', profile.id);
    }

    const { data: calcs, error } = await query;
    if (error) {
      console.error('Error fetching history:', error);
      return;
    }
    if (calcs) setHistory(calcs as CalculationHistory[]);
  };

  const fetchMaterials = async () => {
    const { data: mats } = await supabase.from('materials').select('*');
    if (mats) setMaterials(mats as Material[]);
    
    const { data: custMats } = await supabase.from('customer_materials').select('*');
    if (custMats) setCustomerMaterials(custMats as CustomerMaterial[]);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus riwayat kalkulasi ini?')) return;
    
    setDeleting(id);
    const { error } = await supabase
      .from('calculations')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting:', error);
      alert('Gagal menghapus data');
    } else {
      setHistory(history.filter(h => h.id !== id));
      if (selectedCalc?.id === id) setSelectedCalc(null);
    }
    setDeleting(null);
  };

  const getMaterialName = (calc: CalculationHistory) => {
    if (calc.material_type === 'krearte' && calc.material_id) {
      return materials.find(m => m.id === calc.material_id)?.name || 'Unknown Material';
    } else if (calc.material_type === 'customer' && calc.customer_material_id) {
      return customerMaterials.find(m => m.id === calc.customer_material_id)?.name || 'Unknown Service';
    }
    return 'Unknown';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRoomCount = (roomData: RoomData | null) => {
    if (!roomData || !roomData.walls) return 0;
    return Array.isArray(roomData.walls) ? roomData.walls.length : 0;
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
          <a href="/dashboard" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-slate-200 rounded-xl font-medium transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 3.666V14m-6.118 4.134l.789.789a2 2 0 002.828 0l4.243-4.243a2 2 0 000-2.828l-.789-.789M6.343 17.657l4.243-4.243" />
            </svg>
            Calculator
          </a>
          
          <a href="/history" className="flex items-center gap-3 px-4 py-3 bg-indigo-600/10 text-indigo-400 rounded-xl font-medium transition border border-indigo-600/20">
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
            onClick={async () => {
              await supabase.auth.signOut();
              router.push('/login');
            }}
            className="w-full mt-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-64 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Calculation History</h1>
          <p className="text-slate-400">
            {user.role === 'admin' ? 'View all calculations from all users' : 'View your past calculations'}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* History List */}
          <div className="lg:col-span-2 space-y-4">
            {history.length === 0 ? (
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-12 text-center">
                <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">No calculations yet</h3>
                <p className="text-slate-400 mb-6">Start creating your first calculation</p>
                <button 
                  onClick={() => router.push('/dashboard')}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition font-medium"
                >
                  Go to Calculator
                </button>
              </div>
            ) : (
              history.map((calc) => (
                <div 
                  key={calc.id}
                  onClick={() => setSelectedCalc(calc)}
                  className={`bg-slate-900 rounded-xl border p-5 cursor-pointer transition-all hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10 ${
                    selectedCalc?.id === calc.id ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-800'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="font-semibold text-white text-lg">
                          {calc.project_name || 'Untitled Project'}
                        </h3>
                        <div className="flex gap-2">
                          <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                            calc.price_type === 'retail' ? 'bg-gray-500/20 text-gray-400' :
                            calc.price_type === 'designer' ? 'bg-purple-500/20 text-purple-400' :
                            'bg-blue-500/20 text-blue-400'
                          }`}>
                            {calc.price_type}
                          </span>
                          <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                            calc.material_type === 'krearte' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-emerald-500/20 text-emerald-400'
                          }`}>
                            {calc.material_type === 'krearte' ? 'Krearte' : 'Customer'}
                          </span>
                        </div>
                      </div>
                      
                      <p className="text-sm text-slate-400 mb-3">
                        <span className="font-medium text-slate-300">{getMaterialName(calc)}</span>
                        <span className="mx-2">•</span>
                        <span>{calc.num_panels} panels</span>
                        <span className="mx-2">•</span>
                        <span>{getRoomCount(calc.room_data)} wall(s)</span>
                      </p>
                      
                      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                        <div className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 4l-5-5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                          </svg>
                          <span>{calc.volume_print.toFixed(2)} m² print</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                          <span>{calc.volume_bahan.toFixed(2)} m² material</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right ml-6">
                      <p className="text-2xl font-bold text-indigo-400 mb-1">
                        Rp {calc.total_cost.toLocaleString('id-ID')}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDate(calc.created_at)}
                      </p>
                    </div>
                  </div>
                  
                  {user.role === 'admin' && (
                    <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center">
                      <span className="text-xs text-slate-500">Created by: {calc.user_id}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(calc.id);
                        }}
                        disabled={deleting === calc.id}
                        className="text-xs text-red-400 hover:text-red-300 transition flex items-center gap-1 disabled:opacity-50"
                      >
                        {deleting === calc.id ? (
                          <span>Deleting...</span>
                        ) : (
                          <>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Detail Panel */}
          <div className="lg:col-span-1">
            {selectedCalc ? (
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 sticky top-8">
                <div className="flex justify-between items-start mb-6">
                  <h3 className="text-xl font-semibold text-white">Calculation Details</h3>
                  <button
                    onClick={() => setSelectedCalc(null)}
                    className="text-slate-400 hover:text-white transition p-1 hover:bg-slate-800 rounded-lg"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-5 text-sm">
                  <div>
                    <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Project Name</p>
                    <p className="text-white font-medium">{selectedCalc.project_name || '-'}</p>
                  </div>
                  
                  <div>
                    <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Material</p>
                    <p className="text-white font-medium">{getMaterialName(selectedCalc)}</p>
                  </div>
                  
                  <div>
                    <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Date</p>
                    <p className="text-white font-medium">{formatDate(selectedCalc.created_at)}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700">
                      <p className="text-slate-400 text-xs mb-1">Print Area</p>
                      <p className="text-white font-bold text-lg">{selectedCalc.volume_print.toFixed(2)} <span className="text-sm font-normal text-slate-400">m²</span></p>
                    </div>
                    <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700">
                      <p className="text-slate-400 text-xs mb-1">Material</p>
                      <p className="text-white font-bold text-lg">{selectedCalc.volume_bahan.toFixed(2)} <span className="text-sm font-normal text-slate-400">m²</span></p>
                    </div>
                    <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700">
                      <p className="text-slate-400 text-xs mb-1">Panels</p>
                      <p className="text-white font-bold text-lg">{selectedCalc.num_panels}</p>
                    </div>
                    <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700">
                      <p className="text-slate-400 text-xs mb-1">Waste</p>
                      <p className="text-orange-400 font-bold text-lg">{selectedCalc.volume_waste.toFixed(2)} <span className="text-sm font-normal text-slate-400">m²</span></p>
                    </div>
                  </div>

                  <div className="border-t border-slate-800 pt-5">
                    <p className="text-slate-300 font-semibold mb-3">Cost Breakdown</p>
                    <div className="space-y-2">
                      <div className="flex justify-between py-2">
                        <span className="text-slate-500">Material</span>
                        <span className="text-slate-200 font-medium">Rp {selectedCalc.material_cost.toLocaleString('id-ID')}</span>
                      </div>
                      {selectedCalc.waste_cost > 0 && (
                        <div className="flex justify-between py-2">
                          <span className="text-slate-500">Waste</span>
                          <span className="text-slate-200 font-medium">Rp {selectedCalc.waste_cost.toLocaleString('id-ID')}</span>
                        </div>
                      )}
                      {selectedCalc.cost_25d > 0 && (
                        <div className="flex justify-between py-2">
                          <span className="text-slate-500">2.5D Print</span>
                          <span className="text-slate-200 font-medium">Rp {selectedCalc.cost_25d.toLocaleString('id-ID')}</span>
                        </div>
                      )}
                      {selectedCalc.cost_design_service > 0 && (
                        <div className="flex justify-between py-2">
                          <span className="text-slate-500">Design Service</span>
                          <span className="text-slate-200 font-medium">Rp {selectedCalc.cost_design_service.toLocaleString('id-ID')}</span>
                        </div>
                      )}
                      {selectedCalc.cost_image_enhance > 0 && (
                        <div className="flex justify-between py-2">
                          <span className="text-slate-500">Image Enhance</span>
                          <span className="text-slate-200 font-medium">Rp {selectedCalc.cost_image_enhance.toLocaleString('id-ID')}</span>
                        </div>
                      )}
                      {selectedCalc.cost_shutterstock > 0 && (
                        <div className="flex justify-between py-2">
                          <span className="text-slate-500">Shutterstock</span>
                          <span className="text-slate-200 font-medium">Rp {selectedCalc.cost_shutterstock.toLocaleString('id-ID')}</span>
                        </div>
                      )}
                      {selectedCalc.cost_installation > 0 && (
                        <div className="flex justify-between py-2">
                          <span className="text-slate-500">Installation</span>
                          <span className="text-slate-200 font-medium">Rp {selectedCalc.cost_installation.toLocaleString('id-ID')}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-slate-800 pt-5">
                    <div className="flex justify-between items-center bg-gradient-to-r from-indigo-600/20 to-purple-600/20 p-4 rounded-xl border border-indigo-500/20">
                      <span className="text-slate-300 font-semibold">Total</span>
                      <span className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                        Rp {selectedCalc.total_cost.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify({
                        project: selectedCalc.project_name,
                        material: getMaterialName(selectedCalc),
                        total: selectedCalc.total_cost,
                        date: selectedCalc.created_at
                      }, null, 2));
                      alert('Calculation data copied to clipboard!');
                    }}
                    className="w-full py-3 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition text-sm font-medium flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    Copy Summary
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 text-center sticky top-8">
                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <p className="text-slate-400">Select a calculation from the list to view detailed information</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}