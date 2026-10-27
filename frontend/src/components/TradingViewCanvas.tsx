import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import type { ISeriesApi, UTCTimestamp } from 'lightweight-charts';

interface TradingViewCanvasProps {
  ticker: string;
  wsUrl?: string;
  activeOrders?: Array<{ id: number; ticker: string; price: number; side: string; type: string }>;
  onPriceTick?: (price: number) => void;
}

export default function TradingViewCanvas({ ticker, wsUrl, activeOrders = [], onPriceTick }: TradingViewCanvasProps) {
  // Same-origin WebSocket: works behind the nginx proxy on Render and in Docker Compose.
  // Only falls back to localhost for local dev without a proxy.
  const effectiveWsUrl = wsUrl ?? (typeof window !== 'undefined'
    ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
    : 'ws://localhost:3001/ws');
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [priceLines, setPriceLines] = useState<any[]>([]);

  // 1. Initialize Lightweight Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#a1a1aa',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.02)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.02)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.05)',
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.05)',
        timeVisible: true,
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
    });

    // Add Candlestick Series
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#2E9E62',
      downColor: '#C94A3A',
      borderVisible: false,
      wickUpColor: '#2E9E62',
      wickDownColor: '#C94A3A',
    });

    seriesRef.current = candleSeries;
    chartRef.current = chart;

    // Generate historical baseline data
    const generateHistoricalData = () => {
      const data = [];
      let time = Math.floor(Date.now() / 1000) - 300 * 60; // 300 minutes ago
      let close = ticker === 'BTC' ? 68000 : ticker === 'ETH' ? 3800 : ticker === 'AAPL' ? 180 : 170;

      for (let i = 0; i < 300; i++) {
        const open = close + (Math.random() - 0.5) * (close * 0.002);
        const high = Math.max(open, close) + Math.random() * (close * 0.001);
        const low = Math.min(open, close) - Math.random() * (close * 0.001);
        close = open + (Math.random() - 0.5) * (close * 0.002);

        data.push({
          time: time as UTCTimestamp,
          open: Number(open.toFixed(2)),
          high: Number(high.toFixed(2)),
          low: Number(low.toFixed(2)),
          close: Number(close.toFixed(2)),
        });
        time += 60;
      }
      return data;
    };

    const historical = generateHistoricalData();
    candleSeries.setData(historical);
    chart.timeScale().fitContent();

    // Handle Resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.resize(chartContainerRef.current.clientWidth, 400);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [ticker]);

  // 2. Manage WebSocket Streaming and Ticker Updates
  useEffect(() => {
    let lastCandleTime = 0;
    let currentCandle: any = null;

    const connectWebSocket = () => {
      console.log('Connecting to WebSocket live price ticks...');
      const socket = new WebSocket(effectiveWsUrl);
      socketRef.current = socket;

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'tick' && message.data.ticker === ticker) {
            const tick = message.data;
            const price = tick.price;
            setCurrentPrice(price);
            setPriceChange(tick.changePercent);
            if (onPriceTick) onPriceTick(price);

            // Update chart series
            if (seriesRef.current) {
              const now = Math.floor(Date.now() / 1000);
              const minuteTime = Math.floor(now / 60) * 60;

              if (minuteTime !== lastCandleTime) {
                // New minute candle
                lastCandleTime = minuteTime;
                currentCandle = {
                  time: minuteTime as UTCTimestamp,
                  open: price,
                  high: price,
                  low: price,
                  close: price,
                };
              } else if (currentCandle) {
                // Update current minute candle
                currentCandle.high = Math.max(currentCandle.high, price);
                currentCandle.low = Math.min(currentCandle.low, price);
                currentCandle.close = price;
              }

              if (currentCandle) {
                seriesRef.current.update(currentCandle);
              }
            }
          }
        } catch (err) {
          // Ignore parse errors
        }
      };

      socket.onerror = (e) => {
        console.warn('WebSocket connection error, retrying in 5 seconds...', e);
      };

      socket.onclose = () => {
        console.log('WebSocket connection closed, scheduling reconnect...');
        setTimeout(connectWebSocket, 5000);
      };
    };

    connectWebSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.onclose = null;
        socketRef.current.close();
      }
    };
  }, [ticker, wsUrl]);

  // 3. Draw Pending Order Limit/Stop/Profit Lines
  useEffect(() => {
    if (!seriesRef.current) return;

    // Clear old price lines
    priceLines.forEach((line) => {
      try {
        seriesRef.current?.removePriceLine(line);
      } catch (err) {
        // Ignore
      }
    });

    const newLines: any[] = [];

    activeOrders
      .filter((o) => o.ticker === ticker)
      .forEach((order) => {
        const color = order.side === 'BUY' || order.side === 'BUY_TO_COVER' ? '#2E9E62' : '#C94A3A';
        try {
          const line = seriesRef.current?.createPriceLine({
            price: order.price,
            color: color,
            lineWidth: 1,
            lineStyle: 1, // Dashed line
            axisLabelVisible: true,
            title: `${order.side} ${order.type} @ $${order.price}`,
          });
          if (line) newLines.push(line);
        } catch (err) {
          // Ignore
        }
      });

    setPriceLines(newLines);
  }, [activeOrders, ticker]);

  return (
    <div className="glass-panel p-4 rounded-xl border border-white/5 relative overflow-hidden">
      {/* Background glow behind charts */}
      <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-terminal-accent/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Header telemetry details */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Active Stream</span>
          <div className="flex items-baseline space-x-3 mt-1">
            <h2 className="text-2xl font-bold tracking-tight text-white">{ticker}/USD</h2>
            <span className={`text-2xl font-mono font-bold tracking-wide ${currentPrice ? 'text-white' : 'text-zinc-600'}`}>
              {currentPrice ? `$${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : 'Connecting...'}
            </span>
            <span className={`text-sm font-mono font-semibold ${priceChange >= 0 ? 'text-terminal-bull' : 'text-red-500'}`}>
              {priceChange >= 0 ? '+' : ''}{priceChange}%
            </span>
          </div>
        </div>

        <div className="flex space-x-2 text-zinc-400">
          <div className="flex items-center space-x-1 border border-white/5 bg-white/5 px-2.5 py-1 rounded-md text-xs font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-terminal-bull animate-ping mr-1" />
            <span>LIVE FEED</span>
          </div>
        </div>
      </div>

      {/* Chart Render Canvas Target */}
      <div ref={chartContainerRef} className="w-full relative min-h-[400px] z-10" />

      {/* Order limits overlay information */}
      {activeOrders.filter(o => o.ticker === ticker).length > 0 && (
        <div className="mt-4 pt-3 border-t border-white/5 flex flex-wrap gap-2 text-xs font-mono text-zinc-400">
          <span className="text-zinc-500 uppercase mr-1 mt-0.5">Active triggers:</span>
          {activeOrders
            .filter((o) => o.ticker === ticker)
            .map((o) => (
              <span key={o.id} className="bg-white/5 px-2 py-0.5 rounded border border-white/5">
                {o.side} {o.type} @ ${o.price}
              </span>
            ))}
        </div>
      )}
    </div>
  );
}
