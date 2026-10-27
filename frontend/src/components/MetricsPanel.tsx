import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Percent, TrendingUp, TrendingDown, Target, Zap } from 'lucide-react';

interface PerformanceMetrics {
  win_rate: number;
  profit_factor: number;
  sharpe_ratio: number;
  max_drawdown: number;
  total_trades: number;
  wins: number;
  losses: number;
}

interface EquityPoint {
  net_asset_value: number;
  timestamp: string;
}

export default function MetricsPanel() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    win_rate: 0,
    profit_factor: 0,
    sharpe_ratio: 0,
    max_drawdown: 0,
    total_trades: 0,
    wins: 0,
    losses: 0,
  });
  const [equity, setEquity] = useState<EquityPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const fetchMetricsAndEquity = async () => {
    setLoading(true);
    try {
      const metricsRes = await fetch('/api/trading/metrics');
      const equityRes = await fetch('/api/trading/equity-curve');
      
      if (metricsRes.ok && equityRes.ok) {
        const mData = await metricsRes.json();
        const eData = await equityRes.json();
        setMetrics(mData);
        setEquity(eData);
      }
    } catch (e) {
      // Offline default mocks
      setEquity(generateMockEquity());
    } finally {
      setLoading(false);
    }
  };

  const generateMockEquity = () => {
    const arr = [];
    let val = 100000;
    const now = Date.now();
    for (let i = 0; i < 30; i++) {
      val += val * (0.006 * (Math.random() - 0.46));
      arr.push({
        net_asset_value: val,
        timestamp: new Date(now - (30 - i) * 24 * 3600 * 1000).toISOString()
      });
    }
    return arr;
  };

  useEffect(() => {
    fetchMetricsAndEquity();
  }, []);

  // 1. Draw Canvas Equity Line Graph
  useEffect(() => {
    if (equity.length === 0 || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI screens
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    ctx.clearRect(0, 0, width, height);

    // Compute bounds
    const vals = equity.map(p => p.net_asset_value);
    const minVal = Math.min(...vals) * 0.995;
    const maxVal = Math.max(...vals) * 1.005;
    const valRange = maxVal - minVal;

    const padding = 20;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    // Graph points mapping
    const points = equity.map((p, idx) => {
      const x = padding + (idx / (equity.length - 1)) * chartWidth;
      const y = padding + chartHeight - ((p.net_asset_value - minVal) / valRange) * chartHeight;
      return { x, y };
    });

    // 2. Draw Shading Area Gradient below Curve
    ctx.beginPath();
    ctx.moveTo(points[0].x, height - padding);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, height - padding);
    ctx.closePath();

    const areaGlow = ctx.createLinearGradient(0, 0, 0, height);
    areaGlow.addColorStop(0, 'rgba(226, 166, 61, 0.25)');   // Signal amber
    areaGlow.addColorStop(0.5, 'rgba(226, 166, 61, 0.08)'); // Signal amber fade
    areaGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = areaGlow;
    ctx.fill();

    // 3. Draw Line Curve
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      // Bezier curve calculations for organic smoothing
      const xc = (points[i - 1].x + points[i].x) / 2;
      const yc = (points[i - 1].y + points[i].y) / 2;
      ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    
    const lineGlow = ctx.createLinearGradient(0, 0, width, 0);
    lineGlow.addColorStop(0, '#E2A63D');
    lineGlow.addColorStop(0.5, '#E2A63D');
    lineGlow.addColorStop(1, '#E2A63D');
    ctx.strokeStyle = lineGlow;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Draw grid bounds guide lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(width - padding, padding);
    ctx.moveTo(padding, padding + chartHeight / 2);
    ctx.lineTo(width - padding, padding + chartHeight / 2);
    ctx.moveTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    // Text labels
    ctx.fillStyle = '#71717a';
    ctx.font = '10px JetBrains Mono';
    ctx.fillText(`$${maxVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, padding, padding - 5);
    ctx.fillText(`$${minVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, padding, height - padding + 15);
  }, [equity]);

  return (
    <div className="space-y-6">
      {/* Telemetry Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Win Rate */}
        <div className="glass-panel p-4 rounded-xl border border-white/5 relative overflow-hidden flex flex-col justify-between h-[100px] animate-float-fast">
          <div className="flex justify-between items-center text-zinc-500 font-mono text-[10px] uppercase tracking-widest">
            <span>Win Rate</span>
            <Percent className="w-3.5 h-3.5 text-terminal-accent" />
          </div>
          <div className="text-2xl font-bold text-white font-mono mt-1">
            {loading ? '...' : `${metrics.win_rate}%`}
          </div>
          <span className="text-[10px] text-zinc-600 font-mono">
            {metrics.wins} W / {metrics.losses} L
          </span>
        </div>

        {/* Profit Factor */}
        <div className="glass-panel p-4 rounded-xl border border-white/5 relative overflow-hidden flex flex-col justify-between h-[100px] animate-float-fast" style={{ animationDelay: '0.1s' }}>
          <div className="flex justify-between items-center text-zinc-500 font-mono text-[10px] uppercase tracking-widest">
            <span>Profit Factor</span>
            <Target className="w-3.5 h-3.5 text-terminal-accent" />
          </div>
          <div className="text-2xl font-bold text-white font-mono mt-1">
            {loading ? '...' : metrics.profit_factor.toFixed(2)}
          </div>
          <span className="text-[10px] text-zinc-600 font-mono">Gross Gain / Loss</span>
        </div>

        {/* Sharpe Ratio */}
        <div className="glass-panel p-4 rounded-xl border border-white/5 relative overflow-hidden flex flex-col justify-between h-[100px] animate-float-fast" style={{ animationDelay: '0.2s' }}>
          <div className="flex justify-between items-center text-zinc-500 font-mono text-[10px] uppercase tracking-widest">
            <span>Sharpe Ratio</span>
            <Zap className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-white font-mono mt-1">
            {loading ? '...' : metrics.sharpe_ratio.toFixed(2)}
          </div>
          <span className="text-[10px] text-zinc-600 font-mono">Risk-Adjusted Return</span>
        </div>

        {/* Max Drawdown */}
        <div className="glass-panel p-4 rounded-xl border border-white/5 relative overflow-hidden flex flex-col justify-between h-[100px] animate-float-fast" style={{ animationDelay: '0.3s' }}>
          <div className="flex justify-between items-center text-zinc-500 font-mono text-[10px] uppercase tracking-widest">
            <span>Max Drawdown</span>
            <TrendingDown className="w-3.5 h-3.5 text-red-500" />
          </div>
          <div className="text-2xl font-bold text-white font-mono mt-1">
            {loading ? '...' : `${metrics.max_drawdown}%`}
          </div>
          <span className="text-[10px] text-zinc-600 font-mono">Peak-to-Trough Decline</span>
        </div>
      </div>

      {/* Equity Curve Panel */}
      <div className="glass-panel p-5 rounded-xl border border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[250px] h-[250px] bg-terminal-accent/5 blur-[100px] rounded-full pointer-events-none" />

        <div className="flex justify-between items-center mb-4">
          <div>
            <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Growth Telemetry</span>
            <h3 className="text-base font-bold text-white mt-1">Historical Equity Curve</h3>
          </div>

          <button
            onClick={fetchMetricsAndEquity}
            disabled={loading}
            className="p-1 rounded-md hover:bg-white/5 text-zinc-500 hover:text-white transition-colors cursor-none"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Custom Canvas Line Graph */}
        <div className="w-full h-[240px] relative">
          <canvas ref={canvasRef} className="w-full h-full block" />
        </div>
        
        <div className="flex justify-between items-center mt-2 px-5 text-[10px] font-mono text-zinc-600">
          <span>30 Days Ago</span>
          <span>Today</span>
        </div>
      </div>
    </div>
  );
}
