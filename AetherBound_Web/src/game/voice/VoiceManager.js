// WebRTC Mesh Voice Communication Manager for AetherBound
// Handles microphone capture, Web Audio analysis, peer connections, and signaling.

const RTC_CONFIG = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
  ],
};

const SPEAKING_THRESHOLD = 0.04;
const SPEAKING_HOLD_MS = 280;

export class VoiceManager {
  constructor(network, callbacks = {}) {
    this.network = network;
    this.callbacks = callbacks;
    this.localPlayerId = null;
    this.localStream = null;
    this.audioContext = null;
    this.analyser = null;
    this.micSource = null;
    this.analyserData = null;

    this.isMuted = false;
    this.isDeafened = false;
    this.pushToTalk = false;
    this.isPttPressed = false;
    this.volume = 1.0;

    this.isSpeaking = false;
    this.lastSpokeAt = 0;
    this.permissionState = 'prompt'; // 'prompt' | 'granted' | 'denied' | 'unsupported' | 'listen-only'

    this.peers = new Map(); // peerId -> { pc, audioElement, stream, analyser, isSpeaking, isMuted, isPolite, makingOffer, ignoreOffer }
    this.vadInterval = null;
    this.isDestroyed = false;

    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.boundKeyUp = this.handleKeyUp.bind(this);

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.boundKeyDown);
      window.addEventListener('keyup', this.boundKeyUp);
    }
  }

  setLocalPlayerId(id) {
    this.localPlayerId = id;
    // Update politeness for any existing peers
    for (const [peerId, peer] of this.peers.entries()) {
      peer.isPolite = this.localPlayerId ? this.localPlayerId < peerId : false;
    }
  }

  async init(localPlayerId) {
    if (this.isDestroyed) return;
    if (localPlayerId) this.setLocalPlayerId(localPlayerId);

    // Check mediaDevices support
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn('Voice chat: getUserMedia not supported in this environment. Falling back to listen-only mode.');
      this.permissionState = 'unsupported';
      this.emitState();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
        },
        video: false,
      });

      if (this.isDestroyed) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      this.localStream = stream;
      this.permissionState = 'granted';

      this.setupWebAudio();
      this.applyMuteState();

      // Add local stream tracks to any already-created peer connections
      for (const peer of this.peers.values()) {
        if (peer.pc && peer.pc.signalingState !== 'closed') {
          for (const track of this.localStream.getAudioTracks()) {
            peer.pc.addTrack(track, this.localStream);
          }
        }
      }

      this.startVoiceActivityDetection();
      this.emitState();
    } catch (error) {
      console.warn('Voice chat mic access denied or unavailable:', error);
      this.permissionState = 'listen-only';
      this.isMuted = true;
      this.emitState();
    }
  }

  setupWebAudio() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      this.audioContext = new AudioContextClass();
      if (this.audioContext.state === 'suspended') {
        const resumeAudio = () => {
          this.audioContext?.resume();
          window.removeEventListener('click', resumeAudio);
          window.removeEventListener('keydown', resumeAudio);
          window.removeEventListener('touchstart', resumeAudio);
        };
        window.addEventListener('click', resumeAudio, { once: true });
        window.addEventListener('keydown', resumeAudio, { once: true });
        window.addEventListener('touchstart', resumeAudio, { once: true });
      }

      if (this.localStream) {
        this.micSource = this.audioContext.createMediaStreamSource(this.localStream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.4;
        this.analyserData = new Uint8Array(this.analyser.frequencyBinCount);
        this.micSource.connect(this.analyser);
      }
    } catch (err) {
      console.warn('Voice chat WebAudio setup failed:', err);
    }
  }

  startVoiceActivityDetection() {
    if (this.vadInterval) clearInterval(this.vadInterval);
    this.vadInterval = setInterval(() => {
      this.checkSpeakingLevel();
    }, 60);
  }

  checkSpeakingLevel() {
    if (!this.analyser || !this.analyserData) return;

    // If muted or (push-to-talk enabled and not pressed), local user cannot speak
    const canSpeak = !this.isMuted && !this.isDeafened && (!this.pushToTalk || this.isPttPressed);

    let volumeLevel = 0;
    if (canSpeak) {
      this.analyser.getByteFrequencyData(this.analyserData);
      let sum = 0;
      for (let i = 0; i < this.analyserData.length; i++) {
        sum += this.analyserData[i];
      }
      volumeLevel = sum / (this.analyserData.length * 255);
    }

    const now = Date.now();
    let nextSpeaking = false;

    if (volumeLevel > SPEAKING_THRESHOLD) {
      nextSpeaking = true;
      this.lastSpokeAt = now;
    } else if (this.isSpeaking && now - this.lastSpokeAt < SPEAKING_HOLD_MS) {
      nextSpeaking = true;
    }

    if (nextSpeaking !== this.isSpeaking) {
      this.isSpeaking = nextSpeaking;
      if (this.network?.connected) {
        this.network.sendVoiceStatus(this.isSpeaking, this.isMuted, this.isDeafened);
      }
      this.callbacks.onLocalSpeaking?.(this.isSpeaking, volumeLevel);
      this.emitState();
    }
  }

  handleKeyDown(event) {
    if (event.code === 'KeyV' && !event.repeat) {
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        return;
      }
      if (this.pushToTalk) {
        this.isPttPressed = true;
        this.applyMuteState();
        this.emitState();
      }
    }
  }

  handleKeyUp(event) {
    if (event.code === 'KeyV') {
      if (this.pushToTalk && this.isPttPressed) {
        this.isPttPressed = false;
        this.applyMuteState();
        this.emitState();
      }
    }
  }

  applyMuteState() {
    const micEnabled = !this.isMuted && !this.isDeafened && (!this.pushToTalk || this.isPttPressed);
    if (this.localStream) {
      for (const track of this.localStream.getAudioTracks()) {
        track.enabled = micEnabled;
      }
    }
    if (!micEnabled && this.isSpeaking) {
      this.isSpeaking = false;
      this.network?.sendVoiceStatus(false, this.isMuted, this.isDeafened);
      this.callbacks.onLocalSpeaking?.(false, 0);
    }
  }

  toggleMute() {
    this.setMuted(!this.isMuted);
  }

  setMuted(muted) {
    this.isMuted = Boolean(muted);
    this.applyMuteState();
    this.network?.sendVoiceStatus(this.isSpeaking, this.isMuted, this.isDeafened);
    this.emitState();
  }

  toggleDeafen() {
    this.setDeafened(!this.isDeafened);
  }

  setDeafened(deafened) {
    this.isDeafened = Boolean(deafened);
    this.applyMuteState();

    // Mute/unmute all remote audio elements
    for (const peer of this.peers.values()) {
      if (peer.audioElement) {
        peer.audioElement.muted = this.isDeafened;
      }
    }

    this.network?.sendVoiceStatus(this.isSpeaking, this.isMuted, this.isDeafened);
    this.emitState();
  }

  setPushToTalk(enabled) {
    this.pushToTalk = Boolean(enabled);
    this.isPttPressed = false;
    this.applyMuteState();
    this.emitState();
  }

  setPushToTalkActive(active) {
    if (!this.pushToTalk) return;
    this.isPttPressed = Boolean(active);
    this.applyMuteState();
    this.emitState();
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1.5, Number(vol) || 1.0));
    for (const peer of this.peers.values()) {
      if (peer.audioElement) {
        peer.audioElement.volume = Math.min(1.0, this.volume);
      }
    }
    this.emitState();
  }

  // Sync roster human peers
  syncPeers(players = []) {
    if (!this.localPlayerId) return;

    const currentHumanIds = new Set();
    for (const p of players) {
      if (!p.isBot && p.id && p.id !== this.localPlayerId) {
        currentHumanIds.add(p.id);
        if (!this.peers.has(p.id)) {
          // If we have a lower ID or we just discovered them, initiate peer connection
          const shouldInitiate = this.localPlayerId < p.id;
          this.createPeerConnection(p.id, shouldInitiate);
        }
      }
    }

    // Clean up peers that left
    for (const peerId of this.peers.keys()) {
      if (!currentHumanIds.has(peerId)) {
        this.removePeer(peerId);
      }
    }
  }

  createPeerConnection(peerId, shouldInitiate = false) {
    if (this.peers.has(peerId)) return this.peers.get(peerId);

    const isPolite = this.localPlayerId ? this.localPlayerId < peerId : false;
    let pc;

    try {
      pc = new RTCPeerConnection(RTC_CONFIG);
    } catch (err) {
      console.warn(`Could not create RTCPeerConnection for ${peerId}:`, err);
      return null;
    }

    const audioElement = typeof document !== 'undefined' ? document.createElement('audio') : null;
    if (audioElement) {
      audioElement.autoplay = true;
      audioElement.playsInline = true;
      audioElement.muted = this.isDeafened;
      audioElement.volume = Math.min(1.0, this.volume);
    }

    const peer = {
      peerId,
      pc,
      audioElement,
      stream: null,
      analyser: null,
      isSpeaking: false,
      isMuted: false,
      isPolite,
      makingOffer: false,
      ignoreOffer: false,
    };

    this.peers.set(peerId, peer);

    // Add local tracks if microphone stream is active
    if (this.localStream) {
      for (const track of this.localStream.getAudioTracks()) {
        try {
          pc.addTrack(track, this.localStream);
        } catch (err) {
          console.warn(`Failed adding track to peer ${peerId}:`, err);
        }
      }
    }

    // ICE Candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate && this.network?.connected) {
        this.network.sendVoiceSignal(peerId, { candidate: event.candidate });
      }
    };

    // Track handler (receive incoming voice audio)
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      peer.stream = remoteStream;
      if (audioElement) {
        audioElement.srcObject = remoteStream;
        audioElement.play().catch((err) => {
          console.warn(`Autoplay blocked for voice peer ${peerId}:`, err);
        });
      }
      this.attachRemoteAnalyser(peer, remoteStream);
    };

    // Perfect negotiation onnegotiationneeded
    pc.onnegotiationneeded = async () => {
      try {
        peer.makingOffer = true;
        await pc.setLocalDescription();
        if (this.network?.connected) {
          this.network.sendVoiceSignal(peerId, { description: pc.localDescription });
        }
      } catch (err) {
        console.warn(`Negotiation error for peer ${peerId}:`, err);
      } finally {
        peer.makingOffer = false;
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.removePeer(peerId);
      }
      this.emitState();
    };

    this.emitState();
    return peer;
  }

  attachRemoteAnalyser(peer, stream) {
    if (!this.audioContext || !stream) return;
    try {
      const source = this.audioContext.createMediaStreamSource(stream);
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      peer.analyser = analyser;
      peer.analyserData = new Uint8Array(analyser.frequencyBinCount);
    } catch (err) {
      console.warn(`Remote analyser error for peer ${peer.peerId}:`, err);
    }
  }

  async handleVoiceSignal(senderId, signal) {
    if (!senderId || !signal) return;
    let peer = this.peers.get(senderId);
    if (!peer) {
      peer = this.createPeerConnection(senderId, false);
      if (!peer) return;
    }

    const { pc } = peer;

    try {
      if (signal.description) {
        const description = signal.description;
        const offerCollision =
          description.type === 'offer' &&
          (peer.makingOffer || pc.signalingState !== 'stable');

        peer.ignoreOffer = !peer.isPolite && offerCollision;
        if (peer.ignoreOffer) {
          return;
        }

        await pc.setRemoteDescription(description);

        if (description.type === 'offer') {
          await pc.setLocalDescription();
          if (this.network?.connected) {
            this.network.sendVoiceSignal(senderId, { description: pc.localDescription });
          }
        }
      } else if (signal.candidate) {
        try {
          await pc.addIceCandidate(signal.candidate);
        } catch (err) {
          if (!peer.ignoreOffer) {
            console.warn(`ICE candidate error for peer ${senderId}:`, err);
          }
        }
      }
    } catch (err) {
      console.warn(`Signal handling error from ${senderId}:`, err);
    }
  }

  handleVoiceStatus(playerId, isSpeaking, isMuted, isDeafened) {
    const peer = this.peers.get(playerId);
    if (peer) {
      peer.isSpeaking = Boolean(isSpeaking);
      peer.isMuted = Boolean(isMuted);
    }
    this.callbacks.onPeerSpeakingChange?.(playerId, Boolean(isSpeaking), Boolean(isMuted));
    this.emitState();
  }

  removePeer(peerId) {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    if (peer.audioElement) {
      peer.audioElement.pause();
      peer.audioElement.srcObject = null;
      peer.audioElement.remove?.();
    }

    if (peer.pc) {
      peer.pc.onicecandidate = null;
      peer.pc.ontrack = null;
      peer.pc.onnegotiationneeded = null;
      peer.pc.onconnectionstatechange = null;
      peer.pc.close();
    }

    this.peers.delete(peerId);
    this.callbacks.onPeerSpeakingChange?.(peerId, false, false);
    this.emitState();
  }

  emitState() {
    this.callbacks.onVoiceStateChange?.({
      isMuted: this.isMuted,
      isDeafened: this.isDeafened,
      pushToTalk: this.pushToTalk,
      isPttPressed: this.isPttPressed,
      isSpeaking: this.isSpeaking,
      volume: this.volume,
      permissionState: this.permissionState,
      peerCount: this.peers.size,
      connectedPeers: Array.from(this.peers.keys()),
    });
  }

  reset() {
    for (const peerId of Array.from(this.peers.keys())) {
      this.removePeer(peerId);
    }
  }

  destroy() {
    this.isDestroyed = true;
    if (this.vadInterval) {
      clearInterval(this.vadInterval);
      this.vadInterval = null;
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.boundKeyDown);
      window.removeEventListener('keyup', this.boundKeyUp);
    }

    this.reset();

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch (e) {
        // Ignored
      }
      this.audioContext = null;
    }
  }
}
