import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Bookmark, RotateCcw, Volume2, VolumeX, Edit3, Clock, Sparkles } from 'lucide-react';

interface Note {
  id: number;
  timestamp_seconds: number;
  note_text: string;
  created_at: string;
}

interface MinimalPlayerProps {
  videoUrl: string;
  onProgressUpdate?: (percent: number) => void;
}

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
    YT: any;
  }
}

export default function MinimalPlayer({ videoUrl, onProgressUpdate }: MinimalPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const progressTimerRef = useRef<any>(null);
  const iframeId = 'youtube-iframe-player';

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  
  // Note System States
  const [noteText, setNoteText] = useState('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [apiReady, setApiReady] = useState(false);

  // Extract YouTube ID from link
  const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : 'dQw4w9WgXcQ'; // Fallback Rickroll
  };

  const videoId = getYouTubeId(videoUrl);

  // 1. Load YouTube IFrame API Script
  useEffect(() => {
    // Load local notes on load
    fetchNotes();

    if (window.YT) {
      initPlayer();
      return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      initPlayer();
    };

    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [videoUrl]);

  const initPlayer = () => {
    try {
      playerRef.current = new window.YT.Player(iframeId, {
        videoId: videoId,
        playerVars: {
          controls: 0,        // Hide default player controls
          disablekb: 1,       // Disable keyboard controls
          fs: 0,              // Hide fullscreen button
          modestbranding: 1,  // Hide YT Logo
          rel: 0,             // Hide related videos
          showinfo: 0,
          iv_load_policy: 3,  // Hide video annotations
        },
        events: {
          onReady: onPlayerReady,
          onStateChange: onPlayerStateChange,
        },
      });
    } catch (e) {
      console.error('Error initializing YT Player:', e);
    }
  };

  const onPlayerReady = (event: any) => {
    setDuration(event.target.getDuration());
    setApiReady(true);
  };

  const onPlayerStateChange = (event: any) => {
    // YT.PlayerState: UNSTARTED (-1), ENDED (0), PLAYING (1), PAUSED (2), BUFFERING (3), CUED (5)
    if (event.data === 1) {
      setIsPlaying(true);
      startProgressTracking();
    } else {
      setIsPlaying(false);
      stopProgressTracking();
    }
  };

  const startProgressTracking = () => {
    stopProgressTracking();
    progressTimerRef.current = setInterval(() => {
      if (!playerRef.current) return;
      const cur = playerRef.current.getCurrentTime();
      const dur = playerRef.current.getDuration();
      setCurrentTime(cur);
      setProgress((cur / dur) * 100);

      // Trigger telemetry API
      const percent = Number(((cur / dur) * 100).toFixed(2));
      if (onProgressUpdate) onProgressUpdate(percent);
    }, 1000);
  };

  const stopProgressTracking = () => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  };

  // Custom Controls Functions
  const togglePlay = () => {
    if (!playerRef.current || !apiReady) return;
    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!playerRef.current || !apiReady) return;
    const value = parseFloat(e.target.value);
    const newTime = (value / 100) * duration;
    playerRef.current.seekTo(newTime, true);
    setProgress(value);
    setCurrentTime(newTime);
  };

  const toggleMute = () => {
    if (!playerRef.current || !apiReady) return;
    if (isMuted) {
      playerRef.current.unMute();
      setIsMuted(false);
    } else {
      playerRef.current.mute();
      setIsMuted(true);
    }
  };

  const restartVideo = () => {
    if (!playerRef.current || !apiReady) return;
    playerRef.current.seekTo(0, true);
    playerRef.current.playVideo();
  };

  // Note Fetching and Saving
  const fetchNotes = async () => {
    try {
      const res = await fetch(`/api/education/notes?video_url=${encodeURIComponent(videoUrl)}`);
      if (res.ok) {
        const data = await res.json();
        setNotes(data);
      }
    } catch (e) {
      // Offline fallback
    }
  };

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;

    const timestamp = Math.floor(currentTime);

    try {
      const res = await fetch('/api/education/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_url: videoUrl,
          timestamp_seconds: timestamp,
          note_text: noteText,
        }),
      });

      if (res.ok) {
        const newNote = await res.json();
        setNotes((prev) => [...prev, newNote].sort((a, b) => a.timestamp_seconds - b.timestamp_seconds));
        setNoteText('');
      }
    } catch (e) {
      // Fallback local append for offline
      const mockNote: Note = {
        id: Date.now(),
        timestamp_seconds: timestamp,
        note_text: noteText,
        created_at: new Date().toISOString(),
      };
      setNotes((prev) => [...prev, mockNote].sort((a, b) => a.timestamp_seconds - b.timestamp_seconds));
      setNoteText('');
    }
  };

  const seekToTimestamp = (seconds: number) => {
    if (!playerRef.current || !apiReady) return;
    playerRef.current.seekTo(seconds, true);
    if (!isPlaying) playerRef.current.playVideo();
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 1. Masked Video Player Canvas */}
      <div className="lg:col-span-2 flex flex-col space-y-4">
        <div ref={containerRef} className="relative aspect-video rounded-xl border border-white/5 bg-zinc-950 overflow-hidden shadow-2xl">
          {/* Chromeless IFrame */}
          <div className="absolute inset-0 pointer-events-none scale-105">
            <div id={iframeId} className="w-full h-full" />
          </div>

          {/* Mouse protection / Click-to-play layer */}
          <div 
            className="absolute inset-0 z-10" 
            onClick={togglePlay}
          />

          {/* Floating gravity gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none z-20" />

          {/* Play state big center icon indicator */}
          {!isPlaying && apiReady && (
            <button 
              onClick={togglePlay}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:scale-110 transition-transform duration-300 z-30"
            >
              <Play className="w-8 h-8 fill-white ml-1 text-white" />
            </button>
          )}

          {/* Telemetry info */}
          <div className="absolute top-4 left-4 border border-white/10 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md text-xs font-mono text-zinc-300 z-30 flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cosmic-teal animate-pulse" />
            <span>ACADEMY STREAM</span>
          </div>
        </div>

        {/* Custom Controller controls bar */}
        <div className="glass-panel px-4 py-3.5 rounded-xl border border-white/5 flex flex-col space-y-3">
          {/* Slider bar */}
          <div className="flex items-center space-x-3 text-xs font-mono text-zinc-400">
            <span>{formatTime(currentTime)}</span>
            <input
              type="range"
              min="0"
              max="100"
              step="0.1"
              value={progress}
              onChange={seek}
              className="flex-1 h-1 bg-zinc-800 rounded-lg appearance-none cursor-none accent-cosmic-indigo outline-none"
            />
            <span>{formatTime(duration)}</span>
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <button 
                onClick={togglePlay}
                className="text-zinc-400 hover:text-white transition-colors"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-zinc-400 hover:fill-white" /> : <Play className="w-5 h-5 fill-zinc-400 hover:fill-white" />}
              </button>
              
              <button 
                onClick={restartVideo}
                className="text-zinc-400 hover:text-white transition-colors"
                title="Rewind"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button 
                onClick={toggleMute}
                className="text-zinc-400 hover:text-white transition-colors"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
            </div>

            <div className="text-xs font-mono text-zinc-500">
              Progress: {progress.toFixed(0)}%
            </div>
          </div>
        </div>
      </div>

      {/* 2. Bookmarkable Annotation Learning Notes Sidebar */}
      <div className="glass-panel p-4 rounded-xl border border-white/5 flex flex-col h-[480px]">
        <h3 className="text-sm font-semibold tracking-wide text-white mb-3 flex items-center font-mono uppercase">
          <Bookmark className="w-4 h-4 text-cosmic-teal mr-2" />
          Annotation Notes
        </h3>

        {/* Notes feed log */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 no-scrollbar mb-4">
          {notes.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500 text-xs py-10">
              <Edit3 className="w-8 h-8 text-zinc-700 mb-2" />
              <span>Capture timestamp-linked notes. Click notes to seek.</span>
            </div>
          ) : (
            notes.map((note) => (
              <div 
                key={note.id}
                onClick={() => seekToTimestamp(note.timestamp_seconds)}
                className="p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 cursor-none transition-all duration-200 text-left"
              >
                <div className="flex justify-between items-center text-xs font-mono text-cosmic-teal mb-1">
                  <span className="flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {formatTime(note.timestamp_seconds)}
                  </span>
                  <span className="text-[10px] text-zinc-600">
                    {new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs text-zinc-300 font-sans leading-relaxed">{note.note_text}</p>
              </div>
            ))
          )}
        </div>

        {/* Input box */}
        <form onSubmit={addNote} className="pt-3 border-t border-white/5 flex space-x-2">
          <input
            type="text"
            placeholder={`Note at ${formatTime(currentTime)}...`}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            className="flex-1 bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 outline-none focus:border-cosmic-indigo transition-colors font-sans"
          />
          <button
            type="submit"
            className="bg-cosmic-indigo hover:bg-indigo-600 text-white rounded-lg px-3 py-2 text-xs font-semibold flex items-center transition-colors"
          >
            Add
          </button>
        </form>
      </div>
    </div>
  );
}
