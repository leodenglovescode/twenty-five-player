import assert from 'node:assert/strict';
import { PlaybackSession } from '../playback.js';
class FakeAudio extends EventTarget {
  paused=true;ended=false;events=[];pending=[];
  pause(){this.events.push('pause');this.paused=true;}
  load(){this.events.push('load:'+this.src);this.ended=false;}
  play(){this.events.push('play:'+this.src);this.paused=false;this.dispatchEvent(new Event('play'));return new Promise((resolve,reject)=>this.pending.push({resolve,reject}));}
}
const store=new Map();const storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};
const channels=[];
const channel=()=>{const c={onmessage:null,postMessage:m=>{for(const other of channels)if(other!==c)queueMicrotask(()=>other.onmessage?.({data:m}));},close(){}};channels.push(c);return c;};
const audio=new FakeAudio(), orphan=new FakeAudio();orphan.paused=false;
const first=new PlaybackSession(audio,{id:'one',now:()=>1000,channel:channel(),storage,peers:()=>[audio,orphan]});
const old=first.play('a.wav');assert.equal(orphan.paused,true);
const latest=first.play('b.wav');assert.deepEqual(audio.events.slice(0,6),['pause','load:a.wav','play:a.wav','pause','load:b.wav','play:b.wav']);
audio.pending[1].resolve();assert.equal(await latest,true);audio.pending[0].resolve();assert.equal(await old,false);assert.equal(audio.src,'b.wav');assert.equal(first.wanted,true);
assert.equal(first.consumeEnded(),false);audio.ended=true;assert.equal(first.consumeEnded(),true);assert.equal(first.consumeEnded(),false);
const resume=first.play('c.wav');first.pause();audio.pending[2].resolve();assert.equal(await resume,false);assert.equal(audio.paused,true);assert.equal(first.wanted,false);
const again=first.play('d.wav');audio.pending[3].resolve();await again;
const secondAudio=new FakeAudio();let interruptions=0;first.onInterrupted=()=>interruptions++;
const second=new PlaybackSession(secondAudio,{id:'two',now:()=>1000,channel:channel(),storage,peers:()=>[secondAudio]});
const takeover=second.play('e.wav');secondAudio.pending[0].resolve();await takeover;await Promise.resolve();assert.equal(first.wanted,false);assert.equal(audio.paused,true);assert.equal(secondAudio.paused,false);assert.equal(interruptions,1);
const stale=first.play('f.wav');first.pause();audio.pending[4].reject(Object.assign(new Error('interrupted'),{name:'AbortError'}));assert.equal(await stale,false);
first.destroy();second.destroy();
console.log('Passed: stop-before-source-change, stale requests, pause while loading, duplicate ended events, stray media, and cross-tab ownership.');
