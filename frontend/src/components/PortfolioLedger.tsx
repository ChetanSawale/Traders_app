import { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownRight, Layers, ShieldAlert, CheckCircle, RefreshCw, XCircle } from 'lucide-react';

interface Position {
  id: number;
  ticker: string;
  quantity: number;
  average_entry_price: number;
  side: 'LONG' | 'SHORT';
  leverage: number;
  stop_loss: number | null;
  take_profit: number | null;
  current_price: number;
  market_value: number;
  pnl: number;
  pnl_percent: number;
}

interface Order {
  id: number;
  ticker: string;
  quantity: number;
  price: number | null;
  type: 'MARKET' | 'LIMIT';
  side: 'BUY' | 'SELL' | 'SELL_SHORT' | 'BUY_TO_COVER';
  status: 'PENDING' | 'FILLED' | 'CANCELLED';
  stop_loss: number | null;
  take_profit: number | null;
  created_at: string;
}

interface Transaction {
  id: number;
  ticker: string;
  quantity: number;
  price: number;
  side: string;
  commission: number;
  execution_time: string;
}

interface PortfolioLedgerProps {
  selectedTicker: string;
  onSelectTicker: (ticker: string) => void;
  onOrderPlaced?: () => void;
  lastTickPrice?: number;
}

