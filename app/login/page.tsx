'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, Lock, User, AlertCircle, Sparkles, HeartPulse, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // If already logged in, redirect to home page
  useEffect(() => {
    const auth = localStorage.getItem('cardiokonnect_auth')
    if (auth === 'true') {
      router.replace('/')
    }
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Simulate clinical authorization validation
    await new Promise((resolve) => setTimeout(resolve, 1200))

    if (username === 'cardiokonnect' && password === 'test1234') {
      localStorage.setItem('cardiokonnect_auth', 'true')
      toast.success('Access Granted. Opening Cardio-Konnect Registry...', {
        style: {
          background: 'rgba(16, 185, 129, 0.95)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          color: '#ffffff'
        }
      })
      router.replace('/')
    } else {
      setError('Invalid registry credentials. Please contact administration for access keys.')
      toast.error('Authentication Failed', {
        description: 'Check clinical user ID or password.',
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
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/35 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/5 pulse-animation">
            <HeartPulse className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Cardio-Konnect
          </h1>
          <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold flex items-center gap-1.5 bg-blue-950/20 px-3 py-1 rounded-full border border-blue-500/10">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" /> AICTS Pune · Research Portal
          </p>
        </div>

        {/* Premium Frosted Glass Card */}
        <div 
          className="glass-card p-8 rounded-3xl relative border border-white/10 shadow-2xl overflow-hidden backdrop-blur-2xl"
          style={{
            background: 'linear-gradient(135deg, rgba(15, 26, 61, 0.6) 0%, rgba(7, 14, 27, 0.8) 100%)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.05)'
          }}
        >
          {/* Internal Glow Effect */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />

          <h2 className="text-lg font-semibold text-white mb-6 text-center">
            Sign in to access Registry
          </h2>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Username Input */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider font-semibold text-gray-400">
                Clinical ID
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  disabled={loading}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. cardiokonnect"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-700/50 bg-[#070e1b]/80 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition duration-200 text-sm"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider font-semibold text-gray-400">
                Security Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  required
                  disabled={loading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-700/50 bg-[#070e1b]/80 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition duration-200 text-sm"
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex gap-2.5 p-3 rounded-xl bg-red-950/20 border border-red-500/20 text-red-300 text-xs animate-shake">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition duration-200 text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 border border-blue-400/20 mt-6"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Authorizing...
                </>
              ) : (
                <>
                  Connect Registry
                </>
              )}
            </button>
          </form>

          {/* Secure indicator footer */}
          <div className="mt-8 pt-6 border-t border-gray-800/60 flex items-center justify-center gap-2 text-[10px] text-gray-500 uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5 text-blue-400/50" /> End-to-End HIPAA Encrypted
          </div>
        </div>

        {/* Administration Note */}
        <p className="text-center text-[10px] text-gray-500 mt-6 leading-relaxed px-4">
          This system is restricted to authorized medical research personnel at AICTS Pune. Unauthorized entry attempts are logged.
        </p>
      </div>
    </div>
  )
}
