import { useEffect, useState, useRef } from 'react';
import { Search, Globe, TrendingUp, BookOpen, Shield, HelpCircle, Power } from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (route: string) => void;
  onSelectTicker: (ticker: string) => void;
}

export default function CommandPalette({ isOpen, onClose, onNavigate, onSelectTicker }: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setSearch('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  const items = [
    // Page Routes
    { category: 'Navigation', label: 'Go to Dashboard', icon: Globe, action: () => { onNavigate('dashboard'); onClose(); } },
    { category: 'Navigation', label: 'Go to Live Paper Trading', icon: TrendingUp, action: () => { onNavigate('trading'); onClose(); } },
    { category: 'Navigation', label: 'Go to Education Academy', icon: BookOpen, action: () => { onNavigate('education'); onClose(); } },
    { category: 'Navigation', label: 'Go to Industry News Feed', icon: Globe, action: () => { onNavigate('news'); onClose(); } },
    { category: 'Navigation', label: 'Go to Security Audit Log', icon: Shield, action: () => { onNavigate('security'); onClose(); } },
    
    // Tickers
    { category: 'Assets', label: 'View Bitcoin (BTC)', icon: TrendingUp, action: () => { onSelectTicker('BTC'); onNavigate('trading'); onClose(); } },
    { category: 'Assets', label: 'View Ethereum (ETH)', icon: TrendingUp, action: () => { onSelectTicker('ETH'); onNavigate('trading'); onClose(); } },
    { category: 'Assets', label: 'View Apple Inc. (AAPL)', icon: TrendingUp, action: () => { onSelectTicker('AAPL'); onNavigate('trading'); onClose(); } },
    { category: 'Assets', label: 'View Tesla Motors (TSLA)', icon: TrendingUp, action: () => { onSelectTicker('TSLA'); onNavigate('trading'); onClose(); } },
    { category: 'Assets', label: 'View Microsoft Corp. (MSFT)', icon: TrendingUp, action: () => { onSelectTicker('MSFT'); onNavigate('trading'); onClose(); } },
    { category: 'Assets', label: 'View Nvidia Corp. (NVDA)', icon: TrendingUp, action: () => { onSelectTicker('NVDA'); onNavigate('trading'); onClose(); } },

    // Action Triggers
    { category: 'Security', label: 'Configure 2FA MFA TOTP', icon: Shield, action: () => { onNavigate('security'); onClose(); } },
    { category: 'Education', label: 'Support & Resistance Drawing Quiz', icon: HelpCircle, action: () => { onNavigate('education'); onClose(); } },
  ];

  const filteredItems = items.filter((item) =>
    item.label.toLowerCase().includes(search.toLowerCase()) ||
    item.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-md z-[999] flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg glass-panel bg-space-950/90 rounded-xl shadow-2xl border border-white/10 overflow-hidden animate-float-fast"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search header */}
        <div className="flex items-center px-4 py-3.5 border-b border-white/5">
          <Search className="w-5 h-5 text-zinc-400 mr-3" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a stock ticker, page name, or action..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-white outline-none border-none text-base placeholder-zinc-500 font-sans"
          />
          <span className="text-xs text-zinc-500 border border-zinc-700 rounded px-1.5 py-0.5 font-mono">
            ESC
          </span>
        </div>

        {/* Results Body */}
        <div className="max-h-[350px] overflow-y-auto py-2 no-scrollbar">
          {filteredItems.length === 0 ? (
            <div className="px-5 py-8 text-center text-zinc-500 text-sm">
              No results matching "{search}"
            </div>
          ) : (
            // Group by category
            Object.entries(
              filteredItems.reduce((acc, item) => {
                if (!acc[item.category]) acc[item.category] = [];
                acc[item.category].push(item);
                return acc;
              }, {} as Record<string, typeof items>)
            ).map(([category, catItems]) => (
              <div key={category}>
                <div className="px-4 py-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider font-mono">
                  {category}
                </div>
                {catItems.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={idx}
                      onClick={item.action}
                      className="w-full flex items-center px-4 py-2.5 hover:bg-white/5 text-zinc-300 hover:text-white transition-colors text-left text-sm"
                    >
                      <Icon className="w-4 h-4 mr-3 text-zinc-400" />
                      <span className="flex-1 font-sans">{item.label}</span>
                      <span className="text-xs text-zinc-600 font-mono">⏎ Select</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="bg-space-950 px-4 py-2 border-t border-white/5 flex items-center justify-between text-xs text-zinc-500 font-mono">
          <span>Navigate with 🠕🠗 arrows</span>
          <span>Open with Ctrl + K</span>
        </div>
      </div>
    </div>
  );
}