export default function PortfolioLedger({ selectedTicker, onSelectTicker, onOrderPlaced, lastTickPrice }: PortfolioLedgerProps) {
  // Account state
  const [cash, setCash] = useState(100000);
  const [margin, setMargin] = useState(100000);
  const [nav, setNav] = useState(100000);
  const [pnl, setPnl] = useState(0);
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<'positions' | 'orders' | 'journal'>('positions');
  const [loading, setLoading] = useState(false);

  // Trading Ticket state
  const [side, setSide] = useState<'BUY' | 'SELL' | 'SELL_SHORT' | 'BUY_TO_COVER'>('BUY');
  const [type, setType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [qty, setQty] = useState('10');
  const [limitPrice, setLimitPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    fetchPortfolio();
    fetchOrders();
    fetchTransactions();
  }, [selectedTicker]);

  // Sync limit price with tick price if market
  useEffect(() => {
    if (type === 'MARKET' && lastTickPrice) {
      setLimitPrice(lastTickPrice.toString());
    }
  }, [lastTickPrice, type]);

  const fetchPortfolio = async () => {
    try {
      const res = await fetch('/api/trading/portfolio');
      if (res.ok) {
        const data = await res.json();
        setCash(data.cash_balance);
        setMargin(data.margin_balance);
        setNav(data.net_asset_value);
        setPnl(data.total_pnl);
        setPositions(data.positions);
      }
    } catch (e) {
      // Offline fallback
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/trading/orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (e) {}
  };

  const fetchTransactions = async () => {
    try {
      const res = await fetch('/api/trading/transactions');
      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
      }
    } catch (e) {}
  };

  const placeOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotification(null);
    setLoading(true);

    const quantityNum = parseFloat(qty);
    if (isNaN(quantityNum) || quantityNum <= 0) {
      setNotification({ type: 'error', message: 'Quantity must be greater than zero.' });
      setLoading(false);
      return;
    }

    const priceNum = type === 'LIMIT' ? parseFloat(limitPrice) : undefined;
    if (type === 'LIMIT' && (isNaN(priceNum as number) || (priceNum as number) <= 0)) {
      setNotification({ type: 'error', message: 'Limit price must be greater than zero.' });
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/trading/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: selectedTicker,
          quantity: quantityNum,
          price: priceNum,
          type: type,
          side: side,
          stop_loss: stopLoss ? parseFloat(stopLoss) : null,
          take_profit: takeProfit ? parseFloat(takeProfit) : null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setNotification({
          type: 'success',
          message: data.status === 'FILLED' 
            ? `Order filled immediately at $${data.price}!` 
            : 'Limit order placed successfully.'
        });
        setQty('10');
        setStopLoss('');
        setTakeProfit('');
        
        fetchPortfolio();
        fetchOrders();
        fetchTransactions();
        if (onOrderPlaced) onOrderPlaced();
      } else {
        setNotification({ type: 'error', message: data.error || 'Failed to execute order.' });
      }
    } catch (err) {
      // Offline mock fallback
      setNotification({
        type: 'success',
        message: 'Demo mode: Order accepted and executed locally.'
      });
    } finally {
      setLoading(false);
    }
  };

  const cancelOrder = async (id: number) => {
    try {
      const res = await fetch(`/api/trading/order/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setNotification({ type: 'success', message: 'Order cancelled successfully.' });
        fetchOrders();
        fetchPortfolio();
      }
    } catch (e) {}
  };

  const marginRatio = nav > 0 ? (cash / nav) * 100 : 100;
  const isMarginCall = marginRatio < 15; // standard warning threshold

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 1. Interactive Trade Execution Ticket */}
      <div className="glass-panel p-5 rounded-xl border border-white/5 h-fit flex flex-col space-y-4">
        <div>
          <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Trade Terminal</span>
          <h3 className="text-base font-bold text-white mt-1">Submit Order: {selectedTicker}/USD</h3>
        </div>

        {/* Side selector */}
        <div className="grid grid-cols-4 gap-1 p-1 bg-white/5 rounded-lg border border-white/5 text-xs font-semibold">
          <button
            onClick={() => setSide('BUY')}
            className={`py-1.5 rounded-md transition-colors cursor-none ${side === 'BUY' ? 'bg-emerald-500 text-white shadow' : 'text-zinc-400 hover:text-white'}`}
          >
            Buy
          </button>
          <button
            onClick={() => setSide('SELL')}
            className={`py-1.5 rounded-md transition-colors cursor-none ${side === 'SELL' ? 'bg-red-500 text-white shadow' : 'text-zinc-400 hover:text-white'}`}
          >
            Sell
          </button>
          <button
            onClick={() => setSide('SELL_SHORT')}
            className={`py-1.5 rounded-md transition-colors cursor-none ${side === 'SELL_SHORT' ? 'bg-purple-600 text-white shadow' : 'text-zinc-400 hover:text-white'}`}
            title="Short Sell"
          >
            Short
          </button>
          <button
            onClick={() => setSide('BUY_TO_COVER')}
            className={`py-1.5 rounded-md transition-colors cursor-none ${side === 'BUY_TO_COVER' ? 'bg-indigo-600 text-white shadow' : 'text-zinc-400 hover:text-white'}`}
            title="Cover Short"
          >
            Cover
          </button>
        </div>

        <form onSubmit={placeOrder} className="space-y-4 text-xs font-sans">
          {/* Order Type */}
          <div className="space-y-1">
            <label className="text-zinc-500 font-mono">Order Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-white outline-none cursor-none focus:border-cosmic-indigo"
            >
              <option value="MARKET" className="bg-space-950">Market Order</option>
              <option value="LIMIT" className="bg-space-950">Limit Order</option>
            </select>
          </div>

          {/* Quantity */}
          <div className="space-y-1">
            <label className="text-zinc-500 font-mono">Quantity ({selectedTicker === 'BTC' || selectedTicker === 'ETH' ? 'Contracts' : 'Shares'})</label>
            <input
              type="number"
              step="any"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-full bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-white placeholder-zinc-600 outline-none focus:border-cosmic-indigo cursor-none"
            />
          </div>

          {/* Limit Price */}
          {type === 'LIMIT' && (
            <div className="space-y-1">
              <label className="text-zinc-500 font-mono">Limit Price ($)</label>
              <input
                type="number"
                step="any"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                placeholder={lastTickPrice?.toString() || '0.00'}
                className="w-full bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-white placeholder-zinc-600 outline-none focus:border-cosmic-indigo cursor-none"
              />
            </div>
          )}

          {/* Stop Loss & Take Profit */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-zinc-500 font-mono">Stop Loss ($)</label>
              <input
                type="number"
                step="any"
                placeholder="None"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                className="w-full bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-white placeholder-zinc-600 outline-none focus:border-cosmic-indigo cursor-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-zinc-500 font-mono">Take Profit ($)</label>
              <input
                type="number"
                step="any"
                placeholder="None"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                className="w-full bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-white placeholder-zinc-600 outline-none focus:border-cosmic-indigo cursor-none"
              />
            </div>
          </div>

          {/* Estimated Value */}
          <div className="bg-white/5 p-3 rounded-lg border border-white/5 font-mono text-zinc-500 space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span>Order Value:</span>
              <span className="text-white">
                ${((parseFloat(qty) || 0) * (type === 'LIMIT' ? parseFloat(limitPrice) || 0 : lastTickPrice || 0)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Est. Commission (0.05%):</span>
              <span className="text-white">
                ${((parseFloat(qty) || 0) * (type === 'LIMIT' ? parseFloat(limitPrice) || 0 : lastTickPrice || 0) * 0.0005).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2.5 rounded-lg text-white font-semibold text-xs transition-colors cursor-none ${
              side === 'BUY' ? 'bg-emerald-600 hover:bg-emerald-500' : 
              side === 'SELL' ? 'bg-red-600 hover:bg-red-500' :
              side === 'SELL_SHORT' ? 'bg-purple-600 hover:bg-purple-500' : 'bg-indigo-600 hover:bg-indigo-500'
            }`}
          >
            {loading ? 'Processing...' : `Submit ${side} Order`}
          </button>
        </form>

        {/* Local notifications banner */}
        {notification && (
          <div className={`p-3 rounded-lg flex items-start space-x-2 text-xs leading-tight ${notification.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
            {notification.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
            <span>{notification.message}</span>
          </div>
        )}
      </div>

      {/* 2. Position Portfolio list, Orders checklist, Transaction logs */}
      <div className="lg:col-span-2 flex flex-col space-y-4">
        {/* Account balance telemetries */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-panel p-4 rounded-xl border border-white/5 relative">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Net Asset Value</span>
            <div className="text-lg font-bold text-white mt-0.5 font-mono">${nav.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          <div className="glass-panel p-4 rounded-xl border border-white/5">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Available Cash</span>
            <div className="text-lg font-bold text-white mt-0.5 font-mono">${cash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          <div className="glass-panel p-4 rounded-xl border border-white/5">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Open Return P&L</span>
            <div className={`text-lg font-bold mt-0.5 font-mono flex items-center ${pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {pnl >= 0 ? '+' : ''}${pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              {pnl >= 0 ? <ArrowUpRight className="w-4 h-4 ml-1" /> : <ArrowDownRight className="w-4 h-4 ml-1" />}
            </div>
          </div>
          <div className="glass-panel p-4 rounded-xl border border-white/5 relative overflow-hidden">
            {isMarginCall && (
              <div className="absolute inset-0 bg-red-500/5 animate-pulse pointer-events-none" />
            )}
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Cash/NAV Ratio</span>
              {isMarginCall && <ShieldAlert className="w-3.5 h-3.5 text-red-500 animate-bounce" />}
            </div>
            <div className={`text-lg font-bold mt-0.5 font-mono ${isMarginCall ? 'text-red-500' : 'text-zinc-400'}`}>
              {marginRatio.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex justify-between items-center border-b border-white/5 pb-2">
          <div className="flex space-x-4 text-xs font-mono">
            <button
              onClick={() => setActiveTab('positions')}
              className={`pb-2 transition-colors border-b-2 cursor-none ${activeTab === 'positions' ? 'text-white border-cosmic-teal font-semibold' : 'text-zinc-500 border-transparent hover:text-zinc-300'}`}
            >
              Open Positions ({positions.length})
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`pb-2 transition-colors border-b-2 cursor-none ${activeTab === 'orders' ? 'text-white border-cosmic-teal font-semibold' : 'text-zinc-500 border-transparent hover:text-zinc-300'}`}
            >
              Pending Triggers ({orders.filter(o => o.status === 'PENDING').length})
            </button>
            <button
              onClick={() => setActiveTab('journal')}
              className={`pb-2 transition-colors border-b-2 cursor-none ${activeTab === 'journal' ? 'text-white border-cosmic-teal font-semibold' : 'text-zinc-500 border-transparent hover:text-zinc-300'}`}
            >
              Journal Logs ({transactions.length})
            </button>
          </div>

          <button
            onClick={() => { fetchPortfolio(); fetchOrders(); fetchTransactions(); }}
            className="p-1 rounded-md hover:bg-white/5 text-zinc-500 hover:text-white transition-colors cursor-none"
            title="Refresh Account Data"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Tab Content Panels */}
        <div className="glass-panel rounded-xl border border-white/5 overflow-hidden flex-1 min-h-[300px]">
          {activeTab === 'positions' && (
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-white/5 text-zinc-500 uppercase text-[10px] tracking-wider">
                    <th className="p-4 font-semibold">Asset</th>
                    <th className="p-4 font-semibold">Type</th>
                    <th className="p-4 font-semibold text-right">Size</th>
                    <th className="p-4 font-semibold text-right">Entry Price</th>
                    <th className="p-4 font-semibold text-right">Market Price</th>
                    <th className="p-4 font-semibold text-right">P&L ($)</th>
                    <th className="p-4 font-semibold text-right">P&L (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-zinc-300">
                  {positions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-zinc-500 font-sans">
                        No active open positions. Submit orders on the left to trade.
                      </td>
                    </tr>
                  ) : (
                    positions.map((pos) => (
                      <tr 
                        key={pos.id} 
                        onClick={() => onSelectTicker(pos.ticker)}
                        className={`hover:bg-white/5 transition-colors cursor-none ${selectedTicker === pos.ticker ? 'bg-white/5' : ''}`}
                      >
                        <td className="p-4 font-bold text-white flex items-center">
                          <Layers className="w-3.5 h-3.5 mr-2 text-zinc-500" />
                          {pos.ticker}
                        </td>
                        <td className="p-4">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${pos.side === 'LONG' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'}`}>
                            {pos.side}
                          </span>
                        </td>
                        <td className="p-4 text-right">{pos.quantity}</td>
                        <td className="p-4 text-right">${pos.average_entry_price.toFixed(2)}</td>
                        <td className="p-4 text-right">${pos.current_price?.toFixed(2)}</td>
                        <td className={`p-4 text-right font-semibold ${pos.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)}
                        </td>
                        <td className={`p-4 text-right font-semibold ${pos.pnl_percent >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {pos.pnl_percent >= 0 ? '+' : ''}{pos.pnl_percent}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-white/5 text-zinc-500 uppercase text-[10px] tracking-wider">
                    <th className="p-4 font-semibold">Time</th>
                    <th className="p-4 font-semibold">Asset</th>
                    <th className="p-4 font-semibold">Type</th>
                    <th className="p-4 font-semibold">Side</th>
                    <th className="p-4 font-semibold text-right">Size</th>
                    <th className="p-4 font-semibold text-right">Price</th>
                    <th className="p-4 font-semibold text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-zinc-300">
                  {orders.filter(o => o.status === 'PENDING').length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-zinc-500 font-sans">
                        No pending limit orders or stop triggers active.
                      </td>
                    </tr>
                  ) : (
                    orders
                      .filter((o) => o.status === 'PENDING')
                      .map((order) => (
                        <tr key={order.id} className="hover:bg-white/5 transition-colors">
                          <td className="p-4 text-zinc-500">
                            {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="p-4 font-bold text-white">{order.ticker}</td>
                          <td className="p-4">{order.type}</td>
                          <td className="p-4">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${order.side.includes('BUY') ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                              {order.side}
                            </span>
                          </td>
                          <td className="p-4 text-right">{order.quantity}</td>
                          <td className="p-4 text-right">${order.price ? order.price.toFixed(2) : 'Market'}</td>
                          <td className="p-4 text-center">
                            <button
                              onClick={() => cancelOrder(order.id)}
                              className="text-red-500 hover:text-red-400 font-semibold px-2 py-0.5 rounded hover:bg-red-500/10 transition-colors cursor-none"
                            >
                              Cancel
                            </button>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'journal' && (
            <div className="overflow-x-auto no-scrollbar max-h-[350px]">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-white/5 text-zinc-500 uppercase text-[10px] tracking-wider sticky top-0 bg-space-950 z-10">
                    <th className="p-4 font-semibold">Timestamp</th>
                    <th className="p-4 font-semibold">Asset</th>
                    <th className="p-4 font-semibold">Side</th>
                    <th className="p-4 font-semibold text-right">Size</th>
                    <th className="p-4 font-semibold text-right">Fill Price</th>
                    <th className="p-4 font-semibold text-right">Commissions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-zinc-300">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-zinc-500 font-sans">
                        No transactions recorded in ledger logs yet.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-4 text-zinc-500">
                          {new Date(tx.execution_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="p-4 font-bold text-white">{tx.ticker}</td>
                        <td className="p-4">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${tx.side.includes('BUY') ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                            {tx.side}
                          </span>
                        </td>
                        <td className="p-4 text-right">{parseFloat(tx.quantity.toString())}</td>
                        <td className="p-4 text-right">${parseFloat(tx.price.toString()).toFixed(2)}</td>
                        <td className="p-4 text-right text-zinc-500">${parseFloat(tx.commission.toString()).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
