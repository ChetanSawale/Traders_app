import { EventEmitter } from 'events';
import { cache } from '../redis/redis.js';

export interface TickerPrice {
  ticker: string;
  price: number;
  changePercent: number;
  high: number;
  low: number;
  prevClose: number;
  timestamp: number;
}

export const feedEvents = new EventEmitter();

const TICKERS = ['AAPL', 'TSLA', 'MSFT', 'NVDA', 'BTC', 'ETH'];

const INITIAL_PRICES: Record<string, number> = {
  AAPL: 180.50,
  TSLA: 175.20,
  MSFT: 420.10,
  NVDA: 950.00,
  BTC: 68500.00,
  ETH: 3800.00,
};

let currentPrices: Record<string, TickerPrice> = {};

// Initialize prices
for (const ticker of TICKERS) {
  const base = INITIAL_PRICES[ticker];
  currentPrices[ticker] = {
    ticker,
    price: base,
    changePercent: 0,
    high: base * 1.01,
    low: base * 0.99,
    prevClose: base,
    timestamp: Date.now(),
  };
}

// Fetch crypto from Binance
async function fetchBinancePrice(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}USDT`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = (await res.json()) as { price: string };
    const price = parseFloat(data.price);
    return isNaN(price) ? null : price;
  } catch (err) {
    // Silently log or handle in fallback
    return null;
  }
}

// Fetch stock from Yahoo Finance
async function fetchYahooPrice(symbol: string): Promise<{ price: number; prevClose: number } | null> {
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = (await res.json()) as any;
    const meta = data?.chart?.result?.[0]?.meta;
    if (meta) {
      const price = meta.regularMarketPrice;
      const prevClose = meta.chartPreviousClose || price;
      return { price, prevClose };
    }
    return null;
  } catch (err) {
    return null;
  }
}

// Update prices via API or Simulation fallback
async function updatePrices() {
  for (const ticker of TICKERS) {
    const prev = currentPrices[ticker];
    let newPrice: number | null = null;
    let prevClose = prev.prevClose;

    if (ticker === 'BTC' || ticker === 'ETH') {
      newPrice = await fetchBinancePrice(ticker);
    } else {
      const yahooData = await fetchYahooPrice(ticker);
      if (yahooData) {
        newPrice = yahooData.price;
        prevClose = yahooData.prevClose;
      }
    }

    // Stochastic Random Walk Fallback if APIs are offline/rate-limited
    if (newPrice === null) {
      const volatility = ticker === 'BTC' || ticker === 'ETH' ? 0.0015 : 0.0008;
      const drift = 0.00005;
      const change = prev.price * (drift + volatility * (Math.random() - 0.5));
      newPrice = prev.price + change;
    }

    const changePercent = ((newPrice - prevClose) / prevClose) * 100;
    const timestamp = Date.now();

    const updated: TickerPrice = {
      ticker,
      price: Number(newPrice.toFixed(2)),
      changePercent: Number(changePercent.toFixed(2)),
      high: Number(Math.max(prev.high, newPrice).toFixed(2)),
      low: Number(Math.min(prev.low, newPrice).toFixed(2)),
      prevClose: Number(prevClose.toFixed(2)),
      timestamp,
    };

    currentPrices[ticker] = updated;

    // Cache current price in Redis for faster lookups
    await cache.set(`price:${ticker}`, JSON.stringify(updated), 60);

    // Emit event for WebSocket and order matching engine
    feedEvents.emit('tick', updated);
  }
}

let updateInterval: NodeJS.Timeout | null = null;

export function startLiveFeeds(intervalMs = 2000) {
  if (updateInterval) return;
  console.log(`Starting Live Market Feed cycle (interval: ${intervalMs}ms)...`);
  
  // Run immediately then schedule
  updatePrices().catch(console.error);
  updateInterval = setInterval(() => {
    updatePrices().catch(console.error);
  }, intervalMs);
}

export function stopLiveFeeds() {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
    console.log('Live Market Feed cycle stopped.');
  }
}

export function getLatestPrices(): Record<string, TickerPrice> {
  return currentPrices;
}

export function getPriceForTicker(ticker: string): TickerPrice | undefined {
  return currentPrices[ticker];
}
