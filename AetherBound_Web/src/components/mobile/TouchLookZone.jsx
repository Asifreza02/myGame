import React, { useRef, useEffect, useCallback } from 'react';

export function TouchLookZone({
  isPlacing = false,
  onLookDrag,
  onDragItemPlacement,
}) {
  const zoneRef = useRef(null);
  const activeTouchIdRef = useRef(null);
  const lastTouchPosRef = useRef({ x: 0, y: 0 });

  const handleTouchStart = useCallback((e) => {
    // Only accept a touch if we don't already have one active in this look zone
    if (activeTouchIdRef.current !== null) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      // Do not intercept touches on interactive buttons, hotbar items, or HUD controls
      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      if (target && target.closest('.interactive, button, .hotbar-item, .hud-panel')) {
        continue;
      }
      // Accept touches on the right 65% of the screen (away from the joystick on bottom-left)
      if (touch.clientX > window.innerWidth * 0.35) {
        activeTouchIdRef.current = touch.identifier;
        lastTouchPosRef.current = { x: touch.clientX, y: touch.clientY };
        e.preventDefault();
        break;
      }
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (activeTouchIdRef.current === null) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === activeTouchIdRef.current) {
        e.preventDefault();
        const deltaX = touch.clientX - lastTouchPosRef.current.x;
        const deltaY = touch.clientY - lastTouchPosRef.current.y;
        lastTouchPosRef.current = { x: touch.clientX, y: touch.clientY };

        if (isPlacing && onDragItemPlacement) {
          // Controls item placement by screen drag:
          // deltaX aims the POV, deltaY moves item distance far/near!
          onDragItemPlacement(deltaX, deltaY);
        } else if (onLookDrag) {
          // Normal horizontal camera view aiming
          const sens = 0.004;
          onLookDrag(-deltaX * sens);
        }
        break;
      }
    }
  }, [isPlacing, onLookDrag, onDragItemPlacement]);

  const handleTouchEnd = useCallback((e) => {
    if (activeTouchIdRef.current === null) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeTouchIdRef.current) {
        activeTouchIdRef.current = null;
        e.preventDefault();
        break;
      }
    }
  }, []);

  useEffect(() => {
    const el = zoneRef.current;
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
      ref={zoneRef}
      className={`touch-look-zone ${isPlacing ? 'placing-active' : ''}`}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '70%',
        height: '100%',
        zIndex: 5,
        touchAction: 'none',
      }}
    >
      {isPlacing && (
        <div className="touch-drag-hint">
          <span>👆 Drag screen to aim &amp; push/pull item distance</span>
        </div>
      )}
    </div>
  );
}
