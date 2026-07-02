import { useState, useEffect, useRef } from "react";
import { hasSupabase } from "./lib/supabase";
import { kvGet, kvSet, listMessages, addMessage, deleteMessage } from "./lib/db";

const DEFAULT_UNIT = "THE LEAD FARMERS";
const DEFAULT_MOTTO = "NEVER GO HALF. ONLY GO HARDCOVER. · A KENNY POWERS READING DIVISION";

/* ---------- absurd auto-assigned call signs ---------- */
const CS_RANK = ["SERGEANT", "MAJOR", "COLONEL", "CAPTAIN", "COMMANDANT", "GENERAL", "ADMIRAL", "GUNNERY SERGEANT", "FIELD MARSHAL", "SUPREME WARLORD", "DEPUTY DADDY"];
const CS_ADJ = ["IRON", "GASOLINE", "RAMPAGING", "BLISTERING", "NUCLEAR", "FERAL", "SWEATY", "CHISELED", "UNTAMED", "GREASED", "VELOCIRAPTOR", "BARE-KNUCKLE", "TURBO", "UNHINGED", "DENIM", "MUSTACHIOED", "FREEDOM", "GLISTENING", "SEMI-AUTOMATIC", "FLEXED", "DELUXE", "MOIST"];
const CS_NOUN = ["MUSTACHE", "HANDSHAKE", "BRISKET", "KNUCKLE", "JAWLINE", "WOLVERINE", "BRONCO", "MEATLOAF", "TESTOSTERONE", "GRAVEL", "CHEST BEARD", "THUNDERCLAP", "RIBEYE", "CAMARO", "MULLET", "GRILLMASTER", "BEEFCASTLE", "THUNDERDOME", "EAGLE", "PROTEIN", "LIBERTY", "DENIM", "BICEP", "WARLORD"];
const CS_FLAIR = ["", "", "", "", ", ESQUIRE", " JR.", ", PhD", " (RETIRED)", " (UNDEFEATED)", " THE THIRD", ", AMERICAN HERO"];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const makeCodename = () => `${pick(CS_RANK)} ${pick(CS_ADJ)} ${pick(CS_NOUN)}${pick(CS_FLAIR)}`;

/* ---------- explosion onomatopoeia ---------- */
const BOOM_WORDS = ["BOOM", "KABOOM", "BLAM", "FRAG OUT!", "BOOYAH", "OORAH", "KAPOW", "RATATAT", "HOOAH", "NAPALM!", "DAKKA", "SCORCHED"];

/* ---------- spawn a napalm explosion at screen coords ---------- */
function detonate(x, y) {
  if (typeof document === "undefined") return;
  let layer = document.getElementById("boom-layer");
  if (!layer) {
    layer = document.createElement("div");
    layer.id = "boom-layer";
    layer.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:99999;overflow:hidden";
    document.body.appendChild(layer);
  }
  const burst = document.createElement("div");
  burst.className = "boom";
  burst.style.left = x + "px";
  burst.style.top = y + "px";

  // rising smoke (behind)
  for (let i = 0; i < 3; i++) {
    const sm = document.createElement("div");
    sm.className = "smoke";
    sm.style.setProperty("--sx", (Math.random() * 50 - 25).toFixed(0) + "px");
    sm.style.animationDelay = (i * 60) + "ms";
    burst.appendChild(sm);
  }
  // napalm fireball
  const fb = document.createElement("div");
  fb.className = "fireball";
  burst.appendChild(fb);
  // secondary smaller fire blobs for rolling-flame look
  for (let i = 0; i < 4; i++) {
    const f2 = document.createElement("div");
    f2.className = "fireblob";
    const a = Math.random() * Math.PI * 2, d = 18 + Math.random() * 26;
    f2.style.setProperty("--bx", (Math.cos(a) * d).toFixed(0) + "px");
    f2.style.setProperty("--by", (Math.sin(a) * d).toFixed(0) + "px");
    f2.style.animationDelay = (Math.random() * 80).toFixed(0) + "ms";
    burst.appendChild(f2);
  }
  // shock ring
  const ring = document.createElement("div");
  ring.className = "boom-ring";
  burst.appendChild(ring);
  // debris shards + glowing embers
  const n = 14;
  for (let i = 0; i < n; i++) {
    const ang = (Math.PI * 2 * i) / n + Math.random() * 0.5;
    const dist = 42 + Math.random() * 70;
    const tx = (Math.cos(ang) * dist).toFixed(1) + "px";
    const ty = (Math.sin(ang) * dist).toFixed(1) + "px";
    const s = document.createElement("div");
    s.className = i % 2 ? "ember" : "shard";
    s.style.setProperty("--tx", tx);
    s.style.setProperty("--ty", ty);
    if (i % 2 === 0) s.style.background = Math.random() > 0.5 ? "#3a2a14" : "#1c1810";
    burst.appendChild(s);
  }
  // onomatopoeia (top)
  const word = document.createElement("div");
  word.className = "boom-word";
  word.textContent = BOOM_WORDS[Math.floor(Math.random() * BOOM_WORDS.length)];
  word.style.setProperty("--rot", (Math.random() * 28 - 14).toFixed(1) + "deg");
  burst.appendChild(word);

  layer.appendChild(burst);
  setTimeout(() => burst.remove(), 1100);
}

