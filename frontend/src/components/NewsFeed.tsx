import { useEffect, useState } from 'react';
import { Search, RefreshCw, MessageSquare, ExternalLink, Calendar } from 'lucide-react';

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  summary: string;
}

export default function NewsFeed() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchNews = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/news');
      if (res.ok) {
        const data = await res.json();
        setNews(data);
      }
    } catch (e) {
      console.error('Failed to load news headlines:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  const filteredNews = news.filter((item) =>
    item.title.toLowerCase().includes(search.toLowerCase()) ||
    item.summary.toLowerCase().includes(search.toLowerCase()) ||
    item.source.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Search and control bar */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search news headlines or sources..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/5 rounded-lg pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 outline-none focus:border-terminal-accent transition-colors cursor-none"
          />
        </div>

        <button
          onClick={fetchNews}
          disabled={loading}
          className="flex items-center space-x-1.5 border border-white/5 bg-white/5 hover:bg-white/10 px-3.5 py-2 rounded-lg text-xs font-mono text-zinc-300 hover:text-white transition-all cursor-none"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Feed</span>
        </button>
      </div>

      {/* Grid of news articles */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass-panel p-5 rounded-xl border border-white/5 h-[160px] animate-pulse flex flex-col justify-between">
              <div className="space-y-2">
                <div className="h-4 bg-white/5 rounded w-3/4" />
                <div className="h-3 bg-white/5 rounded w-1/2" />
                <div className="h-3 bg-white/5 rounded w-5/6" />
              </div>
              <div className="h-4 bg-white/5 rounded w-1/4" />
            </div>
          ))}
        </div>
      ) : filteredNews.length === 0 ? (
        <div className="glass-panel py-16 text-center text-zinc-500 text-sm rounded-xl">
          No news articles found matching "{search}"
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredNews.map((item, idx) => {
            // Sentiment Badge styling
            const sentimentColors = {
              BULLISH: 'bg-terminal-bull/10 text-terminal-bull border-terminal-bull/20',
              BEARISH: 'bg-red-500/10 text-red-400 border-red-500/20',
              NEUTRAL: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
            };

            return (
              <div
                key={idx}
                className="group glass-panel p-5 rounded-xl border border-white/5 hover:border-white/10 transition-all duration-300 flex flex-col justify-between relative overflow-hidden animate-float-slow"
                style={{ animationDelay: `${idx * 0.2}s` }}
              >
                {/* Visual hover background gradients */}
                <div className="absolute top-0 right-0 w-[150px] h-[150px] bg-terminal-accent/2 blur-[80px] rounded-full pointer-events-none group-hover:bg-terminal-accent/5 transition-colors" />

                <div className="space-y-2">
                  <div className="flex justify-between items-start gap-4">
                    <span className="text-xs font-mono text-zinc-500 flex items-center">
                      <Calendar className="w-3 h-3 mr-1" />
                      {new Date(item.pubDate).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className={`text-[10px] font-bold font-mono tracking-wider uppercase px-2 py-0.5 rounded-full border ${sentimentColors[item.sentiment]}`}>
                      {item.sentiment}
                    </span>
                  </div>

                  <h4 className="text-sm font-semibold text-white group-hover:text-terminal-accent transition-colors font-sans leading-snug">
                    {item.title}
                  </h4>

                  <p className="text-xs text-zinc-400 font-sans leading-relaxed line-clamp-3">
                    {item.summary}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center text-xs font-mono">
                  <span className="text-zinc-500">{item.source}</span>
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1 text-terminal-accent hover:text-white transition-colors cursor-none"
                  >
                    <span>Read Article</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
