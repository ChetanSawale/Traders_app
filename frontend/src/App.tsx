import { useState, useEffect } from 'react';
import { 
  Globe, 
  TrendingUp, 
  BookOpen, 
  Shield, 
  Command, 
  ChevronRight, 
  Layers, 
  LogOut, 
  Github, 
  ShieldCheck, 
  Sparkles, 
  HelpCircle,
  Lock
} from 'lucide-react';

// Components
import CustomCursor from './components/CustomCursor';
import CommandPalette from './components/CommandPalette';
import BentoGrid from './components/BentoGrid';
import MetricsPanel from './components/MetricsPanel';
import TradingViewCanvas from './components/TradingViewCanvas';
import PortfolioLedger from './components/PortfolioLedger';
import MinimalPlayer from './components/MinimalPlayer';
import CourseQuizzes from './components/CourseQuizzes';
import NewsFeed from './components/NewsFeed';

interface User {
  id: number;
  email: string;
  role: string;
  portfolioId: number;
  mfaEnabled: boolean;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentRoute, setCurrentRoute] = useState<string>('dashboard');
  const [selectedTicker, setSelectedTicker] = useState<string>('BTC');
  const [tickerPrice, setTickerPrice] = useState<number>(68500);
  
  // Dialog / Modal states
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [tempMfaToken, setTempMfaToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // 2FA Setup state
  const [mfaQr, setMfaQr] = useState<string | null>(null);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaSetupCode, setMfaSetupCode] = useState('');
  const [sessionLogs, setSessionLogs] = useState<any[]>([]);

  // Pricing Toggle states
  const [pricingCycle, setPricingCycle] = useState<'monthly' | 'yearly'>('monthly');

  // Active Orders state and fetcher for TradingView Canvas triggers
  const [orders, setOrders] = useState<any[]>([]);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/trading/orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (e) {}
  };

  // Sync orders on user/ticker shifts
  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user, selectedTicker]);

  // Trigger command palette on keyboard shortcut Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    checkAuth();
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (user && currentRoute === 'security') {
      fetchSessionLogs();
    }
  }, [user, currentRoute]);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch (e) {}
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput, password: passwordInput })
      });
      const data = await res.json();

      if (res.ok) {
        if (data.mfaRequired) {
          setTempMfaToken(data.tempToken);
        } else {
          setUser(data.user);
          setEmailInput('');
          setPasswordInput('');
        }
      } else {
        setAuthError(data.error || 'Authentication failed');
      }
    } catch (err) {
      setAuthError('Unable to connect to authentication backend.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput, password: passwordInput, role: 'trader' })
      });
      const data = await res.json();

      if (res.ok) {
        setUser(data.user);
        setEmailInput('');
        setPasswordInput('');
      } else {
        setAuthError(data.error || 'Registration failed');
      }
    } catch (err) {
      setAuthError('Unable to connect to authentication backend.');
    }
  };

  const handleMfaLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      const res = await fetch('/api/auth/mfa/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken: tempMfaToken, token: mfaCode })
      });
      const data = await res.json();

      if (res.ok) {
        setUser(data.user);
        setTempMfaToken(null);
        setMfaCode('');
      } else {
        setAuthError(data.error || 'Invalid 2FA code.');
      }
    } catch (err) {
      setAuthError('Connection failed.');
    }
  };

  const handleGithubLogin = async () => {
    setAuthError(null);
    try {
      const res = await fetch('/api/auth/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'STUDENT_GITHUB_PLAN' })
      });
      const data = await res.json();

      if (res.ok) {
        setUser(data.user);
      } else {
        setAuthError(data.error || 'GitHub SSO authentication failed.');
      }
    } catch (err) {
      setAuthError('Connection failed.');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      setCurrentRoute('dashboard');
    } catch (e) {}
  };

  // 2FA Setup functions
  const initiateMfaSetup = async () => {
    try {
      const res = await fetch('/api/auth/mfa/setup', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setMfaQr(data.qrCode);
        setMfaSecret(data.secret);
      }
    } catch (e) {}
  };

  const verifyMfaSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: mfaSetupCode })
      });
      if (res.ok) {
        // Complete
        setMfaQr(null);
        setMfaSecret(null);
        setMfaSetupCode('');
        checkAuth();
      } else {
        alert('Invalid code, please try again.');
      }
    } catch (e) {}
  };

  const fetchSessionLogs = async () => {
    try {
      const res = await fetch('/api/auth/session-audit');
      if (res.ok) {
        const data = await res.json();
        setSessionLogs(data);
      }
    } catch (e) {}
  };

  return (
    <div className="min-h-screen flex flex-col relative pb-20 select-none">
      {/* 1. Global custom cursor with orbital particle rings */}
      <CustomCursor />

      {/* 2. Global command palette triggered by Ctrl+K */}
      <CommandPalette 
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={setCurrentRoute}
        onSelectTicker={setSelectedTicker}
      />

      {/* 3. Cosmic Space Grid Overlay */}
      <div className="cosmic-grid" />

      {/* 4. Infinite Indices Marquee Ticker */}
      <div className="w-full bg-space-950/80 backdrop-blur border-b border-white/5 py-2 overflow-hidden z-40 text-xs font-mono">
        <div className="flex w-max animate-marquee space-x-12 whitespace-nowrap">
          <div className="flex space-x-8">
            <span className="flex space-x-2">
              <span className="text-zinc-500 font-semibold">S&P 5520.40</span>
              <span className="text-emerald-500 font-bold">+0.85%</span>
            </span>
            <span className="flex space-x-2">
              <span className="text-zinc-500 font-semibold">NASDAQ 18640.20</span>
              <span className="text-emerald-500 font-bold">+1.24%</span>
            </span>
            <span className="flex space-x-2">
              <span className="text-zinc-500 font-semibold">DOW 39820.60</span>
              <span className="text-red-500 font-bold">-0.12%</span>
            </span>
            <span className="flex space-x-2">
              <span className="text-zinc-500 font-semibold">BTC/USD 68,520.10</span>
              <span className="text-emerald-500 font-bold">+2.45%</span>
            </span>
            <span className="flex space-x-2">
              <span className="text-zinc-500 font-semibold">ETH/USD 3,820.50</span>
              <span className="text-emerald-500 font-bold">+3.12%</span>
            </span>
          </div>
          {/* Loop duplicates for marquee flow */}
          <div className="flex space-x-8">
            <span className="flex space-x-2">
              <span className="text-zinc-500 font-semibold">S&P 5520.40</span>
              <span className="text-emerald-500 font-bold">+0.85%</span>
            </span>
            <span className="flex space-x-2">
              <span className="text-zinc-500 font-semibold">NASDAQ 18640.20</span>
              <span className="text-emerald-500 font-bold">+1.24%</span>
            </span>
            <span className="flex space-x-2">
              <span className="text-zinc-500 font-semibold">DOW 39820.60</span>
              <span className="text-red-500 font-bold">-0.12%</span>
            </span>
            <span className="flex space-x-2">
              <span className="text-zinc-500 font-semibold">BTC/USD 68,520.10</span>
              <span className="text-emerald-500 font-bold">+2.45%</span>
            </span>
            <span className="flex space-x-2">
              <span className="text-zinc-500 font-semibold">ETH/USD 3,820.50</span>
              <span className="text-emerald-500 font-bold">+3.12%</span>
            </span>
          </div>
        </div>
      </div>

      {/* 5. Sticky Navbar */}
      <header className="sticky top-0 bg-black/40 backdrop-blur-md border-b border-white/5 z-40 transition-colors duration-500">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cosmic-indigo to-cosmic-teal flex items-center justify-center shadow-lg shadow-cosmic-indigo/20">
              <Sparkles className="w-4 h-4 text-white animate-spin" style={{ animationDuration: '6s' }} />
            </div>
            <span className="font-bold tracking-wider text-white text-base font-mono">TRADESPHERE</span>
          </div>

          {/* Navigation Route Menu (with line indicators) */}
          <nav className="hidden md:flex space-x-8 text-xs font-mono font-semibold">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: Globe },
              { id: 'trading', label: 'Live Trading', icon: TrendingUp },
              { id: 'education', label: 'Academy', icon: BookOpen },
              { id: 'news', label: 'News Feed', icon: Globe },
            ].map((route) => {
              const Icon = route.icon;
              const isActive = currentRoute === route.id;
              return (
                <button
                  key={route.id}
                  onClick={() => setCurrentRoute(route.id)}
                  className={`flex items-center space-x-1.5 py-5 border-b-2 relative transition-all duration-300 cursor-none ${isActive ? 'text-white border-cosmic-teal' : 'text-zinc-500 border-transparent hover:text-zinc-300'}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{route.label}</span>
                </button>
              );
            })}
          </nav>

          {/* User Auth Action triggers */}
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="hidden lg:flex items-center space-x-1.5 border border-white/5 bg-white/5 px-2.5 py-1.5 rounded-md text-[10px] font-mono text-zinc-500 hover:text-white transition-colors cursor-none"
            >
              <Command className="w-3.5 h-3.5" />
              <span>Ctrl + K</span>
            </button>

            {user ? (
              <div className="flex items-center space-x-3 text-xs font-mono">
                {/* User role student pill */}
                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${user.role === 'student' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-cosmic-teal/10 text-cosmic-teal border border-cosmic-teal/20'}`}>
                  {user.role}
                </span>
                
                {/* Security link */}
                <button
                  onClick={() => setCurrentRoute('security')}
                  className={`text-zinc-500 hover:text-white transition-colors flex items-center space-x-1 cursor-none ${currentRoute === 'security' ? 'text-white' : ''}`}
                  title="Security Logs"
                >
                  <Shield className="w-4 h-4" />
                </button>

                {/* Logout */}
                <button
                  onClick={handleLogout}
                  className="text-zinc-500 hover:text-red-400 transition-colors flex items-center space-x-1 cursor-none"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              // Open login gate directly if offline or unauthenticated
              <button
                onClick={() => {
                  // Direct bypass trigger if auth route failed,
                  // or show login box modal. We will scroll/trigger layout
                }}
                className="bg-white hover:bg-zinc-200 text-black px-4 py-1.5 rounded-lg text-xs font-bold font-mono tracking-wide transition-all shadow-md cursor-none"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 6. Main Routing Layout viewport */}
      <main className="max-w-7xl mx-auto px-6 mt-8 flex-1 w-full z-10">
        
        {/* Auth Gate Page if unauthenticated */}
        {!user ? (
          <div className="max-w-md mx-auto my-[10vh] glass-panel p-6 rounded-xl border border-white/5 relative overflow-hidden flex flex-col space-y-6 animate-float-slow">
            <div className="absolute top-0 right-0 w-[150px] h-[150px] bg-cosmic-teal/5 blur-[80px] rounded-full pointer-events-none" />

            <div className="text-center space-y-1">
              <Lock className="w-10 h-10 text-cosmic-indigo mx-auto mb-2" />
              <h2 className="text-xl font-bold tracking-tight text-white uppercase font-mono">Sign In to TradeSphere</h2>
              <p className="text-xs text-zinc-500">Access live paper trading, curriculums, and logs.</p>
            </div>

            {/* MFA Login Verification */}
            {tempMfaToken ? (
              <form onSubmit={handleMfaLogin} className="space-y-4 text-xs font-mono">
                <div className="space-y-1.5">
                  <label className="text-zinc-500">MFA Verification Passcode</label>
                  <input
                    type="text"
                    placeholder="Enter 6-digit TOTP code"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    className="w-full bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-white outline-none focus:border-cosmic-indigo text-center tracking-widest text-lg cursor-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-cosmic-indigo hover:bg-indigo-600 text-white py-2.5 rounded-lg font-semibold tracking-wide transition-colors cursor-none"
                >
                  Verify TOTP Code
                </button>
              </form>
            ) : (
              // Standard Email/Password Form
              <form onSubmit={authMode === 'login' ? handleLogin : handleRegister} className="space-y-4 text-xs font-mono">
                <div className="space-y-1.5">
                  <label className="text-zinc-500">Email Address</label>
                  <input
                    type="email"
                    placeholder="name@domain.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-white outline-none focus:border-cosmic-indigo cursor-none font-sans"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-zinc-500">Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-white outline-none focus:border-cosmic-indigo cursor-none font-sans"
                  />
                </div>

                {authError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs leading-relaxed">
                    {authError}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-cosmic-indigo hover:bg-indigo-600 text-white py-2.5 rounded-lg font-semibold tracking-wide transition-colors cursor-none"
                >
                  {authMode === 'login' ? 'Login to Portfolio' : 'Create Trader Account'}
                </button>
              </form>
            )}

            {/* SSO Mock buttons */}
            {!tempMfaToken && (
              <div className="space-y-3">
                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-white/5"></div>
                  <span className="flex-shrink mx-4 text-zinc-600 text-[10px] font-mono uppercase">Or SSO Student Link</span>
                  <div className="flex-grow border-t border-white/5"></div>
                </div>

                <button
                  onClick={handleGithubLogin}
                  className="w-full bg-zinc-900 border border-white/5 hover:bg-zinc-800 text-zinc-300 hover:text-white py-2 rounded-lg font-mono text-xs font-semibold flex items-center justify-center space-x-2 transition-colors cursor-none"
                >
                  <Github className="w-4 h-4 text-white" />
                  <span>GitHub Student plan SSO</span>
                </button>

                <div className="text-center text-[11px] font-sans">
                  {authMode === 'login' ? (
                    <span className="text-zinc-500">
                      Need a new account?{' '}
                      <button onClick={() => setAuthMode('register')} className="text-cosmic-teal underline font-semibold hover:text-white cursor-none">
                        Register
                      </button>
                    </span>
                  ) : (
                    <span className="text-zinc-500">
                      Already registered?{' '}
                      <button onClick={() => setAuthMode('login')} className="text-cosmic-teal underline font-semibold hover:text-white cursor-none">
                        Login
                      </button>
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          // Authenticated Pages
          <div className="space-y-8 animate-float-fast">
            
            {/* Route 1: Dashboard Home */}
            {currentRoute === 'dashboard' && (
              <div className="space-y-8">
                {/* Hero Candlestick stream layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
                  <div className="space-y-4 lg:col-span-1">
                    <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest flex items-center">
                      <Sparkles className="w-3.5 h-3.5 text-cosmic-teal mr-1.5 animate-pulse" />
                      Paper Trading SaaS
                    </span>
                    <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-[1.15]">
                      Simulate Financial Spreads With Zero Risk.
                    </h1>
                    <p className="text-sm text-zinc-400 font-sans leading-relaxed">
                      TradeSphere bridges professional analytics tools with risk-free learning sandboxes. Experience live indices charts, margin simulations, and quizzes.
                    </p>

                    <div className="flex space-x-3 pt-2">
                      <button
                        onClick={() => setCurrentRoute('trading')}
                        className="bg-gradient-to-r from-cosmic-indigo to-cosmic-violet hover:brightness-110 text-white font-bold text-xs font-mono tracking-wider uppercase px-5 py-2.5 rounded-lg transition-all shadow-lg shadow-cosmic-indigo/25 flex items-center space-x-2 cursor-none"
                      >
                        <span>Start Trading</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Hero lightweight chart component */}
                  <div className="lg:col-span-2">
                    <TradingViewCanvas 
                      ticker={selectedTicker}
                      onPriceTick={setTickerPrice}
                    />
                  </div>
                </div>

                {/* Telemetry Bento Grid */}
                <BentoGrid />

                {/* Metrics Dashboard */}
                <MetricsPanel />

                {/* Interactive Pricing Toggle (Student vs Trader) */}
                <div className="glass-panel p-6 rounded-xl border border-white/5 relative overflow-hidden flex flex-col items-center text-center space-y-6">
                  <div className="absolute top-0 right-0 w-[180px] h-[180px] bg-cosmic-teal/5 blur-[90px] rounded-full pointer-events-none" />

                  <div className="space-y-2">
                    <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Platform Pricing</span>
                    <h3 className="text-xl font-bold text-white font-mono">Flexible Plans for Learners & Traders</h3>
                  </div>

                  {/* Switch */}
                  <div className="flex items-center space-x-3 bg-white/5 p-1 rounded-lg border border-white/5 text-xs font-mono">
                    <button
                      onClick={() => setPricingCycle('monthly')}
                      className={`px-3 py-1.5 rounded-md transition-all cursor-none ${pricingCycle === 'monthly' ? 'bg-cosmic-indigo text-white shadow' : 'text-zinc-500 hover:text-white'}`}
                    >
                      Monthly Bill
                    </button>
                    <button
                      onClick={() => setPricingCycle('yearly')}
                      className={`px-3 py-1.5 rounded-md transition-all cursor-none ${pricingCycle === 'yearly' ? 'bg-cosmic-indigo text-white shadow' : 'text-zinc-500 hover:text-white'}`}
                    >
                      Yearly (-20%)
                    </button>
                  </div>

                  {/* Pricing grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl text-left font-sans text-xs">
                    {/* Student plan */}
                    <div className="glass-panel p-5 rounded-lg border border-white/5 flex flex-col justify-between space-y-4">
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-white uppercase font-mono">Student Academy</span>
                          <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded text-[9px] font-bold">OAuth Verified</span>
                        </div>
                        <div className="text-xl font-bold text-white font-mono mt-1">
                          ${pricingCycle === 'monthly' ? '0.00' : '0.00'} <span className="text-zinc-600 text-xs">/ mo</span>
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-1">Free access when authenticated via GitHub Student Developer plan credentials.</p>
                      </div>
                      <ul className="space-y-1.5 text-zinc-400 font-mono text-[10px]">
                        <li>✓ Access to Custom Stream Video Academy</li>
                        <li>✓ Interactive Support/Resistance Quizzes</li>
                        <li>✓ In-Memory Paper Ledger Sandbox</li>
                      </ul>
                    </div>

                    {/* Trader Plan */}
                    <div className="glass-panel p-5 rounded-lg border border-white/10 bg-white/5 flex flex-col justify-between space-y-4 relative">
                      <div className="absolute top-0 right-0 bg-cosmic-teal text-black px-2 py-0.5 rounded-bl text-[8px] font-bold uppercase tracking-widest font-mono">Popular</div>
                      <div className="space-y-1">
                        <span className="font-bold text-white uppercase font-mono">Professional Trader</span>
                        <div className="text-xl font-bold text-white font-mono mt-1">
                          ${pricingCycle === 'monthly' ? '19.00' : '15.00'} <span className="text-zinc-600 text-xs">/ mo</span>
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-1">Full-scale real-time telemetry analytics platform with custom indices integrations.</p>
                      </div>
                      <ul className="space-y-1.5 text-zinc-400 font-mono text-[10px]">
                        <li>✓ Sourcing Live Data Feed WebSockets</li>
                        <li>✓ Limit/Market orders + SL/TP Margin triggers</li>
                        <li>✓ Sharpe Ratio & Audit Performance telemetries</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Route 2: Trading terminal view */}
            {currentRoute === 'trading' && (
              <div className="space-y-6">
                {/* Watchlist Quick Selection header */}
                <div className="glass-panel p-3.5 rounded-xl border border-white/5 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-mono text-zinc-500 uppercase mr-2">Asset Watchlist:</span>
                    {['BTC', 'ETH', 'AAPL', 'TSLA', 'MSFT', 'NVDA'].map((t) => (
                      <button
                        key={t}
                        onClick={() => setSelectedTicker(t)}
                        className={`px-3 py-1 rounded-md text-xs font-mono font-bold transition-all cursor-none ${selectedTicker === t ? 'bg-cosmic-teal text-black shadow-md' : 'bg-white/5 text-zinc-400 hover:text-white'}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  
                  <div className="text-xs font-mono text-zinc-400 flex items-center space-x-1.5">
                    <span>Active Spread Price:</span>
                    <span className="text-white font-bold">${tickerPrice.toLocaleString()}</span>
                  </div>
                </div>

                {/* Lightweight Chart canvas */}
                <TradingViewCanvas 
                  ticker={selectedTicker}
                  activeOrders={orders}
                  onPriceTick={setTickerPrice}
                />

                {/* Account details and Order Ticket */}
                <PortfolioLedger 
                  selectedTicker={selectedTicker}
                  onSelectTicker={setSelectedTicker}
                  lastTickPrice={tickerPrice}
                  onOrderPlaced={fetchOrders}
                />
              </div>
            )}

            {/* Route 3: Video Hub and interactive Quiz */}
            {currentRoute === 'education' && (
              <div className="space-y-8">
                <div>
                  <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Education Academy</span>
                  <h2 className="text-2xl font-bold text-white mt-1">Interactive Learning Modules</h2>
                </div>

                {/* Minimalist custom player block */}
                <MinimalPlayer 
                  videoUrl="https://www.youtube.com/watch?id=reversal-zones-lesson" 
                />

                {/* Support/Resistance coordinate quiz block */}
                <CourseQuizzes />
              </div>
            )}

            {/* Route 4: Realtime news feed */}
            {currentRoute === 'news' && (
              <div className="space-y-6">
                <div>
                  <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Industry Feed</span>
                  <h2 className="text-2xl font-bold text-white mt-1">Real-Time Market Headlines</h2>
                  <p className="text-xs text-zinc-400 mt-1">Stay updated with standard parsed Yahoo news. Sentiment badges calculated dynamically.</p>
                </div>

                <NewsFeed />
              </div>
            )}

            {/* Route 5: Security / session audit logs */}
            {currentRoute === 'security' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 2FA setup */}
                <div className="glass-panel p-5 rounded-xl border border-white/5 h-fit flex flex-col space-y-4">
                  <div>
                    <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest text-cosmic-violet">Authentication Security</span>
                    <h3 className="text-base font-bold text-white mt-1">Setup Multi-Factor Auth (MFA)</h3>
                  </div>

                  {user.mfaEnabled ? (
                    <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center space-x-2 text-xs font-mono font-semibold">
                      <ShieldCheck className="w-5 h-5 shrink-0" />
                      <span>2FA MFA TOTP protection is ACTIVE.</span>
                    </div>
                  ) : mfaQr ? (
                    <form onSubmit={verifyMfaSetup} className="space-y-4 text-xs font-mono">
                      <p className="text-zinc-400 leading-relaxed">Scan the QR code below inside Google Authenticator or Microsoft Authenticator, then verify the code:</p>
                      
                      <div className="bg-white p-3 rounded-lg w-fit mx-auto border border-white/10">
                        <img src={mfaQr} alt="MFA QR Code" className="w-[160px] h-[160px] block" />
                      </div>

                      <div className="space-y-1">
                        <label className="text-zinc-500">MFA Code</label>
                        <input
                          type="text"
                          placeholder="e.g. 123456"
                          value={mfaSetupCode}
                          onChange={(e) => setMfaSetupCode(e.target.value)}
                          className="w-full bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-white outline-none focus:border-cosmic-indigo text-center tracking-widest text-base cursor-none"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full bg-cosmic-indigo hover:bg-indigo-600 text-white py-2 rounded-lg font-semibold transition-colors cursor-none"
                      >
                        Verify & Enable 2FA
                      </button>
                    </form>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-zinc-400 text-xs leading-relaxed">Secure your TradeSphere paper balance account using Speakeasy TOTP dynamic login passcodes.</p>
                      <button
                        onClick={initiateMfaSetup}
                        className="w-full bg-cosmic-indigo hover:bg-indigo-600 text-white py-2 rounded-lg text-xs font-semibold font-mono tracking-wide transition-colors cursor-none"
                      >
                        Generate MFA Secret QR
                      </button>
                    </div>
                  )}
                </div>

                {/* Audit table */}
                <div className="lg:col-span-2 glass-panel p-5 rounded-xl border border-white/5">
                  <h3 className="text-sm font-semibold tracking-wide text-white mb-4 flex items-center font-mono uppercase">
                    <Shield className="w-4 h-4 text-cosmic-violet mr-2 animate-pulse" />
                    Session Activity Audit Log
                  </h3>

                  <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-left border-collapse text-xs font-mono">
                      <thead>
                        <tr className="border-b border-white/5 text-zinc-500 uppercase text-[10px] tracking-wider">
                          <th className="p-3 font-semibold">Login Time</th>
                          <th className="p-3 font-semibold">IP Address</th>
                          <th className="p-3 font-semibold">User Agent</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-zinc-400">
                        {sessionLogs.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="p-4 text-center text-zinc-600">No session login audits found.</td>
                          </tr>
                        ) : (
                          sessionLogs.map((log, i) => (
                            <tr key={i} className="hover:bg-white/5 transition-colors">
                              <td className="p-3 text-zinc-500">
                                {new Date(log.login_time).toLocaleString()}
                              </td>
                              <td className="p-3 text-white">{log.ip_address}</td>
                              <td className="p-3 truncate max-w-[200px]" title={log.user_agent}>
                                {log.user_agent}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
