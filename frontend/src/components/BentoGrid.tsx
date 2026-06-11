import { Activity, ShieldCheck, Zap, Library, Cpu, HelpCircle } from 'lucide-react';

export default function BentoGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-sans">
      {/* 1. Large Asymmetric Telemetry panel */}
      <div className="md:col-span-2 glass-panel p-5 rounded-xl border border-white/5 flex flex-col justify-between relative overflow-hidden group hover:border-white/10 transition-all duration-300">
        <div className="absolute top-0 right-0 w-[180px] h-[180px] bg-cosmic-indigo/5 blur-[90px] rounded-full pointer-events-none group-hover:bg-cosmic-indigo/8 transition-colors" />

        <div className="space-y-4">
          <div className="flex items-center space-x-2 text-cosmic-teal">
            <Cpu className="w-5 h-5 animate-pulse" />
            <span className="text-xs font-mono font-semibold uppercase tracking-wider">System Telemetry</span>
          </div>

          <h3 className="text-xl font-bold text-white tracking-tight leading-snug">
            Zero-Latency Order Matching & High Frequency Quote Aggregation.
          </h3>
          <p className="text-xs text-zinc-400 leading-relaxed max-w-lg">
            TradeSphere utilizes an in-memory execution pipeline hooked to live market API hooks. Pending limit orders are matched instantly as spreads intersect, ensuring actual trade slippage emulation.
          </p>
        </div>

        {/* Dynamic Telemetry Metric matrix */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-5 border-t border-white/5 font-mono text-zinc-500 text-[11px]">
          <div className="space-y-1">
            <span className="block uppercase text-[10px] text-zinc-600">Matching Speed</span>
            <span className="text-white font-bold text-sm">&lt; 2.5ms</span>
          </div>
          <div className="space-y-1">
            <span className="block uppercase text-[10px] text-zinc-600">Redis Read Latency</span>
            <span className="text-white font-bold text-sm">~ 0.8ms</span>
          </div>
          <div className="space-y-1">
            <span className="block uppercase text-[10px] text-zinc-600">WS Broadcast</span>
            <span className="text-white font-bold text-sm">60fps</span>
          </div>
        </div>
      </div>

      {/* 2. Security / Platform Certifications card */}
      <div className="glass-panel p-5 rounded-xl border border-white/5 flex flex-col justify-between relative overflow-hidden group hover:border-white/10 transition-all duration-300">
        <div className="absolute top-0 right-0 w-[120px] h-[120px] bg-cosmic-violet/5 blur-[60px] rounded-full pointer-events-none" />

        <div className="space-y-3">
          <div className="flex items-center space-x-2 text-cosmic-violet">
            <ShieldCheck className="w-5 h-5" />
            <span className="text-xs font-mono font-semibold uppercase tracking-wider">Session Security</span>
          </div>

          <h3 className="text-lg font-bold text-white tracking-tight leading-snug">
            Secure Session Sandboxing
          </h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            All user operations are protected with JWT cookies, rate limiting boundaries, and Google Antigravity-styled TOTP secondary MFA checks.
          </p>
        </div>

        <div className="mt-4 pt-3 border-t border-white/5 font-mono text-zinc-500 text-[11px] flex justify-between items-center">
          <span>Auth Encrypt</span>
          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold">
            HS256
          </span>
        </div>
      </div>

      {/* 3. Education hub bento block */}
      <div className="glass-panel p-5 rounded-xl border border-white/5 flex flex-col justify-between relative overflow-hidden group hover:border-white/10 transition-all duration-300">
        <div className="absolute top-0 right-0 w-[120px] h-[120px] bg-cosmic-magenta/5 blur-[60px] rounded-full pointer-events-none" />

        <div className="space-y-3">
          <div className="flex items-center space-x-2 text-cosmic-magenta">
            <Library className="w-5 h-5" />
            <span className="text-xs font-mono font-semibold uppercase tracking-wider">Trading Academy</span>
          </div>

          <h3 className="text-lg font-bold text-white tracking-tight leading-snug">
            Interactive Curriculums
          </h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Learn candlestick charting patterns through video training with custom controller overlays and support/resistance canvas quizes.
          </p>
        </div>

        <div className="mt-4 pt-3 border-t border-white/5 font-mono text-zinc-500 text-[11px] flex justify-between items-center">
          <span>Progress State</span>
          <span className="text-white font-semibold">PostgreSQL Saved</span>
        </div>
      </div>

      {/* 4. Quick Help / Guides bento block */}
      <div className="md:col-span-2 glass-panel p-5 rounded-xl border border-white/5 flex flex-col justify-between relative overflow-hidden group hover:border-white/10 transition-all duration-300">
        <div className="absolute top-0 right-0 w-[180px] h-[180px] bg-amber-500/5 blur-[90px] rounded-full pointer-events-none" />

        <div className="space-y-4">
          <div className="flex items-center space-x-2 text-amber-500">
            <HelpCircle className="w-5 h-5" />
            <span className="text-xs font-mono font-semibold uppercase tracking-wider">Quick Start Guide</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <h4 className="font-semibold text-white">1. Fund Your Portfolio</h4>
              <p className="text-zinc-400 text-[11px]">Every new account is automatically initialized with $100,000 in simulated cash, allowing zero-risk trades.</p>
            </div>
            <div className="space-y-1">
              <h4 className="font-semibold text-white">2. Place Limit/Market Orders</h4>
              <p className="text-zinc-400 text-[11px]">Select an asset (AAPL, BTC, ETH) and execute positions. Configure Stop-Loss & Take-Profit targets.</p>
            </div>
            <div className="space-y-1">
              <h4 className="font-semibold text-white">3. Review Performance</h4>
              <p className="text-zinc-400 text-[11px]">Track your overall Win Rate, Profit Factor, and Sharpe Ratio as the matching engine fills trades.</p>
            </div>
            <div className="space-y-1">
              <h4 className="font-semibold text-white">4. Unlock Command Palette</h4>
              <p className="text-zinc-400 text-[11px]">Use the global keyboard shortcut <span className="font-mono text-white border border-zinc-700 bg-zinc-900 rounded px-1 py-0.5">Ctrl + K</span> to quickly jump between assets.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
