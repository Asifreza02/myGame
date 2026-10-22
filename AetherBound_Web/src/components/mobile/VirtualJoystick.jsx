import React, { useRef, useState, useCallback, useEffect } from 'react';

export function VirtualJoystick({ onChange }) {
  const containerRef = useRef(null);
  const touchIdRef = useRef(null);
  const centerPosRef = useRef({ x: 0, y: 0 });
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);

  const maxRadius = 45; // Max movement radius in pixels

  const handleTouchStart = useCallback((e) => {
    e.preventDefault();
    if (touchIdRef.current !== null) return;

    const touch = e.changedTouches[0];
    touchIdRef.current = touch.identifier;

    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    centerPosRef.current = { x: centerX, y: centerY };

    setActive(true);

    const dx = touch.clientX - centerX;
    const dy = touch.clientY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clampedDist = Math.min(maxRadius, dist);
    const angle = Math.atan2(dy, dx);

    const stickX = Math.cos(angle) * clampedDist;
    const stickY = Math.sin(angle) * clampedDist;

    setKnobPos({ x: stickX, y: stickY });
    // Normalize: x is right/left (-1 to 1), y is forward/backward (up is -dy in screen space, so invert for forward)
    onChange({
      x: stickX / maxRadius,
      y: -stickY / maxRadius,
    });
  }, [onChange]);

  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
    if (touchIdRef.current === null) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === touchIdRef.current) {
        const { x: centerX, y: centerY } = centerPosRef.current;
        const dx = touch.clientX - centerX;
        const dy = touch.clientY - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const clampedDist = Math.min(maxRadius, dist);
        const angle = Math.atan2(dy, dx);

        const stickX = Math.cos(angle) * clampedDist;
        const stickY = Math.sin(angle) * clampedDist;

        setKnobPos({ x: stickX, y: stickY });
        onChange({
          x: stickX / maxRadius,
          y: -stickY / maxRadius,
        });
        break;
      }
    }
  }, [onChange]);

  const handleTouchEnd = useCallback((e) => {
    e.preventDefault();
    if (touchIdRef.current === null) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchIdRef.current) {
        touchIdRef.current = null;
        setKnobPos({ x: 0, y: 0 });
        setActive(false);
        onChange({ x: 0, y: 0 });
        break;
      }
    }
  }, [onChange]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: false });
    el.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return (
    <div
      ref={containerRef}
      className={`virtual-joystick-base ${active ? 'active' : ''}`}
    >
      <div
        className="virtual-joystick-knob"
        style={{
          transform: `translate(calc(-50% + ${knobPos.x}px), calc(-50% + ${knobPos.y}px))`,
        }}
      >
        <div className="knob-inner-ring" />
      </div>
    </div>
  );
}
