// src/app/admin/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Material, CustomerMaterial } from '@/types';

interface NewUser {
  username: string;
  email: string;
  password: string;
  role: 'admin' | 'designer' | 'reseller';
}

export default function AdminPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [customerMaterials, setCustomerMaterials] = useState<CustomerMaterial[]>([]);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState<NewUser>({
    username: '',
    email: '',
    password: '',
    role: 'designer'
  });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
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
        
      if (profile?.role !== 'admin') {
        router.push('/dashboard');
        return;
      }

      await Promise.all([
        fetchUsers(),
        fetchMaterials()
      ]);
      setLoading(false);
    };
    fetchData();
  }, [router]);

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, username, role, created_at')
      .order('created_at', { ascending: false });
    if (data) setUsers(data);
  };

  const fetchMaterials = async () => {
    const { data: mats } = await supabase
      .from('materials')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (mats) setMaterials(mats);

    const { data: custMats } = await supabase
      .from('customer_materials')
      .select('*')
      .order('name');
    if (custMats) setCustomerMaterials(custMats);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setMessage({ type: '', text: '' });

    try {
      const { error } = await supabase.auth.admin.createUser({
        email: newUser.email,
        password: newUser.password,
        user_metadata: {
          username: newUser.username,
          role: newUser.role
        }
      });

      if (error) throw error;

      setMessage({ type: 'success', text: 'User berhasil dibuat!' });
      setNewUser({ username: '', email: '', password: '', role: 'designer' });
      setShowCreateUser(false);
      await fetchUsers();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-64 bg-slate-900 border-r border-slate-800 z-10">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Krearte</h1>
          <p className="text-sm text-slate-500 mt-1">Admin Panel</p>
        </div>
        
        <nav className="p-4 space-y-2">
          <a href="/dashboard" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-slate-200 rounded-xl font-medium transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 3.666V14m-6.118 4.134l.789.789a2 2 0 002.828 0l4.243-4.243a2 2 0 000-2.828l-.789-.789M6.343 17.657l4.243-4.243" />
            </svg>
            Calculator
          </a>
          
          <a href="/admin" className="flex items-center gap-3 px-4 py-3 bg-indigo-600/10 text-indigo-400 rounded-xl font-medium transition border border-indigo-600/20">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Admin Panel
          </a>
        </nav>
        
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800">
          <button 
            onClick={async () => {
              await supabase.auth.signOut();
              router.push('/login');
            }}
            className="w-full px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-64 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Admin Dashboard</h1>
          <p className="text-slate-400">Manage users and view system information</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* User Management */}
          <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-white">User Management</h2>
              <button
                onClick={() => setShowCreateUser(!showCreateUser)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium"
              >
                {showCreateUser ? 'Cancel' : '+ Create User'}
              </button>
            </div>

            {showCreateUser && (
              <form onSubmit={handleCreateUser} className="mb-6 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                <h3 className="text-lg font-medium text-white mb-4">Create New User</h3>
                {message.text && (
                  <div className={`mb-4 p-3 rounded-lg ${
                    message.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'
                  }`}>
                    {message.text}
                  </div>
                )}
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Username</label>
                    <input
                      type="text"
                      value={newUser.username}
                      onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-800 text-white focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
                    <input
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-800 text-white focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
                    <input
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-800 text-white focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Role</label>
                    <select
                      value={newUser.role}
                      onChange={(e) => setNewUser({...newUser, role: e.target.value as any})}
                      className="w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-800 text-white focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="designer">Designer</option>
                      <option value="reseller">Reseller</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={creating}
                    className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                  >
                    {creating ? 'Creating...' : 'Create User'}
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2">
              {users.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                  <div>
                    <p className="font-medium text-white">{user.username}</p>
                    <p className="text-sm text-slate-400">{user.id}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    user.role === 'admin' ? 'bg-purple-500/20 text-purple-400' :
                    user.role === 'reseller' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-green-500/20 text-green-400'
                  }`}>
                    {user.role}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Material Reference */}
          <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-6">
            <h2 className="text-xl font-semibold text-white mb-6">Material Reference</h2>
            
            {/* Tabs */}
            <div className="flex gap-2 mb-6">
              <button className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium">
                Materials Info
              </button>
            </div>

            {/* Krearte Materials */}
            <div className="mb-6">
              <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                Krearte Materials (Reseller A)
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {materials.map((mat) => (
                  <div key={mat.id} className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                    <p className="font-medium text-slate-200 text-sm">{mat.name}</p>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-slate-400">
                      <span>Width: {mat.width_material}m</span>
                      <span>Print: {mat.width_print}m</span>
                      <span>Designer: Rp {mat.price_designer?.toLocaleString('id-ID')}</span>
                      <span>Reseller: Rp {mat.price_reseller?.toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Customer Materials */}
            <div>
              <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                Customer Materials (Reseller B)
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {customerMaterials.map((mat) => (
                  <div key={mat.id} className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                    <p className="font-medium text-slate-200 text-sm">{mat.name}</p>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-slate-400">
                      <span>Width: {mat.width}m</span>
                      <span>Print: {mat.width_print}m</span>
                      <span>Price: Rp {mat.price_print.toLocaleString('id-ID')}</span>
                      <span>Category: {mat.category}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <div className="bg-gradient-to-br from-indigo-600/20 to-purple-600/20 rounded-2xl border border-indigo-500/20 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white">Total Users</h3>
            </div>
            <p className="text-3xl font-bold text-white">{users.length}</p>
            <p className="text-sm text-slate-400 mt-1">Active accounts</p>
          </div>

          <div className="bg-gradient-to-br from-blue-600/20 to-cyan-600/20 rounded-2xl border border-blue-500/20 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white">Krearte Materials</h3>
            </div>
            <p className="text-3xl font-bold text-white">{materials.length}</p>
            <p className="text-sm text-slate-400 mt-1">Available products</p>
          </div>

          <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-2xl border border-purple-500/20 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white">Customer Materials</h3>
            </div>
            <p className="text-3xl font-bold text-white">{customerMaterials.length}</p>
            <p className="text-sm text-slate-400 mt-1">Print service options</p>
          </div>
        </div>
      </div>
    </div>
  );
}