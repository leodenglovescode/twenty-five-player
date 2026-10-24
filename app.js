import { PlaybackSession } from './playback.js';
// Original implementation. No Apple code, fonts, graphics, catalog or services.
const $ = (id) => document.getElementById(id);
const audio = $('audio');
const playback = new PlaybackSession(audio, { onInterrupted: () => {
  ++playbackRequest; announce('Playback paused because another Twenty Five tab started playing.'); render();
} });
const demoTracks = [
  { title: 'First Light', artist: 'Twenty Five', album: 'Small Circuits', src: 'audio/first-light.wav' },
  { title: 'Pocket Orbit', artist: 'Twenty Five', album: 'Small Circuits', src: 'audio/pocket-orbit.wav' },
  { title: 'Long Way Home', artist: 'Twenty Five', album: 'Small Circuits', src: 'audio/long-way-home.wav' }
];
let tracks = [...demoTracks];
let page = { type: 'root', title: 'Twenty Five', index: 0 };
const history = [];
let queue = [...tracks], current = null, held = false, clicker = true, backlit = false;
let shuffle = false, repeat = false, playerMode = 'progress', volume = 0.6, context;
let clickTime = -Infinity, clickBuffer, volumeOverlay = false, volumeTimer;
function clearVolumeOverlay() { clearTimeout(volumeTimer); volumeOverlay = false; }
audio.volume = volume;
const escape = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatTime = (t) => `${Math.floor((Number.isFinite(t) ? t : 0)/60)}:${String(Math.floor((Number.isFinite(t) ? t : 0)%60)).padStart(2,'0')}`;
const announce = (text) => { $('status').textContent = text; };
function click() {
  if (!clicker) return;
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') context.resume().catch(()=>{});
    const now = context.currentTime;
    if (now - clickTime < 0.025) return;
    clickTime = now;
    // Original, deterministic noise impulse: short attack, damped body, no beep.
    if (!clickBuffer) {
      clickBuffer = context.createBuffer(1, Math.ceil(context.sampleRate*.018), context.sampleRate);
      const data = clickBuffer.getChannelData(0); let seed = 137;
      for (let n=0; n<data.length; n++) {
        seed = (Math.imul(seed,1664525)+1013904223) >>> 0;
        const t = n/context.sampleRate;
        data[n] = (seed/2147483648-1)*Math.min(1,t/.0007)*Math.exp(-t*390);
      }
    }
    const source=context.createBufferSource(), filter=context.createBiquadFilter(), gain=context.createGain();
    source.buffer=clickBuffer; filter.type='lowpass'; filter.frequency.value=1650; filter.Q.value=.55;
    gain.gain.value=.24; source.connect(filter).connect(gain).connect(context.destination);
    source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};source.start(now);
    const body=context.createOscillator(), bodyGain=context.createGain();
    body.type='sine';body.frequency.setValueAtTime(730,now);body.frequency.exponentialRampToValueAtTime(410,now+.012);
    bodyGain.gain.setValueAtTime(.055,now);bodyGain.gain.exponentialRampToValueAtTime(.0001,now+.018);
    body.connect(bodyGain).connect(context.destination);body.start(now);body.stop(now+.02);
    body.onended=()=>{body.disconnect();bodyGain.disconnect();};
  } catch { /* Audio is optional; navigation remains available. */ }
}
function open(next) {
  clearVolumeOverlay();history.push({...page}); page = {index:0,...next}; playerMode='progress';render();
}
function back() {
  if (held) return;
  clearVolumeOverlay();
  if (page.type === 'now' && history.length === 0) page={type:'root',title:'Twenty Five',index:0};
  else page = history.pop() || {type:'root',title:'Twenty Five',index:0};
  render();
}
function items() {
  switch(page.type) {
    case 'root': return [
      ['Playlists',()=>open({type:'playlists',title:'Playlists'})],
      ['Artists',()=>open({type:'artists',title:'Artists'})],
      ['Songs',()=>open({type:'songs',title:'Songs',songs:tracks})],
      ['Settings',()=>open({type:'settings',title:'Settings'})],
      ['About',()=>open({type:'about',title:'About'})],
      ['Now Playing',()=>current ? open({type:'now',title:'Now Playing'}) : open({type:'empty',title:'Now Playing'})]
    ];
    case 'music': return [
      ['Playlists',()=>open({type:'playlists',title:'Playlists'})],
      ['Artists',()=>open({type:'artists',title:'Artists'})],
      ['Albums',()=>open({type:'albums',title:'Albums'})],
      ['Songs',()=>open({type:'songs',title:'Songs',songs:tracks})],
      ['Shuffle Songs',()=>{shuffle=true;playTrack(tracks[Math.floor(Math.random()*tracks.length)],tracks);}]
    ];
    case 'playlists': return [
      ['All Music',()=>open({type:'songs',title:'All Music',songs:tracks})],
      ['Original Demos',()=>open({type:'songs',title:'Original Demos',songs:demoTracks})],
      ['Your Music',()=>open({type:'songs',title:'Your Music',songs:tracks.filter(t=>t.local)})]
    ];
    case 'artists': return [...new Set(tracks.map(t=>t.artist))].sort().map(artist=>[artist,()=>open({type:'songs',title:artist,songs:tracks.filter(t=>t.artist===artist)})]);
    case 'albums': return [...new Set(tracks.map(t=>t.album))].sort().map(album=>[album,()=>open({type:'songs',title:album,songs:tracks.filter(t=>t.album===album)})]);
    case 'songs': return (page.songs || tracks).map(t=>[t.title,()=>playTrack(t,page.songs || tracks)]);
    case 'settings': return [
      ['Shuffle',()=>{shuffle=!shuffle;render();},()=>shuffle?'Songs':'Off'],
      ['Repeat',()=>{repeat=!repeat;render();},()=>repeat?'All':'Off'],
      ['Backlight',()=>{backlit=!backlit;render();},()=>backlit?'On':'Off'],
      ['Clicker',()=>{clicker=!clicker;render();},()=>clicker?'On':'Off'],
      ['Volume',()=>open({type:'volume',title:'Volume'})]
    ];
    default:return [];
  }
}
function render() {
  $('screen').classList.toggle('backlit',backlit);
  $('screen-title').textContent=page.title;
  $('play-state').textContent=held?'▣':current?(audio.paused?'Ⅱ':'▶'):'';
  const content=$('screen-content');
  if (page.type === 'now') {renderNow();return;}
  if (page.type === 'volume') {
    content.innerHTML=`<div class="screen-note">Volume<br><strong>${Math.round(volume*100)}%</strong><div class="progress"><i style="width:${volume*100}%"></i></div></div>`;return;
  }
  if (page.type === 'about') {
    content.innerHTML=`<div class="screen-note">Twenty Five<br>${tracks.length} songs · 3 original demos<br>2001 — 2026<br>Built for the browser.</div>`;return;
  }
  if (page.type === 'empty') {content.innerHTML='<div class="screen-note">Nothing playing.<br>Choose Songs to play.</div>';return;}
  const rows=items();page.index=Math.max(0,Math.min(page.index,rows.length-1));
  if (!rows.length) {content.innerHTML='<div class="screen-note">No songs yet.<br>Use “Add your music”.</div>';return;}
  const start=Math.max(0,page.index-5);
  content.innerHTML=`<ul class="menu-list" role="listbox" aria-label="${escape(page.title)}">${rows.slice(start,start+6).map(([name,action,value],i)=>`<li class="menu-row ${start+i===page.index?'selected':''}" role="option" aria-selected="${start+i===page.index}" data-index="${start+i}"><span>${escape(name)}</span><span>${value ? escape(value()):'›'}</span></li>`).join('')}</ul>`;
  content.querySelectorAll('[data-index]').forEach(row=>row.addEventListener('click',()=>{if(held)return;page.index=Number(row.dataset.index);choose();}));
}
function renderNow() {
  if (!current) return;
  const content=$('screen-content');
  const duration=Number.isFinite(audio.duration)?audio.duration:0;
  const elapsed=audio.currentTime;
  const seeking=playerMode==='seek', showVolume=!seeking && volumeOverlay;
  const percent=showVolume ? volume*100 : duration?elapsed/duration*100:0;
  const safePercent=Math.max(0,Math.min(100,percent));
  const barRole=seeking?'slider':'progressbar';
  const barAttributes=seeking
    ? `tabindex="0" aria-label="Song position" aria-valuenow="${elapsed.toFixed(1)}" aria-valuemin="0" aria-valuemax="${duration}" aria-valuetext="${formatTime(elapsed)} of ${formatTime(duration)}"`
    : `aria-label="${showVolume?'Volume':'Playback progress'}" aria-valuenow="${Math.round(safePercent)}" aria-valuemin="0" aria-valuemax="100"`;
  // Preserve the focused slider across time updates for keyboard users.
  const focused=content.querySelector('.progress')===document.activeElement;
  content.innerHTML=`<div class="now-count"><span>${Math.max(0,queue.indexOf(current))+1} of ${queue.length}</span><span>${shuffle?'S ':''}${repeat?'↻':''}</span></div><div class="track-title">${escape(current.title)}</div><div class="track-artist">${escape(current.artist)}</div><div class="track-album">${escape(current.album)}</div><div class="progress ${seeking?'scrubber':''}" role="${barRole}" ${barAttributes}><i style="width:${safePercent}%"></i>${seeking?`<b class="playhead" style="left:${safePercent}%"></b>`:''}</div><div class="times"><span>${showVolume?'Volume':formatTime(elapsed)}</span><span>${showVolume?Math.round(volume*100)+'%':'−'+formatTime(duration-elapsed)}</span></div><div class="mode-label">${seeking?'Scroll or drag to seek':showVolume?'Scroll for volume':'Center: seek'}</div>`;
  if(focused && seeking)content.querySelector('.progress').focus({preventScroll:true});
}
function move(step) {
  if (held || !step) return;
  if (page.type==='volume' || (page.type==='now' && playerMode!=='seek')) {
    const next=Math.max(0,Math.min(1,volume+step*.025));
    if(next===volume)return;
    volume=next;audio.volume=volume;
    if(page.type==='now') {
      volumeOverlay=true;clearTimeout(volumeTimer);
      volumeTimer=setTimeout(()=>{volumeOverlay=false;if(page.type==='now')renderNow();},1400);
    }
  } else if (page.type==='now' && playerMode==='seek') {
    if(!Number.isFinite(audio.duration) || audio.duration<=0)return;
    const next=Math.max(0,Math.min(audio.duration,audio.currentTime+step*2));
    if(next===audio.currentTime)return;
    audio.currentTime=next;
  } else {
    const count=items().length;
    const next=Math.max(0,Math.min(count-1,page.index+step));
    if(!count || next===page.index)return;
    page.index=next;click();
  }
  render();
}
function choose() {
  if (held) return;
  if (page.type==='now') {
    clearVolumeOverlay();playerMode=playerMode==='seek'?'progress':'seek';render();return;
  }
  items()[page.index]?.[1]();
}
// The slider is active after pressing Center. Capture on its stable container,
// because playback updates replace the visual bar while a pointer is held.
const display=$('screen-content');let scrubbing=false;
function seekFromPointer(e) {
  if(held || page.type!=='now' || playerMode!=='seek' || !Number.isFinite(audio.duration))return;
  const bar=display.querySelector('.scrubber');if(!bar)return;
  const bounds=bar.getBoundingClientRect();
  const fraction=Math.max(0,Math.min(1,(e.clientX-bounds.left)/bounds.width));
  audio.currentTime=fraction*audio.duration;renderNow();
}
display.addEventListener('pointerdown',e=>{
  if(!e.target.closest('.scrubber') || held)return;
  e.preventDefault();scrubbing=true;display.setPointerCapture(e.pointerId);seekFromPointer(e);
});
display.addEventListener('pointermove',e=>{if(scrubbing)seekFromPointer(e);});
for(const event of ['pointerup','pointercancel','lostpointercapture'])display.addEventListener(event,()=>scrubbing=false);
display.addEventListener('keydown',e=>{
  if(!e.target.closest('.scrubber') || held)return;
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
  e.preventDefault();e.stopPropagation();
  if(!Number.isFinite(audio.duration))return;
  if(e.key==='Home')audio.currentTime=0;
  else if(e.key==='End')audio.currentTime=audio.duration;
  else audio.currentTime=Math.max(0,Math.min(audio.duration,audio.currentTime+(['ArrowLeft','ArrowDown'].includes(e.key)?-1:1)*(e.shiftKey?5:1)));
  renderNow();
});
let playbackRequest = 0;
async function playTrack(track,list=queue,show=true) {
  if (!track) {announce('Add an audio file first.');return;}
  const request = ++playbackRequest;
  queue=[...list];
  if(track!==current){clearVolumeOverlay();playerMode='progress';scrubbing=false;}
  current=track;
  if(show && page.type!=='now')open({type:'now',title:'Now Playing'});
  try {
    const started = await playback.play(track.src);
    if (started && request===playbackRequest)announce(`Playing ${track.title} — ${track.artist}.`);
  } catch(e) {
    if (request===playbackRequest && e.name!=='AbortError')announce(`Could not play ${track.title}. This browser may not support its audio format.`);
  }
  render();
}
function togglePlay() {
  if (held)return;
  if(!current) {
    if(page.type==='songs')playTrack(page.songs[page.index],page.songs);
    else playTrack(tracks[0],tracks);
  } else if(!playback.wanted)playTrack(current,queue,false);
  else {++playbackRequest;playback.pause();announce(`Paused ${current.title}.`);}
}
function skip(direction,automatic=false) {
  if (held && !automatic)return;
  if(!current)return playTrack(tracks[0],tracks);
  if(direction<0 && audio.currentTime>3){audio.currentTime=0;return;}
  let index=queue.indexOf(current)+direction;
  if(shuffle && direction>0 && queue.length>1) {
    const options=queue.filter(t=>t!==current);return playTrack(options[Math.floor(Math.random()*options.length)],queue,false);
  }
  if(index>=queue.length && automatic && !repeat){playback.pause();audio.currentTime=0;render();announce('Playback finished.');return;}
  index=(index+queue.length)%queue.length;
  playTrack(queue[index],queue,false);
}
$('menu').onclick=back;$('select').onclick=choose;$('play').onclick=togglePlay;
$('previous').onclick=()=>skip(-1);$('next').onclick=()=>skip(1);
// The complete segmented ring is clickable; focused buttons stay on its outer edge.
document.querySelector('.controls').addEventListener('click',e=>{
  if(e.target.closest('button') || e.target.closest('.wheel'))return;
  const r=e.currentTarget.getBoundingClientRect();
  const x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2;
  if(Math.hypot(x,y)<r.width*.39)return;
  if(Math.abs(y)>Math.abs(x)) y<0?back():togglePlay();
  else skip(x<0?-1:1);
});
$('hold').onclick=()=>{held=!held;$('hold').setAttribute('aria-pressed',held);$('hold-overlay').hidden=!held;announce(held?'Hold is on. Slide the top switch to unlock.':'Controls unlocked.');render();};
$('device').addEventListener('keydown',e=>{
  if(e.target.id==='hold')return;
  if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter','Escape',' '].includes(e.key))return;
  // Enter/Space on physical buttons retain their native activation.
  if(e.target.tagName==='BUTTON' && (e.key==='Enter'||e.key===' '))return;
  e.preventDefault();
  if(e.key==='ArrowUp')move(-1);if(e.key==='ArrowDown')move(1);
  if(e.key==='ArrowLeft')skip(-1);if(e.key==='ArrowRight')skip(1);
  if(e.key==='Enter')choose();if(e.key==='Escape')back();if(e.key===' ')togglePlay();
});
const wheel=$('wheel');let drag=null, rotation=0;
function angle(e){const r=wheel.getBoundingClientRect();return Math.atan2(e.clientY-r.top-r.height/2,e.clientX-r.left-r.width/2);}
wheel.addEventListener('pointerdown',e=>{
  if(e.target.closest('button') || held)return;
  e.preventDefault();$('device').focus();wheel.setPointerCapture(e.pointerId);
  drag={angle:angle(e),remainder:0};
});
wheel.addEventListener('pointermove',e=>{
  if(!drag)return;
  const a=angle(e);let delta=a-drag.angle;
  if(delta>Math.PI)delta-=2*Math.PI;if(delta< -Math.PI)delta+=2*Math.PI;
  drag.angle=a;drag.remainder+=delta;rotation+=delta;
  wheel.style.setProperty('--wheel-angle',`${rotation}rad`);
  const steps=Math.trunc(drag.remainder/(Math.PI/12));
  if(steps){drag.remainder-=steps*Math.PI/12;move(steps);}
});
for(const event of ['pointerup','pointercancel','lostpointercapture'])wheel.addEventListener(event,()=>drag=null);
for(const event of ['play','pause','loadedmetadata','durationchange','timeupdate'])audio.addEventListener(event,()=>{if(page.type==='now')renderNow();$('play-state').textContent=held?'▣':current?(audio.paused?'Ⅱ':'▶'):'';});
audio.addEventListener('ended',()=>{ if(playback.consumeEnded())skip(1,true); });
audio.addEventListener('error',()=>{ if(audio.error){playback.pause();announce('Audio could not be loaded. Try a supported MP3, WAV, or M4A file.');} });
function addFiles(files) {
  const imported=[...files].filter(f=>f.type.startsWith('audio/')||/\.(mp3|m4a|aac|wav|ogg|flac|opus|aif|aiff)$/i.test(f.name)).map(file=>{
    const name=file.name.replace(/\.[^.]+$/,'');const parts=name.split(' - ');
    return {title:parts.length>1?parts.slice(1).join(' - '):name,artist:parts.length>1?parts[0]:'Your music',album:'Local files',src:URL.createObjectURL(file),local:true};
  });
  if(!imported.length){announce('Choose audio files such as MP3, WAV, or M4A.');return;}
  tracks.push(...imported);history.length=0;page={type:'songs',title:'Your Music',index:0,songs:tracks.filter(t=>t.local)};render();
  announce(`${imported.length} ${imported.length===1?'song added':'songs added'}. Files stay in this tab; refresh to clear them.`);
  $('device').focus();
}
$('music-files').onchange=e=>{addFiles(e.target.files);e.target.value='';};
$('demo').onclick=()=>{held=false;$('hold').setAttribute('aria-pressed','false');$('hold-overlay').hidden=true;playTrack(demoTracks[0],demoTracks);$('device').focus();};
let dragDepth=0;
window.addEventListener('dragenter',e=>{if([...e.dataTransfer.types].includes('Files')){e.preventDefault();dragDepth++;document.body.classList.add('dragging');}});
window.addEventListener('dragover',e=>{if([...e.dataTransfer.types].includes('Files'))e.preventDefault();});
window.addEventListener('dragleave',()=>{dragDepth=Math.max(0,dragDepth-1);if(!dragDepth)document.body.classList.remove('dragging');});
window.addEventListener('drop',e=>{e.preventDefault();dragDepth=0;document.body.classList.remove('dragging');addFiles(e.dataTransfer.files);});
render();

// Immersion changes the page layout, without restarting the player.
let immersive=false;
function fitImmersivePlayer() {
  const scale=Math.min(1,(window.innerHeight-70)/550,(window.innerWidth-44)/326);
  document.documentElement.style.setProperty('--immersive-scale',String(Math.max(.2,scale)));
}
window.addEventListener('resize',fitImmersivePlayer);
function setImmersion(enabled) {
  immersive=enabled;fitImmersivePlayer();
  document.body.classList.toggle('immersive',enabled);
  $('immersion').setAttribute('aria-pressed',String(enabled));
  $('immersion').textContent=enabled?'Exit immersion':'Immersion mode';
  $('immersion-exit').hidden=!enabled;
  $('device').focus({preventScroll:true});
  window.scrollTo({top:0,behavior:'instant'});
}
$('immersion').onclick=()=>setImmersion(!immersive);
$('immersion-exit').onclick=()=>setImmersion(false);
window.addEventListener('keydown',e=>{
  if(immersive && e.key==='Escape') {
    e.preventDefault();e.stopImmediatePropagation();setImmersion(false);
  }
},true);
