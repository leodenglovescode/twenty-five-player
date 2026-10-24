// One music element and one current play intent. Other tribute tabs relinquish
// playback when a newer tab claims it; no music is ever mixed or cross-faded.
export class PlaybackSession {
  constructor(audio, { onInterrupted = () => {}, peers = () => document.querySelectorAll('audio, video'), channel, storage, now = () => Date.now(), id } = {}) {
    this.audio = audio;
    this.onInterrupted = onInterrupted;
    this.peers = peers;
    this.now = now;
    this.id = id ?? globalThis.crypto.randomUUID();
    this.generation = 0;
    this.wanted = false;
    this.source = null;
    this.lastSeen = 0;
    this.claim = null;
    this.endedGeneration = -1;
    this.key = 'twenty-five:playback-owner';
    try { this.storage = storage ?? globalThis.localStorage; } catch { this.storage = null; }
    try { this.channel = channel ?? new BroadcastChannel(this.key); } catch { this.channel = null; }
    this.receive = (message) => {
      if (!message || message.type !== 'claim' || typeof message.id !== 'string' || !Number.isSafeInteger(message.time)) return;
      this.lastSeen = Math.max(this.lastSeen, message.time);
      if (message.id === this.id || !this.claim) return;
      const newer = message.time > this.claim.time || (message.time === this.claim.time && message.id > this.id);
      if (newer && this.wanted) { this.pause(); this.onInterrupted(); }
    };
    if (this.channel) this.channel.onmessage = (event) => this.receive(event.data);
    this.storageListener = (event) => {
      if (event.key !== this.key || !event.newValue) return;
      try { this.receive(JSON.parse(event.newValue)); } catch { /* Ignore unrelated data. */ }
    };
    globalThis.addEventListener?.('storage', this.storageListener);
    this.playListener = () => {
      if (!this.wanted) { audio.pause(); return; }
      for (const other of this.peers()) if (other !== audio && !other.paused) other.pause();
    };
    audio.addEventListener('play', this.playListener);
    this.leaveListener = () => this.pause();
    globalThis.addEventListener?.('pagehide', this.leaveListener);
  }
  claimPlayback() {
    try {
      const stored = JSON.parse(this.storage?.getItem(this.key) || 'null');
      if (Number.isSafeInteger(stored?.time)) this.lastSeen = Math.max(this.lastSeen, stored.time);
    } catch { /* BroadcastChannel remains available if storage is blocked. */ }
    this.claim = { type: 'claim', id: this.id, time: Math.max(this.now(), this.lastSeen + 1) };
    this.lastSeen = this.claim.time;
    try { this.storage?.setItem(this.key, JSON.stringify(this.claim)); } catch {}
    try { this.channel?.postMessage(this.claim); } catch {}
  }
  async play(source) {
    const ticket = ++this.generation;
    this.wanted = true;
    this.claimPlayback();
    // Stop the old source before assigning or loading the next one.
    this.audio.pause();
    if (this.source !== source) {
      this.source = source;
      this.audio.src = source;
      this.audio.load();
    }
    try {
      await this.audio.play();
      return ticket === this.generation && this.wanted;
    } catch (error) {
      if (ticket !== this.generation || error.name === 'AbortError') return false;
      this.wanted = false;
      throw error;
    }
  }
  pause() {
    ++this.generation;
    this.wanted = false;
    this.audio.pause();
  }
  consumeEnded() {
    if (!this.wanted || !this.audio.ended || this.endedGeneration === this.generation) return false;
    this.endedGeneration = this.generation;
    this.wanted = false;
    return true;
  }
  destroy() {
    this.pause();
    this.channel?.close();
    this.audio.removeEventListener('play', this.playListener);
    globalThis.removeEventListener?.('storage', this.storageListener);
    globalThis.removeEventListener?.('pagehide', this.leaveListener);
  }
}
