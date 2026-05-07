import { useState, useEffect, useRef, useCallback } from "react";

// ── Constants ─────────────────────────────────────────────────────────────────
const MINUTES_IN_DAY = 1440;
const BLOCK_SIZE     = 15;
const PPM            = 2.8;
const BUFFER         = 15;

const CATEGORIES = [
  { id:"deep",     label:"Deep Work", color:"#F59E0B", bg:"rgba(245,158,11,0.18)"  },
  { id:"meeting",  label:"Meeting",   color:"#38BDF8", bg:"rgba(56,189,248,0.18)"  },
  { id:"admin",    label:"Admin",     color:"#A78BFA", bg:"rgba(167,139,250,0.18)" },
  { id:"break",    label:"Break",     color:"#34D399", bg:"rgba(52,211,153,0.18)"  },
  { id:"personal", label:"Personal",  color:"#FB923C", bg:"rgba(251,146,60,0.18)"  },
];

const PRIORITIES = [
  { id:"high", label:"High",   color:"#f87171" },
  { id:"med",  label:"Medium", color:"#fbbf24" },
  { id:"low",  label:"Low",    color:"#6b7280" },
];

const C = {
  bg0:"#07090f", bg1:"#0a0e18", bg2:"#0d1220", bg3:"#111827",
  border:"#1f2d42", borderHi:"#2d4460",
  L1:"#f1f5f9", L2:"#94a3b8", L3:"#64748b", L4:"#3d4f66",
  gridHr:"#1a2840", gridQtr:"#111e2e",
};

// ── Date helpers ──────────────────────────────────────────────────────────────
function today()       { return new Date().toISOString().split("T")[0]; }
const TODAY = today();

function dateAddDays(d, n) {
  const dt = new Date(d + "T12:00:00");
  dt.setDate(dt.getDate() + n);
  return dt.toISOString().split("T")[0];
}
function formatDateDisplay(d) {
  const dt  = new Date(d + "T12:00:00");
  const now = new Date();
  const opts = { weekday:"short", month:"short", day:"numeric" };
  if (dt.getFullYear() !== now.getFullYear()) opts.year = "numeric";
  return dt.toLocaleDateString("en-US", opts);
}
function isToday(d) { return d === TODAY; }

