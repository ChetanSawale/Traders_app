import { useEffect, useRef, useState } from 'react';

export default function CustomCursor() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [trail, setTrail] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  
  const mouseRef = useRef({ x: 0, y: 0 });
  const trailRef = useRef({ x: 0, y: 0 });
  const requestRef = useRef<number | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
      setPosition({ x: e.clientX, y: e.clientY });
      if (!isVisible) setIsVisible(true);
    };

    const handleMouseLeave = () => {
      setIsVisible(false);
    };

    const handleMouseEnter = () => {
      setIsVisible(true);
    };

    // Listen to mouse coordinates
    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);

    // Easing loop for the lagging outer ring (spring dampening)
    const updateTrail = () => {
      const targetX = mouseRef.current.x;
      const targetY = mouseRef.current.y;
      
      const currentX = trailRef.current.x;
      const currentY = trailRef.current.y;
      
      // Interpolation: move 15% closer to target on each frame
      const nextX = currentX + (targetX - currentX) * 0.15;
      const nextY = currentY + (targetY - currentY) * 0.15;
      
      trailRef.current = { x: nextX, y: nextY };
      setTrail({ x: nextX, y: nextY });
      
      requestRef.current = requestAnimationFrame(updateTrail);
    };

    requestRef.current = requestAnimationFrame(updateTrail);

    // Dynamic hover bindings for interactive elements
    const addHoverListeners = () => {
      const interactiveElements = document.querySelectorAll(
        'a, button, select, input, textarea, [role="button"], [data-hover]'
      );
      
      interactiveElements.forEach((el) => {
        el.addEventListener('mouseenter', () => setIsHovered(true));
        el.addEventListener('mouseleave', () => setIsHovered(false));
      });
    };

    // Watch DOM mutations to attach to new elements
    const observer = new MutationObserver(addHoverListeners);
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Initial bindings
    addHoverListeners();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      observer.disconnect();
    };
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <>
      {/* 1. Core Pointer (4px Solid Circle) */}
      <div
        className="fixed top-0 left-0 w-1.5 h-1.5 bg-white rounded-full pointer-events-none z-[9999]"
        style={{
          transform: `translate3d(${position.x - 3}px, ${position.y - 3}px, 0)`,
          transition: 'transform 0.02s linear',
        }}
      />

      {/* 2. Gravitational Lag Outer Ring with Blend difference */}
      <div
        className={`fixed top-0 left-0 rounded-full pointer-events-none z-[9998] mix-blend-difference border border-white transition-all duration-300 ease-out`}
        style={{
          width: isHovered ? '48px' : '28px',
          height: isHovered ? '48px' : '28px',
          transform: `translate3d(${trail.x - (isHovered ? 24 : 14)}px, ${trail.y - (isHovered ? 24 : 14)}px, 0)`,
          backgroundColor: isHovered ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
          boxShadow: isHovered 
            ? '0 0 20px rgba(99, 102, 241, 0.4), inset 0 0 10px rgba(6, 182, 212, 0.3)' 
            : 'none',
        }}
      >
        {/* Orbital particles representing gravity field when hovered */}
        {isHovered && (
          <div className="absolute inset-0 animate-spin" style={{ animationDuration: '3s' }}>
            <div className="absolute -top-1 left-1/2 w-1.5 h-1.5 bg-cosmic-teal rounded-full animate-ping" />
            <div className="absolute -bottom-1 left-1/2 w-1 h-1 bg-cosmic-violet rounded-full" />
          </div>
        )}
      </div>
    </>
  );
}
