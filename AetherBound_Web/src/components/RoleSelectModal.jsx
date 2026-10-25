import React, { useEffect, useState, useCallback, useRef } from 'react';
import { CURATED_CHALLENGES, MATCH_MODES } from '../game/data/matchModes.js';
import {
  generateUniqueRoomCode,
  sanitizeRoomCode,
  isValidRoomCode,
  fetchActiveRooms,
  checkRoomStatus,
  copyToClipboard,
} from '../game/data/roomUtils.js';

export function RoleSelectModal({
  visible = true,
  currentRoom = 'default',
  currentConfig = {},
  message = '',
  onSelectRole,
}) {
  const [activeTab, setActiveTab] = useState(() => {
    // If entered via invite link with a specific room code, start on 'join' tab
    return currentRoom && currentRoom !== 'default' && currentRoom !== 'quickplay' ? 'join' : 'create';
  });

  // Created room code (unique cyber-fantasy code like HUNT-4821)
  const [createdRoomCode, setCreatedRoomCode] = useState(() => generateUniqueRoomCode());
  // Joining room code
  const [joinRoomCode, setJoinRoomCode] = useState(
    currentRoom && currentRoom !== 'default' && currentRoom !== 'quickplay'
      ? sanitizeRoomCode(currentRoom)
      : ''
  );

  // Player Name
  const [playerName, setPlayerName] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('aetherbound_player_name') || '';
    }
    return '';
  });

  // Match configurations
  const [mode, setMode] = useState(currentConfig.mode || 'ffa');
  const [seed, setSeed] = useState(currentConfig.seed ? String(currentConfig.seed) : '');
  const [challengeId, setChallengeId] = useState('');
  const [fillBots, setFillBots] = useState(currentConfig.fillBots !== false);

  // Active rooms list & status
  const [activeRooms, setActiveRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [roomStatus, setRoomStatus] = useState(null); // { exists, isFull, playerCount, maxPlayers, modeName, checking }
  const [copiedNotification, setCopiedNotification] = useState('');

  const checkDebounceRef = useRef(null);

  // Sync props
  useEffect(() => {
    if (currentRoom && currentRoom !== 'default' && currentRoom !== 'quickplay') {
      setJoinRoomCode(sanitizeRoomCode(currentRoom));
    }
    setMode(currentConfig.mode || 'ffa');
    setSeed(currentConfig.seed ? String(currentConfig.seed) : '');
    if (currentConfig.fillBots !== undefined) setFillBots(currentConfig.fillBots !== false);
  }, [currentRoom, currentConfig]);

  // Load active rooms from server
  const loadRooms = useCallback(async () => {
    setLoadingRooms(true);
    const rooms = await fetchActiveRooms();
    setActiveRooms(rooms);
    setLoadingRooms(false);
  }, []);

  useEffect(() => {
    if (visible) {
      loadRooms();
    }
  }, [visible, loadRooms]);

  // Check room status when joinRoomCode changes
  useEffect(() => {
    if (!joinRoomCode.trim()) {
      setRoomStatus(null);
      return;
    }

    if (checkDebounceRef.current) clearTimeout(checkDebounceRef.current);

    setRoomStatus({ checking: true });
    checkDebounceRef.current = setTimeout(async () => {
      const status = await checkRoomStatus(joinRoomCode);
      setRoomStatus(status);
    }, 350);

    return () => {
      if (checkDebounceRef.current) clearTimeout(checkDebounceRef.current);
    };
  }, [joinRoomCode]);

  // Save player name to localStorage
  const handleNameChange = (val) => {
    const clean = val.slice(0, 20);
    setPlayerName(clean);
    if (typeof window !== 'undefined') {
      localStorage.setItem('aetherbound_player_name', clean);
    }
  };

  const getConfig = () => ({
    mode,
    seed: seed.trim() ? Number(seed) : null,
    fillBots,
  });

  const handleGenerateNewCode = () => {
    const newCode = generateUniqueRoomCode(activeRooms);
    setCreatedRoomCode(newCode);
    showCopiedBanner('Generated new unique code!');
  };

  const showCopiedBanner = (msg) => {
    setCopiedNotification(msg);
    setTimeout(() => setCopiedNotification(''), 2500);
  };

  const handleCopyCode = async (codeToCopy) => {
    const success = await copyToClipboard(codeToCopy);
    if (success) {
      showCopiedBanner(`Room code ${codeToCopy} copied to clipboard!`);
    } else {
      showCopiedBanner(`Code: ${codeToCopy}`);
    }
  };

  const handleCopyInviteLink = async (roomCode) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('role', 'player');
    url.searchParams.set('room', sanitizeRoomCode(roomCode));
    url.searchParams.set('mode', mode);
    const success = await copyToClipboard(url.toString());
    if (success) {
      showCopiedBanner('Direct invite link copied to clipboard!');
    }
  };

  const handlePasteCode = async () => {
    try {
      if (navigator?.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          // If pasted full URL, extract room param
          try {
            const url = new URL(text);
            const rParam = url.searchParams.get('room');
            if (rParam) {
              setJoinRoomCode(sanitizeRoomCode(rParam));
              return;
            }
          } catch (e) {}
          setJoinRoomCode(sanitizeRoomCode(text));
        }
      }
    } catch (e) {
      console.warn('Clipboard read failed:', e);
    }
  };

  const handleCreateRoom = () => {
    const code = sanitizeRoomCode(createdRoomCode) || generateUniqueRoomCode();
    onSelectRole('player', code, getConfig(), playerName.trim());
  };

  const handleJoinRoom = (targetCode = null) => {
    const code = sanitizeRoomCode(targetCode || joinRoomCode);
    if (!code) return;
    onSelectRole('player', code, getConfig(), playerName.trim());
  };

  const handleQuickPlay = () => {
    onSelectRole('player', 'quickplay', getConfig(), playerName.trim());
  };

  const selectChallenge = (id) => {
    setChallengeId(id);
    const challenge = CURATED_CHALLENGES.find((entry) => entry.id === id);
    if (!challenge) return;
    setMode(challenge.mode);
    setSeed(String(challenge.seed));
  };

  if (!visible) return null;

  return (
    <div
      className="modal-overlay"
      id="modal-role-select"
      role="dialog"
      aria-modal="true"
      aria-labelledby="role-select-title"
    >
      <div className="modal-card role-select-card room-hub-modal">
        {/* Modal Header */}
        <div className="modal-header-row">
          <div className="menu-kicker">
            <span className="brand-mark">⚔️</span> 5-PLAYER MULTIPLAYER ARENA
          </div>
          {copiedNotification && (
            <div className="toast-pill-notification">{copiedNotification}</div>
          )}
        </div>

        <h1 className="modal-title" id="role-select-title">AETHERBOUND</h1>
        <p className="modal-subtitle">5 Contenders · 1 Arena · Dragon Hunt & Free-for-All Survival</p>

        {message && (
          <div className="room-alert-message" role="alert">
            ⚠️ {message}
          </div>
        )}

        {/* Player Display Name Input */}
        <div className="player-identity-bar">
          <label htmlFor="player-name-input" className="hud-label">SURVIVOR NAME</label>
          <div className="player-name-field">
            <input
              id="player-name-input"
              type="text"
              placeholder="Enter your hunter name (e.g. Shadowblade)"
              value={playerName}
              maxLength={20}
              onChange={(e) => handleNameChange(e.target.value)}
            />
            <span className="player-name-pill">TAG: #{playerName ? playerName.slice(0, 4).toUpperCase() : 'SURV'}</span>
          </div>
        </div>

        {/* Navigation Tabs: CREATE ROOM vs JOIN ROOM vs QUICK PLAY */}
        <div className="room-nav-tabs" role="tablist">
          <button
            type="button"
            className={`room-nav-tab interactive ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
            role="tab"
            aria-selected={activeTab === 'create'}
          >
            <span className="tab-icon">🛠️</span>
            <span className="tab-title">CREATE ROOM</span>
            <span className="tab-badge">UNIQUE CODE</span>
          </button>

          <button
            type="button"
            className={`room-nav-tab interactive ${activeTab === 'join' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('join');
              loadRooms();
            }}
            role="tab"
            aria-selected={activeTab === 'join'}
          >
            <span className="tab-icon">🎮</span>
            <span className="tab-title">JOIN ROOM</span>
            {activeRooms.length > 0 && (
              <span className="tab-count-pill">{activeRooms.length} ACTIVE</span>
            )}
          </button>

          <button
            type="button"
            className={`room-nav-tab interactive ${activeTab === 'quick' ? 'active' : ''}`}
            onClick={() => setActiveTab('quick')}
            role="tab"
            aria-selected={activeTab === 'quick'}
          >
            <span className="tab-icon">⚡</span>
            <span className="tab-title">QUICK PLAY</span>
            <span className="tab-badge">AUTO-MATCH</span>
          </button>
        </div>

        {/* ================= TAB 1: CREATE ROOM ================= */}
        {activeTab === 'create' && (
          <div className="tab-content create-room-tab">
            {/* Unique Room Code Display Card */}
            <div className="unique-room-card">
              <div className="unique-room-header">
                <div>
                  <div className="hud-label">YOUR UNIQUE MATCH ROOM CODE</div>
                  <div className="room-helper">Friends use this unique code to join your 5-player match</div>
                </div>
                <div className="unique-room-actions">
                  <button
                    type="button"
                    className="room-action-btn secondary interactive"
                    onClick={handleGenerateNewCode}
                    title="Generate another unique code"
                  >
                    🎲 NEW CODE
                  </button>
                  <button
                    type="button"
                    className="room-action-btn primary interactive"
                    onClick={() => handleCopyCode(createdRoomCode)}
                    title="Copy Room Code"
                  >
                    📋 COPY CODE
                  </button>
                  <button
                    type="button"
                    className="room-action-btn primary interactive"
                    onClick={() => handleCopyInviteLink(createdRoomCode)}
                    title="Copy full invite link"
                  >
                    🔗 SHARE LINK
                  </button>
                </div>
              </div>

              <div className="unique-code-display-row">
                <div className="code-display-box">
                  <span className="code-prefix">ROOM</span>
                  <input
                    type="text"
                    className="code-input-display"
                    value={createdRoomCode}
                    maxLength={20}
                    onChange={(e) => setCreatedRoomCode(sanitizeRoomCode(e.target.value))}
                    title="Customizable room code"
                  />
                </div>
                <div className="room-meta-pill">
                  <span>MAX 5 CONTENDERS</span>
                  <span>AUTHORITATIVE</span>
                </div>
              </div>
            </div>

            {/* Match Rules & Arena Config */}
            <div className="match-config-grid">
              <label>
                <span className="hud-label">MATCH MODE (MAX 5)</span>
                <select
                  value={mode}
                  onChange={(event) => {
                    setMode(event.target.value);
                    setChallengeId('');
                  }}
                >
                  {Object.values(MATCH_MODES).map((matchMode) => (
                    <option key={matchMode.id} value={matchMode.id}>
                      {matchMode.name} (Max {matchMode.maxPlayers})
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="hud-label">RIVALS & BOTS (MAX 5)</span>
                <select
                  value={fillBots ? 'fill' : 'none'}
                  onChange={(event) => setFillBots(event.target.value === 'fill')}
                >
                  <option value="fill">Auto-fill up to 5 players (Bots)</option>
                  <option value="none">Humans only (Wait for friends)</option>
                </select>
              </label>

              <label>
                <span className="hud-label">CURATED CHALLENGE</span>
                <select value={challengeId} onChange={(event) => selectChallenge(event.target.value)}>
                  <option value="">Custom match</option>
                  {CURATED_CHALLENGES.map((challenge) => (
                    <option key={challenge.id} value={challenge.id}>
                      {challenge.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="hud-label">WORLD SEED</span>
                <input
                  type="number"
                  min="1"
                  max="2147483646"
                  step="1"
                  value={seed}
                  placeholder="Random world seed"
                  onChange={(event) => {
                    setSeed(event.target.value);
                    setChallengeId('');
                  }}
                />
              </label>

              <p className="match-mode-description">{MATCH_MODES[mode]?.description}</p>
            </div>

            {/* Launch Create Action */}
            <div className="modal-cta-box">
              <button
                type="button"
                className="launch-room-button create-button interactive"
                onClick={handleCreateRoom}
                disabled={!createdRoomCode.trim()}
              >
                <span className="btn-icon">🚀</span>
                <span className="btn-text">
                  CREATE & LAUNCH ROOM <b>[{createdRoomCode || 'ROOM'}]</b>
                </span>
                <span className="btn-arrow">→</span>
              </button>
            </div>
          </div>
        )}

        {/* ================= TAB 2: JOIN ROOM ================= */}
        {activeTab === 'join' && (
          <div className="tab-content join-room-tab">
            {/* Join with Room Code Card */}
            <div className="join-code-card">
              <div className="hud-label">ENTER OR PASTE ROOM CODE</div>
              <div className="join-input-group">
                <div className="join-input-wrapper">
                  <span className="input-icon">🔑</span>
                  <input
                    type="text"
                    className="join-room-input"
                    placeholder="Enter code (e.g. HUNT-4821)"
                    value={joinRoomCode}
                    maxLength={24}
                    autoComplete="off"
                    onChange={(e) => setJoinRoomCode(sanitizeRoomCode(e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && isValidRoomCode(joinRoomCode)) {
                        handleJoinRoom();
                      }
                    }}
                  />
                  {joinRoomCode && (
                    <button
                      type="button"
                      className="clear-code-btn interactive"
                      onClick={() => setJoinRoomCode('')}
                      title="Clear code"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  className="room-action-btn secondary interactive paste-btn"
                  onClick={handlePasteCode}
                  title="Paste room code from clipboard"
                >
                  📋 PASTE
                </button>

                <button
                  type="button"
                  className="launch-room-button join-button interactive"
                  onClick={() => handleJoinRoom()}
                  disabled={!isValidRoomCode(joinRoomCode) || (roomStatus?.exists && roomStatus?.isFull)}
                >
                  <span className="btn-icon">⚔️</span>
                  <span>JOIN MATCH</span>
                </button>
              </div>

              {/* Real-time Room Status Indicator */}
              {joinRoomCode.trim() && (
                <div className="room-status-row">
                  {roomStatus?.checking ? (
                    <div className="status-pill checking">
                      <span className="status-dot pulse" /> Checking room status on server...
                    </div>
                  ) : roomStatus?.exists ? (
                    roomStatus.isFull ? (
                      <div className="status-pill full">
                        <span className="status-dot red" /> Room <b>{joinRoomCode}</b> is FULL ({roomStatus.playerCount}/{roomStatus.maxPlayers} players)
                      </div>
                    ) : (
                      <div className="status-pill active">
                        <span className="status-dot green" /> Room <b>{joinRoomCode}</b> active · {roomStatus.playerCount}/{roomStatus.maxPlayers} players · {roomStatus.modeName || '5-Player Free-for-All'}
                      </div>
                    )
                  ) : (
                    <div className="status-pill available">
                      <span className="status-dot yellow" /> New Room: <b>{joinRoomCode}</b> will be initiated upon joining
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Active Live Rooms Browser */}
            <div className="live-rooms-browser">
              <div className="browser-header">
                <div>
                  <span className="browser-title">LIVE PUBLIC MATCHES</span>
                  <span className="browser-count">
                    ({activeRooms.length} active room{activeRooms.length === 1 ? '' : 's'})
                  </span>
                </div>
                <button
                  type="button"
                  className="room-refresh-btn interactive"
                  onClick={loadRooms}
                  disabled={loadingRooms}
                  title="Refresh active rooms"
                >
                  {loadingRooms ? '⏳ REFRESHING…' : '🔄 REFRESH'}
                </button>
              </div>

              <div className="rooms-list-container">
                {activeRooms.length > 0 ? (
                  activeRooms.map((room) => {
                    const isFull = room.isFull || room.playerCount >= room.maxPlayers;
                    return (
                      <div
                        key={room.id}
                        className={`live-room-item ${isFull ? 'room-full' : ''}`}
                      >
                        <div className="room-item-info">
                          <div className="room-item-title-row">
                            <span className="room-item-code">{room.code || room.id}</span>
                            <span className="room-item-mode-pill">
                              {room.modeName || '5-PLAYER FFA'}
                            </span>
                          </div>
                          <div className="room-item-meta">
                            <span className="meta-players">
                              👤 {room.playerCount}/{room.maxPlayers} Contenders
                              {room.humanCount > 0 && ` (${room.humanCount} human)`}
                            </span>
                          </div>
                        </div>

                        <div className="room-item-action">
                          <button
                            type="button"
                            className={`room-quick-join-btn interactive ${isFull ? 'disabled' : ''}`}
                            disabled={isFull}
                            onClick={() => handleJoinRoom(room.id)}
                          >
                            {isFull ? 'FULL' : 'JOIN MATCH →'}
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="no-rooms-placeholder">
                    <span className="placeholder-icon">🌐</span>
                    <p className="placeholder-text">
                      No other active matches running on the server right now.
                    </p>
                    <p className="placeholder-sub">
                      Click <b>CREATE ROOM</b> above to host the first 5-player match with a unique code!
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: QUICK PLAY ================= */}
        {activeTab === 'quick' && (
          <div className="tab-content quick-play-tab">
            <div className="quick-play-hero-card">
              <span className="hero-badge">FAST MATCHMAKING</span>
              <h2 className="hero-title">INSTANT 5-PLAYER ARENA</h2>
              <p className="hero-desc">
                Quick Play instantly connects you to an existing open match, or spins up a fresh 5-player arena ready for battle. AI contender bots will automatically fill empty slots so you never have to wait.
              </p>

              <div className="quick-play-mode-selector">
                <span className="hud-label">SELECTED MODE:</span>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  className="quick-mode-select"
                >
                  {Object.values(MATCH_MODES).map((matchMode) => (
                    <option key={matchMode.id} value={matchMode.id}>
                      {matchMode.name} (Max {matchMode.maxPlayers})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                className="launch-room-button quick-button interactive"
                onClick={handleQuickPlay}
              >
                <span className="btn-icon">⚡</span>
                <span className="btn-text">
                  QUICK PLAY 5-PLAYER MATCH · {MATCH_MODES[mode]?.name}
                </span>
                <span className="btn-arrow">→</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer Controls Info */}
        <p className="menu-footer">
          WASD MOVE <span>·</span> MOUSE LOOK 360° & UP/DOWN <span>·</span> SHIFT SPRINT <span>·</span> LEFT CLICK ATTACK/SHOOT <span>·</span> 1-5 WEAPONS <span>·</span> C FORGE
        </p>
      </div>
    </div>
  );
}
