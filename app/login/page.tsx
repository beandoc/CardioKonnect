'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, Lock, User, AlertCircle, HeartPulse, RefreshCw, ArrowRight, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { authenticateUser } from '@/lib/appConfig'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // If already logged in, redirect based on stored user
  useEffect(() => {
    const auth = localStorage.getItem('cardiokonnect_auth')
    const storedUserId = localStorage.getItem('cardio_active_user_id')
    const role = localStorage.getItem('cardiokonnect_role')
    if (auth === 'true') {
      if (role === 'deo') {
        router.replace('/deo')
      } else if (storedUserId === 'DR_RAJEEV_CHAUHAN') {
        router.replace('/registry-home')
      } else {
        router.replace('/')
      }
    }
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Simulate clinical authorization validation
    await new Promise((resolve) => setTimeout(resolve, 500))

    const trimmedUser = username.trim()
    const trimmedPass = password.trim()

    // 1. Check DEO special case
    const isDeoDirect = (trimmedUser.toLowerCase() === 'dataentry' || trimmedUser.toLowerCase() === 'deo') && trimmedPass === 'deo1234'
    if (isDeoDirect) {
      localStorage.setItem('cardiokonnect_auth', 'true')
      localStorage.setItem('cardiokonnect_role', 'deo')
      localStorage.setItem('cardio_active_user_id', 'DR_ARSHDEEP')
      toast.success('Access Granted — Data Entry Operator Portal', {
        style: {
          background: 'rgba(6, 182, 212, 0.95)',
          border: '1px solid rgba(6, 182, 212, 0.3)',
          color: '#ffffff'
        }
      })
      router.replace('/deo')
      return
    }

    // 2. Validate against AppUser directory
    const authenticated = authenticateUser(trimmedUser, trimmedPass)

    if (authenticated) {
      localStorage.setItem('cardiokonnect_auth', 'true')
      localStorage.setItem('cardio_active_user_id', authenticated.id)
      localStorage.setItem('cardiokonnect_role', authenticated.role === 'DEO' ? 'deo' : 'doctor')

      toast.success(`Access Granted — Welcome, ${authenticated.name}`, {
        description: `${authenticated.role}`,
        style: {
          background: 'rgba(16, 185, 129, 0.95)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          color: '#ffffff'
        }
      })

      if (authenticated.id === 'DR_RAJEEV_CHAUHAN') {
        router.replace('/registry-home')
      } else {
        router.replace('/')
      }
    } else {
      setError('Invalid clinical user ID or password. Please verify your credentials.')
      toast.error('Authentication Failed', {
        description: 'Please verify your registered credentials and password.',
      })
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#070e1b]">
      {/* Dynamic Background Mesh Gradients */}
      <div 
        className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full pointer-events-none opacity-20 filter blur-[120px]"
        style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }}
      />
      <div 
        className="absolute bottom-[-20%] right-[-10%] w-[65vw] h-[65vw] rounded-full pointer-events-none opacity-15 filter blur-[120px]"
        style={{ background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)' }}
      />

      {/* Subtle Star Grid Canvas Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 0)`,
          backgroundSize: '24px 24px'
        }}
      />

      <div className="relative w-full max-w-md p-4 mx-auto z-10 animate-fade-in">
        {/* Brand Logo and Title */}
        <div className="text-center mb-6 flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/35 flex items-center justify-center mb-3 shadow-lg shadow-blue-500/5 pulse-animation">
            <HeartPulse className="w-7 h-7 text-blue-400" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white mb-1.5" style={{ fontFamily: 'Outfit, sans-serif' }}>
            CardioKonnect
          </h1>
          <p className="text-[11px] text-gray-400 uppercase tracking-widest font-semibold flex items-center gap-1.5 bg-blue-950/20 px-3 py-1 rounded-full border border-blue-500/10">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" /> Clinical Registry Platform
          </p>
        </div>

        {/* Premium Frosted Glass Card */}
        <div 
          className="glass-card p-6 md:p-8 rounded-3xl relative border border-white/10 shadow-2xl overflow-hidden backdrop-blur-2xl"
          style={{
            background: 'linear-gradient(135deg, rgba(15, 26, 61, 0.75) 0%, rgba(7, 14, 27, 0.9) 100%)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.05)'
          }}
        >
          {/* Internal Glow Accent */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500/60 to-transparent" />

          <div className="mb-6">
            <h2 className="text-lg font-bold text-white leading-tight">
              Clinical Portal Login
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Secure authorization for registry investigators and clinical personnel
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Username Input */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider font-semibold text-gray-300">
                Clinical User ID / Username
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  disabled={loading}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your registered clinical ID"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-700/60 bg-[#070e1b]/90 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition duration-200 text-xs"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider font-semibold text-gray-300">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  required
                  disabled={loading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-700/60 bg-[#070e1b]/90 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition duration-200 text-xs"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/25 text-rose-300 text-xs flex items-center gap-2 animate-fade-in">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full py-3 rounded-xl font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/25 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer mt-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Authenticating Session...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Clinical Registry</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Secure indicator footer */}
          <div className="mt-6 pt-4 border-t border-gray-800/60 flex items-center justify-center gap-2 text-[10px] text-gray-400 uppercase tracking-wider">
            <Shield className="w-3.5 h-3.5 text-blue-400" />
            <span>Encrypted Multi-Center Clinical Network</span>
          </div>
        </div>

        {/* Administration Confidentiality Notice */}
        <p className="text-center text-[10px] text-gray-500 mt-6 leading-relaxed px-4">
          Authorized personnel only. All access attempts and clinical data transactions are securely logged and audited.
        </p>
      </div>
    </div>
  )
}