// ── Time helpers ──────────────────────────────────────────────────────────────
function minuteToTimeStr(m) {
  const h  = Math.floor(m / 60) % 24;
  const mn = m % 60;
  const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hh}:${String(mn).padStart(2,"0")} ${h < 12 ? "AM" : "PM"}`;
}
function getCurrentMinute() {
  const n = new Date(); return n.getHours() * 60 + n.getMinutes();
}
function polarToCart(cx, cy, r, a) {
  const rad = ((a - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function findNextFreeSlot(events, after, duration) {
  const s = Math.ceil(after / BLOCK_SIZE) * BLOCK_SIZE;
  for (let m = s; m + duration <= MINUTES_IN_DAY; m += BLOCK_SIZE) {
    if (!events.some(ev => ev.startMinute < m+duration && ev.startMinute+ev.duration > m)) return m;
  }
  return null;
}
function catLabel(id)          { return CATEGORIES.find(c => c.id === id)?.label ?? "Block"; }
function resolveTitle(t, catId){ const s=(t||"").trim(); return s.length ? s : catLabel(catId); }

// ── Overlap layout ────────────────────────────────────────────────────────────
// Returns map of eventId → { column, totalColumns }
function computeLayout(events) {
  const sorted = [...events].sort((a,b) => a.startMinute - b.startMinute);
  const columns = [];   // columns[c] = last end-minute placed there
  const result  = {};

  for (const ev of sorted) {
    let placed = false;
    for (let c = 0; c < columns.length; c++) {
      if (columns[c] <= ev.startMinute) {
        columns[c] = ev.startMinute + ev.duration;
        result[ev.id] = { column:c, totalColumns:1 };
        placed = true; break;
      }
    }
    if (!placed) {
      result[ev.id] = { column:columns.length, totalColumns:1 };
      columns.push(ev.startMinute + ev.duration);
    }
  }

  // Second pass: for each event, expand totalColumns to cover all simultaneous overlaps
  for (const ev of sorted) {
    let maxCol = result[ev.id].column;
    for (const other of sorted) {
      if (other.id === ev.id) continue;
      const overlaps = other.startMinute < ev.startMinute + ev.duration
                    && other.startMinute + other.duration > ev.startMinute;
      if (overlaps) maxCol = Math.max(maxCol, result[other.id].column);
    }
    result[ev.id].totalColumns = maxCol + 1;
  }
  return result;
}

// ── Seed data ─────────────────────────────────────────────────────────────────
const SAMPLE_EVENTS = [
  { id:1, date:TODAY, startMinute:390,  duration:60,  title:"Morning Planning",  category:"admin"   },
  { id:2, date:TODAY, startMinute:480,  duration:90,  title:"Deep Work Block",   category:"deep"    },
  { id:3, date:TODAY, startMinute:660,  duration:45,  title:"Team Standup",      category:"meeting" },
  { id:4, date:TODAY, startMinute:720,  duration:30,  title:"Lunch Break",       category:"break"   },
  { id:5, date:TODAY, startMinute:780,  duration:120, title:"Strategy Session",  category:"deep"    },
  { id:6, date:TODAY, startMinute:960,  duration:30,  title:"Admin Catchup",     category:"admin"   },
  { id:7, date:TODAY, startMinute:1020, duration:60,  title:"Client Call",       category:"meeting" },
  { id:8, date:TODAY, startMinute:510,  duration:60,  title:"Design Review",     category:"meeting" }, // overlaps Deep Work Block
  { id:8, date:dateAddDays(TODAY,1), startMinute:480, duration:90, title:"Tomorrow Deep Work", category:"deep" },
  { id:9, date:dateAddDays(TODAY,1), startMinute:660, duration:30, title:"Weekly Review",      category:"admin" },
];

const SAMPLE_TODOS = [
  { id:101, title:"Review Q2 pricing proposal",     duration:30, category:"deep",    priority:"high", done:false, scheduledEventId:null },
  { id:102, title:"Send follow-up emails",          duration:15, category:"admin",   priority:"med",  done:false, scheduledEventId:null },
  { id:103, title:"Update employee agreement",      duration:45, category:"deep",    priority:"high", done:false, scheduledEventId:null },
  { id:104, title:"Research route software",        duration:60, category:"deep",    priority:"med",  done:false, scheduledEventId:null },
  { id:105, title:"Order service vehicle supplies", duration:20, category:"admin",   priority:"low",  done:false, scheduledEventId:null },
  { id:106, title:"Call insurance broker",          duration:15, category:"meeting", priority:"med",  done:false, scheduledEventId:null },
];

// ── MinuteInput — dual entry (0-1440 ↔ clock time) ───────────────────────────
function MinuteInput({ value, onChange, accentColor }) {
  const [mode, setMode] = useState("min");

  const toParts = v => {
    const h24 = Math.floor(Math.max(0, Math.min(1439, v)) / 60) % 24;
    const mn  = Math.max(0, Math.min(1439, v)) % 60;
    return { h: String(h24===0?12:h24>12?h24-12:h24), m: String(mn).padStart(2,"0"), ap: h24<12?"AM":"PM" };
  };

  const [ch,  setCh]  = useState(() => toParts(value).h);
  const [cm,  setCm]  = useState(() => toParts(value).m);
  const [cap, setCap] = useState(() => toParts(value).ap);

  const lastRef = useRef(value);
  useEffect(() => {
    if (lastRef.current !== value) {
      lastRef.current = value;
      const p = toParts(value);
      setCh(p.h); setCm(p.m); setCap(p.ap);
    }
  }, [value]);

  const clockToMin = (h, m, ap) => {
    let h24 = parseInt(h) || 0;
    if (h24 === 12) h24 = 0;
    if (ap === "PM") h24 += 12;
    return Math.max(0, Math.min(1439, h24 * 60 + (parseInt(m) || 0)));
  };

  const iBase = (color) => ({
    padding:"6px 8px", background:C.bg0,
    border:`1.5px solid ${color || C.border}`,
    borderRadius:4, color: color || C.L1,
    fontFamily:"'Courier New',monospace", fontSize:14, fontWeight:700,
    outline:"none", boxSizing:"border-box",
  });

  return (
    <div>
      {mode === "min" ? (
        <input type="number" min={0} max={1440} step={15} value={value}
          onChange={e => onChange(Math.max(0, Math.min(1440, +e.target.value)))}
          style={{ ...iBase(accentColor), width:"100%" }} />
      ) : (
        <div style={{ display:"flex", gap:5, alignItems:"center" }}>
          <input value={ch}
            onChange={e => setCh(e.target.value)}
            onBlur={() => onChange(clockToMin(ch, cm, cap))}
            placeholder="12"
            style={{ ...iBase(accentColor), width:46, textAlign:"center" }} />
          <span style={{ color:C.L2, fontSize:16, fontWeight:700, flexShrink:0 }}>:</span>
          <input value={cm}
            onChange={e => setCm(e.target.value)}
            onBlur={() => onChange(clockToMin(ch, cm, cap))}
            placeholder="00"
            style={{ ...iBase(), width:46, textAlign:"center" }} />
          <button onClick={() => { const a=cap==="AM"?"PM":"AM"; setCap(a); onChange(clockToMin(ch,cm,a)); }}
            style={{ padding:"6px 10px", borderRadius:4, border:`1px solid ${C.borderHi}`,
              background:C.bg3, color:C.L1, cursor:"pointer",
              fontSize:11, fontFamily:"inherit", fontWeight:700, flexShrink:0 }}>
            {cap}
          </button>
        </div>
      )}
      <div onClick={() => setMode(m => m==="min" ? "clock" : "min")}
        style={{ fontSize:8, color:"#38BDF8", cursor:"pointer", marginTop:4,
          letterSpacing:"0.1em", userSelect:"none", display:"flex", gap:4 }}>
        <span>↕</span>
        <span>{mode==="min" ? `clock · ${minuteToTimeStr(value)}` : `minute · ${value}`}</span>
      </div>
    </div>
  );
}

// ── DateInput ─────────────────────────────────────────────────────────────────
function DateInput({ value, onChange, label }) {
  return (
    <div>
      {label && <div style={{ fontSize:8, color:C.L3, letterSpacing:"0.15em", marginBottom:4 }}>{label}</div>}
      <input type="date" value={value} onChange={e => onChange(e.target.value)}
        style={{ width:"100%", padding:"6px 8px", background:C.bg0,
          border:`1.5px solid ${C.border}`, borderRadius:4, color:C.L1,
          fontFamily:"'Courier New',monospace", fontSize:11, outline:"none",
          colorScheme:"dark", boxSizing:"border-box" }} />
    </div>
  );
}

// ── FieldLabel ────────────────────────────────────────────────────────────────
const FL = ({ children }) => (
  <div style={{ fontSize:8, color:C.L3, letterSpacing:"0.15em", marginBottom:4 }}>{children}</div>
);

// ── WatchFace ─────────────────────────────────────────────────────────────────
function WatchFace({ currentMinute, events, countMode }) {
  const cx=100, cy=100, r=80;
  const ac = countMode==="down" ? "#38BDF8" : "#F59E0B";
  const displayVal = countMode==="down" ? MINUTES_IN_DAY-currentMinute : currentMinute;
  const handAngle  = (currentMinute/MINUTES_IN_DAY)*360-90;
  const handRad    = (handAngle*Math.PI)/180;
  const arcR = r-8;
  const sa = countMode==="down" ? (currentMinute/MINUTES_IN_DAY)*360-90 : -90;
  const ea = countMode==="down" ? 270 : (currentMinute/MINUTES_IN_DAY)*360-90;
  const pct = countMode==="down" ? (MINUTES_IN_DAY-currentMinute)/MINUTES_IN_DAY : currentMinute/MINUTES_IN_DAY;
  const arcS = polarToCart(cx,cy,arcR,sa);
  const arcE = polarToCart(cx,cy,arcR,ea);
  return (
    <svg viewBox="0 0 200 200" style={{ width:"100%", maxWidth:200 }}>
      <defs>
        <radialGradient id="wbg"><stop offset="0%" stopColor="#1a2235"/><stop offset="100%" stopColor="#0a0e18"/></radialGradient>
        <filter id="wgl"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <circle cx={cx} cy={cy} r={r+10} fill="url(#wbg)" stroke={ac} strokeWidth="1.5" opacity="0.55"/>
      {Array.from({length:96},(_,i)=>{
        const a=(i/96)*360-90,rd=(a*Math.PI)/180,maj=i%4===0;
        return <line key={i} x1={cx+(maj?r-5:r+1)*Math.cos(rd)} y1={cy+(maj?r-5:r+1)*Math.sin(rd)} x2={cx+(r+5)*Math.cos(rd)} y2={cy+(r+5)*Math.sin(rd)} stroke={maj?ac:C.L4} strokeWidth={maj?1.8:0.6} opacity={maj?0.9:0.7}/>;
      })}
      {events.map(ev=>{
        const cat=CATEGORIES.find(c=>c.id===ev.category);
        const s=polarToCart(cx,cy,r-16,ev.startMinute/MINUTES_IN_DAY*360-90);
        const e=polarToCart(cx,cy,r-16,(ev.startMinute+ev.duration)/MINUTES_IN_DAY*360-90);
        return <path key={ev.id} d={`M${s.x} ${s.y}A${r-16} ${r-16} 0 ${ev.duration>720?1:0} 1 ${e.x} ${e.y}`} fill="none" stroke={cat?.color||"#fff"} strokeWidth="4.5" opacity="0.7"/>;
      })}
      <path d={`M${arcS.x} ${arcS.y}A${arcR} ${arcR} 0 ${pct>0.5?1:0} 1 ${arcE.x} ${arcE.y}`} fill="none" stroke={ac} strokeWidth="2.8" filter="url(#wgl)" strokeLinecap="round"/>
      <circle cx={cx} cy={cy} r={33} fill={C.bg0} stroke={C.border} strokeWidth="1"/>
      <text x={cx} y={cy-7} textAnchor="middle" fill={ac} fontSize="15" fontFamily="'Courier New',monospace" fontWeight="bold" filter="url(#wgl)">{displayVal}</text>
      <text x={cx} y={cy+5} textAnchor="middle" fill={C.L3} fontSize="6" fontFamily="'Courier New',monospace">{countMode==="down"?"MIN LEFT":"MIN ELAPSED"}</text>
      <text x={cx} y={cy+15} textAnchor="middle" fill={C.L2} fontSize="8.5" fontFamily="'Courier New',monospace">{minuteToTimeStr(currentMinute)}</text>
      <line x1={cx} y1={cy} x2={cx+r*0.62*Math.cos(handRad)} y2={cy+r*0.62*Math.sin(handRad)} stroke={ac} strokeWidth="2.2" strokeLinecap="round" filter="url(#wgl)"/>
      <circle cx={cx} cy={cy} r={3.5} fill={ac} filter="url(#wgl)"/>
      {[6,12,18,24].map((h,i)=>{
        const a=(h/24*360-90)*Math.PI/180;
        return <text key={i} x={cx+(r-22)*Math.cos(a)} y={cy+(r-22)*Math.sin(a)+3} textAnchor="middle" fill={C.L3} fontSize="5.5" fontFamily="'Courier New',monospace">{["6A","12P","6P","12A"][i]}</text>;
      })}
    </svg>
  );
}

// ── EventBlock ────────────────────────────────────────────────────────────────
function EventBlock({ event, onSelect, selected, layout }) {
  const cat    = CATEGORIES.find(c => c.id === event.category);
  const top    = event.startMinute * PPM;
  const height = Math.max(event.duration * PPM, 24);

  const { column=0, totalColumns=1 } = layout || {};
  const RULER = 76, RIGHT_PAD = 8;
  // Use percentages of the area right of the ruler
  const slotPct = 1 / totalColumns;
  const leftPct = column * slotPct;
  const gapPx   = totalColumns > 1 ? 2 : 0;

  const posStyle = totalColumns === 1
    ? { left:RULER, right:RIGHT_PAD }
    : {
        left:  `calc(${RULER}px + ${leftPct * 100}% * (1 - ${(RULER + RIGHT_PAD) / 1000}) - ${RULER * leftPct}px)`,
        width: `calc(${slotPct * 100}% - ${(RULER + RIGHT_PAD) * slotPct}px - ${gapPx}px)`,
        right: "auto",
      };

  return (
    <div data-event="1" onClick={() => onSelect(event)} style={{
      position:"absolute", top, height,
      ...posStyle,
      background:cat?.bg||"rgba(255,255,255,0.08)",
      borderLeft:`3px solid ${cat?.color||"#fff"}`,
      borderRadius:"0 6px 6px 0", padding:"3px 7px",
      cursor:"pointer", overflow:"hidden", boxSizing:"border-box",
      zIndex:selected?10:2,
      outline:selected?`1.5px solid ${cat?.color}`:"none",
      boxShadow:selected?`0 0 14px ${cat?.color}50`:totalColumns>1?"0 2px 8px rgba(0,0,0,0.4)":"none",
      transition:"box-shadow 0.15s ease, outline 0.15s ease",
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:4 }}>
        <span style={{ width:5, height:5, borderRadius:"50%", background:cat?.color, flexShrink:0 }}/>
        <span style={{ color:C.L1, fontSize:11, fontWeight:600, fontFamily:"'Courier New',monospace", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
          {event.title}
        </span>
        {event.fromTodo && <span style={{ fontSize:9, color:cat?.color, flexShrink:0 }}>☑</span>}
        {event.seriesId && <span style={{ fontSize:8, color:C.L3, flexShrink:0 }}>↺</span>}
      </div>
      {height > 32 && (
        <div style={{ color:C.L2, fontSize:9, fontFamily:"'Courier New',monospace", marginTop:1 }}>
          {minuteToTimeStr(event.startMinute)} · {event.duration}m
        </div>
      )}
    </div>
  );
}

// ── UndoToast ─────────────────────────────────────────────────────────────────
function UndoToast({ entry, onUndo, onDismiss }) {
  const cat = CATEGORIES.find(c => c.id === entry.event.category);
  return (
    <div style={{
      position:"fixed", bottom:20, left:"50%", transform:"translateX(-50%)",
      background:C.bg2, border:`1px solid ${C.borderHi}`,
      borderRadius:8, padding:"10px 16px", zIndex:200,
      display:"flex", alignItems:"center", gap:14,
      boxShadow:"0 8px 32px rgba(0,0,0,0.6)", whiteSpace:"nowrap",
    }}>
      <div style={{ width:6, height:6, borderRadius:"50%", background:cat?.color, flexShrink:0 }}/>
      <span style={{ fontSize:11, color:C.L2, fontFamily:"'Courier New',monospace" }}>
        <span style={{ color:C.L3 }}>Deleted · </span>
        <span style={{ color:C.L1, fontWeight:600 }}>{entry.event.title}</span>
      </span>
      <button onClick={onUndo}
        style={{ padding:"3px 10px", borderRadius:4, border:`1px solid ${cat?.color}`, background:cat?.bg,
          color:cat?.color, cursor:"pointer", fontSize:10, fontFamily:"inherit", fontWeight:700 }}>
        UNDO
      </button>
      <button onClick={onDismiss}
        style={{ background:"none", border:"none", color:C.L3, cursor:"pointer", fontSize:14, padding:0, lineHeight:1 }}>×</button>
    </div>
  );
}

// ── SettingsPanel ─────────────────────────────────────────────────────────────
function SettingsPanel({ settings, onChange, onClose, accentColor }) {
  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", backdropFilter:"blur(4px)",
      display:"flex", alignItems:"center", justifyContent:"center", zIndex:150,
    }}>
      <div style={{ background:C.bg2, border:`1px solid ${C.borderHi}`, borderRadius:8,
        padding:22, width:300, display:"flex", flexDirection:"column", gap:16 }}>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:10, color:accentColor, letterSpacing:"0.2em", fontWeight:700 }}>⚙ SETTINGS</span>
          <button onClick={onClose} style={{ background:"none", border:"none", color:C.L3, cursor:"pointer", fontSize:16, padding:0 }}>✕</button>
        </div>

        {/* Default duration */}
        <div>
          <div style={{ fontSize:8, color:C.L3, letterSpacing:"0.15em", marginBottom:6 }}>DEFAULT BLOCK DURATION</div>
          <div style={{ display:"flex", gap:4 }}>
            {[15,30,45,60,90,120].map(d => (
              <button key={d} onClick={() => onChange("defaultDuration", d)}
                style={{ padding:"4px 8px", borderRadius:3, border:`1px solid ${settings.defaultDuration===d?accentColor:C.border}`,
                  background:settings.defaultDuration===d?`${accentColor}22`:"transparent",
                  color:settings.defaultDuration===d?accentColor:C.L2,
                  cursor:"pointer", fontSize:9, fontFamily:"inherit", fontWeight:settings.defaultDuration===d?700:400 }}>
                {d}m
              </button>
            ))}
          </div>
        </div>

        {/* Buffer between tasks */}
        <div>
          <div style={{ fontSize:8, color:C.L3, letterSpacing:"0.15em", marginBottom:6 }}>AUTO-SCHEDULE BUFFER</div>
          <div style={{ display:"flex", gap:4 }}>
            {[0,5,10,15,30].map(b => (
              <button key={b} onClick={() => onChange("bufferMinutes", b)}
                style={{ padding:"4px 8px", borderRadius:3, border:`1px solid ${settings.bufferMinutes===b?accentColor:C.border}`,
                  background:settings.bufferMinutes===b?`${accentColor}22`:"transparent",
                  color:settings.bufferMinutes===b?accentColor:C.L2,
                  cursor:"pointer", fontSize:9, fontFamily:"inherit", fontWeight:settings.bufferMinutes===b?700:400 }}>
                {b}m
              </button>
            ))}
          </div>
          <div style={{ fontSize:8, color:C.L3, marginTop:4 }}>Gap inserted between auto-scheduled tasks</div>
        </div>

        {/* Wake / Sleep window */}
        <div>
          <div style={{ fontSize:8, color:C.L3, letterSpacing:"0.15em", marginBottom:6 }}>ACTIVE WINDOW (shades grid outside)</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div>
              <div style={{ fontSize:7, color:C.L3, marginBottom:4 }}>WAKE (minute)</div>
              <input type="number" min={0} max={720} step={15} value={settings.wakeMinute}
                onChange={e => onChange("wakeMinute", Math.max(0, Math.min(720, +e.target.value)))}
                style={{ width:"100%", padding:"5px 7px", background:C.bg0, border:`1px solid ${C.border}`,
                  borderRadius:3, color:C.L1, fontFamily:"'Courier New',monospace", fontSize:13, fontWeight:700, outline:"none", boxSizing:"border-box" }}/>
              <div style={{ fontSize:8, color:C.L3, marginTop:2 }}>{minuteToTimeStr(settings.wakeMinute)}</div>
            </div>
            <div>
              <div style={{ fontSize:7, color:C.L3, marginBottom:4 }}>SLEEP (minute)</div>
              <input type="number" min={720} max={1440} step={15} value={settings.sleepMinute}
                onChange={e => onChange("sleepMinute", Math.max(720, Math.min(1440, +e.target.value)))}
                style={{ width:"100%", padding:"5px 7px", background:C.bg0, border:`1px solid ${C.border}`,
                  borderRadius:3, color:C.L1, fontFamily:"'Courier New',monospace", fontSize:13, fontWeight:700, outline:"none", boxSizing:"border-box" }}/>
              <div style={{ fontSize:8, color:C.L3, marginTop:2 }}>{minuteToTimeStr(settings.sleepMinute)}</div>
            </div>
          </div>
        </div>

        {/* Conflict highlight */}
        <div>
          <div style={{ fontSize:8, color:C.L3, letterSpacing:"0.15em", marginBottom:6 }}>DISPLAY</div>
          <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }}>
            <div onClick={() => onChange("highlightConflicts", !settings.highlightConflicts)}
              style={{ width:32, height:18, borderRadius:9, background:settings.highlightConflicts?accentColor:C.bg3,
                border:`1px solid ${settings.highlightConflicts?accentColor:C.border}`,
                position:"relative", cursor:"pointer", transition:"background 0.2s" }}>
              <div style={{ position:"absolute", top:2, left:settings.highlightConflicts?14:2, width:12, height:12,
                borderRadius:"50%", background:C.L1, transition:"left 0.2s" }}/>
            </div>
            <span style={{ fontSize:9, color:C.L2 }}>Highlight schedule conflicts</span>
          </label>
        </div>

        <button onClick={onClose}
          style={{ padding:8, borderRadius:4, background:`${accentColor}22`, border:`1px solid ${accentColor}`,
            color:accentColor, cursor:"pointer", fontSize:10, fontFamily:"inherit", fontWeight:700 }}>
          SAVE & CLOSE
        </button>
      </div>
    </div>
  );
}

// ── TodoRow ───────────────────────────────────────────────────────────────────
function TodoRow({ todo, onDone, onDelete, onSchedule, onPick, isPicking }) {
  const cat = CATEGORIES.find(c => c.id === todo.category);
  const pri = PRIORITIES.find(p => p.id === todo.priority);
  const isScheduled = !!todo.scheduledEventId;

  return (
    <div style={{
      background: isPicking ? `${cat?.color}12` : todo.done ? "rgba(255,255,255,0.015)" : C.bg2,
      border:`1px solid ${isPicking ? cat?.color+"60" : isScheduled ? "#1a3d2a" : C.border}`,
      borderLeft:`3px solid ${todo.done?C.L4:isPicking?cat?.color:isScheduled?"#34D399":pri?.color||"#fff"}`,
      borderRadius:"0 6px 6px 0", padding:"10px 12px", marginBottom:6,
      opacity:todo.done?0.5:1, transition:"all 0.2s",
    }}>
      <div style={{ display:"flex", alignItems:"flex-start", gap:9 }}>
        <button onClick={() => onDone(todo.id)} style={{
          width:16, height:16, borderRadius:3,
          border:`1.5px solid ${todo.done?C.L3:pri?.color}`,
          background:todo.done?C.bg3:"transparent",
          cursor:"pointer", flexShrink:0, marginTop:2,
          display:"flex", alignItems:"center", justifyContent:"center", color:C.L2, fontSize:10,
        }}>{todo.done?"✓":""}</button>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:12, color:todo.done?C.L3:C.L1, fontFamily:"'Courier New',monospace", fontWeight:600,
            textDecoration:todo.done?"line-through":"none", marginBottom:4,
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{todo.title}</div>
          <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
            <span style={{ fontSize:9, color:cat?.color, background:cat?.bg, padding:"1px 6px", borderRadius:3 }}>{cat?.label}</span>
            <span style={{ fontSize:9, color:pri?.color, fontWeight:600 }}>{pri?.label}</span>
            <span style={{ fontSize:9, color:C.L3 }}>{todo.duration}m</span>
            {isScheduled && <span style={{ fontSize:9, color:"#34D399", background:"rgba(52,211,153,0.12)", padding:"1px 6px", borderRadius:3 }}>on calendar</span>}
            {isPicking && <span style={{ fontSize:9, color:cat?.color, letterSpacing:"0.1em" }}>PLACING →</span>}
          </div>
        </div>
        {!todo.done && !isScheduled && (
          <div style={{ display:"flex", gap:4, flexShrink:0 }}>
            <button onClick={() => onSchedule(todo)} style={{ padding:"3px 8px", borderRadius:3, fontSize:9, fontFamily:"inherit", cursor:"pointer", background:"rgba(52,211,153,0.15)", border:"1px solid #34D399", color:"#34D399", fontWeight:700 }}>AUTO</button>
            <button onClick={() => onPick(todo)}
              style={{ padding:"3px 8px", borderRadius:3, fontSize:9, fontFamily:"inherit", cursor:"pointer",
                background: isPicking ? "rgba(56,189,248,0.3)" : "rgba(56,189,248,0.12)",
                border:"1px solid #38BDF8", color:"#38BDF8", fontWeight:700 }}>
              {isPicking ? "✕" : "PICK"}
            </button>
            <button onClick={() => onDelete(todo.id)} style={{ padding:"3px 7px", borderRadius:3, fontSize:11, cursor:"pointer", background:"transparent", border:`1px solid ${C.border}`, color:C.L3 }}>✕</button>
          </div>
        )}
        {todo.done && <button onClick={() => onDelete(todo.id)} style={{ padding:"3px 7px", borderRadius:3, fontSize:11, cursor:"pointer", background:"transparent", border:`1px solid ${C.border}`, color:C.L3, flexShrink:0 }}>✕</button>}
      </div>
    </div>
  );
}

// ── TodoPlacementPanel ────────────────────────────────────────────────────────
// Shows in the right sidebar when user clicks PICK on a task.
// Lets them set date + time, then places the block on the calendar.
function TodoPlacementPanel({ todo, selectedDate, accentColor, onPlace, onCancel }) {
  const cat = CATEGORIES.find(c => c.id === todo.category);
  const pri = PRIORITIES.find(p => p.id === todo.priority);
  const [pickMin,  setPickMin]  = useState(getCurrentMinute);
  const [pickDate, setPickDate] = useState(selectedDate);

  const endMin = pickMin + todo.duration;

  return (
    <div style={{ width:238, background:C.bg1, borderLeft:`1px solid ${cat?.color}50`, padding:14, display:"flex", flexDirection:"column", gap:12, overflow:"auto", flexShrink:0 }}>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:7 }}>
          <div style={{ width:8, height:8, borderRadius:2, background:cat?.color }}/>
          <span style={{ fontSize:9, color:cat?.color, letterSpacing:"0.18em", fontWeight:700 }}>PLACE ON CALENDAR</span>
        </div>
        <button onClick={onCancel} style={{ background:"none", border:"none", color:C.L3, cursor:"pointer", fontSize:16, padding:0, lineHeight:1 }}>✕</button>
      </div>

      {/* Task summary card */}
      <div style={{ background:cat?.bg, border:`1px solid ${cat?.color}40`, borderRadius:5, padding:"9px 11px" }}>
        <div style={{ fontSize:13, color:C.L1, fontWeight:700, marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{todo.title}</div>
        <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
          <span style={{ fontSize:9, color:cat?.color }}>{cat?.label}</span>
          <span style={{ fontSize:9, color:pri?.color, fontWeight:600 }}>{pri?.label} priority</span>
          <span style={{ fontSize:9, color:C.L2 }}>{todo.duration}m block</span>
        </div>
      </div>

      {/* Date */}
      <div>
        <FL>DATE</FL>
        <input type="date" value={pickDate} onChange={e => setPickDate(e.target.value)}
          style={{ width:"100%", padding:"6px 8px", background:C.bg0, border:`1.5px solid ${C.border}`,
            borderRadius:4, color:C.L1, fontFamily:"'Courier New',monospace", fontSize:11,
            outline:"none", colorScheme:"dark", boxSizing:"border-box" }}/>
        <div style={{ fontSize:8, color:C.L3, marginTop:3 }}>{formatDateDisplay(pickDate)}</div>
      </div>

      {/* Start time — dual minute/clock */}
      <div>
        <FL>START TIME</FL>
        <MinuteInput value={pickMin} onChange={setPickMin} accentColor={cat?.color}/>
      </div>

      {/* Preview */}
      <div style={{ background:C.bg0, border:`1px solid ${C.border}`, borderRadius:5, padding:"8px 10px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:"5px 4px" }}>
        {[
          { l:"FROM",     v: minuteToTimeStr(pickMin)    },
          { l:"TO",       v: minuteToTimeStr(endMin)     },
          { l:"DURATION", v: `${todo.duration}m`         },
          { l:"END MIN",  v: `${endMin}`                 },
        ].map(({ l, v }) => (
          <div key={l}>
            <div style={{ fontSize:7, color:C.L3, letterSpacing:"0.1em" }}>{l}</div>
            <div style={{ fontSize:10, color:C.L2, fontWeight:700 }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Place button */}
      <button
        onClick={() => onPlace(todo, pickMin, pickDate)}
        style={{ padding:"10px", borderRadius:4, border:`1px solid ${cat?.color}`,
          background:`linear-gradient(135deg, ${cat?.color}30, ${cat?.color}60)`,
          color:C.L1, cursor:"pointer", fontSize:10, fontFamily:"inherit",
          fontWeight:900, letterSpacing:"0.15em" }}>
        PLACE ON CALENDAR →
      </button>

      <button onClick={onCancel}
        style={{ padding:"6px", borderRadius:4, border:`1px solid ${C.border}`,
          background:"transparent", color:C.L3, cursor:"pointer",
          fontSize:9, fontFamily:"inherit" }}>
        CANCEL
      </button>
    </div>
  );
}

// ── EventDetailPanel ──────────────────────────────────────────────────────────
function EventDetailPanel({ event, currentMinute, countMode, accentColor, onUpdate, onDelete, onClose, allEvents }) {
  const [title,    setTitle]    = useState(event.title);
  const [start,    setStart]    = useState(event.startMinute);
  const [dur,      setDur]      = useState(event.duration);
  const [category, setCategory] = useState(event.category);
  const [date,     setDate]     = useState(event.date);

  useEffect(() => {
    setTitle(event.title); setStart(event.startMinute);
    setDur(event.duration); setCategory(event.category); setDate(event.date);
  }, [event.id]);

  const cat    = CATEGORIES.find(c => c.id === category);
  const isNow  = event.date===TODAY && event.startMinute<=currentMinute && event.startMinute+event.duration>currentMinute;
  const isPast = event.date<TODAY || (event.date===TODAY && event.startMinute+event.duration<currentMinute);

  const commit = (field, val) => onUpdate(event.id, { [field]: val });

  const inputStyle = (color) => ({
    width:"100%", padding:"6px 8px", background:C.bg0,
    border:`1.5px solid ${color||C.border}`, borderRadius:4,
    color:color||C.L1, fontFamily:"'Courier New',monospace",
    fontSize:12, fontWeight:600, outline:"none", boxSizing:"border-box",
  });

  return (
    <div style={{ width:238, background:C.bg1, borderLeft:`1px solid ${C.border}`, padding:14, display:"flex", flexDirection:"column", gap:11, overflow:"auto", flexShrink:0 }}>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <div style={{ width:8, height:8, borderRadius:2, background:cat?.color }}/>
          <span style={{ fontSize:9, color:cat?.color, letterSpacing:"0.18em", fontWeight:700 }}>{cat?.label?.toUpperCase()}</span>
        </div>
        <button onClick={onClose} style={{ background:"none", border:"none", color:C.L3, cursor:"pointer", fontSize:16, padding:0 }}>✕</button>
      </div>

      {/* Status */}
      <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
        {isNow  && <span style={{ fontSize:8, color:"#F59E0B", background:"rgba(245,158,11,0.12)", padding:"2px 7px", borderRadius:3 }}>● IN PROGRESS</span>}
        {isPast && <span style={{ fontSize:8, color:C.L3, background:C.bg3, padding:"2px 7px", borderRadius:3 }}>✓ COMPLETE</span>}
        {event.fromTodo  && <span style={{ fontSize:8, color:"#A78BFA", background:"rgba(167,139,250,0.1)", padding:"2px 7px", borderRadius:3 }}>☑ from tasks</span>}
        {event.seriesId  && <span style={{ fontSize:8, color:C.L2, background:C.bg3, padding:"2px 7px", borderRadius:3 }}>↺ repeating</span>}
      </div>

      {/* Title */}
      <div>
        <FL>TITLE</FL>
        <input value={title}
          onChange={e => setTitle(e.target.value)}
          onBlur={() => commit("title", resolveTitle(title, category))}
          onKeyDown={e => e.key==="Enter" && commit("title", resolveTitle(title, category))}
          placeholder={catLabel(category)}
          style={inputStyle(cat?.color)} />
      </div>

      {/* Category */}
      <div>
        <FL>CATEGORY</FL>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:3 }}>
          {CATEGORIES.map(c => (
            <button key={c.id} onClick={() => { setCategory(c.id); commit("category", c.id); }}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 7px", borderRadius:4,
                border:`1px solid ${category===c.id?c.color:C.border}`,
                background:category===c.id?c.bg:"transparent", cursor:"pointer", fontFamily:"inherit" }}>
              <div style={{ width:6, height:6, borderRadius:2, background:c.color, flexShrink:0 }}/>
              <span style={{ fontSize:9, color:category===c.id?c.color:C.L2, fontWeight:category===c.id?700:400, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{c.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Date */}
      <div>
        <FL>DATE</FL>
        <input type="date" value={date}
          onChange={e => { setDate(e.target.value); commit("date", e.target.value); }}
          style={{ width:"100%", padding:"6px 8px", background:C.bg0, border:`1.5px solid ${C.border}`,
            borderRadius:4, color:C.L1, fontFamily:"'Courier New',monospace", fontSize:11,
            outline:"none", colorScheme:"dark", boxSizing:"border-box" }}/>
        {date !== event.date && (
          <div style={{ fontSize:8, color:"#34D399", marginTop:3 }}>↺ Rescheduled to {formatDateDisplay(date)}</div>
        )}
      </div>

      {/* Start time */}
      <div>
        <FL>START {countMode==="down"?"(MIN REMAINING)":"(MIN ELAPSED)"}</FL>
        <MinuteInput value={start} onChange={v => { setStart(v); commit("startMinute", v); }} accentColor={accentColor}/>
      </div>

      {/* Duration */}
      <div>
        <FL>DURATION</FL>
        <MinuteInput value={dur} onChange={v => { setDur(v); commit("duration", v); }}/>
        <div style={{ display:"flex", gap:3, marginTop:6, flexWrap:"wrap" }}>
          {[15,30,45,60,90,120].map(d => (
            <button key={d} onClick={() => { setDur(d); commit("duration", d); }}
              style={{ padding:"3px 7px", borderRadius:3,
                border:`1px solid ${dur===d?cat?.color:C.border}`,
                background:dur===d?cat?.bg:"transparent",
                color:dur===d?cat?.color:C.L2, cursor:"pointer", fontSize:9, fontFamily:"inherit", fontWeight:dur===d?700:400 }}>
              {d}m
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div style={{ background:C.bg0, border:`1px solid ${C.border}`, borderRadius:5, padding:9, display:"grid", gridTemplateColumns:"1fr 1fr", gap:"5px 4px" }}>
        {[
          { l:"FROM",  v:minuteToTimeStr(start) },
          { l:"TO",    v:minuteToTimeStr(start+dur) },
          { l:"BLOCKS",v:`${Math.round(dur/15)}×15m` },
          { l:"DATE",  v:formatDateDisplay(date) },
        ].map(({l,v}) => (
          <div key={l}><div style={{ fontSize:7, color:C.L3, letterSpacing:"0.1em" }}>{l}</div><div style={{ fontSize:10, color:C.L2, fontWeight:700 }}>{v}</div></div>
        ))}
      </div>

      <button onClick={() => onDelete(event.id)}
        style={{ padding:8, borderRadius:4, border:"1px solid #7f1d1d", background:"rgba(127,29,29,0.2)", color:"#f87171", cursor:"pointer", fontSize:9, fontFamily:"inherit", letterSpacing:"0.1em" }}>
        DELETE BLOCK
      </button>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
const BLANK_EV = { title:"", category:"deep", startMinute:0, duration:60, date:TODAY, repeat:"none", repeatEvery:7, repeatCount:4 };

export default function App() {
  const [curMin,       setCurMin]       = useState(getCurrentMinute);
  const [events,       setEvents]       = useState(SAMPLE_EVENTS);
  const [todos,        setTodos]        = useState(SAMPLE_TODOS);
  const [selEv,        setSelEv]        = useState(null);
  const [view,         setView]         = useState("day");
  const [countMode,    setCountMode]    = useState("up");
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [showModal,    setShowModal]    = useState(false);
  const [newEv,        setNewEv]        = useState({ ...BLANK_EV });
  const [showRepeat,   setShowRepeat]   = useState(false);
  const [newTodo,      setNewTodo]      = useState({ title:"", duration:30, category:"deep", priority:"med" });
  const [showAddTodo,  setShowAddTodo]  = useState(false);
  const [flashId,      setFlashId]      = useState(null);
  const [showDone,     setShowDone]     = useState(false);
  const [pendingTodo,  setPendingTodo]  = useState(null);
  const [undoEntry,    setUndoEntry]    = useState(null);   // { event, linkedTodoId, timer }
  const [showSettings, setShowSettings] = useState(false);
  const [settings,     setSettings]     = useState({
    defaultDuration:   60,
    bufferMinutes:     15,
    wakeMinute:        360,   // 6 AM
    sleepMinute:       1320,  // 10 PM
    highlightConflicts: true,
  });
  const timelineRef = useRef(null);
  const nowRef      = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setCurMin(getCurrentMinute()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (nowRef.current && view==="day" && selectedDate===TODAY)
      setTimeout(() => nowRef.current?.scrollIntoView({ block:"center", behavior:"smooth" }), 120);
  }, [view, selectedDate]);

  // Sync side panel when events mutate
  useEffect(() => {
    if (selEv) setSelEv(prev => events.find(e => e.id===prev.id) || null);
  }, [events]);

  const ac = countMode==="down" ? "#38BDF8" : "#F59E0B";
  const displayNum  = countMode==="down" ? MINUTES_IN_DAY-curMin : curMin;
  const progressPct = countMode==="down"
    ? Math.round(((MINUTES_IN_DAY-curMin)/MINUTES_IN_DAY)*100)
    : Math.round((curMin/MINUTES_IN_DAY)*100);

  const dayEvents       = events.filter(e => e.date === selectedDate);
  const pendingTodos    = todos.filter(t => !t.done && !t.scheduledEventId);
  const scheduledTodos  = todos.filter(t => !t.done && t.scheduledEventId);
  const doneTodos       = todos.filter(t => t.done);
  const nextEvent       = dayEvents.filter(e => e.startMinute > curMin).sort((a,b) => a.startMinute-b.startMinute)[0];
  const totalScheduled  = dayEvents.reduce((s,e) => s+e.duration, 0);

  const flash = id => { setFlashId(id); setTimeout(() => setFlashId(null), 2500); };

  const gridLabel = min => countMode==="down" ? MINUTES_IN_DAY-min : min;

  // ── Timeline click ────────────────────────────────────────────────────────
  const handleTimelineClick = useCallback(e => {
    if (!timelineRef.current || e.target.closest("[data-event]")) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const y    = e.clientY - rect.top + timelineRef.current.scrollTop;
    const snap = Math.max(0, Math.min(MINUTES_IN_DAY-15, Math.round(y/PPM/BLOCK_SIZE)*BLOCK_SIZE));
    setNewEv({ ...BLANK_EV, startMinute:snap, date:selectedDate });
    setShowRepeat(false);
    setShowModal(true);
  }, [selectedDate]);

  // ── Event CRUD ────────────────────────────────────────────────────────────
  const addEvent = () => {
    const title    = resolveTitle(newEv.title, newEv.category);
    const seriesId = newEv.repeat !== "none" ? `series-${Date.now()}` : undefined;
    const interval = newEv.repeat==="daily"?1 : newEv.repeat==="weekly"?7 : newEv.repeatEvery;
    const count    = newEv.repeat==="none" ? 1 : Math.max(1, newEv.repeatCount);
    const base = { title, category:newEv.category, startMinute:newEv.startMinute, duration:newEv.duration, fromTodo:false };
    const eventsToAdd = Array.from({ length:count }, (_, i) => ({
      ...base,
      id:   Date.now() + i + (i ? Math.random()*1000 : 0),
      date: dateAddDays(newEv.date, i * interval),
      ...(seriesId ? { seriesId } : {}),
    }));
    setEvents(p => [...p, ...eventsToAdd]);
    setShowModal(false);
    flash(eventsToAdd[0].id);
  };

  const updateEvent = (id, patch) => setEvents(p => p.map(e => e.id===id ? {...e,...patch} : e));

  const deleteEvent = id => {
    const ev       = events.find(e => e.id === id);
    const linkedTd = todos.find(t => t.scheduledEventId === id);
    // Clear immediately from state
    setEvents(p => p.filter(e => e.id !== id));
    setTodos(p  => p.map(t => t.scheduledEventId===id ? {...t,scheduledEventId:null} : t));
    setSelEv(null);
    // Set undo entry with auto-dismiss timer
    if (undoEntry?.timer) clearTimeout(undoEntry.timer);
    const timer = setTimeout(() => setUndoEntry(null), 4000);
    setUndoEntry({ event:ev, linkedTodoId:linkedTd?.id || null, timer });
  };

  const undoDelete = () => {
    if (!undoEntry) return;
    clearTimeout(undoEntry.timer);
    setEvents(p => [...p, undoEntry.event]);
    if (undoEntry.linkedTodoId) {
      setTodos(p => p.map(t => t.id===undoEntry.linkedTodoId ? {...t,scheduledEventId:undoEntry.event.id} : t));
    }
    setUndoEntry(null);
  };

  const updateSettings = (key, val) => setSettings(s => ({ ...s, [key]: val }));

  // ── Todo actions ──────────────────────────────────────────────────────────
  const addTodo = () => {
    if (!newTodo.title.trim()) return;
    setTodos(p => [...p, { ...newTodo, id:Date.now(), done:false, scheduledEventId:null }]);
    setNewTodo({ title:"", duration:30, category:"deep", priority:"med" });
    setShowAddTodo(false);
  };

  const scheduleTodo = todo => {
    const buf    = settings.bufferMinutes;
    const withBuf = events.filter(e=>e.date===selectedDate).map(ev => ({...ev,duration:ev.duration+buf}));
    const start   = findNextFreeSlot(withBuf, curMin, todo.duration);
    if (start === null) { alert("No free slot today!"); return; }
    const ev = { id:Date.now(), date:selectedDate, startMinute:start, duration:todo.duration, title:resolveTitle(todo.title,todo.category), category:todo.category, fromTodo:true };
    setEvents(p => [...p, ev]);
    setTodos(p  => p.map(t => t.id===todo.id ? {...t,scheduledEventId:ev.id} : t));
    flash(ev.id);
  };

  const scheduleTodoAt = (todo, startMinute, date) => {
    const ev = { id:Date.now(), date:date||selectedDate, startMinute, duration:todo.duration, title:resolveTitle(todo.title,todo.category), category:todo.category, fromTodo:true };
    setEvents(p => [...p, ev]);
    setTodos(p  => p.map(t => t.id===todo.id ? {...t,scheduledEventId:ev.id} : t));
    setPendingTodo(null);
    setSelectedDate(date || selectedDate);
    setView("day");
    flash(ev.id);
  };

  const autoScheduleAll = () => {
    const buf    = settings.bufferMinutes;
    let scratch = events.filter(e => e.date===selectedDate);
    const newEvs = []; const upd = {};
    const queue  = [...pendingTodos].sort((a,b) => PRIORITIES.findIndex(p=>p.id===a.priority) - PRIORITIES.findIndex(p=>p.id===b.priority));
    const lastEnd = scratch.reduce((max,ev) => Math.max(max, ev.startMinute+ev.duration), 0);
    let cursor = Math.max(curMin, lastEnd>0 ? lastEnd+buf : curMin);
    for (const todo of queue) {
      const withBuf = scratch.map(ev => ({...ev,duration:ev.duration+buf}));
      const start   = findNextFreeSlot(withBuf, cursor, todo.duration);
      if (start === null) continue;
      const ev = { id:Date.now()+Math.random(), date:selectedDate, startMinute:start, duration:todo.duration, title:resolveTitle(todo.title,todo.category), category:todo.category, fromTodo:true };
      scratch.push(ev); newEvs.push(ev); upd[todo.id]=ev.id;
      cursor = start + todo.duration + buf;
    }
    setEvents(p => [...p,...newEvs]);
    setTodos(p  => p.map(t => upd[t.id] ? {...t,scheduledEventId:upd[t.id]} : t));
    if (newEvs.length) { flash(newEvs[0].id); setView("day"); }
  };

  // ── PICK handler — open placement panel in calendar view ─────────────────
  const pickTodo = (todo) => {
    if (pendingTodo?.id === todo.id) {
      // toggle off
      setPendingTodo(null);
    } else {
      setPendingTodo(todo);
      setSelEv(null);     // close any open event panel
      setView("day");     // switch to calendar view
    }
  };

  // Count how many dates have events (for mini date indicator)
  const datesWithEvents = [...new Set(events.map(e => e.date))].sort();

  // ── Shared button component ───────────────────────────────────────────────
  const TabBtn = ({ id, label, color }) => (
    <button onClick={() => setView(id)} style={{
      padding:"5px 11px", borderRadius:4, border:"1px solid",
      borderColor:view===id?(color||ac):C.border,
      background:view===id?`${color||ac}22`:"transparent",
      color:view===id?(color||ac):C.L3,
      cursor:"pointer", fontSize:9, letterSpacing:"0.12em", textTransform:"uppercase",
      fontFamily:"inherit", transition:"all 0.2s", whiteSpace:"nowrap", fontWeight:view===id?700:400,
    }}>{label}</button>
  );

  const openModal = () => {
    setNewEv({ ...BLANK_EV, startMinute:curMin, date:selectedDate, duration:settings.defaultDuration });
    setShowRepeat(false);
    setShowModal(true);
  };

  return (
    <div style={{ background:C.bg0, minHeight:"100vh", color:C.L1, fontFamily:"'Courier New',monospace", display:"flex", flexDirection:"column", overflow:"hidden", height:"100vh" }}>

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <div style={{ background:`linear-gradient(180deg,${C.bg2},${C.bg0})`, borderBottom:`1px solid ${C.border}`, padding:"8px 12px", display:"flex", flexDirection:"column", gap:7, flexShrink:0 }}>

        {/* Row 1: counter left · progress center · mode toggle right */}
        <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>

          {/* Counter — compact */}
          <div style={{ flexShrink:0 }}>
            <div style={{ fontSize:7, color:C.L3, letterSpacing:"0.18em", lineHeight:1, marginBottom:1 }}>{countMode==="down"?"CNTDN":"CNTUP"}</div>
            <div style={{ display:"flex", alignItems:"baseline", gap:4, lineHeight:1 }}>
              <span style={{ fontSize:28, fontWeight:900, letterSpacing:"-1px", color:ac, textShadow:`0 0 18px ${ac}55`, transition:"color 0.4s" }}>
                {String(displayNum).padStart(4,"0")}
              </span>
              <span style={{ fontSize:9, color:C.L3, whiteSpace:"nowrap" }}>{countMode==="down"?"m left":"/ 1440"}</span>
            </div>
            <div style={{ fontSize:8, color:C.L2, marginTop:1 }}>{minuteToTimeStr(curMin)}</div>
          </div>

          {/* Progress bar — fills remaining space */}
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ height:4, background:C.bg3, borderRadius:2, overflow:"hidden", position:"relative", marginBottom:3 }}>
              <div style={{ position:"absolute", left:countMode==="down"?`${100-progressPct}%`:"0", width:`${progressPct}%`, height:"100%",
                background:countMode==="down"?"linear-gradient(90deg,#0c3d56,#38BDF8)":"linear-gradient(90deg,#78350f,#F59E0B)",
                borderRadius:2, boxShadow:`0 0 6px ${ac}80`, transition:"left 1s,width 1s,background 0.4s" }}/>
            </div>
            {/* Inline mini-stats row */}
            <div style={{ display:"flex", gap:8, flexWrap:"nowrap", overflow:"hidden" }}>
              {[{l:"ELP",v:`${curMin}m`},{l:"REM",v:`${MINUTES_IN_DAY-curMin}m`},{l:"SCHED",v:`${totalScheduled}m`},{l:"TASKS",v:`${pendingTodos.length}`}].map(({l,v})=>(
                <div key={l} style={{ display:"flex", gap:3, alignItems:"baseline", flexShrink:0 }}>
                  <span style={{ fontSize:7, color:C.L3 }}>{l}</span>
                  <span style={{ fontSize:9, color:C.L1, fontWeight:700 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Mode toggle — tight pill */}
          <div style={{ display:"flex", borderRadius:4, overflow:"hidden", border:`1px solid ${C.border}`, flexShrink:0 }}>
            <button onClick={() => setCountMode("up")} style={{ padding:"4px 8px", background:countMode==="up"?"rgba(245,158,11,0.22)":"transparent", color:countMode==="up"?"#F59E0B":C.L3, border:"none", borderRight:`1px solid ${C.border}`, cursor:"pointer", fontSize:8, fontFamily:"inherit", fontWeight:countMode==="up"?700:400 }}>▲</button>
            <button onClick={() => setCountMode("down")} style={{ padding:"4px 8px", background:countMode==="down"?"rgba(56,189,248,0.22)":"transparent", color:countMode==="down"?"#38BDF8":C.L3, border:"none", cursor:"pointer", fontSize:8, fontFamily:"inherit", fontWeight:countMode==="down"?700:400 }}>▼</button>
          </div>
        </div>

        {/* Row 2: view tabs + add button — single non-wrapping row */}
        <div style={{ display:"flex", gap:4, alignItems:"center", minWidth:0, overflow:"hidden" }}>
          <TabBtn id="day"   label="⊞ Grid"/>
          <TabBtn id="watch" label="◎ Watch"/>
          <TabBtn id="tasks" label={`☑ Tasks${pendingTodos.length?` (${pendingTodos.length})`:""}`} color="#A78BFA"/>
          <div style={{ flex:1 }}/>
          <button onClick={() => setShowSettings(true)}
            style={{ padding:"5px 8px", borderRadius:4, border:`1px solid ${C.border}`, background:"transparent",
              color:C.L3, cursor:"pointer", fontSize:13, lineHeight:1, flexShrink:0 }}
            title="Settings">⚙</button>
          <button onClick={openModal} style={{ padding:"5px 10px", borderRadius:4, border:`1px solid ${ac}`, background:`${ac}22`, color:ac, cursor:"pointer", fontSize:10, fontFamily:"inherit", fontWeight:900, flexShrink:0 }}>+ BLOCK</button>
        </div>
      </div>

      {/* ══ DATE NAV BAR ════════════════════════════════════════════════════ */}
      <div style={{ background:C.bg1, borderBottom:`1px solid ${C.border}`, padding:"5px 8px", display:"flex", alignItems:"center", gap:5, flexShrink:0, minWidth:0 }}>

        <button onClick={() => setSelectedDate(d => dateAddDays(d,-1))}
          style={{ padding:"4px 7px", borderRadius:3, border:`1px solid ${C.border}`, background:"transparent", color:C.L2, cursor:"pointer", fontSize:12, fontFamily:"inherit", flexShrink:0, lineHeight:1 }}>◀</button>

        {/* Date strip — single horizontal scrollable row, no wrap */}
        <div style={{ display:"flex", gap:3, alignItems:"center", flex:1, overflowX:"auto", overflowY:"hidden", scrollbarWidth:"none", WebkitOverflowScrolling:"touch", padding:"1px 0" }}>
          {Array.from({length:7},(_,i)=>{
            const d = dateAddDays(selectedDate, i-3);
            const hasEvs = events.some(e => e.date===d);
            const isSel  = d===selectedDate;
            const isTod  = isToday(d);
            const dt     = new Date(d+"T12:00:00");
            const dayN   = dt.toLocaleDateString("en-US",{weekday:"narrow"});
            const dayD   = dt.getDate();
            return (
              <button key={d} onClick={() => setSelectedDate(d)}
                style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:1,
                  padding:"3px 0", borderRadius:5, width:36, flexShrink:0,
                  border:`1px solid ${isSel?ac:isTod?C.borderHi:"transparent"}`,
                  background:isSel?`${ac}22`:isTod?C.bg3:"transparent",
                  cursor:"pointer", transition:"all 0.15s" }}>
                <span style={{ fontSize:8, color:isSel?ac:isTod?C.L2:C.L3, fontWeight:isTod||isSel?700:400, lineHeight:1 }}>{dayN}</span>
                <span style={{ fontSize:13, color:isSel?ac:C.L1, fontWeight:isSel?900:400, lineHeight:1.2 }}>{dayD}</span>
                <div style={{ width:4, height:4, borderRadius:"50%", background:hasEvs?(isSel?ac:C.L3):"transparent" }}/>
              </button>
            );
          })}
        </div>

        {/* Date label + today button — right side, compact */}
        <div style={{ display:"flex", alignItems:"center", gap:5, flexShrink:0 }}>
          {!isToday(selectedDate) && (
            <button onClick={() => setSelectedDate(TODAY)}
              style={{ padding:"2px 7px", borderRadius:3, border:`1px solid ${ac}`, background:`${ac}18`, color:ac, cursor:"pointer", fontSize:8, fontFamily:"inherit", fontWeight:700, whiteSpace:"nowrap" }}>TODAY</button>
          )}
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:9, color:isToday(selectedDate)?ac:C.L2, fontWeight:700, whiteSpace:"nowrap" }}>
              {isToday(selectedDate)?"Today":formatDateDisplay(selectedDate).split(",")[0]}
            </div>
            <div style={{ fontSize:8, color:C.L3, whiteSpace:"nowrap" }}>{dayEvents.length} blocks</div>
          </div>
        </div>

        <button onClick={() => setSelectedDate(d => dateAddDays(d,1))}
          style={{ padding:"4px 7px", borderRadius:3, border:`1px solid ${C.border}`, background:"transparent", color:C.L2, cursor:"pointer", fontSize:12, fontFamily:"inherit", flexShrink:0, lineHeight:1 }}>▶</button>
      </div>

      {/* ══ DAY SUMMARY BAR ═════════════════════════════════════════════════ */}
      {(()=>{
        const activeWindow  = settings.sleepMinute - settings.wakeMinute;
        const scheduledInWindow = dayEvents
          .filter(e => e.startMinute >= settings.wakeMinute && e.startMinute < settings.sleepMinute)
          .reduce((s,e) => s+e.duration, 0);
        const pctUsed  = Math.min(100, Math.round((scheduledInWindow / activeWindow) * 100));
        const layout   = computeLayout(dayEvents);
        const conflicts = dayEvents.filter(e => (layout[e.id]?.totalColumns||1) > 1).length;
        const freeTime  = Math.max(0, activeWindow - scheduledInWindow);
        return (
          <div style={{ background:C.bg1, borderBottom:`1px solid ${C.border}`, padding:"4px 12px",
            display:"flex", alignItems:"center", gap:10, flexShrink:0, minWidth:0 }}>
            {/* mini progress fill */}
            <div style={{ flex:1, height:3, background:C.bg3, borderRadius:2, overflow:"hidden", minWidth:40 }}>
              <div style={{ height:"100%", width:`${pctUsed}%`,
                background:`linear-gradient(90deg,${ac}88,${ac})`,
                borderRadius:2, transition:"width 0.6s" }}/>
            </div>
            <span style={{ fontSize:8, color:ac, fontWeight:700, flexShrink:0 }}>{pctUsed}%</span>
            <span style={{ fontSize:8, color:C.L3, flexShrink:0 }}>scheduled</span>
            <div style={{ width:1, height:12, background:C.border }}/>
            <span style={{ fontSize:8, color:C.L2, flexShrink:0 }}>{freeTime}m free</span>
            {conflicts > 0 && (
              <>
                <div style={{ width:1, height:12, background:C.border }}/>
                <span style={{ fontSize:8, color:"#f87171", fontWeight:700, flexShrink:0 }}>
                  ⚠ {conflicts} conflict{conflicts!==1?"s":""}
                </span>
              </>
            )}
          </div>
        );
      })()}

      {/* ══ BODY ════════════════════════════════════════════════════════════ */}
      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

        {/* ── SIDEBAR ──────────────────────────────────────── */}
        <div style={{ width:208, background:C.bg1, borderRight:`1px solid ${C.border}`, padding:12, display:"flex", flexDirection:"column", gap:12, overflow:"auto", flexShrink:0 }}>
          <WatchFace currentMinute={curMin} events={dayEvents} countMode={countMode}/>

          {nextEvent && (
            <div style={{ background:C.bg0, border:`1px solid ${C.border}`, borderRadius:5, padding:8 }}>
              <div style={{ fontSize:8, color:C.L3, letterSpacing:"0.15em", marginBottom:2 }}>NEXT BLOCK</div>
              <div style={{ fontSize:11, color:C.L1, fontWeight:700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{nextEvent.title}</div>
              <div style={{ fontSize:9, color:ac, marginTop:2, fontWeight:700 }}>
                {countMode==="down"?`${MINUTES_IN_DAY-nextEvent.startMinute}m left`:`min ${nextEvent.startMinute}`} · in {nextEvent.startMinute-curMin}m
              </div>
            </div>
          )}

          {pendingTodos.length > 0 && (
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                <span style={{ fontSize:8, color:C.L3, letterSpacing:"0.15em" }}>OPEN TASKS</span>
                <span style={{ fontSize:9, color:"#A78BFA", cursor:"pointer", fontWeight:700 }} onClick={() => setView("tasks")}>{pendingTodos.length} →</span>
              </div>
              {pendingTodos.slice(0,4).map(t => {
                const pri = PRIORITIES.find(p => p.id===t.priority);
                return (
                  <div key={t.id} onClick={() => setView("tasks")} style={{ display:"flex", gap:6, alignItems:"center", marginBottom:5, cursor:"pointer" }}>
                    <div style={{ width:2, height:26, borderRadius:1, background:pri?.color, flexShrink:0 }}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:9, color:C.L2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.title}</div>
                      <div style={{ fontSize:8, color:C.L3 }}>{t.duration}m · {pri?.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div>
            <div style={{ fontSize:8, color:C.L3, letterSpacing:"0.15em", marginBottom:5 }}>CATEGORIES</div>
            {CATEGORIES.map(cat => {
              const mins = dayEvents.filter(e => e.category===cat.id).reduce((s,e)=>s+e.duration,0);
              return (
                <div key={cat.id} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                  <div style={{ width:6, height:6, borderRadius:2, background:cat.color }}/>
                  <div style={{ flex:1, fontSize:9, color:C.L2 }}>{cat.label}</div>
                  <div style={{ fontSize:8, color:cat.color, fontWeight:700 }}>{mins>0?`${mins}m`:""}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── GRID VIEW ────────────────────────────────────── */}
        {view === "day" && (
          <div style={{ flex:1, overflow:"auto", position:"relative" }} ref={timelineRef} onClick={handleTimelineClick}>
            <div style={{ position:"relative", height:MINUTES_IN_DAY*PPM, minWidth:280 }}>

              {/* Sleep/wake shading */}
              {settings.wakeMinute > 0 && (
                <div style={{ position:"absolute", top:0, left:0, right:0,
                  height:settings.wakeMinute*PPM, background:"rgba(0,0,0,0.35)",
                  pointerEvents:"none", zIndex:0 }}/>
              )}
              {settings.sleepMinute < MINUTES_IN_DAY && (
                <div style={{ position:"absolute", top:settings.sleepMinute*PPM, left:0, right:0,
                  bottom:0, background:"rgba(0,0,0,0.35)",
                  pointerEvents:"none", zIndex:0 }}/>
              )}

              {/* Hour lines */}
              {Array.from({length:25},(_,i)=>{
                const minute = i*60;
                const h = i%24;
                const label = h===0?"12 AM":h<12?`${h} AM`:h===12?"12 PM":`${h-12} PM`;
                const isWake  = minute === settings.wakeMinute;
                const isSleep = minute === settings.sleepMinute;
                return (
                  <div key={minute} style={{ position:"absolute", top:minute*PPM, left:0, right:0, zIndex:1,
                    borderTop:`1px solid ${isWake||isSleep ? ac+"60" : C.gridHr}`, pointerEvents:"none" }}>
                    <div style={{ position:"absolute", left:6, top:-8, display:"flex", gap:5, alignItems:"baseline", userSelect:"none" }}>
                      <span style={{ fontSize:9, color:isWake||isSleep?ac:ac, fontWeight:700, transition:"color 0.4s", minWidth:32 }}>{gridLabel(minute)}</span>
                      <span style={{ fontSize:8, color:isWake?"#34D399":isSleep?"#f87171":C.L3 }}>
                        {label}{isWake?" · wake":isSleep?" · sleep":""}
                      </span>
                    </div>
                  </div>
                );
              })}
              {/* 15-min dashes */}
              {Array.from({length:MINUTES_IN_DAY/BLOCK_SIZE},(_,i)=>(
                <div key={i} style={{ position:"absolute", top:i*BLOCK_SIZE*PPM, left:70, right:8, borderTop:`1px dashed ${C.gridQtr}`, pointerEvents:"none", zIndex:1 }}/>
              ))}
              {/* NOW line — only on today */}
              {selectedDate === TODAY && (
                <div ref={nowRef} style={{ position:"absolute", top:curMin*PPM, left:0, right:0, zIndex:20, display:"flex", alignItems:"center", pointerEvents:"none" }}>
                  <div style={{ background:ac, color:"#000", fontSize:9, padding:"1px 5px", borderRadius:"0 2px 2px 0", fontFamily:"'Courier New',monospace", fontWeight:900, transition:"background 0.4s", whiteSpace:"nowrap" }}>{displayNum}</div>
                  <div style={{ flex:1, height:1.5, background:`linear-gradient(90deg,${ac},transparent)`, boxShadow:`0 0 7px ${ac}a0`, transition:"background 0.4s" }}/>
                </div>
              )}
              {/* Events — with overlap layout */}
              {(()=>{
                const layout = computeLayout(dayEvents);
                return dayEvents.map(ev => (
                  <EventBlock key={ev.id} event={ev} onSelect={setSelEv}
                    selected={selEv?.id===ev.id||flashId===ev.id}
                    layout={layout[ev.id]}/>
                ));
              })()}
            </div>
          </div>
        )}

        {/* ── WATCH VIEW ───────────────────────────────────── */}
        {view === "watch" && (
          <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:28, gap:22, overflow:"auto" }}>
            <div style={{ width:"min(380px,90vw)" }}>
              <svg viewBox="0 0 300 300" style={{ width:"100%" }}>
                <defs>
                  <radialGradient id="bfbg"><stop offset="0%" stopColor="#141a27"/><stop offset="100%" stopColor="#08090f"/></radialGradient>
                  <filter id="bgl"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                </defs>
                <circle cx={150} cy={150} r={145} fill={C.bg1} stroke={ac} strokeWidth="1" opacity="0.45"/>
                <circle cx={150} cy={150} r={138} fill="url(#bfbg)"/>
                {Array.from({length:96},(_,i)=>{
                  const a=(i/96)*360-90,rd=(a*Math.PI)/180,maj=i%4===0;
                  return <line key={i} x1={150+(maj?118:122)*Math.cos(rd)} y1={150+(maj?118:122)*Math.sin(rd)} x2={150+131*Math.cos(rd)} y2={150+131*Math.sin(rd)} stroke={maj?"#F59E0B":C.L4} strokeWidth={maj?2:0.8} opacity={maj?0.9:0.7}/>;
                })}
                {dayEvents.map(ev=>{
                  const cat=CATEGORIES.find(c=>c.id===ev.category);
                  const sa=ev.startMinute/MINUTES_IN_DAY*360-90,ea=(ev.startMinute+ev.duration)/MINUTES_IN_DAY*360-90;
                  const s={x:150+90*Math.cos(sa*Math.PI/180),y:150+90*Math.sin(sa*Math.PI/180)};
                  const e={x:150+90*Math.cos(ea*Math.PI/180),y:150+90*Math.sin(ea*Math.PI/180)};
                  return <path key={ev.id} d={`M${s.x} ${s.y}A90 90 0 ${ev.duration>720?1:0} 1 ${e.x} ${e.y}`} fill="none" stroke={cat?.color} strokeWidth="8" opacity="0.6" strokeLinecap="round" style={{cursor:"pointer"}} onClick={()=>setSelEv(ev)}/>;
                })}
                {(()=>{
                  const R=75,sa=countMode==="down"?(curMin/MINUTES_IN_DAY)*360-90:-90,ea=countMode==="down"?270:(curMin/MINUTES_IN_DAY)*360-90;
                  const pct=countMode==="down"?(MINUTES_IN_DAY-curMin)/MINUTES_IN_DAY:curMin/MINUTES_IN_DAY;
                  const s={x:150+R*Math.cos(sa*Math.PI/180),y:150+R*Math.sin(sa*Math.PI/180)};
                  const e={x:150+R*Math.cos(ea*Math.PI/180),y:150+R*Math.sin(ea*Math.PI/180)};
                  return <path d={`M${s.x} ${s.y}A${R} ${R} 0 ${pct>0.5?1:0} 1 ${e.x} ${e.y}`} fill="none" stroke={ac} strokeWidth="3.5" filter="url(#bgl)" strokeLinecap="round"/>;
                })()}
                {(()=>{
                  const a=(curMin/MINUTES_IN_DAY)*360-90,rd=a*Math.PI/180;
                  return <>
                    <line x1={150} y1={150} x2={150+63*Math.cos(rd)} y2={150+63*Math.sin(rd)} stroke={ac} strokeWidth="2.8" strokeLinecap="round" filter="url(#bgl)"/>
                    <line x1={150} y1={150} x2={150-16*Math.cos(rd)} y2={150-16*Math.sin(rd)} stroke={ac} strokeWidth="1.5" strokeLinecap="round" opacity="0.4"/>
                  </>;
                })()}
                <circle cx={150} cy={150} r={41} fill={C.bg0} stroke={C.border} strokeWidth="1"/>
                <text x={150} y={141} textAnchor="middle" fill={ac} fontSize="23" fontFamily="'Courier New',monospace" fontWeight="900" filter="url(#bgl)">{String(displayNum).padStart(4,"0")}</text>
                <text x={150} y={152} textAnchor="middle" fill={C.L3} fontSize="6.5" fontFamily="'Courier New',monospace" letterSpacing="1">{countMode==="down"?"MIN REMAINING":"MIN ELAPSED"}</text>
                <text x={150} y={164} textAnchor="middle" fill={C.L2} fontSize="9.5" fontFamily="'Courier New',monospace">{minuteToTimeStr(curMin)}</text>
                <circle cx={150} cy={150} r={4.5} fill={ac} filter="url(#bgl)"/>
              </svg>
            </div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:7, justifyContent:"center", maxWidth:440 }}>
              {dayEvents.sort((a,b)=>a.startMinute-b.startMinute).map(ev=>{
                const cat=CATEGORIES.find(c=>c.id===ev.category);
                const past=ev.startMinute+ev.duration<curMin;
                return <div key={ev.id} onClick={()=>setSelEv(ev)} style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 10px", borderRadius:4, border:`1px solid ${cat?.color}50`, background:cat?.bg, cursor:"pointer", opacity:past?0.35:1 }}>
                  <div style={{ width:5, height:5, borderRadius:"50%", background:cat?.color }}/>
                  <span style={{ fontSize:9, color:C.L3 }}>{countMode==="down"?MINUTES_IN_DAY-ev.startMinute:ev.startMinute}m</span>
                  <span style={{ fontSize:10, color:C.L1, fontWeight:600 }}>{ev.title}</span>
                </div>;
              })}
            </div>
          </div>
        )}

        {/* ── TASKS VIEW ───────────────────────────────────── */}
        {view === "tasks" && (
          <div style={{ flex:1, overflow:"auto", padding:18 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14, flexWrap:"wrap" }}>
              <div style={{ fontSize:11, color:"#A78BFA", letterSpacing:"0.2em", fontWeight:700 }}>☑ TASK BACKLOG</div>
              <div style={{ flex:1 }}/>
              <button onClick={() => setShowDone(v=>!v)} style={{ padding:"4px 9px", borderRadius:3, border:`1px solid ${C.border}`, background:"transparent", color:showDone?C.L2:C.L3, cursor:"pointer", fontSize:9, fontFamily:"inherit" }}>{showDone?"HIDE":"SHOW"} DONE ({doneTodos.length})</button>
              {pendingTodos.length > 0 && (
                <button onClick={autoScheduleAll} style={{ padding:"5px 11px", borderRadius:3, border:"1px solid #34D399", background:"rgba(52,211,153,0.15)", color:"#34D399", cursor:"pointer", fontSize:9, fontFamily:"inherit", fontWeight:700 }}>⚡ AUTO-SCHEDULE ALL</button>
              )}
              <button onClick={() => setShowAddTodo(v=>!v)} style={{ padding:"5px 11px", borderRadius:3, border:"1px solid #A78BFA", background:"rgba(167,139,250,0.15)", color:"#A78BFA", cursor:"pointer", fontSize:9, fontFamily:"inherit", fontWeight:700 }}>+ NEW TASK</button>
            </div>

            {showAddTodo && (
              <div style={{ background:C.bg2, border:`1px solid #A78BFA30`, borderRadius:6, padding:14, marginBottom:14, display:"flex", flexDirection:"column", gap:10 }}>
                <FL>NEW TASK</FL>
                <input value={newTodo.title} onChange={e=>setNewTodo(s=>({...s,title:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addTodo()} placeholder="What needs to get done?" autoFocus
                  style={{ padding:"8px 10px", background:C.bg0, border:`1px solid ${C.border}`, borderRadius:4, color:C.L1, fontSize:12, fontFamily:"inherit", outline:"none" }}/>
                <div style={{ display:"flex", gap:14, flexWrap:"wrap" }}>
                  <div>
                    <FL>DURATION</FL>
                    <div style={{ display:"flex", gap:4 }}>
                      {[15,30,45,60,90,120].map(d=>(
                        <button key={d} onClick={()=>setNewTodo(s=>({...s,duration:d}))} style={{ padding:"3px 7px", borderRadius:3, border:`1px solid ${newTodo.duration===d?"#A78BFA":C.border}`, background:newTodo.duration===d?"rgba(167,139,250,0.15)":"transparent", color:newTodo.duration===d?"#A78BFA":C.L2, cursor:"pointer", fontSize:9, fontFamily:"inherit" }}>{d}m</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <FL>PRIORITY</FL>
                    <div style={{ display:"flex", gap:4 }}>
                      {PRIORITIES.map(p=>(
                        <button key={p.id} onClick={()=>setNewTodo(s=>({...s,priority:p.id}))} style={{ padding:"3px 7px", borderRadius:3, border:`1px solid ${newTodo.priority===p.id?p.color:C.border}`, background:newTodo.priority===p.id?`${p.color}20`:"transparent", color:newTodo.priority===p.id?p.color:C.L2, cursor:"pointer", fontSize:9, fontFamily:"inherit", fontWeight:newTodo.priority===p.id?700:400 }}>{p.label}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <FL>CATEGORY</FL>
                    <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                      {CATEGORIES.map(c=>(
                        <button key={c.id} onClick={()=>setNewTodo(s=>({...s,category:c.id}))} style={{ padding:"3px 7px", borderRadius:3, border:`1px solid ${newTodo.category===c.id?c.color:C.border}`, background:newTodo.category===c.id?c.bg:"transparent", color:newTodo.category===c.id?c.color:C.L2, cursor:"pointer", fontSize:9, fontFamily:"inherit" }}>{c.label}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ display:"flex", gap:7 }}>
                  <button onClick={addTodo} style={{ padding:"6px 14px", borderRadius:4, background:"rgba(167,139,250,0.2)", border:"1px solid #A78BFA", color:"#A78BFA", cursor:"pointer", fontSize:10, fontFamily:"inherit", fontWeight:700 }}>ADD TASK</button>
                  <button onClick={()=>setShowAddTodo(false)} style={{ padding:"6px 12px", borderRadius:4, background:"transparent", border:`1px solid ${C.border}`, color:C.L3, cursor:"pointer", fontSize:10, fontFamily:"inherit" }}>CANCEL</button>
                </div>
              </div>
            )}

            {pendingTodos.length > 0 && (
              <div style={{ marginBottom:18 }}>
                <div style={{ fontSize:8, color:C.L3, letterSpacing:"0.2em", marginBottom:7, display:"flex", gap:8 }}>
                  <span>PENDING</span><span style={{ color:"#A78BFA", fontWeight:700 }}>{pendingTodos.length}</span>
                </div>
                {[...pendingTodos].sort((a,b)=>PRIORITIES.findIndex(p=>p.id===a.priority)-PRIORITIES.findIndex(p=>p.id===b.priority)).map(t=>(
                  <TodoRow key={t.id} todo={t}
                    onDone={id=>setTodos(p=>p.map(t=>t.id===id?{...t,done:!t.done}:t))}
                    onDelete={id=>setTodos(p=>p.filter(t=>t.id!==id))}
                    onSchedule={scheduleTodo}
                    onPick={pickTodo}
                    isPicking={pendingTodo?.id === t.id}/>
                ))}
              </div>
            )}

            {scheduledTodos.length > 0 && (
              <div style={{ marginBottom:18 }}>
                <div style={{ fontSize:8, color:"#34D399", letterSpacing:"0.2em", marginBottom:7, display:"flex", gap:8 }}>
                  <span>ON CALENDAR</span><span style={{ fontWeight:700 }}>{scheduledTodos.length}</span>
                </div>
                {scheduledTodos.map(t=>{
                  const ev=events.find(e=>e.id===t.scheduledEventId);
                  return (
                    <div key={t.id} style={{ display:"flex", alignItems:"flex-start", gap:7 }}>
                      <div style={{ flex:1 }}>
                        <TodoRow todo={t}
                          onDone={id=>setTodos(p=>p.map(t=>t.id===id?{...t,done:!t.done}:t))}
                          onDelete={id=>setTodos(p=>p.filter(t=>t.id!==id))}
                          onSchedule={scheduleTodo}
                          onPick={pickTodo}
                          isPicking={false}/>
                      </div>
                      {ev && (
                        <button onClick={()=>{ setSelEv(ev); setSelectedDate(ev.date); setView("day"); }}
                          style={{ padding:"6px 9px", borderRadius:3, background:"rgba(52,211,153,0.1)", border:`1px solid #34D39940`, color:"#34D399", cursor:"pointer", fontSize:8, fontFamily:"inherit", whiteSpace:"nowrap", flexShrink:0, lineHeight:1.5 }}>
                          → {formatDateDisplay(ev.date)}<br/>
                          <span style={{ fontSize:7, color:"#34D39980" }}>{minuteToTimeStr(ev.startMinute)}</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {showDone && doneTodos.length > 0 && (
              <div>
                <div style={{ fontSize:8, color:C.L3, letterSpacing:"0.2em", marginBottom:7 }}>COMPLETED ({doneTodos.length})</div>
                {doneTodos.map(t=>(
                  <TodoRow key={t.id} todo={t}
                    onDone={id=>setTodos(p=>p.map(t=>t.id===id?{...t,done:!t.done}:t))}
                    onDelete={id=>setTodos(p=>p.filter(t=>t.id!==id))}
                    onSchedule={scheduleTodo}
                    onPick={pickTodo}
                    isPicking={false}/>
                ))}
              </div>
            )}

            {pendingTodos.length===0 && scheduledTodos.length===0 && (
              <div style={{ textAlign:"center", padding:"60px 0" }}>
                <div style={{ fontSize:40, marginBottom:8, color:C.border }}>☑</div>
                <div style={{ fontSize:11, letterSpacing:"0.25em", color:C.L3 }}>ALL CLEAR</div>
              </div>
            )}
          </div>
        )}

        {/* ── RIGHT PANEL: event detail OR todo placement ──── */}
        {pendingTodo && (
          <TodoPlacementPanel
            key={pendingTodo.id}
            todo={pendingTodo}
            selectedDate={selectedDate}
            accentColor={ac}
            onPlace={scheduleTodoAt}
            onCancel={() => setPendingTodo(null)}
          />
        )}
        {!pendingTodo && selEv && view !== "tasks" && (
          <EventDetailPanel
            key={selEv.id}
            event={selEv}
            allEvents={events}
            currentMinute={curMin}
            countMode={countMode}
            accentColor={ac}
            onUpdate={updateEvent}
            onDelete={deleteEvent}
            onClose={() => setSelEv(null)}
          />
        )}
      </div>

      {/* ══ ADD BLOCK MODAL ════════════════════════════════════════════════ */}
      {showModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.82)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 }}>
          <div style={{ background:C.bg2, border:`1px solid ${C.borderHi}`, borderRadius:8, padding:20, width:320, display:"flex", flexDirection:"column", gap:12, maxHeight:"90vh", overflow:"auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:9, color:ac, letterSpacing:"0.2em", fontWeight:700 }}>NEW TIME BLOCK</span>
              <button onClick={() => setShowModal(false)} style={{ background:"none", border:"none", color:C.L3, cursor:"pointer", fontSize:16, padding:0 }}>✕</button>
            </div>

            {/* Title */}
            <div>
              <FL>TITLE (blank = category name)</FL>
              <input value={newEv.title} onChange={e=>setNewEv(s=>({...s,title:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addEvent()}
                placeholder={catLabel(newEv.category)} autoFocus
                style={{ width:"100%", padding:"8px 10px", background:C.bg0, border:`1px solid ${C.border}`, borderRadius:4, color:C.L1, fontSize:12, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
            </div>

            {/* Date + Start in a grid */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <DateInput label="DATE" value={newEv.date} onChange={d=>setNewEv(s=>({...s,date:d}))}/>
              <div>
                <FL>START</FL>
                <MinuteInput value={newEv.startMinute} onChange={v=>setNewEv(s=>({...s,startMinute:v}))} accentColor={ac}/>
              </div>
            </div>

            {/* Duration */}
            <div>
              <FL>DURATION</FL>
              <MinuteInput value={newEv.duration} onChange={v=>setNewEv(s=>({...s,duration:v}))}/>
              <div style={{ display:"flex", gap:4, marginTop:6, flexWrap:"wrap" }}>
                {[15,30,45,60,90,120].map(d=>(
                  <button key={d} onClick={()=>setNewEv(s=>({...s,duration:d}))}
                    style={{ padding:"3px 8px", borderRadius:3, border:`1px solid ${newEv.duration===d?ac:C.border}`, background:newEv.duration===d?`${ac}22`:"transparent", color:newEv.duration===d?ac:C.L2, cursor:"pointer", fontSize:9, fontFamily:"inherit", fontWeight:newEv.duration===d?700:400 }}>
                    {d}m
                  </button>
                ))}
              </div>
            </div>

            {/* Category */}
            <div>
              <FL>CATEGORY</FL>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:3 }}>
                {CATEGORIES.map(cat=>(
                  <button key={cat.id} onClick={()=>setNewEv(s=>({...s,category:cat.id}))}
                    style={{ display:"flex", alignItems:"center", gap:7, padding:"5px 8px", borderRadius:4,
                      border:`1px solid ${newEv.category===cat.id?cat.color:C.border}`,
                      background:newEv.category===cat.id?cat.bg:"transparent", cursor:"pointer", fontFamily:"inherit" }}>
                    <div style={{ width:6, height:6, borderRadius:2, background:cat.color }}/>
                    <span style={{ fontSize:9, color:newEv.category===cat.id?cat.color:C.L2, fontWeight:newEv.category===cat.id?700:400 }}>{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Repeat — collapsible */}
            <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:10 }}>
              <button onClick={() => setShowRepeat(v=>!v)}
                style={{ background:"none", border:"none", color:newEv.repeat!=="none"?ac:C.L3, cursor:"pointer", fontSize:9, fontFamily:"inherit", display:"flex", alignItems:"center", gap:6, padding:0, letterSpacing:"0.12em" }}>
                <span>{showRepeat?"▼":"▶"}</span>
                <span>REPEAT</span>
                {newEv.repeat !== "none" && <span style={{ color:ac }}>· {newEv.repeat}{newEv.repeat==="custom"?` every ${newEv.repeatEvery}d`:""} × {newEv.repeatCount}</span>}
              </button>

              {showRepeat && (
                <div style={{ marginTop:8, display:"flex", flexDirection:"column", gap:8 }}>
                  <div style={{ display:"flex", gap:4 }}>
                    {["none","daily","weekly","custom"].map(r=>(
                      <button key={r} onClick={()=>setNewEv(s=>({...s,repeat:r}))}
                        style={{ padding:"3px 8px", borderRadius:3, border:`1px solid ${newEv.repeat===r?ac:C.border}`, background:newEv.repeat===r?`${ac}22`:"transparent", color:newEv.repeat===r?ac:C.L2, cursor:"pointer", fontSize:9, fontFamily:"inherit", fontWeight:newEv.repeat===r?700:400, textTransform:"capitalize" }}>{r}</button>
                    ))}
                  </div>
                  {newEv.repeat === "custom" && (
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:9, color:C.L3 }}>Every</span>
                      <input type="number" min={1} max={365} value={newEv.repeatEvery}
                        onChange={e=>setNewEv(s=>({...s,repeatEvery:Math.max(1,+e.target.value)}))}
                        style={{ width:52, padding:"4px 6px", background:C.bg0, border:`1px solid ${C.border}`, borderRadius:3, color:ac, fontFamily:"'Courier New',monospace", fontSize:13, fontWeight:700, outline:"none" }}/>
                      <span style={{ fontSize:9, color:C.L3 }}>days</span>
                    </div>
                  )}
                  {newEv.repeat !== "none" && (
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:9, color:C.L3 }}>Occurrences</span>
                      <input type="number" min={2} max={52} value={newEv.repeatCount}
                        onChange={e=>setNewEv(s=>({...s,repeatCount:Math.max(2,Math.min(52,+e.target.value))}))}
                        style={{ width:52, padding:"4px 6px", background:C.bg0, border:`1px solid ${C.border}`, borderRadius:3, color:C.L1, fontFamily:"'Courier New',monospace", fontSize:13, fontWeight:700, outline:"none" }}/>
                      <span style={{ fontSize:9, color:C.L3 }}>× = {newEv.repeatCount} blocks</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button onClick={addEvent}
              style={{ padding:9, borderRadius:4, background:countMode==="down"?"linear-gradient(135deg,#0b3a52,#38BDF8)":"linear-gradient(135deg,#6b2d0a,#F59E0B)", border:"none", color:"#000", cursor:"pointer", fontSize:10, fontFamily:"inherit", fontWeight:900, letterSpacing:"0.15em" }}>
              SCHEDULE BLOCK{newEv.repeat!=="none"?` (${newEv.repeatCount}×)`:""}
            </button>
          </div>
        </div>
      )}

      {/* ══ SETTINGS PANEL ═════════════════════════════════════════════════ */}
      {showSettings && (
        <SettingsPanel
          settings={settings}
          onChange={updateSettings}
          onClose={() => setShowSettings(false)}
          accentColor={ac}
        />
      )}

      {/* ══ UNDO TOAST ═════════════════════════════════════════════════════ */}
      {undoEntry && (
        <UndoToast
          entry={undoEntry}
          onUndo={undoDelete}
          onDismiss={() => { clearTimeout(undoEntry.timer); setUndoEntry(null); }}
        />
      )}
    </div>
  );
}