/* ---------- shared persistent storage, backed by Supabase key-value ---------- */
const store = {
  ok: hasSupabase,
  async get(key) {
    try {
      return await kvGet(key);
    } catch {
      return null;
    }
  },
  async set(key, value) {
    try {
      await kvSet(key, value);
      return true;
    } catch {
      return false;
    }
  },
};

/* ---------- shrink + compress an uploaded cover so it fits storage ---------- */
function compressImage(file, max = 360, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > max) {
          height = Math.round((height * max) / width);
          width = max;
        } else if (height >= width && height > max) {
          width = Math.round((width * max) / height);
          height = max;
        }
        const c = document.createElement("canvas");
        c.width = width;
        c.height = height;
        c.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(c.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const CSS = `
:root{
  --field:#15200f; --field2:#1f2c17; --olive:#3f5026; --olive-lt:#6f8a3c;
  --tan:#cdbb8d; --tan-dk:#a8946180; --ink:#0e150a; --bone:#ece6d0;
  --blaze:#b5402a; --blaze-lt:#d6552f; --steel:#7f9163;
  --leaf1:#15280f; --leaf2:#1f3d16; --leaf3:#2f5a21;
  --disp:'Black Ops One',Impact,'Haettenschweiler','Franklin Gothic Heavy','Arial Black',sans-serif;
  --cond:'Oswald','Arial Narrow','Helvetica Neue',Impact,sans-serif;
  --type:'Special Elite','Courier New',Courier,monospace;
}
*{box-sizing:border-box}
.hq{
  min-height:100vh; position:relative; overflow-x:hidden; background:var(--field);
  background-image:
    radial-gradient(ellipse at 50% -8%, rgba(130,180,60,.20), transparent 55%),
    radial-gradient(circle at 18% 10%, rgba(160,210,90,.12), transparent 28%),
    radial-gradient(circle at 82% 6%, rgba(160,210,90,.10), transparent 24%),
    radial-gradient(circle at 12% 85%, rgba(0,0,0,.42), transparent 45%),
    radial-gradient(circle at 88% 90%, rgba(0,0,0,.44), transparent 48%),
    repeating-linear-gradient(135deg, rgba(255,255,255,.012) 0 2px, transparent 2px 7px);
  color:var(--bone); font-family:var(--type); padding:0 0 70px;
}
.wrap{max-width:1000px; margin:0 auto; padding:0 16px; position:relative; z-index:2}
.foliage{position:fixed; z-index:0; pointer-events:none; filter:drop-shadow(0 6px 10px rgba(0,0,0,.4))}
.disp{font-family:var(--disp); letter-spacing:.04em; line-height:1}
.cond{font-family:var(--cond); text-transform:uppercase; letter-spacing:.12em}

/* corner-bracket panel — the field-manual frame */
.panel{position:relative; background:var(--field2);
  background-image:
    radial-gradient(ellipse 130px 95px at 100% 0%, rgba(8,6,3,.55), transparent 60%),
    radial-gradient(ellipse 95px 70px at 3% 97%, rgba(8,6,3,.45), transparent 60%);
  border:2px solid var(--ink);
  box-shadow:inset 0 0 0 4px rgba(205,187,141,.08), 0 7px 0 rgba(0,0,0,.35); padding:22px 20px; margin:18px 0}
.panel::before,.panel::after{content:""; position:absolute; width:18px; height:18px; border:3px solid var(--blaze); pointer-events:none}
.panel::before{top:8px; left:8px; border-right:0; border-bottom:0}
.panel::after{bottom:8px; right:8px; border-left:0; border-top:0}
.panel-label{display:inline-block; font-family:var(--cond); font-weight:700; letter-spacing:.18em;
  background:var(--blaze); color:var(--bone); padding:4px 14px; margin:-34px 0 16px -4px; font-size:13px;
  box-shadow:3px 3px 0 rgba(0,0,0,.4)}

/* stencil header — battered briefing */
.crate{border:3px solid var(--ink);
  background:linear-gradient(180deg,var(--olive),#3c3d22);
  background-image:
    radial-gradient(ellipse 220px 150px at 95% 6%, rgba(8,5,2,.6), transparent 60%),
    radial-gradient(circle at 7% 92%, rgba(8,5,2,.5), transparent 30%),
    linear-gradient(180deg,var(--olive),#3c3d22);
  box-shadow:inset 0 0 0 5px rgba(0,0,0,.15), 0 8px 0 rgba(0,0,0,.4); padding:30px 24px 26px; margin-top:22px; position:relative; overflow:hidden}
.crate h1{font-family:var(--disp); font-size:clamp(30px,6.4vw,62px); color:var(--bone);
  text-shadow:3px 3px 0 var(--ink),6px 6px 0 rgba(181,64,42,.45); margin:0; position:relative; z-index:2}
.crate .motto{font-family:var(--cond); letter-spacing:.22em; color:var(--tan); margin-top:8px; font-size:13px; position:relative; z-index:2}
.stampbig{position:absolute; top:14px; right:-6px; transform:rotate(8deg); border:4px solid var(--blaze);
  color:var(--blaze); font-family:var(--disp); padding:4px 12px; font-size:14px; opacity:.85; letter-spacing:.05em; z-index:3}

/* battle damage */
.bullet{position:absolute; border-radius:50%; pointer-events:none; z-index:4;
  background:radial-gradient(circle at 44% 40%, #000 0%, #0a0a06 40%, rgba(0,0,0,0) 72%);
  box-shadow:0 0 0 2px rgba(0,0,0,.4), inset 0 0 5px #000, 0 0 11px 3px rgba(0,0,0,.32)}
.bullet::after{content:""; position:absolute; inset:-7px; border-radius:50%;
  background:radial-gradient(circle, rgba(0,0,0,.2), transparent 70%)}
.scorch{position:absolute; pointer-events:none; z-index:1; filter:blur(3px); mix-blend-mode:multiply;
  background:radial-gradient(ellipse at center, rgba(12,8,4,.85), rgba(18,12,6,.32) 48%, transparent 72%)}
.coffee{position:absolute; pointer-events:none; z-index:1; border-radius:50%;
  border:7px solid rgba(70,45,20,.22); box-shadow:inset 0 0 0 4px rgba(70,45,20,.1)}
.tssmall{position:absolute; z-index:3; font-family:var(--disp); color:var(--blaze);
  border:4px solid var(--blaze); padding:2px 9px; letter-spacing:.05em; opacity:.78; font-size:12px;
  mix-blend-mode:screen}
.tape{position:absolute; z-index:5; width:104px; height:26px; pointer-events:none;
  background:repeating-linear-gradient(90deg, rgba(214,204,170,.4) 0 8px, rgba(196,186,150,.34) 8px 16px);
  border-left:2px dashed rgba(0,0,0,.18); border-right:2px dashed rgba(0,0,0,.18)}

/* tactical nav */
.nav{display:flex; flex-wrap:wrap; gap:8px; margin-top:18px}
.tab{font-family:var(--cond); font-weight:700; letter-spacing:.12em; font-size:14px; cursor:pointer;
  background:#1d1e15; color:var(--steel); border:2px solid var(--ink); padding:11px 16px;
  box-shadow:0 4px 0 rgba(0,0,0,.4); transition:transform .08s, color .15s}
.tab:hover{color:var(--bone)} .tab:active{transform:translateY(3px); box-shadow:0 1px 0 rgba(0,0,0,.4)}
.tab.on{background:var(--blaze); color:var(--bone); border-color:var(--ink)}

/* buttons + inputs */
.btn{font-family:var(--cond); font-weight:700; letter-spacing:.12em; cursor:pointer; border:2px solid var(--ink);
  background:var(--blaze); color:var(--bone); padding:11px 18px; box-shadow:0 4px 0 rgba(0,0,0,.45); transition:transform .08s}
.btn:hover{background:var(--blaze-lt)} .btn:active{transform:translateY(3px); box-shadow:0 1px 0 rgba(0,0,0,.45)}
.btn.ghost{background:#22231a; color:var(--tan)} .btn.ghost:hover{color:var(--bone)}
.btn.sm{padding:6px 11px; font-size:12px; box-shadow:0 3px 0 rgba(0,0,0,.45)}
.in,.ta,select.in{width:100%; font-family:var(--type); background:#15160e; color:var(--bone);
  border:2px solid var(--olive); padding:10px 12px; font-size:15px}
.in:focus,.ta:focus{outline:3px solid var(--blaze); outline-offset:0; border-color:var(--blaze)}
.ta{resize:vertical; min-height:84px}
label.fld{display:block; font-family:var(--cond); letter-spacing:.14em; font-size:12px; color:var(--tan); margin:12px 0 5px}
.row{display:flex; gap:12px; flex-wrap:wrap}
.row>div{flex:1 1 160px}

/* DOSSIER — the signature reading-list card */
.timeline{position:relative; margin-top:10px; padding-left:38px}
.timeline::before{content:""; position:absolute; left:14px; top:6px; bottom:6px; width:4px;
  background:repeating-linear-gradient(var(--olive-lt) 0 10px, transparent 10px 18px)}
.dossier{position:relative; background:var(--tan); color:var(--ink); border:2px solid var(--ink);
  margin-bottom:20px; padding:16px; box-shadow:5px 5px 0 rgba(0,0,0,.4); display:flex; gap:16px}
.dossier::before{content:""; position:absolute; left:-31px; top:20px; width:14px; height:14px; border-radius:50%;
  background:var(--blaze); border:3px solid var(--ink)}
.dossier:nth-child(odd){transform:rotate(-0.7deg)}
.dossier:nth-child(even){transform:rotate(0.7deg)}
.dossier .bullet{width:15px; height:15px}
.op{font-family:var(--disp); font-size:13px; color:var(--blaze)}
.dtitle{font-family:var(--cond); font-weight:700; font-size:21px; letter-spacing:.04em; line-height:1.05; margin:2px 0}
.meta{font-size:13px; color:#3b3623}
.cover{width:92px; min-width:92px; height:128px; object-fit:cover; border:2px solid var(--ink); background:#5c5436;
  box-shadow:3px 3px 0 rgba(0,0,0,.3)}
.cover.empty{display:flex; align-items:center; justify-content:center; font-family:var(--cond); color:var(--bone); font-size:11px; text-align:center; padding:6px}
.stamp{position:absolute; right:10px; top:10px; transform:rotate(-11deg); border:3px solid var(--blaze);
  color:var(--blaze); font-family:var(--disp); font-size:11px; padding:2px 7px; opacity:.9;
  animation:thunk .35s cubic-bezier(.2,1.4,.4,1) both}
@keyframes thunk{0%{transform:rotate(-11deg) scale(2.4); opacity:0}60%{opacity:1}100%{transform:rotate(-11deg) scale(1)}}
.verdict{margin-top:7px; font-size:14px; position:relative}
.verdict .label{font-family:var(--cond); letter-spacing:.12em; font-size:11px; color:#6b5e36}
.redact{position:relative; display:inline-block}
.redact .bar{position:absolute; inset:0; background:var(--ink); transition:transform .4s ease}
.redact:hover .bar,.redact:focus-within .bar{transform:translateX(101%)}

/* meetings */
.op-card{display:flex; gap:14px; align-items:center; background:#15160e; border:2px solid var(--olive);
  padding:14px; margin-bottom:12px}
.op-card.next{border-color:var(--blaze); box-shadow:0 0 0 3px rgba(181,64,42,.25)}
.datechip{font-family:var(--disp); text-align:center; background:var(--blaze); color:var(--bone);
  border:2px solid var(--ink); padding:8px 10px; min-width:66px}
.datechip .d{font-size:22px} .datechip .m{font-size:11px; letter-spacing:.1em}

/* comms */
.msg{background:#15160e; border-left:4px solid var(--blaze); border-top:1px solid #3a3a26; padding:12px 14px; margin-bottom:10px}
.msg .who{font-family:var(--cond); font-weight:700; letter-spacing:.1em; color:var(--blaze-lt)}
.msg .when{font-size:11px; color:var(--steel); float:right}
.msg .body{margin-top:6px; white-space:pre-wrap; word-break:break-word}

.empty{border:2px dashed var(--olive); padding:22px; text-align:center; color:var(--tan); font-size:14px}
.note{font-size:12px; color:var(--steel); margin-top:6px}
.banner{background:var(--blaze); color:var(--bone); font-family:var(--cond); letter-spacing:.1em;
  text-align:center; padding:8px; font-size:12px}
.foot{text-align:center; color:var(--steel); font-size:12px; margin-top:30px; font-family:var(--cond); letter-spacing:.14em}

/* gate */
.gate{min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px;
  background:var(--field); background-image:repeating-linear-gradient(135deg, rgba(0,0,0,.18) 0 26px, rgba(0,0,0,.06) 26px 52px)}
.gate-box{position:relative; z-index:2; max-width:420px; width:100%; background:var(--field2); border:3px solid var(--ink);
  box-shadow:0 10px 0 rgba(0,0,0,.45); padding:30px 26px; text-align:center}
.denied{color:var(--blaze); font-family:var(--disp); margin-top:12px; letter-spacing:.06em;
  animation:shake .35s}
@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-7px)}75%{transform:translateX(7px)}}

/* EXPLOSIONS — NAPALM */
.boom{position:absolute; transform:translate(-50%,-50%)}
.fireball{position:absolute; left:0; top:0; width:130px; height:130px; border-radius:50%;
  transform:translate(-50%,-50%) scale(.18); mix-blend-mode:screen; filter:blur(2px);
  background:radial-gradient(circle, #fff 0%, #ffe88a 16%, #ffb01f 36%, #ff6a13 56%, #c5371b 76%, rgba(40,12,0,.5) 90%, transparent 100%);
  animation:fball .6s ease-out forwards}
@keyframes fball{0%{transform:translate(-50%,-50%) scale(.18); opacity:1}
  35%{opacity:1} 100%{transform:translate(-50%,-50%) scale(1.55); opacity:0}}
.fireblob{position:absolute; left:0; top:0; width:54px; height:54px; border-radius:50%;
  transform:translate(-50%,-50%) scale(.3); mix-blend-mode:screen; filter:blur(2px);
  background:radial-gradient(circle, #ffe27a 0%, #ff8c1e 45%, #d6451c 72%, transparent 100%);
  animation:fblob .55s ease-out forwards}
@keyframes fblob{0%{transform:translate(-50%,-50%) scale(.3); opacity:.95}
  100%{transform:translate(calc(-50% + var(--bx)), calc(-50% + var(--by))) scale(1.1); opacity:0}}
.smoke{position:absolute; left:0; top:0; width:96px; height:96px; border-radius:50%;
  transform:translate(-50%,-50%) scale(.4); filter:blur(4px);
  background:radial-gradient(circle, rgba(60,55,48,.6), rgba(18,16,12,0) 70%);
  animation:smk 1s ease-out forwards}
@keyframes smk{0%{opacity:0; transform:translate(-50%,-50%) scale(.4)}
  25%{opacity:.65} 100%{opacity:0; transform:translate(calc(-50% + var(--sx)),-160%) scale(1.8)}}
.boom-ring{position:absolute; left:0; top:0; border-radius:50%; border:4px solid #ffce5a;
  transform:translate(-50%,-50%); animation:ring .5s ease-out forwards}
@keyframes ring{0%{width:8px;height:8px;opacity:1;border-width:7px}100%{width:150px;height:150px;opacity:0;border-width:1px}}
.boom-word{position:absolute; left:0; top:0; font-family:var(--disp); color:#ffd23f; font-size:28px;
  white-space:nowrap; text-shadow:2px 2px 0 var(--blaze),4px 4px 0 var(--ink); animation:bword .8s ease-out forwards}
@keyframes bword{
  0%{opacity:0; transform:translate(-50%,-90%) scale(.4) rotate(var(--rot))}
  22%{opacity:1; transform:translate(-50%,-160%) scale(1.18) rotate(var(--rot))}
  100%{opacity:0; transform:translate(-50%,-220%) scale(1) rotate(var(--rot))}}
.shard{position:absolute; left:0; top:0; width:9px; height:9px; transform:translate(-50%,-50%);
  animation:shard .66s ease-out forwards}
@keyframes shard{
  0%{opacity:1; transform:translate(-50%,-50%) rotate(0)}
  100%{opacity:0; transform:translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(.3) rotate(200deg)}}
.ember{position:absolute; left:0; top:0; width:6px; height:6px; border-radius:50%; background:#ffd23f;
  box-shadow:0 0 7px 2px #ff9d2f; transform:translate(-50%,-50%); animation:ember .7s ease-out forwards}
@keyframes ember{0%{opacity:1; transform:translate(-50%,-50%)}
  100%{opacity:0; transform:translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(.2)}}

.codetag{display:inline-block; background:var(--ink); color:var(--bone); border:2px solid var(--blaze);
  font-family:var(--cond); font-weight:700; letter-spacing:.14em; padding:6px 14px; margin-top:14px;
  box-shadow:3px 3px 0 rgba(0,0,0,.45); font-size:14px}
.codetag b{color:var(--blaze-lt)}

@media (max-width:560px){ .dossier{flex-direction:column} .cover{width:100%; height:200px} }
@media (prefers-reduced-motion:reduce){ *{animation:none!important; transition:none!important} #boom-layer{display:none} }
`;

/* ============================ JUNGLE FOLIAGE ============================ */
function Foliage() {
  const greens = ["#0f2410", "#16380f", "#1f4a16", "#2a5e1d", "#357024"];
  const rnd = (s) => { const x = Math.sin(s * 999.13) * 10000; return x - Math.floor(x); };
  const items = [];
  let key = 0;

  const broad = (cx, cy, rot, sc, ci, op) => {
    items.push(
      <g key={key++} transform={`translate(${cx} ${cy}) rotate(${rot}) scale(${sc})`} opacity={op}>
        <path d="M0 0 C -40 46, -40 124, 0 166 C 40 124, 40 46, 0 0 Z" fill={greens[ci]} />
        <path d="M0 4 C -22 46, -22 120, 0 150" fill="rgba(255,255,255,.05)" />
        <path d="M0 12 L0 152" stroke="rgba(0,0,0,.32)" strokeWidth="3" fill="none" />
        <path d="M0 48 L-22 36 M0 76 L-26 66 M0 104 L-24 96 M0 48 L22 36 M0 76 L26 66 M0 104 L24 96"
          stroke="rgba(0,0,0,.2)" strokeWidth="2" fill="none" />
      </g>
    );
  };

  const fern = (cx, cy, rot, sc, ci, op) => {
    const L = 152, N = 13, parts = [];
    parts.push(<path key="s" d={`M0 0 Q 12 ${L * 0.5} 0 ${L}`} stroke={greens[ci]} strokeWidth="3.5" fill="none" />);
    for (let i = 1; i <= N; i++) {
      const t = i / (N + 1), y = t * L, ll = (1 - t) * 22 + 7;
      parts.push(<ellipse key={i + "a"} cx={-ll * 0.55} cy={y} rx={ll} ry={3.6} transform={`rotate(-46 0 ${y})`} fill={greens[ci]} />);
      parts.push(<ellipse key={i + "b"} cx={ll * 0.55} cy={y} rx={ll} ry={3.6} transform={`rotate(46 0 ${y})`} fill={greens[ci]} />);
    }
    items.push(<g key={key++} transform={`translate(${cx} ${cy}) rotate(${rot}) scale(${sc})`} opacity={op}>{parts}</g>);
  };

  // dark back canopy
  for (let i = 0; i <= 9; i++) broad(i * 135 + rnd(i + 9) * 40, -58, (rnd(i + 11) - 0.5) * 40, 1.5 + rnd(i + 12) * 0.6, Math.floor(rnd(i + 13) * 2), 0.85);
  // front canopy hanging down
  for (let i = 0; i <= 13; i++) broad(i * 95 - 30 + rnd(i + 1) * 30, -28 + rnd(i + 2) * 30, (rnd(i + 3) - 0.5) * 46, 1.0 + rnd(i + 4) * 0.7, Math.floor(rnd(i + 5) * 3), 0.92);
  // undergrowth pointing up
  for (let i = 0; i <= 11; i++) broad(i * 110 - 20 + rnd(i + 21) * 40, 832, 180 + (rnd(i + 22) - 0.5) * 44, 1.2 + rnd(i + 23) * 0.8, Math.floor(rnd(i + 24) * 3), 0.92);
  // left edge
  for (let i = 0; i <= 5; i++) (i % 2 ? fern : broad)(-42 + rnd(i + 32) * 30, 110 + i * 120 + rnd(i + 31) * 40, -90 + (rnd(i + 33) - 0.5) * 50, 1.0 + rnd(i + 34) * 0.6, Math.floor(rnd(i + 35) * 3), 0.9);
  // right edge
  for (let i = 0; i <= 5; i++) (i % 2 ? fern : broad)(1242 - rnd(i + 42) * 30, 110 + i * 120 + rnd(i + 41) * 40, 90 + (rnd(i + 43) - 0.5) * 50, 1.0 + rnd(i + 44) * 0.6, Math.floor(rnd(i + 45) * 3), 0.9);
  // hanging vines
  for (let i = 0; i < 4; i++) {
    const x = 170 + i * 300 + rnd(i + 51) * 80, len = 150 + rnd(i + 52) * 230;
    items.push(
      <g key={key++} opacity="0.8">
        <path d={`M${x} -10 Q ${x + 30} ${len * 0.5} ${x - 10} ${len}`} stroke="#16380f" strokeWidth="3" fill="none" />
        <ellipse cx={x - 10} cy={len} rx="11" ry="4" fill="#1f4a16" />
        <ellipse cx={x + 8} cy={len * 0.6} rx="9" ry="3.6" fill="#1f4a16" transform={`rotate(30 ${x + 8} ${len * 0.6})`} />
      </g>
    );
  }

  return (
    <svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 0, pointerEvents: "none" }}>
      {items}
    </svg>
  );
}

