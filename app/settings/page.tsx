'use client'
import { useState } from 'react'
import { Shield, ShieldAlert, Award, Calendar, Clock, Laptop, Compass, Heart, HelpCircle } from 'lucide-react'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'

export default function DoctorProfilePage() {
  const [mfa, setMfa] = useState(true)

  return (
    <div className="space-y-6 animate-fade-in text-gray-300">
      
      {/* Header Profile Info Banner */}
      <div className="accent-card p-6 flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
        <div className="flex flex-col md:flex-row items-center gap-5 text-center md:text-left">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6, #06b6d4)' }}>
            AJ
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Dr. A. Jayachandra</h2>
            <p className="text-sm text-gray-400">Attending Doctor &bull; AICTS Pune</p>
            <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-3">
              <span className="badge badge-green text-[10px] uppercase font-semibold">Active</span>
              <span className="badge badge-blue text-[10px] uppercase font-semibold">Approved Account</span>
              <span className="text-xs text-gray-500 flex items-center gap-1 ml-2">
                <Calendar className="w-3.5 h-3.5" /> Member since: Nov 4, 2025
              </span>
            </div>
          </div>
        </div>

        {/* Small stats in banner */}
        <div className="flex gap-4 border-t md:border-t-0 md:border-l border-blue-500/10 pt-4 md:pt-0 md:pl-6">
          <div className="text-center md:text-left">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Last Login</p>
            <p className="text-white font-semibold text-sm mt-0.5">Today, 07:27 PM</p>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: Key Stats & Active Session */}
        <div className="space-y-6">
          
          {/* Key Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="kpi-card blue">
              <p className="text-[10px] uppercase tracking-wider text-gray-400">Active Roles</p>
              <p className="text-2xl font-bold text-white mt-1">4</p>
              <p className="text-[10px] text-gray-500 mt-1">Assigned roles</p>
            </div>
            <div className="kpi-card violet">
              <p className="text-[10px] uppercase tracking-wider text-gray-400">Registries</p>
              <p className="text-2xl font-bold text-white mt-1">1</p>
              <p className="text-[10px] text-emerald-400 mt-1">0 pending</p>
            </div>
            <div className="kpi-card cyan">
              <p className="text-[10px] uppercase tracking-wider text-gray-400">Appointments</p>
              <p className="text-2xl font-bold text-white mt-1">0</p>
              <p className="text-[10px] text-gray-500 mt-1">This month</p>
            </div>
            <div className="kpi-card amber">
              <p className="text-[10px] uppercase tracking-wider text-gray-400">Account Age</p>
              <p className="text-2xl font-bold text-white mt-1">210</p>
              <p className="text-[10px] text-gray-500 mt-1">Days since signup</p>
            </div>
          </div>

          {/* Active Session info */}
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-blue-500/10">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Laptop className="w-4 h-4 text-blue-400" /> Current Session
              </h3>
              <span className="badge badge-green text-[10px]">Active</span>
            </div>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Platform:</span>
                <span className="text-white font-mono">web</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">IP:</span>
                <span className="text-white font-mono">106.215.177.22</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Location:</span>
                <span className="text-white">Unknown</span>
              </div>
            </div>

            <div className="border-t border-blue-500/10 pt-3 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Started:</span>
                <span className="text-gray-300">June 2, 2026 at 09:55 PM</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Last Active:</span>
                <span className="text-gray-300">June 2, 2026 at 10:07 PM</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Expires:</span>
                <span className="text-gray-300">June 2, 2026 at 10:22 PM</span>
              </div>
            </div>
          </div>
        </div>

        {/* Center column: Assigned Roles & Access */}
        <div className="space-y-6 lg:col-span-2">
          
          {/* Assigned Roles List */}
          <div className="glass-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white pb-3 border-b border-blue-500/10 flex items-center gap-2">
              <Award className="w-4 h-4 text-violet-400" /> Assigned Roles
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              <div className="dark-card p-4 space-y-2 border border-blue-500/10 hover:border-blue-500/20 transition-all">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm text-white">Admin</p>
                  <span className="badge badge-blue text-[9px] uppercase">Active</span>
                </div>
                <p className="text-xs text-gray-400">Administrative access with user management</p>
                <p className="text-[10px] text-gray-500 pt-1">Assigned by Admin &bull; Nov 4, 2025 at 03:04 PM</p>
              </div>

              <div className="dark-card p-4 space-y-2 border border-blue-500/10 hover:border-blue-500/20 transition-all">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm text-white">AttendingDoctor</p>
                  <span className="badge badge-blue text-[9px] uppercase">Active</span>
                </div>
                <p className="text-xs text-gray-400">Doctor with patient management access</p>
                <p className="text-[10px] text-gray-500 pt-1">Assigned by Admin &bull; Nov 4, 2025 at 03:04 PM</p>
              </div>

              <div className="dark-card p-4 space-y-2 border border-blue-500/10 hover:border-blue-500/20 transition-all">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm text-white">RegistryManager</p>
                  <span className="badge badge-blue text-[9px] uppercase">Active</span>
                </div>
                <p className="text-xs text-gray-400">Registry manager with operational control</p>
                <p className="text-[10px] text-gray-500 pt-1">Assigned by Admin &bull; Nov 4, 2025 at 03:04 PM</p>
              </div>

              <div className="dark-card p-4 space-y-2 border border-blue-500/10 hover:border-blue-500/20 transition-all">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm text-white">RegistryOwner</p>
                  <span className="badge badge-blue text-[9px] uppercase">Active</span>
                </div>
                <p className="text-xs text-gray-400">Registry owner with oversight capabilities</p>
                <p className="text-[10px] text-gray-500 pt-1">Assigned by Admin &bull; Nov 4, 2025 at 03:04 PM</p>
              </div>

            </div>
          </div>

          {/* Registry Access & Provider Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Registry Access */}
            <div className="glass-card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white pb-3 border-b border-blue-500/10 flex items-center gap-2">
                <Compass className="w-4 h-4 text-cyan-400" /> Registry Access
              </h3>
              <div className="dark-card p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-xs text-white">Cardiovascular Registry</p>
                  <span className="badge badge-green text-[9px] uppercase">Active</span>
                </div>
                <p className="text-[11px] text-gray-400">Main Heart Failure Registry Database</p>
                <p className="text-[10px] text-gray-500 pt-1">Assigned Nov 4, 2025 at 03:12 PM</p>
              </div>
              <div className="pt-2 text-xs text-gray-500 text-center">No other registry accesses assigned</div>
            </div>

            {/* Provider Information */}
            <div className="glass-card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white pb-3 border-b border-blue-500/10 flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-400" /> Provider Information
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">License Number:</span>
                  <span className="text-white font-mono">123454</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Experience:</span>
                  <span className="text-white">12 years</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Subspecialty:</span>
                  <span className="text-white">Cardiology / Research</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Primary Facility:</span>
                  <span className="text-white">AICTS, Pune</span>
                </div>
              </div>
            </div>

          </div>

          {/* Account Security & Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Account Details */}
            <div className="glass-card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white pb-3 border-b border-blue-500/10 flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" /> Account Security
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Account ID:</span>
                  <span className="text-white font-mono">411fa971...</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Account Type:</span>
                  <span className="text-white">Healthcare Professional</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Verification:</span>
                  <span className="badge badge-green text-[9px] uppercase">Verified</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Two-Factor Auth:</span>
                  <span className="badge badge-blue text-[9px] uppercase">Active</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="glass-card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white pb-3 border-b border-blue-500/10 flex items-center gap-2">
                <Compass className="w-4 h-4 text-amber-400" /> Actions & Logs
              </h3>
              <div className="flex flex-col gap-2.5">
                <Button className="w-full justify-center">Update Profile</Button>
                <Button variant="outline" className="w-full justify-center">View Activity Log</Button>
              </div>
              <div className="pt-2 text-[10px] text-gray-500 text-center">
                Last updated on Nov 4, 2025
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>
  )
}