/* ============================ ACCESS GATE ============================ */
function Gate({ onPass }) {
  const [code, setCode] = useState("");
  const submit = () => onPass(); // accepts anything — the gate is pure theater
  return (
    <div className="gate">
      <style>{CSS}</style>
      <Foliage />
      <div className="gate-box">
        <div className="cond" style={{ color: "var(--blaze)", letterSpacing: ".2em", fontSize: 12 }}>
          ▲ RESTRICTED — DEEP JUNGLE SECTOR ▲
        </div>
        <h2 className="disp" style={{ fontSize: 26, margin: "10px 0 4px" }}>AUTHORIZED<br />PERSONNEL ONLY</h2>
        <p className="note" style={{ marginBottom: 18 }}>Bang in any access code. We're not picky out here.</p>
        <input
          className="in" type="text" value={code} placeholder="ACCESS CODE (anything goes)"
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          aria-label="Access code"
        />
        <div style={{ marginTop: 16 }}>
          <button className="btn" style={{ width: "100%" }} onClick={submit}>DEPLOY ▶</button>
        </div>
        <p className="note" style={{ marginTop: 18 }}>
          No usernames. On deployment you'll be assigned a temporary call sign. Wear it with unearned pride.
        </p>
      </div>
    </div>
  );
}

/* ============================ READING LIST ============================ */
function ReadingList({ books, setBooks, persist }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", author: "", date: "", verdict: "", image: "" });
  const fileRef = useRef();

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const img = await compressImage(file);
      setF((p) => ({ ...p, image: img }));
    } catch {}
  };
  const add = () => {
    if (!f.title.trim()) return;
    const next = [...books, { id: uid(), ...f, title: f.title.trim() }];
    setBooks(next); persist("books", next);
    setF({ title: "", author: "", date: "", verdict: "", image: "" });
    if (fileRef.current) fileRef.current.value = "";
    setOpen(false);
  };
  const remove = (id) => {
    const next = books.filter((b) => b.id !== id);
    setBooks(next); persist("books", next);
  };
  const sorted = [...books].sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  return (
    <div className="panel">
      <span className="panel-label">▣ DECLASSIFIED READING LIST</span>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <p className="note" style={{ margin: 0 }}>Every title this unit has neutralized, in order of engagement.</p>
        <button className="btn sm" onClick={() => setOpen((v) => !v)}>{open ? "CANCEL" : "+ LOG A KILL"}</button>
      </div>

      {open && (
        <div style={{ background: "#15160e", border: "2px solid var(--olive)", padding: 16, marginTop: 14 }}>
          <div className="row">
            <div><label className="fld">TITLE *</label><input className="in" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
            <div><label className="fld">AUTHOR</label><input className="in" value={f.author} onChange={(e) => setF({ ...f, author: e.target.value })} /></div>
          </div>
          <div className="row">
            <div><label className="fld">MONTH READ</label><input className="in" type="month" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
            <div><label className="fld">COVER INTEL (image)</label><input ref={fileRef} className="in" type="file" accept="image/*" onChange={onFile} /></div>
          </div>
          <label className="fld">AGENT VERDICT</label>
          <textarea className="ta" value={f.verdict} onChange={(e) => setF({ ...f, verdict: e.target.value })} placeholder="Hot take. Keep it classified." />
          <div style={{ marginTop: 12 }}><button className="btn" onClick={add}>FILE DOSSIER</button></div>
        </div>
      )}

      <div className="timeline" style={{ marginTop: 18 }}>
        {sorted.length === 0 && <div className="empty">NO CONFIRMED KILLS YET. Log your first book to open the file.</div>}
        {sorted.map((b, i) => (
          <div className="dossier" key={b.id}>
            <span className="stamp">DECLASSIFIED</span>
            <span className="bullet" style={i % 2 ? { top: 12, right: 120 } : { bottom: 16, left: 116 }} />
            {b.image
              ? <img className="cover" src={b.image} alt={b.title} />
              : <div className="cover empty">NO COVER<br />ON FILE</div>}
            <div style={{ flex: 1 }}>
              <div className="op">OP-{String(i + 1).padStart(3, "0")}</div>
              <div className="dtitle">{b.title}</div>
              <div className="meta">{b.author || "AUTHOR UNKNOWN"} · {b.date ? fmtMonth(b.date) : "DATE REDACTED"}</div>
              {b.verdict && (
                <div className="verdict">
                  <span className="label">AGENT VERDICT ▾ </span>
                  <span className="redact" tabIndex={0}>{b.verdict}<span className="bar" /></span>
                </div>
              )}
              <div style={{ marginTop: 10 }}>
                <button className="btn ghost sm" onClick={() => remove(b.id)}>SCRUB FILE</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================ RALLY POINTS ============================ */
function RallyPoints({ meetings, setMeetings, persist }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ date: "", title: "", location: "", notes: "" });
  const add = () => {
    if (!f.date) return;
    const next = [...meetings, { id: uid(), ...f }];
    setMeetings(next); persist("meetings", next);
    setF({ date: "", title: "", location: "", notes: "" }); setOpen(false);
  };
  const remove = (id) => { const n = meetings.filter((m) => m.id !== id); setMeetings(n); persist("meetings", n); };
  const today = new Date().toISOString().slice(0, 10);
  const sorted = [...meetings].sort((a, b) => a.date.localeCompare(b.date));
  const nextId = sorted.find((m) => m.date >= today)?.id;

  return (
    <div className="panel">
      <span className="panel-label">▣ RALLY POINTS</span>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <p className="note" style={{ margin: 0 }}>Where and when the squad musters. Bring the book. Bring snacks.</p>
        <button className="btn sm" onClick={() => setOpen((v) => !v)}>{open ? "CANCEL" : "+ SET OP"}</button>
      </div>

      {open && (
        <div style={{ background: "#15160e", border: "2px solid var(--olive)", padding: 16, marginTop: 14 }}>
          <div className="row">
            <div><label className="fld">DATE *</label><input className="in" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
            <div><label className="fld">OP NAME</label><input className="in" value={f.title} placeholder="e.g. Chapter 7 Debrief" onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          </div>
          <label className="fld">LOCATION</label>
          <input className="in" value={f.location} placeholder="Dave's garage / The usual bar" onChange={(e) => setF({ ...f, location: e.target.value })} />
          <label className="fld">ORDERS</label>
          <textarea className="ta" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Read to ch. 12. No spoilers or you're on KP duty." />
          <div style={{ marginTop: 12 }}><button className="btn" onClick={add}>LOCK IT IN</button></div>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        {sorted.length === 0 && <div className="empty">NO OPS ON THE BOARD. Set a date before morale collapses.</div>}
        {sorted.map((m) => {
          const dt = new Date(m.date + "T00:00:00");
          return (
            <div className={"op-card" + (m.id === nextId ? " next" : "")} key={m.id}>
              <div className="datechip">
                <div className="d">{dt.getDate()}</div>
                <div className="m">{dt.toLocaleString("en", { month: "short" }).toUpperCase()}</div>
              </div>
              <div style={{ flex: 1 }}>
                {m.id === nextId && <span className="cond" style={{ color: "var(--blaze-lt)", fontSize: 11 }}>▶ NEXT OP</span>}
                <div className="cond" style={{ fontSize: 17, color: "var(--bone)" }}>{m.title || "MUSTER"}</div>
                <div className="note" style={{ color: "var(--tan)" }}>
                  {dt.toLocaleDateString("en", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                  {m.location ? ` · ${m.location}` : ""}
                </div>
                {m.notes && <div style={{ fontSize: 14, marginTop: 6 }}>{m.notes}</div>}
              </div>
              <button className="btn ghost sm" onClick={() => remove(m.id)}>CANCEL</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================ COMMS / MESSAGE BOARD ============================ */
function Comms({ messages, onSend, onScrub, reload, callsign, setCallsign }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const send = async () => {
    if (!text.trim() || sending) return;
    const cs = (callsign.trim() || "GHOST").toUpperCase();
    setSending(true);
    try {
      await onSend(cs, text.trim());
      setText("");
    } finally {
      setSending(false);
    }
  };
  const scrub = (id) => onScrub(id);

  return (
    <div className="panel">
      <span className="panel-label">▣ BARRACKS COMMS</span>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <p className="note" style={{ margin: 0 }}>Open channel. Everyone with the access code can read and transmit.</p>
        <button className="btn ghost sm" onClick={reload}>↻ REFRESH COMMS</button>
      </div>

      <div style={{ background: "#15160e", border: "2px solid var(--olive)", padding: 16, marginTop: 14 }}>
        <div className="row">
          <div style={{ flex: "0 1 220px" }}>
            <label className="fld">CALLSIGN</label>
            <input className="in" value={callsign} onChange={(e) => setCallsign(e.target.value)} placeholder="MAD DOG" />
          </div>
        </div>
        <label className="fld">TRANSMISSION</label>
        <textarea className="ta" value={text} onChange={(e) => setText(e.target.value)} placeholder="Say your piece, soldier." />
        <div style={{ marginTop: 12 }}><button className="btn" onClick={send} disabled={sending}>{sending ? "TRANSMITTING…" : "TRANSMIT ▶"}</button></div>
      </div>

      <div style={{ marginTop: 16 }}>
        {messages.length === 0 && <div className="empty">RADIO SILENCE. Be the first to break it.</div>}
        {messages.map((m) => (
          <div className="msg" key={m.id}>
            <span className="when">{relTime(m.ts)} <button className="btn ghost sm" style={{ padding: "1px 6px", marginLeft: 6 }} onClick={() => scrub(m.id)}>✖</button></span>
            <span className="who">{m.who}</span>
            <div className="body">{m.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================ HQ / SETTINGS ============================ */
function HQ({ unit, setUnit, motto, setMotto, persist, storageOk }) {
  const [u, setU] = useState(unit);
  const [m, setM] = useState(motto);
  const [saved, setSaved] = useState(false);
  const save = () => {
    setUnit(u); setMotto(m);
    persist("unitName", u); persist("motto", m);
    setSaved(true); setTimeout(() => setSaved(false), 1500);
  };
  return (
    <div className="panel">
      <span className="panel-label">▣ UNIT HQ</span>
      <label className="fld">UNIT DESIGNATION</label>
      <input className="in" value={u} onChange={(e) => setU(e.target.value)} />
      <label className="fld">MOTTO</label>
      <input className="in" value={m} onChange={(e) => setM(e.target.value)} />
      <div style={{ marginTop: 12 }}>
        <button className="btn" onClick={save}>{saved ? "SAVED ✓" : "SAVE HQ"}</button>
      </div>
      <p className="note" style={{ marginTop: 14 }}>
        Database:{" "}
        <strong style={{ color: storageOk ? "var(--olive-lt)" : "var(--blaze-lt)" }}>
          {storageOk ? "CONNECTED — shared across the squad" : "NOT CONFIGURED — set your Supabase env vars"}
        </strong>
      </p>
    </div>
  );
}

/* ---------- helpers ---------- */
function fmtMonth(ym) {
  const [y, m] = ym.split("-");
  if (!m) return ym;
  return new Date(y, m - 1).toLocaleString("en", { month: "short", year: "numeric" }).toUpperCase();
}
function relTime(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "JUST NOW";
  if (s < 3600) return `${Math.floor(s / 60)}M AGO`;
  if (s < 86400) return `${Math.floor(s / 3600)}H AGO`;
  return new Date(ts).toLocaleDateString("en", { month: "short", day: "numeric" }).toUpperCase();
}

/* ============================ APP ============================ */
export default function App() {
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState("intel");
  const [books, setBooks] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [messages, setMessages] = useState([]);
  const [unit, setUnit] = useState(DEFAULT_UNIT);
  const [motto, setMotto] = useState(DEFAULT_MOTTO);
  const [callsign, setCallsign] = useState("");
  const [codename, setCodename] = useState("");
  const [loaded, setLoaded] = useState(false);

  const persist = (key, val) => { store.set(key, val); };

  const loadAll = async () => {
    const [b, m, u, mo, msg] = await Promise.all([
      store.get("books"), store.get("meetings"),
      store.get("unitName"), store.get("motto"),
      listMessages().catch(() => []),
    ]);
    if (b) setBooks(b);
    if (m) setMeetings(m);
    if (u) setUnit(u);
    if (mo) setMotto(mo);
    setMessages(msg || []);
    setLoaded(true);
  };

  useEffect(() => { if (authed) loadAll(); }, [authed]);

  // detonate on every click, everywhere
  useEffect(() => {
    const onClick = (e) => detonate(e.clientX, e.clientY);
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  // message board → dedicated table (no clobbering on simultaneous posts)
  const sendMessage = async (who, body) => {
    const row = await addMessage(who, body);
    setMessages((prev) => [row, ...prev]);
  };
  const scrubMessage = async (id) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    try { await deleteMessage(id); } catch { loadAll(); }
  };

  const enter = () => {
    const name = makeCodename();
    setCodename(name);
    setCallsign(name);
    setAuthed(true);
  };

  if (!authed) return <Gate onPass={enter} />;

  const tabs = [
    ["intel", "▣ INTEL"],
    ["rally", "◎ RALLY POINTS"],
    ["comms", "✉ COMMS"],
    ["hq", "★ HQ"],
  ];

  return (
    <div className="hq">
      <style>{CSS}</style>
      <Foliage />
      {!hasSupabase && <div className="banner">⚠ DATABASE NOT CONFIGURED — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. Entries won't save.</div>}
      <div className="wrap">
        <div className="crate">
          <div className="scorch" style={{ width: 240, height: 170, top: -30, right: -20 }} />
          <div className="scorch" style={{ width: 150, height: 110, bottom: -24, left: 40 }} />
          <div className="coffee" style={{ width: 96, height: 96, bottom: 10, right: 120, transform: "rotate(12deg)" }} />
          <span className="stampbig">TOP SECRET</span>
          <span className="tssmall" style={{ bottom: 16, right: 14, transform: "rotate(-7deg)" }}>BURN AFTER READING</span>
          <span className="tape" style={{ top: -8, left: 60, transform: "rotate(-5deg)" }} />
          <span className="bullet" style={{ width: 22, height: 22, top: 18, left: 22 }} />
          <span className="bullet" style={{ width: 16, height: 16, top: 70, left: 54 }} />
          <span className="bullet" style={{ width: 19, height: 19, bottom: 22, right: 40 }} />
          <h1 className="disp">{unit}</h1>
          <div className="motto">{motto}</div>
          <div className="codetag">▣ OPERATIVE ON DECK: <b>{codename}</b></div>
        </div>

        <div className="nav">
          {tabs.map(([k, label]) => (
            <button key={k} className={"tab" + (tab === k ? " on" : "")} onClick={() => setTab(k)}>{label}</button>
          ))}
        </div>

        {!loaded && hasSupabase && <div className="empty" style={{ marginTop: 18 }}>DECRYPTING FILES…</div>}

        {tab === "intel" && <ReadingList books={books} setBooks={setBooks} persist={persist} />}
        {tab === "rally" && <RallyPoints meetings={meetings} setMeetings={setMeetings} persist={persist} />}
        {tab === "comms" && (
          <Comms messages={messages} onSend={sendMessage} onScrub={scrubMessage}
            reload={loadAll} callsign={callsign} setCallsign={setCallsign} />
        )}
        {tab === "hq" && <HQ unit={unit} setUnit={setUnit} motto={motto} setMotto={setMotto} persist={persist} storageOk={hasSupabase} />}

        <div className="foot">
          A BOOK CLUB. WE READ BOOKS. THE FATIGUES ARE METAPHORICAL. · HYDRATE · NO ACTUAL COMBAT EXPERIENCE REQUIRED
        </div>
      </div>
    </div>
  );
}
