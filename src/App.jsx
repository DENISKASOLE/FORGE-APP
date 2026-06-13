import { useState, useRef, useEffect } from "react";
import { supabase } from "./supabaseClient.js";
// ── Constants ─────────────────────────────────────────────────────────────────
const GOAL_COLORS = { "Muscle Gain":"#E8C547","Fat Loss":"#FF6B6B","Strength":"#4ECDC4","Endurance":"#A78BFA","General Fitness":"#6EE7B7" };
const LIFT_FIELDS = [{key:"benchPress",label:"Bench"},{key:"squat",label:"Squat"},{key:"deadlift",label:"Deadlift"},{key:"ohp",label:"OHP"}];
const MEAS_FIELDS = [{key:"waist",label:"Waist"},{key:"chest",label:"Chest"},{key:"arms",label:"Arms"},{key:"hips",label:"Hips"},{key:"thighs",label:"Thighs"},{key:"bodyFat",label:"Body Fat %"}];
const EXERCISE_LIBRARY = [
"Rack Pulls","Barbell Deadlift","Romanian Deadlift","Good Morning","Hip Thrust","Trap Bar Deadlift","Deficit Deadlift","Sumo Deadlift","Block Pulls",
"Flat Barbell Bench Press","Incline DB Chest Press","Dumbbell Fly","Cable Crossover","Push-Up","Decline Bench Press","Machine Chest Press","Smith Machine Bench","Guillotine Press",
"Squat","Front Squat","Goblet Squat","Leg Press","Leg Extension","Lying Leg Curl","Lunge","Bulgarian Split Squat","Hack Squat","V-Squat","Pendulum Squat",
"Pull-Up","Neutral Grip Lat Pulldown","Seated Row","Machine Rows","Dumbbell Row","Face Pull","Chest-Supported Row","Pendlay Row","T-Bar Row","Seal Row",
"Overhead Press","DB Shoulder Press","Arnold Press","Cable Lateral Raises","DB Lateral Raises","Shrug","Machine Shoulder Press","Pike Push-Up","Landmine Press",
"Bicep Curl","Incline DB Curl","Hammer Curl","EZ Tricep Extension","Tricep Pushdown","Skull Crusher","Dips","Preacher Curl","Machine Curl","Rope Curl","Cable Curl",
"Sled Push","Farmer's Carry","Battle Ropes","Box Jump","Burpee","SkiErg","Elliptical","Rower","Stair Climber","Assault Bike","VersaClimber",
"Plank","Bird Dog","Dead Bug","Russian Twist","Hanging Leg Raise","Cable Wood Chop","Pallof Press","Ab Wheel","Machine Crunch","Decline Sit-Ups",
"Cat-Cow","90/90 Hip Rotation","Band Pass Throughs","Thoracic Rotation","Med Ball Throw","Foam Rolling","Band Pull-Aparts","Stretching",
"Bag Punches","Interval Treadmill Walk","Swimming","Rowing Machine","Kickboxing","Jump Rope","Shadow Boxing",
];
const COLORS = ["#E8C547","#FF6B6B","#4ECDC4","#A78BFA","#6EE7B7","#FB923C","#60A5FA","#F472B6"];
// ── Seed Data ─────────────────────────────────────────────────────────────────
const SEED = [
{ id:1, name:"Marcus Reid", age:34, goal:"Muscle Gain", weight:83.9, joinDate:"2026-01-10", avatar:"MR", color:"#E8C547", photo:null,
packages:[{id:101,name:"10 Session Pack",total:10,used:7,price:800,paid:true}],
injuries:["Lower back – avoid heavy deadlifts"], checkIns:[true,true,true,false,true,true,true,false,true,true,true,true],
photos:[],
progress:[
{date:"Jan",weight:83.9,benchPress:185,squat:225,deadlift:275,ohp:115,waist:34,chest:42,arms:15,bodyFat:18},
{date:"Feb",weight:85.3,benchPress:195,squat:245,deadlift:295,ohp:120,waist:34,chest:43,arms:15.5,bodyFat:17.5},
{date:"Mar",weight:86.6,benchPress:205,squat:265,deadlift:315,ohp:125,waist:33.5,chest:43.5,arms:16,bodyFat:17},
{date:"Apr",weight:87.5,benchPress:215,squat:280,deadlift:335,ohp:130,waist:33,chest:44,arms:16.5,bodyFat:16.5},
{date:"May",weight:88.0,benchPress:225,squat:295,deadlift:355,ohp:135,waist:33,chest:44.5,arms:17,bodyFat:16},
],
measurements:{waist:33,chest:44.5,arms:17,hips:38,thighs:24,bodyFat:16},
notes:"Great consistency. Increase bench by 10lbs next cycle.", program:null,
schedule:[{day:"Mon",time:"07:00"},{day:"Wed",time:"07:00"},{day:"Fri",time:"08:00"}],
sessions:0,
waitlist:false,
},
{ id:2, name:"Sofia Vargas", age:28, goal:"Fat Loss", weight:67.1, joinDate:"2026-02-03", avatar:"SV", color:"#FF6B6B", photo:null,
packages:[{id:201,name:"Monthly Unlimited",total:20,used:18,price:600,paid:true}],
injuries:[], checkIns:[true,true,false,true,true,true,false,false,true,true],
photos:[],
progress:[
{date:"Feb",weight:67.1,benchPress:65,squat:95,deadlift:115,ohp:45,waist:29,chest:36,arms:12,bodyFat:28},
{date:"Mar",weight:65.8,benchPress:70,squat:105,deadlift:125,ohp:50,waist:28.5,chest:35.5,arms:12,bodyFat:27},
{date:"Apr",weight:64.4,benchPress:75,squat:115,deadlift:135,ohp:55,waist:28,chest:35,arms:12.5,bodyFat:26},
{date:"May",weight:63.5,benchPress:80,squat:125,deadlift:145,ohp:60,waist:27.5,chest:34.5,arms:12.5,bodyFat:25},
],
measurements:{waist:27.5,chest:34.5,arms:12.5,hips:37,thighs:22,bodyFat:25},
notes:"Down 8lbs. Cardio twice weekly. Watch nutrition on weekends.", program:null,
schedule:[{day:"Tue",time:"18:00"},{day:"Thu",time:"18:00"},{day:"Sat",time:"10:00"}],
sessions:0,
waitlist:false,
},
{ id:3, name:"Derek Osei", age:41, goal:"Strength", weight:95.3, joinDate:"2025-11-15", avatar:"DO", color:"#4ECDC4", photo:null,
packages:[{id:301,name:"5 Session Pack",total:5,used:2,price:450,paid:false}],
injuries:["Right shoulder – avoid overhead pressing above 90°"],
checkIns:[true,true,true,true,true,true,true,true,true,true,true,true],
photos:[],
progress:[
{date:"Nov",weight:97.5,benchPress:225,squat:315,deadlift:405,ohp:155,waist:36,chest:46,arms:17,bodyFat:22},
{date:"Dec",weight:96.6,benchPress:245,squat:335,deadlift:425,ohp:160,waist:35.5,chest:46,arms:17.5,bodyFat:21},
{date:"Jan",weight:96.2,benchPress:265,squat:355,deadlift:445,ohp:165,waist:35,chest:46.5,arms:17.5,bodyFat:20.5},
{date:"Feb",weight:95.7,benchPress:275,squat:375,deadlift:465,ohp:170,waist:35,chest:47,arms:18,bodyFat:20},
{date:"Mar",weight:95.3,benchPress:285,squat:395,deadlift:485,ohp:175,waist:34.5,chest:47,arms:18,bodyFat:19.5},
{date:"Apr",weight:95.3,benchPress:295,squat:405,deadlift:495,ohp:180,waist:34.5,chest:47.5,arms:18.5,bodyFat:19},
],
measurements:{waist:34.5,chest:47.5,arms:18.5,hips:40,thighs:26,bodyFat:19},
notes:"Deadlift PR incoming. Focus on hip hinge mechanics.", program:null,
schedule:[{day:"Mon",time:"06:00"},{day:"Wed",time:"06:00"},{day:"Fri",time:"06:00"},{day:"Sat",time:"09:00"}],
sessions:0,
waitlist:false,
},
];
const WAITLIST = [
{id:901,name:"James Park",goal:"Muscle Gain",email:"james@email.com",date:"2026-05-20"},
{id:902,name:"Aisha Nwosu",goal:"Fat Loss",email:"aisha@email.com",date:"2026-05-28"},
];
// ── Helpers ───────────────────────────────────────────────────────────────────
function makeWeek(n,days){ return { weekNum:n, days:days.map(d=>({...d,date:"",sessionData:d.exercises.map(ex=>({name:ex.name,sets:Array.from({length:ex.numSets||3},()=>({weight:"",reps:"",rpe:""})),})),metrics:{maxHR:"",avgHR:"",kcal:""},notes:"",rpeAvg:"",})) }; }
function calc1RM(w,r){ return r===1?w:Math.round(w*(1+r/30)); }
function getPRs(progress){
const prs={};
LIFT_FIELDS.forEach(({key})=>{ let best=0; progress.forEach(p=>{ if(p[key]>best) best=p[key]; }); if(best>0) prs[key]=best; });
return prs;
}
function normalizeInjuries(injuries){
if(!injuries) return [];
if(Array.isArray(injuries)) return injuries;
if(typeof injuries === "string") return injuries.split(";").map(i=>i.trim()).filter(Boolean);
return [];
}
function getClientColor(goal,id){
if(GOAL_COLORS[goal]) return GOAL_COLORS[goal];
const seed = String(id||"").split("").reduce((sum,ch)=>sum+ch.charCodeAt(0),0);
return COLORS[seed % COLORS.length];
}
function mapDbClient(row, sections={}){
const client = {
  id: row.id,
  name: row.name || "",
  goal: row.goal || "General Fitness",
  age: row.age ?? 0,
  weight: row.weight_kg ?? 0,
  phone: row.phone || "",
  email: row.email || "",
  injuries: normalizeInjuries(row.injuries),
  notes: row.notes || "",
  sessions: row.sessions_conducted ?? 0,
  sessionsBooked: row.sessions_booked ?? 0,
  trials: row.trials ?? 0,
  created_at: row.created_at,
  joinDate: row.created_at ? new Date(row.created_at).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
  avatar: row.name ? row.name.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2) : "??",
  color: getClientColor(row.goal, row.id),
  photo: row.photo || null,
  packages: row.packages || [],
  checkIns: row.checkIns || [],
  schedule: row.schedule || [],
  progress: row.progress || [],
  measurements: row.measurements || {},
  program: row.program || null,
  nutrition: row.nutrition || null,
  waitlist: false,
};
if(sections.progress){
  client.progress = sections.progress.progress || client.progress;
  client.measurements = sections.progress.measurements || client.measurements;
}
if(sections.sessions){
  client.sessions = sections.sessions.sessions ?? client.sessions;
  client.schedule = sections.sessions.schedule || client.schedule;
  client.checkIns = sections.sessions.checkIns || client.checkIns;
}
if(sections.details){
  client.notes = sections.details.notes ?? client.notes;
  client.injuries = normalizeInjuries(sections.details.injuries) || client.injuries;
  client.photo = sections.details.photo ?? client.photo;
  client.packages = sections.details.packages || client.packages;
}
if(sections.program){
  client.program = sections.program;
}
if(sections.nutrition){
  client.nutrition = sections.nutrition;
}
return client;
}
async function saveClientDataSection(clientId, section, data) {
  if(!clientId || !section) return;
  console.log("TRYING TO SAVE CLIENT DATA", clientId, section, data);
  const { error } = await supabase.from("client_data").upsert(
    { client_id: clientId, section, data },
    { onConflict: ["client_id", "section"], returning: "minimal" }
  );
  if(error){
    console.error("FAILED TO SAVE CLIENT DATA", clientId, section, error);
    return;
  }
  console.log("SAVED CLIENT DATA SUCCESS", section);
}
function mergeClientDataIntoClient(client, rows) {
  if(!rows?.length) return client;
  let merged = { ...client };
  rows.forEach((row) => {
    if(!row?.section || row.data == null) return;
    const data = row.data;
    switch(row.section){
      case "program":
        merged.program = data;
        break;
      case "nutrition":
        merged.nutrition = data;
        break;
      case "progress":
        if(Array.isArray(data.progress)) merged.progress = data.progress;
        if(data.measurements) merged.measurements = data.measurements;
        if(data.weight != null) merged.weight = data.weight;
        if(data.sessions != null) merged.sessions = data.sessions;
        if(data.sessionsBooked != null) merged.sessionsBooked = data.sessionsBooked;
        if(data.trials != null) merged.trials = data.trials;
        break;
      case "sessions":
        if(Array.isArray(data.schedule)) merged.schedule = data.schedule;
        if(data.sessions != null) merged.sessions = data.sessions;
        if(data.sessionsBooked != null) merged.sessionsBooked = data.sessionsBooked;
        if(data.trials != null) merged.trials = data.trials;
        if(data.checkIns != null) merged.checkIns = data.checkIns;
        break;
      case "details":
        if(data.notes != null) merged.notes = data.notes;
        if(data.injuries != null) merged.injuries = normalizeInjuries(data.injuries);
        if(data.photo != null) merged.photo = data.photo;
        if(Array.isArray(data.packages)) merged.packages = data.packages;
        break;
    }
  });
  return merged;
}
async function persistClientDataSections(client, changes) {
  if(!client?.id) return;
  const tasks = [];
  if(changes.program != null) tasks.push(saveClientDataSection(client.id, "program", client.program || {}));
  if(changes.nutrition != null) tasks.push(saveClientDataSection(client.id, "nutrition", client.nutrition || {}));
  if(changes.progress != null || changes.measurements != null || changes.weight != null || changes.sessions != null || changes.sessionsBooked != null || changes.trials != null) {
    tasks.push(saveClientDataSection(client.id, "progress", {
      progress: client.progress || [],
      measurements: client.measurements || {},
      weight: client.weight ?? 0,
      sessions: client.sessions ?? 0,
      sessionsBooked: client.sessionsBooked ?? 0,
      trials: client.trials ?? 0,
    }));
  }
  if(changes.schedule != null || changes.sessions != null || changes.sessionsBooked != null || changes.trials != null || changes.checkIns != null) {
    tasks.push(saveClientDataSection(client.id, "sessions", {
      schedule: client.schedule || [],
      sessions: client.sessions ?? 0,
      sessionsBooked: client.sessionsBooked ?? 0,
      trials: client.trials ?? 0,
      checkIns: client.checkIns || [],
    }));
  }
  if(changes.notes != null || changes.injuries != null || changes.photo != null || changes.packages != null) {
    tasks.push(saveClientDataSection(client.id, "details", {
      notes: client.notes || "",
      injuries: client.injuries || [],
      photo: client.photo || null,
      packages: client.packages || [],
    }));
  }
  if(tasks.length === 0) return;
  await Promise.all(tasks);
}
function generateSmartProgram(client, days, weeks, extra) {
  const injuries = normalizeInjuries(client.injuries || []);
  const lowerBack = injuries.some(i => /lower back|back/i.test(i.toLowerCase())) || (extra||"").toLowerCase().includes("lower back");
  const goal = client.goal || "General Fitness";
  const goalConfig = {
    Strength: {
      rep: "4-6",
      sets: 4,
      main: ["Squat","Flat Barbell Bench Press","Overhead Press","Pull-Up","Pendlay Row","Front Squat","DB Shoulder Press"],
      accessories: ["Face Pull","Hammer Curl","Tricep Pushdown","Shrug","Cable Lateral Raises"],
      finishers: ["Farmer's Carry","Battle Ropes"],
    },
    "Muscle Gain": {
      rep: "8-12",
      sets: 4,
      main: ["Squat","Flat Barbell Bench Press","Incline DB Chest Press","Overhead Press","Pull-Up","Dumbbell Row","Leg Press"],
      accessories: ["Cable Crossover","DB Lateral Raises","Hammer Curl","Tricep Pushdown","Chest-Supported Row","Face Pull"],
      finishers: ["Jump Rope","Rowing Machine"],
    },
    "Fat Loss": {
      rep: "10-15",
      sets: 3,
      main: ["Squat","Push-Up","Pull-Up","Leg Press","Dumbbell Row","Cable Wood Chop"],
      accessories: ["Battle Ropes","Burpee","Jump Rope","Box Jump","Rowing Machine","Assault Bike"],
      finishers: ["Sled Push","Shadow Boxing"],
    },
    Endurance: {
      rep: "12-18",
      sets: 3,
      main: ["Goblet Squat","Push-Up","Pull-Up","Rowing Machine","Elliptical","Stair Climber","Jump Rope"],
      accessories: ["Band Pull-Aparts","Cable Wood Chop","Machine Crunch","Plank"],
      finishers: ["Swimming","VersaClimber"],
    },
    "General Fitness": {
      rep: "8-14",
      sets: 3,
      main: ["Squat","Push-Up","Pull-Up","Lunge","Dumbbell Row","Plank","Cable Wood Chop"],
      accessories: ["Band Pull-Aparts","Russian Twist","Machine Crunch","Face Pull","DB Shoulder Press"],
      finishers: ["Jump Rope","Battle Ropes"],
    },
  };
  const config = goalConfig[goal] || goalConfig["General Fitness"];
  const blocked = lowerBack ? ["Barbell Deadlift","Romanian Deadlift","Good Morning","Rack Pulls","Sumo Deadlift","Block Pulls","Deficit Deadlift","Heavy Deadlift"] : [];
  const coreStability = ["Dead Bug","Bird Dog","Plank","Side Plank","Pallof Press","Glute Bridge"];
  const dayNames = {
    Strength: ["Lower Strength","Upper Strength","Power","Recovery","Strength Finish"],
    "Muscle Gain": ["Push","Pull","Legs","Upper Hypertrophy","Full Body"],
    "Fat Loss": ["Strength & Sweat","Upper Burn","Lower Burn","Metabolic Circuit","Core & Conditioning"],
    Endurance: ["Circuit","Endurance","Strength","Conditioning","Recovery"],
    "General Fitness": ["Full Body 1","Full Body 2","Full Body 3","Core","Conditioning"],
  };
  const names = (dayNames[goal] || dayNames["General Fitness"]).slice(0, days);
  const choose = (pool, count) => {
    const source = pool.filter(ex => !blocked.includes(ex));
    const selected = [];
    const copy = [...source];
    while(selected.length < count && copy.length){
      const idx = Math.floor(Math.random() * copy.length);
      selected.push(copy.splice(idx,1)[0]);
    }
    return selected;
  };
  const makeDay = (index) => {
    const target = 5;
    const chosen = [];
    chosen.push(...choose(config.main, 2));
    if(lowerBack) chosen.push(...choose(coreStability, 1));
    chosen.push(...choose(config.accessories, target - chosen.length - (goal === "Fat Loss" ? 1 : 0)));
    if(goal === "Fat Loss") chosen.push(...choose(config.finishers, 1));
    const unique = [...new Set(chosen)].slice(0, target);
    return {
      name: names[index] || `Day ${index+1}`,
      exercises: unique.map((name) => ({ name, numSets: config.sets, reps: config.rep, weight: "" })),
    };
  };
  return {
    name: `${client.name} ${goal} Program`,
    totalWeeks: weeks,
    days: names.map((_, index) => makeDay(index)),
  };
}
// ── Tiny Sparkline ────────────────────────────────────────────────────────────
function Spark({data,field,color}){
if(!data||data.length<2)return null;
const vals=data.map(d=>d[field]).filter(v=>v!=null);
if(vals.length<2)return null;
const mn=Math.min(...vals),mx=Math.max(...vals),rng=mx-mn||1;
const W=100,H=36,p=3;
const pts=vals.map((v,i)=>`${p+(i/(vals.length-1))*(W-p*2)},${H-p-((v-mn)/rng)*(H-p*2)}`);
return(<svg width={W} height={H} style={{overflow:"visible"}}><polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx={pts[pts.length-1].split(",")[0]} cy={pts[pts.length-1].split(",")[1]} r="3" fill={color}/></svg>);
}
// ── Chart ─────────────────────────────────────────────────────────────────────
function Chart({data,color}){
const [field,setField]=useState("weight");
if(!data||data.length<2)return <div style={{color:"#444",fontSize:13}}>Not enough data yet.</div>;
const fields=[{key:"weight",label:"Weight"},...LIFT_FIELDS,{key:"bodyFat",label:"Body Fat %"},...MEAS_FIELDS.filter(f=>f.key!=="bodyFat")];
const pts=data.filter(d=>d[field]!=null);
if(pts.length<2)return <div style={{color:"#444",fontSize:13}}>No data for this metric.</div>;
const vals=pts.map(d=>d[field]);
const mn=Math.min(...vals)-2,mx=Math.max(...vals)+2,rng=mx-mn||1;
const W=380,H=130,px=44,py=14;
const mapped=pts.map((d,i)=>({x:px+(i/(pts.length-1))*(W-px-10),y:py+((mx-d[field])/rng)*(H-py*2),v:d[field],l:d.date}));
const poly=mapped.map(p=>`${p.x},${p.y}`).join(" ");
return(<div>
<div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
{fields.map(f=><button key={f.key} onClick={()=>setField(f.key)} style={{background:field===f.key?color:"#1a1a1a",color:field===f.key?"#000":"#555",border:`1px solid ${field===f.key?color:"#222"}`,borderRadius:20,padding:"3px 11px",fontSize:11,cursor:"pointer",fontWeight:600}}>{f.label}</button>)}
</div>
<svg width={W} height={H} style={{overflow:"visible",maxWidth:"100%"}}>
{[0,.5,1].map(t=>{const y=py+t*(H-py*2);return(<g key={t}><line x1={px} x2={W-10} y1={y} y2={y} stroke="#1e1e1e"/><text x={px-6} y={y+4} fontSize="10" fill="#444" textAnchor="end">{Math.round(mx-t*rng)}</text></g>);})}
<polyline points={`${mapped[0].x},${H-py} ${poly} ${mapped[mapped.length-1].x},${H-py}`} fill={color} fillOpacity=".07" stroke="none"/>
<polyline points={poly} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
{mapped.map((p,i)=><g key={i}><circle cx={p.x} cy={p.y} r="4" fill={color}/><text x={p.x} y={H} fontSize="10" fill="#444" textAnchor="middle">{p.l}</text></g>)}
</svg>
</div>);
}
// ── Rest Timer ────────────────────────────────────────────────────────────
function RestTimer(){
const [secs,setSecs]=useState(90);
const [running,setRunning]=useState(false);
const [remaining,setRemaining]=useState(null);
const ref=useRef(null);
useEffect(()=>{
if(running&&remaining>0){ ref.current=setTimeout(()=>setRemaining(r=>r-1),1000); }
else if(remaining===0){ setRunning(false); }
return()=>clearTimeout(ref.current);
},[running,remaining]);
const start=()=>{setRemaining(secs);setRunning(true);};
const stop=()=>{setRunning(false);setRemaining(null);};
const pct=remaining!=null?((secs-remaining)/secs)*100:0;
return(
<div style={{background:"#0e0e0e",border:"1px solid #1e1e1e",borderRadius:12,padding:"14px 16px",display:"flex",alignItems:"center",gap:16,marginBottom:14}}>
<div style={{position:"relative",width:52,height:52,flexShrink:0}}>
<svg width="52" height="52" style={{transform:"rotate(-90deg)"}}>
<circle cx="26" cy="26" r="22" fill="none" stroke="#1e1e1e" strokeWidth="4"/>
<circle cx="26" cy="26" r="22" fill="none" stroke="#4ECDC4" strokeWidth="4" strokeDasharray={`${2*Math.PI*22}`} strokeDashoffset={`${2*Math.PI*22*(1-pct/100)}`} strokeLinecap="round"/>
</svg>
<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,fontFamily:"monospace"}}>{remaining!=null?remaining:secs}</div>
</div>
<div style={{flex:1}}>
<div style={{fontSize:11,color:"#555",fontFamily:"monospace",letterSpacing:1,marginBottom:6}}>REST TIMER</div>
<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
{[30,60,90,120,180].map(s=><button key={s} onClick={()=>{setSecs(s);setRemaining(null);setRunning(false);}} style={{background:secs===s?"#1e1e1e":"transparent",border:`1px solid ${secs===s?"#333":"#1e1e1e"}`,color:secs===s?"#fff":"#444",borderRadius:6,padding:"3px 8px",fontSize:11,cursor:"pointer"}}>{s}s</button>)}
</div>
</div>
{!running?<button onClick={start} style={{background:"#4ECDC4",color:"#000",border:"none",borderRadius:8,padding:"8px 16px",fontWeight:800,fontSize:13,cursor:"pointer",fontFamily:"'Bebas Neue',sans-serif",letterSpacing:1}}>START</button>
:<button onClick={stop} style={{background:"#FF6B6B",color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontWeight:800,fontSize:13,cursor:"pointer",fontFamily:"'Bebas Neue',sans-serif",letterSpacing:1}}>STOP</button>}
</div>
);
}
// ── Session Tracker ───────────────────────────────────────────────────────────
function SessionTracker({client,onUpdate}){
const prog=client.program;
const [wk,setWk]=useState(0);
const [dy,setDy]=useState(0);
if(!prog)return null;
const logs=prog.weekLogs||Array.from({length:prog.totalWeeks},(_,i)=>makeWeek(i+1,prog.days));
const week=logs[wk]; const day=week?.days[dy];
const patch=fn=>{ const u=fn(logs); onUpdate({...prog,weekLogs:u}); };
const setVal=(ei,si,f,v)=>patch(ls=>ls.map((w2,wi)=>wi!==wk?w2:{...w2,days:w2.days.map((d2,di)=>di!==dy?d2:{...d2,sessionData:d2.sessionData.map((ex,xi)=>xi!==ei?ex:{...ex,sets:ex.sets.map((s,j)=>j!==si?s:{...s,[f]:v})})})}));
const setMeta=(f,v)=>patch(ls=>ls.map((w2,wi)=>wi!==wk?w2:{...w2,days:w2.days.map((d2,di)=>di!==dy?d2:{...d2,[f]:v})}));
const hasData=(wi,di)=>{const d=logs[wi]?.days[di];return d&&(d.date||d.notes||d.sessionData.some(e=>e.sets.some(s=>s.weight||s.reps)));};
return(<div>
<div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
{logs.map((_,i)=><button key={i} onClick={()=>{setWk(i);setDy(0);}} style={{background:wk===i?client.color:"#1a1a1a",color:wk===i?"#000":"#555",border:`1px solid ${wk===i?client.color:"#222"}`,borderRadius:8,padding:"5px 13px",cursor:"pointer",fontWeight:700,fontSize:12,fontFamily:"'Bebas Neue',sans-serif",letterSpacing:1}}>WK {i+1}</button>)}
</div>
<div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
{week?.days.map((d,i)=><button key={i} onClick={()=>setDy(i)} style={{background:dy===i?client.color+"22":"#111",color:dy===i?client.color:hasData(wk,i)?"#aaa":"#444",border:`1px solid ${dy===i?client.color:hasData(wk,i)?"#333":"#1e1e1e"}`,borderRadius:8,padding:"5px 13px",cursor:"pointer",fontWeight:600,fontSize:12,position:"relative"}}>
{d.name}{hasData(wk,i)&&<span style={{position:"absolute",top:-4,right:-4,width:8,height:8,background:client.color,borderRadius:"50%",border:"2px solid #0a0a0a"}}/>}
</button>)}
</div>
{day&&(<div style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:14,overflow:"hidden"}}>
<div style={{padding:"12px 18px",borderBottom:"1px solid #1e1e1e",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
<div><div style={{fontSize:15,fontWeight:700}}>{day.name}</div><div style={{fontSize:11,color:"#555",fontFamily:"monospace"}}>WEEK {wk+1}</div></div>
<input type="date" value={day.date} onChange={e=>setMeta("date",e.target.value)} style={{background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:8,padding:"5px 10px",color:"#aaa",fontSize:12,outline:"none"}}/>
</div>
<RestTimer/>
<div style={{padding:"0 18px 8px"}}>
{day.sessionData.length===0&&<div style={{color:"#333",fontSize:13,textAlign:"center",padding:"24px 0"}}>No exercises — edit program to add some.</div>}
{day.sessionData.map((ex,ei)=>{
const best=ex.sets.filter(s=>s.weight&&s.reps).map(s=>calc1RM(Number(s.weight),Number(s.reps)));
const est1RM=best.length?Math.max(...best):null;
return(<div key={ei} style={{borderBottom:"1px solid #191919",padding:"12px 0"}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
<div style={{fontSize:13,fontWeight:700,color:client.color}}>{ex.name}</div>
{est1RM&&<div style={{fontSize:11,color:"#555",fontFamily:"monospace"}}>Est. 1RM: <span style={{color:"#aaa"}}>{est1RM}kg</span></div>}
</div>
<div style={{display:"grid",gridTemplateColumns:"40px 1fr 1fr 70px",gap:5,marginBottom:4}}>
{["SET","WEIGHT","REPS","RPE"].map(h=><div key={h} style={{fontSize:9,color:"#444",fontFamily:"monospace"}}>{h}</div>)}
</div>
{ex.sets.map((s,si)=><div key={si} style={{display:"grid",gridTemplateColumns:"40px 1fr 1fr 70px",gap:5,marginBottom:5}}>
<div style={{fontSize:11,color:"#444",paddingTop:7,fontFamily:"monospace"}}>S{si+1}</div>
<input placeholder="kg" value={s.weight} onChange={e=>setVal(ei,si,"weight",e.target.value)} style={{background:"#161616",border:"1px solid #222",borderRadius:7,padding:"5px 8px",color:"#fff",fontSize:13,outline:"none"}}/>
<input placeholder="reps" value={s.reps} onChange={e=>setVal(ei,si,"reps",e.target.value)} style={{background:"#161616",border:"1px solid #222",borderRadius:7,padding:"5px 8px",color:"#fff",fontSize:13,outline:"none"}}/>
<select value={s.rpe} onChange={e=>setVal(ei,si,"rpe",e.target.value)} style={{background:"#161616",border:"1px solid #222",borderRadius:7,padding:"5px 4px",color:s.rpe?"#fff":"#444",fontSize:12,outline:"none"}}>
<option value="">RPE</option>{[6,6.5,7,7.5,8,8.5,9,9.5,10].map(r=><option key={r} value={r}>{r}</option>)}
</select>
</div>)}
</div>);
})}
</div>
<div style={{padding:"14px 18px",background:"#0e0e0e",borderTop:"1px solid #191919"}}>
<div style={{fontSize:10,color:"#444",fontFamily:"monospace",letterSpacing:1,marginBottom:8}}>METRIC DATA</div>
<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:10}}>
{[{l:"MAX HR",f:"maxHR",p:"bpm"},{l:"AVG HR",f:"avgHR",p:"bpm"},{l:"KCAL",f:"kcal",p:"cal"}].map(({l,f,p})=><div key={f}><div style={{fontSize:9,color:"#444",fontFamily:"monospace",marginBottom:3}}>{l}</div><input placeholder={p} value={day.metrics[f]} onChange={e=>setMeta("metrics",{...day.metrics,[f]:e.target.value})} style={{width:"100%",background:"#161616",border:"1px solid #222",borderRadius:7,padding:"6px 8px",color:"#fff",fontSize:13,outline:"none",boxSizing:"border-box"}}/></div>)}
</div>
<div style={{fontSize:10,color:"#444",fontFamily:"monospace",marginBottom:5}}>SESSION NOTES</div>
<textarea value={day.notes} onChange={e=>setMeta("notes",e.target.value)} placeholder="Notes, cues, observations..." style={{width:"100%",background:"#161616",border:"1px solid #222",borderRadius:8,padding:10,color:"#ccc",fontSize:13,outline:"none",resize:"vertical",minHeight:64,fontFamily:"'DM Sans',sans-serif",lineHeight:1.5,boxSizing:"border-box"}}/>
</div>
</div>)}
</div>);
}

// ── AI Program Generator ──────────────────────────────────────────────────────
function AIProgram({client,onSave,onClose}){
const [extra,setExtra]=useState("");
const [days,setDays]=useState(4);
const [weeks,setWeeks]=useState(4);
const [loading,setLoading]=useState(false);
const [err,setErr]=useState("");
const go=async()=>{
setLoading(true);setErr("");
try{
const program = generateSmartProgram(client, days, weeks, extra);
onSave(program);
}catch(e){
  console.error("Program generation error:", e);
  setErr("Generation failed — try again.");
}
setLoading(false);
};
return(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
<div style={{background:"#111",border:"1px solid #2a2a2a",borderRadius:16,padding:28,width:"100%",maxWidth:460}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
<div><div style={{fontSize:22,fontFamily:"'Bebas Neue',sans-serif",letterSpacing:1}}>✦ AI PROGRAM GENERATOR</div><div style={{fontSize:12,color:"#555",marginTop:2}}>{client.name} · {client.goal}</div></div>
<button onClick={onClose} style={{background:"#1e1e1e",border:"none",color:"#888",borderRadius:8,padding:"8px 12px",cursor:"pointer",fontSize:16}}>✕</button>
</div>
{client.injuries?.length>0&&<div style={{background:"#2a1010",border:"1px solid #FF6B6B44",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#FF6B6B"}}>⚠ {client.injuries.join(" · ")}</div>}
<div style={{background:"#161616",border:"1px solid #1e1e1e",borderRadius:10,padding:12,marginBottom:14,fontSize:12,color:"#666",lineHeight:1.6}}>
body: <span style={{color:GOAL_COLORS[client.goal]}}>{client.goal}</span> · Age: {client.age} · {client.weight}kg{client.notes&&<><br/>{client.notes}</>}
</div>
<div style={{marginBottom:12}}><div style={{fontSize:10,color:"#555",fontFamily:"monospace",letterSpacing:1,marginBottom:6}}>DAYS PER WEEK</div><div style={{display:"flex",gap:6}}>{[2,3,4,5,6].map(d=><button key={d} onClick={()=>setDays(d)} style={{background:days===d?client.color:"#1a1a1a",color:days===d?"#000":"#555",border:"none",borderRadius:8,padding:"7px 14px",cursor:"pointer",fontWeight:700,fontSize:14,fontFamily:"'Bebas Neue',sans-serif"}}>{d}</button>)}</div></div>
<div style={{marginBottom:12}}><div style={{fontSize:10,color:"#555",fontFamily:"monospace",letterSpacing:1,marginBottom:6}}>WEEKS</div><div style={{display:"flex",gap:6}}>{[2,4,6,8,12].map(w=><button key={w} onClick={()=>setWeeks(w)} style={{background:weeks===w?client.color:"#1a1a1a",color:weeks===w?"#000":"#555",border:"none",borderRadius:8,padding:"7px 14px",cursor:"pointer",fontWeight:700,fontSize:14,fontFamily:"'Bebas Neue',sans-serif"}}>{w}</button>)}</div></div>
<div style={{marginBottom:18}}><div style={{fontSize:10,color:"#555",fontFamily:"monospace",letterSpacing:1,marginBottom:6}}>EXTRA DETAILS</div><textarea value={extra} onChange={e=>setExtra(e.target.value)} placeholder="Equipment restrictions, preferences, injuries..." style={{width:"100%",background:"#161616",border:"1px solid #222",borderRadius:8,padding:10,color:"#ccc",fontSize:13,outline:"none",resize:"vertical",minHeight:72,fontFamily:"'DM Sans',sans-serif",boxSizing:"border-box"}}/></div>
{err&&<div style={{color:"#FF6B6B",fontSize:12,marginBottom:10}}>{err}</div>}
<button onClick={go} disabled={loading} style={{width:"100%",background:loading?"#222":client.color,color:loading?"#555":"#000",border:"none",borderRadius:10,padding:"13px 0",fontWeight:800,fontSize:15,cursor:loading?"not-allowed":"pointer",fontFamily:"'Bebas Neue',sans-serif",letterSpacing:1}}>{loading?"✦ GENERATING...":"✦ GENERATE PROGRAM"}</button>
</div>
</div>);
}

// ── AI Session Recap ──────────────────────────────────────────────────────────
function AIRecap({client,session,onClose}){
const [recap,setRecap]=useState("");
const [loading,setLoading]=useState(true);
useEffect(()=>{
const go=async()=>{
try{
const exSummary=session.sessionData.map(ex=>{
const sets=ex.sets.filter(s=>s.weight||s.reps).map((s,i)=>`Set ${i+1}: ${s.weight||"?"}kg × ${s.reps||"?"} reps${s.rpe?` @ RPE ${s.rpe}`:""}`).join(", ");
return `${ex.name}: ${sets||"no data"}`;
}).join("\n");
const prompt=`Write a friendly, motivating session recap message to send to a personal training client.\nClient: ${client.name}, Goal: ${client.goal}\nSession: ${session.name}, Date: ${session.date||"today"}\nExercises:\n${exSummary}\nMetrics: Max HR ${session.metrics?.maxHR||"?"}, Avg HR ${session.metrics?.avgHR||"?"}, Kcal ${session.metrics?.kcal||"?"}\nNotes: ${session.notes||"None"}\n\nWrite 3-4 sentences. Be specific about what they did well. Mention one thing to focus on next session. Keep it warm and personal. Start with "Hi ${client.name}," `;
const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:prompt}]})});
const data=await res.json();
setRecap(data.content.map(b=>b.text||"").join(""));
}catch(e){setRecap("Could not generate recap. Please try again.");}
setLoading(false);
};go();
},[client,session]);
return(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
<div style={{background:"#111",border:"1px solid #2a2a2a",borderRadius:16,padding:28,width:"100%",maxWidth:480}}>
<div style={{fontSize:20,fontFamily:"'Bebas Neue',sans-serif",letterSpacing:1,marginBottom:4}}>SESSION RECAP</div>
<div style={{fontSize:12,color:"#555",marginBottom:18}}>{client.name} · {session.name}</div>
{loading?<div style={{color:"#555",fontSize:13,padding:"20px 0",textAlign:"center"}}>✦ Writing recap...</div>
:<><textarea value={recap} onChange={e=>setRecap(e.target.value)} style={{width:"100%",background:"#161616",border:"1px solid #222",borderRadius:10,padding:14,color:"#ccc",fontSize:14,outline:"none",resize:"vertical",minHeight:160,fontFamily:"'DM Sans',sans-serif",lineHeight:1.7,boxSizing:"border-box"}}/><div style={{display:"flex",gap:10,marginTop:14}}><button onClick={()=>{navigator.clipboard.writeText(recap);}} style={{flex:1,background:"#1a1a1a",border:"1px solid #2a2a2a",color:"#aaa",borderRadius:8,padding:"10px 0",cursor:"pointer",fontSize:13,fontWeight:600}}>Copy</button><button onClick={onClose} style={{flex:1,background:client.color,color:"#000",border:"none",borderRadius:8,padding:"10px 0",cursor:"pointer",fontWeight:800,fontSize:13,fontFamily:"'Bebas Neue',sans-serif",letterSpacing:1}}>DONE</button></div></>}
</div>
</div>);
}

// ── Program Builder ───────────────────────────────────────────────────────────
function ProgramBuilder({client,onSave,onClose}){
const [name,setName]=useState(client.program?.name||`${client.name}'s Program`);
const [weeks,setWeeks]=useState(client.program?.totalWeeks||4);
const [days,setDays]=useState(client.program?.days||[{name:"Day 1 – Push",exercises:[]},{name:"Day 2 – Pull",exercises:[]},{name:"Day 3 – Legs",exercises:[]},{name:"Day 4 – Cardio/Core",exercises:[]}]);
const [search,setSearch]=useState("");
const [active,setActive]=useState(0);
const filtered=EXERCISE_LIBRARY.filter(e=>e.toLowerCase().includes(search.toLowerCase()));
const addEx=ex=>setDays(p=>p.map((d,i)=>i===active?{...d,exercises:[...d.exercises,{name:ex,numSets:3,reps:"8-10",weight:""}]}:d));
const updEx=(di,ei,f,v)=>setDays(p=>p.map((d,i)=>i===di?{...d,exercises:d.exercises.map((e,j)=>j===ei?{...e,[f]:v}:e)}:d));
const remEx=(di,ei)=>setDays(p=>p.map((d,i)=>i===di?{...d,exercises:d.exercises.filter((_,j)=>j!==ei)}:d));
return(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
<div style={{background:"#111",border:"1px solid #2a2a2a",borderRadius:16,width:"100%",maxWidth:820,maxHeight:"92vh",overflow:"hidden",display:"flex",flexDirection:"column"}}>
<div style={{padding:"16px 22px",borderBottom:"1px solid #1e1e1e",display:"flex",gap:12,alignItems:"center"}}>
<div style={{flex:1}}>
<input value={name} onChange={e=>setName(e.target.value)} style={{background:"transparent",border:"none",color:"#fff",fontSize:18,fontWeight:700,fontFamily:"'Bebas Neue',sans-serif",letterSpacing:1,width:"100%",outline:"none"}}/>
<div style={{display:"flex",alignItems:"center",gap:6,marginTop:3}}>
<span style={{fontSize:11,color:"#555"}}>Weeks:</span>
{[2,4,6,8,12].map(w=><button key={w} onClick={()=>setWeeks(w)} style={{background:weeks===w?client.color:"#1e1e1e",color:weeks===w?"#000":"#555",border:"none",borderRadius:6,padding:"2px 9px",cursor:"pointer",fontSize:12,fontWeight:700}}>{w}</button>)}
</div>
</div>
<button onClick={()=>onSave({name,totalWeeks:weeks,days})} style={{background:client.color,color:"#000",border:"none",borderRadius:8,padding:"9px 18px",fontWeight:800,fontSize:13,cursor:"pointer",fontFamily:"'Bebas Neue',sans-serif",letterSpacing:1}}>SAVE</button>
<button onClick={onClose} style={{background:"#1e1e1e",color:"#888",border:"none",borderRadius:8,padding:"9px 13px",cursor:"pointer",fontSize:16}}>✕</button>
</div>
<div style={{display:"flex",flex:1,overflow:"hidden"}}>
<div style={{width:250,borderRight:"1px solid #1e1e1e",display:"flex",flexDirection:"column"}}>
<div style={{padding:"10px 14px",borderBottom:"1px solid #1e1e1e"}}>
<div style={{fontSize:10,color:"#555",letterSpacing:1,marginBottom:7,fontFamily:"monospace"}}>DAYS</div>
{days.map((d,i)=><div key={i} onClick={()=>setActive(i)} style={{padding:"7px 11px",borderRadius:8,cursor:"pointer",marginBottom:3,background:i===active?client.color+"22":"transparent",border:`1px solid ${i===active?client.color:"transparent"}`,color:i===active?client.color:"#555",fontSize:12,fontWeight:600}}>{d.name}</div>)}
<button onClick={()=>{setDays(p=>[...p,{name:`Day ${p.length+1}`,exercises:[]}]);setActive(days.length);}} style={{marginTop:5,width:"100%",padding:"5px 0",background:"#1a1a1a",border:"1px dashed #2a2a2a",borderRadius:8,color:"#444",cursor:"pointer",fontSize:12}}>+ Add Day</button>
</div>
<div style={{padding:"10px 14px",flex:1,overflowY:"auto"}}>
<div style={{fontSize:10,color:"#555",letterSpacing:1,marginBottom:7,fontFamily:"monospace"}}>ADD EXERCISE</div>
<input placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)} style={{width:"100%",background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:8,padding:"7px 9px",color:"#fff",fontSize:12,outline:"none",marginBottom:6,boxSizing:"border-box"}}/>
{filtered.map(ex=><button key={ex} onClick={()=>addEx(ex)} style={{display:"block",width:"100%",background:"transparent",border:"none",color:"#777",textAlign:"left",padding:"5px 7px",borderRadius:6,cursor:"pointer",fontSize:12}} onMouseEnter={e=>{e.currentTarget.style.background="#1e1e1e";e.currentTarget.style.color="#fff";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color="#777"}}>+ {ex}</button>)}
</div>
</div>
<div style={{flex:1,overflowY:"auto",padding:18}}>
<input value={days[active]?.name||""} onChange={e=>setDays(p=>p.map((d,i)=>i===active?{...d,name:e.target.value}:d))} style={{background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:8,padding:"7px 11px",color:"#fff",fontSize:14,fontWeight:700,outline:"none",marginBottom:14}}/>
{days[active]?.exercises.length===0&&<div style={{color:"#2a2a2a",fontSize:14,textAlign:"center",marginTop:60}}>Add exercises from the left panel</div>}
{days[active]?.exercises.map((ex,ei)=><div key={ei} style={{background:"#161616",border:"1px solid #222",borderRadius:10,padding:"11px 14px",display:"grid",gridTemplateColumns:"1fr 55px 75px 85px 28px",gap:7,alignItems:"center",marginBottom:7}}>
<div style={{color:"#fff",fontSize:13,fontWeight:600}}>{ex.name}</div>
{[{l:"SETS",f:"numSets",t:"number"},{l:"REPS",f:"reps",t:"text"},{l:"WEIGHT",f:"weight",t:"text",p:"kg"}].map(({l,f,t,p})=><div key={f}><div style={{fontSize:9,color:"#444",marginBottom:2,fontFamily:"monospace"}}>{l}</div><input type={t} value={ex[f]} placeholder={p} onChange={e=>updEx(active,ei,f,e.target.value)} style={{width:"100%",background:"#1e1e1e",border:"1px solid #2a2a2a",borderRadius:6,padding:"4px 5px",color:"#fff",fontSize:12,outline:"none",textAlign:"center"}}/></div>)}
<button onClick={()=>remEx(active,ei)} style={{background:"transparent",border:"none",color:"#333",cursor:"pointer",fontSize:15,padding:0}}>✕</button>
</div>)}
</div>
</div>
</div>
</div>);
}

// ── Packages & Billing ────────────────────────────────────────────────────────
function PackagesTab({client,onUpdate}){
const pkgs=client.packages||[];
const [adding,setAdding]=useState(false);
const [form,setForm]=useState({name:"10 Session Pack",total:10,price:"",paid:false});
const save=()=>{ onUpdate([...pkgs,{id:Date.now(),...form,total:Number(form.total),price:Number(form.price),used:0}]); setAdding(false); setForm({name:"10 Session Pack",total:10,price:"",paid:false}); };
const toggle=(id)=>onUpdate(pkgs.map(p=>p.id===id?{...p,paid:!p.paid}:p));
const addSession=(id)=>onUpdate(pkgs.map(p=>p.id===id&&p.used<p.total?{...p,used:p.used+1}:p));
const del=(id)=>onUpdate(pkgs.filter(p=>p.id!==id));
const totalRev=pkgs.filter(p=>p.paid).reduce((a,p)=>a+p.price,0);
const outstanding=pkgs.filter(p=>!p.paid).reduce((a,p)=>a+p.price,0);
return(<div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
<div style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:12,padding:"14px 16px"}}>
<div style={{fontSize:22,fontFamily:"'Bebas Neue',sans-serif",color:"#6EE7B7"}}>${totalRev.toLocaleString()}</div>
<div style={{fontSize:10,color:"#555",fontFamily:"monospace",letterSpacing:1}}>PAID REVENUE</div>
</div>
<div style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:12,padding:"14px 16px"}}>
<div style={{fontSize:22,fontFamily:"'Bebas Neue',sans-serif",color:outstanding>0?"#FF6B6B":"#444"}}>${outstanding.toLocaleString()}</div>
<div style={{fontSize:10,color:"#555",fontFamily:"monospace",letterSpacing:1}}>OUTSTANDING</div>
</div>
</div>
{pkgs.map(p=>{
const rem=p.total-p.used; const pct=(p.used/p.total)*100;
return(<div key={p.id} style={{background:"#111",border:`1px solid ${p.paid?"#1e1e1e":"#FF6B6B44"}`,borderRadius:12,padding:"14px 16px",marginBottom:10}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
<div><div style={{fontWeight:700,fontSize:14}}>{p.name}</div><div style={{fontSize:12,color:"#555",marginTop:2}}>${p.price} · {p.used}/{p.total} sessions used</div></div>
<div style={{display:"flex",gap:7,alignItems:"center"}}>
<span style={{fontSize:11,background:p.paid?"#6EE7B722":"#FF6B6B22",color:p.paid?"#6EE7B7":"#FF6B6B",padding:"2px 10px",borderRadius:20,fontWeight:600,cursor:"pointer"}} onClick={()=>toggle(p.id)}>{p.paid?"PAID":"UNPAID"}</span>
<button onClick={()=>del(p.id)} style={{background:"transparent",border:"none",color:"#333",cursor:"pointer",fontSize:14}}>✕</button>
</div>
</div>
<div style={{background:"#1a1a1a",borderRadius:20,height:6,marginBottom:8}}><div style={{background:client.color,borderRadius:20,height:6,width:`${pct}%`,transition:"width 0.3s"}}/></div>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
<span style={{fontSize:11,color:rem>0?"#aaa":"#FF6B6B"}}>{rem>0?`${rem} sessions remaining`:"Package complete"}</span>
{rem>0&&<button onClick={()=>addSession(p.id)} style={{background:client.color+"22",color:client.color,border:`1px solid ${client.color}44`,borderRadius:7,padding:"4px 12px",cursor:"pointer",fontSize:12,fontWeight:600}}>+ Use Session</button>}
</div>
</div>);
})}
{adding?(<div style={{background:"#111",border:"1px solid #2a2a2a",borderRadius:12,padding:16,marginBottom:10}}>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
<div><div style={{fontSize:10,color:"#555",fontFamily:"monospace",marginBottom:4}}>PACKAGE NAME</div><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={{width:"100%",background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:8,padding:"7px 9px",color:"#fff",fontSize:13,outline:"none",boxSizing:"border-box"}}/></div>
<div><div style={{fontSize:10,color:"#555",fontFamily:"monospace",marginBottom:4}}>SESSIONS</div><input type="number" value={form.total} onChange={e=>setForm(f=>({...f,total:e.target.value}))} style={{width:"100%",background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:8,padding:"7px 9px",color:"#fff",fontSize:13,outline:"none",boxSizing:"border-box"}}/></div>
<div><div style={{fontSize:10,color:"#555",fontFamily:"monospace",marginBottom:4}}>PRICE ($)</div><input type="number" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))} style={{width:"100%",background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:8,padding:"7px 9px",color:"#fff",fontSize:13,outline:"none",boxSizing:"border-box"}}/></div>
<div style={{display:"flex",alignItems:"flex-end"}}><label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,color:"#aaa"}}><input type="checkbox" checked={form.paid} onChange={e=>setForm(f=>({...f,paid:e.target.checked}))} style={{width:16,height:16}}/>Already paid</label></div>
</div>
<div style={{display:"flex",gap:8}}><button onClick={save} style={{flex:1,background:client.color,color:"#000",border:"none",borderRadius:8,padding:"9px 0",fontWeight:800,fontSize:13,cursor:"pointer",fontFamily:"'Bebas Neue',sans-serif",letterSpacing:1}}>ADD PACKAGE</button><button onClick={()=>setAdding(false)} style={{flex:1,background:"#1e1e1e",color:"#888",border:"none",borderRadius:8,padding:"9px 0",cursor:"pointer",fontSize:13}}>Cancel</button></div>
</div>):(<button onClick={()=>setAdding(true)} style={{width:"100%",background:"#111",border:"1px dashed #2a2a2a",borderRadius:12,padding:"12px 0",color:"#555",cursor:"pointer",fontSize:13}}>+ Add Package</button>)}
</div>);
}

// ── Schedule Tab ──────────────────────────────────────────────────────────────
function ScheduleTab({client,onUpdate}){
const schedule=client.schedule||[];
const checkIns=client.checkIns||[];
const DAYS=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const streak=()=>{ let s=0; for(let i=checkIns.length-1;i>=0;i--){ if(checkIns[i])s++;else break; } return s; };
const [adding,setAdding]=useState(false);
const [form,setForm]=useState({day:"Mon",time:"08:00"});
return(<div>
<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
<div style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:12,padding:"14px 16px"}}><div style={{fontSize:28,fontFamily:"'Bebas Neue',sans-serif",color:client.color}}>{streak()}</div><div style={{fontSize:10,color:"#555",fontFamily:"monospace",letterSpacing:1}}>CURRENT STREAK</div></div>
<div style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:12,padding:"14px 16px"}}><div style={{fontSize:28,fontFamily:"'Bebas Neue',sans-serif"}}>{checkIns.filter(Boolean).length}</div><div style={{fontSize:10,color:"#555",fontFamily:"monospace",letterSpacing:1}}>SESSIONS ATTENDED</div></div>
<div style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:12,padding:"14px 16px"}}><div style={{fontSize:28,fontFamily:"'Bebas Neue',sans-serif"}}>{checkIns.length?Math.round((checkIns.filter(Boolean).length/checkIns.length)*100):0}%</div><div style={{fontSize:10,color:"#555",fontFamily:"monospace",letterSpacing:1}}>ATTENDANCE</div></div>
</div>
<div style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:12,padding:"16px",marginBottom:14}}>
<div style={{fontSize:10,color:"#555",fontFamily:"monospace",letterSpacing:1,marginBottom:10}}>CHECK-IN HISTORY</div>
<div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
{checkIns.map((c,i)=><div key={i} style={{width:24,height:24,borderRadius:6,background:c?client.color+"33":"#1a1a1a",border:`1px solid ${c?client.color+"66":"#222"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10}}>{c?"✓":""}</div>)}
<div onClick={()=>onUpdate({checkIns:[...checkIns,true]})} style={{width:24,height:24,borderRadius:6,background:"#1a1a1a",border:"1px dashed #333",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:14,color:"#555"}}>+</div>
</div>
</div>
<div style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:12,padding:"16px"}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
<div style={{fontSize:10,color:"#555",fontFamily:"monospace",letterSpacing:1}}>RECURRING SCHEDULE</div>
<button onClick={()=>setAdding(true)} style={{background:client.color+"22",color:client.color,border:`1px solid ${client.color}44`,borderRadius:7,padding:"4px 12px",cursor:"pointer",fontSize:12,fontWeight:600}}>+ Add</button>
</div>
{schedule.map((s,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",background:"#161616",borderRadius:8,marginBottom:6}}>
<span style={{fontWeight:600,fontSize:13}}>{s.day}</span><span style={{color:"#888",fontSize:13}}>{s.time}</span>
<button onClick={()=>onUpdate({schedule:schedule.filter((_,j)=>j!==i)})} style={{background:"transparent",border:"none",color:"#333",cursor:"pointer",fontSize:14}}>✕</button>
</div>)}
{adding&&<div style={{display:"flex",gap:8,marginTop:8}}>
<select value={form.day} onChange={e=>setForm(f=>({...f,day:e.target.value}))} style={{flex:1,background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:8,padding:"7px 9px",color:"#fff",fontSize:13,outline:"none"}}>
{DAYS.map(d=><option key={d}>{d}</option>)}
</select>
<input type="time" value={form.time} onChange={e=>setForm(f=>({...f,time:e.target.value}))} style={{flex:1,background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:8,padding:"7px 9px",color:"#fff",fontSize:13,outline:"none"}}/>
<button onClick={()=>{onUpdate({schedule:[...schedule,form]});setAdding(false);}} style={{background:client.color,color:"#000",border:"none",borderRadius:8,padding:"7px 14px",cursor:"pointer",fontWeight:700,fontSize:13}}>✓</button>
<button onClick={()=>setAdding(false)} style={{background:"#1e1e1e",color:"#888",border:"none",borderRadius:8,padding:"7px 10px",cursor:"pointer",fontSize:13}}>✕</button>
</div>}
</div>
</div>);
}

// ── Body / Measurements ───────────────────────────────────────────────────────
function BodyTab({client,onUpdate}){
const m=client.measurements||{};
const [editing,setEditing]=useState(false);
const [form,setForm]=useState({...m});
return(<div>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
<div style={{fontSize:10,color:"#555",fontFamily:"monospace",letterSpacing:1}}>BODY MEASUREMENTS</div>
{!editing?<button onClick={()=>setEditing(true)} style={{background:"#1a1a1a",border:"1px solid #2a2a2a",color:"#888",borderRadius:8,padding:"6px 13px",cursor:"pointer",fontSize:12}}>Update</button>
:<div style={{display:"flex",gap:7}}><button onClick={()=>{onUpdate(form);setEditing(false);}} style={{background:client.color,color:"#000",border:"none",borderRadius:8,padding:"6px 13px",cursor:"pointer",fontWeight:700,fontSize:12}}>Save</button><button onClick={()=>setEditing(false)} style={{background:"#1a1a1a",border:"1px solid #2a2a2a",color:"#888",borderRadius:8,padding:"6px 13px",cursor:"pointer",fontSize:12}}>Cancel</button></div>}
</div>
<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:20}}>
{MEAS_FIELDS.map(({key,label})=><div key={key} style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:12,padding:"13px 15px"}}>
<div style={{fontSize:10,color:"#555",fontFamily:"monospace",letterSpacing:1,marginBottom:5}}>{label.toUpperCase()}</div>
{editing?<input type="number" step="0.5" value={form[key]||""} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} style={{width:"100%",background:"#1e1e1e",border:"1px solid #2a2a2a",borderRadius:6,padding:"5px 7px",color:"#fff",fontSize:18,fontFamily:"'Bebas Neue',sans-serif",outline:"none"}}/>
:<div style={{fontSize:22,fontFamily:"'Bebas Neue',sans-serif",color:m[key]?"#fff":"#2a2a2a"}}>{m[key]||"—"}<span style={{fontSize:11,color:"#555"}}>{key==="bodyFat"?" %":" in"}</span></div>}
</div>)}
</div>
{client.progress?.length>=2&&<div style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:12,padding:20}}><div style={{fontSize:10,color:"#555",fontFamily:"monospace",letterSpacing:1,marginBottom:14}}>TRENDS</div><Chart data={client.progress} color={client.color}/></div>}
</div>);
}

// ── Photo Comparison ──────────────────────────────────────────────────────────
function PhotosTab({client,onUpdate}){
const photos=client.photos||[];
const ref=useRef();
const upload=e=>{
const file=e.target.files[0];if(!file)return;
const reader=new FileReader();
reader.onload=ev=>onUpdate({photos:[...photos,{id:Date.now(),src:ev.target.result,date:new Date().toLocaleDateString(),label:""}]});
reader.readAsDataURL(file);
};
const del=id=>onUpdate({photos:photos.filter(p=>p.id!==id)});
const updLabel=(id,label)=>onUpdate({photos:photos.map(p=>p.id===id?{...p,label}:p)});
return(<div>
<input ref={ref} type="file" accept="image/*" style={{display:"none"}} onChange={upload}/>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
<div style={{fontSize:10,color:"#555",fontFamily:"monospace",letterSpacing:1}}>PROGRESS PHOTOS</div>
<button onClick={()=>ref.current.click()} style={{background:client.color,color:"#000",border:"none",borderRadius:8,padding:"7px 14px",cursor:"pointer",fontWeight:700,fontSize:12,fontFamily:"'Bebas Neue',sans-serif",letterSpacing:1}}>+ ADD PHOTO</button>
</div>
{photos.length===0&&<div style={{background:"#111",border:"1px dashed #2a2a2a",borderRadius:12,padding:"50px 0",textAlign:"center",color:"#333",cursor:"pointer"}} onClick={()=>ref.current.click()}><div style={{fontSize:36,marginBottom:10}}>📷</div><div>Tap to add progress photos</div></div>}
<div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12}}>
{photos.map(p=><div key={p.id} style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:12,overflow:"hidden"}}>
<img src={p.src} alt="" style={{width:"100%",aspectRatio:"3/4",objectFit:"cover",display:"block"}}/>
<div style={{padding:"10px 12px"}}>
<input value={p.label} onChange={e=>updLabel(p.id,e.target.value)} placeholder={p.date} style={{background:"transparent",border:"none",color:"#888",fontSize:12,outline:"none",width:"100%"}}/>
<button onClick={()=>del(p.id)} style={{background:"transparent",border:"none",color:"#333",cursor:"pointer",fontSize:12,float:"right"}}>Remove</button>
</div>
</div>)}
</div>
{photos.length>=2&&<div style={{marginTop:20,background:"#111",border:"1px solid #1e1e1e",borderRadius:12,padding:16}}>
<div style={{fontSize:10,color:"#555",fontFamily:"monospace",letterSpacing:1,marginBottom:12}}>BEFORE / AFTER</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
{[photos[0],photos[photos.length-1]].map((p,i)=><div key={i}><img src={p.src} alt="" style={{width:"100%",aspectRatio:"3/4",objectFit:"cover",borderRadius:10}}/><div style={{fontSize:11,color:"#555",textAlign:"center",marginTop:5}}>{i===0?"BEFORE":"LATEST"} · {p.date}</div></div>)}
</div>
</div>}
</div>);
}

// ── Sessions Dashboard ─────────────────────────────────────────────────────────
function RevenueDash({clients}){
const all=clients.flatMap(c=>(c.packages||[]).map(p=>({...p,client:c})));
const paid=all.filter(p=>p.paid); const unpaid=all.filter(p=>!p.paid);
const sessionsConducted=clients.reduce((a,c)=>a+(c.sessions||0),0);
const bookedSessions=clients.reduce((a,c)=>a+(c.schedule?.length||0),0);
const activeClients=clients.filter(c=>(c.packages||[]).some(p=>p.used<p.total)).length;
return(<div>
<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20}}>
{[{label:"Sessions Conducted",value:sessionsConducted,color:"#6EE7B7"},{label:"Booked Sessions",value:bookedSessions,color:bookedSessions>0?"#FF6B6B":"#555"},{label:"Active Packages",value:all.filter(p=>p.used<p.total).length,color:"#E8C547"}].map(({label,value,color})=><div key={label} style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:12,padding:"16px 18px"}}><div style={{fontSize:28,fontFamily:"'Bebas Neue',sans-serif",color}}>{value}</div><div style={{fontSize:10,color:"#555",fontFamily:"monospace",letterSpacing:1}}>{label.toUpperCase()}</div></div>)}
</div>
<div style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:12,padding:"16px 18px",marginBottom:14}}>
<div style={{fontSize:10,color:"#555",fontFamily:"monospace",letterSpacing:1,marginBottom:12}}>ALL PACKAGES</div>
{all.length===0&&<div style={{color:"#333",fontSize:13}}>No packages yet. Add them from individual client profiles.</div>}
{all.map((p,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:"1px solid #161616"}}>
<div style={{display:"flex",alignItems:"center",gap:10}}>
<div style={{width:8,height:8,borderRadius:"50%",background:p.client.color,flexShrink:0}}/>
<div><div style={{fontSize:13,fontWeight:600}}>{p.client.name}</div><div style={{fontSize:11,color:"#555"}}>{p.name} · {p.used}/{p.total} sessions</div></div>
</div>
<div style={{textAlign:"right"}}>
<div style={{fontSize:14,fontWeight:700}}>${p.price}</div>
<span style={{fontSize:10,background:p.paid?"#6EE7B722":"#FF6B6B22",color:p.paid?"#6EE7B7":"#FF6B6B",padding:"1px 7px",borderRadius:20,fontWeight:600}}>{p.paid?"PAID":"UNPAID"}</span>
</div>
</div>)}
</div>
{unpaid.length>0&&<div style={{background:"#1a0a0a",border:"1px solid #FF6B6B33",borderRadius:12,padding:"14px 16px"}}>
<div style={{fontSize:10,color:"#FF6B6B",fontFamily:"monospace",letterSpacing:1,marginBottom:10}}>OUTSTANDING INVOICES</div>
{unpaid.map((p,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"5px 0",color:"#aaa"}}><span>{p.client.name} — {p.name}</span><span style={{color:"#FF6B6B",fontWeight:700}}>${p.price}</span></div>)}
</div>}
</div>);
}

// ── Trials Panel ──────────────────────────────────────────────────────────────────
function WaitlistPanel({waitlist,setWaitlist,onPromote}){
const [adding,setAdding]=useState(false);
const [form,setForm]=useState({name:"",goal:"Muscle Gain",email:""});
const add=()=>{if(!form.name)return;setWaitlist(w=>[...w,{id:Date.now(),...form,date:new Date().toLocaleDateString()}]);setAdding(false);setForm({name:"",goal:"Muscle Gain",email:""});};
return(<div>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
<div><div style={{fontSize:11,color:"#555",fontFamily:"monospace",letterSpacing:1}}>TRIALS</div><div style={{fontSize:11,color:"#444",marginTop:2}}>{waitlist.length} trial requests</div></div>
<button onClick={()=>setAdding(true)} style={{background:"#1a1a1a",border:"1px solid #2a2a2a",color:"#888",borderRadius:8,padding:"7px 13px",cursor:"pointer",fontSize:12}}>+ Add Trial</button>
</div>
{waitlist.length===0&&<div style={{color:"#2a2a2a",fontSize:13,textAlign:"center",padding:"30px 0"}}>No trial requests</div>}
{waitlist.map(p=><div key={p.id} style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:12,padding:"13px 15px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
<div><div style={{fontWeight:600,fontSize:14}}>{p.name}</div><div style={{fontSize:11,color:"#555",marginTop:2}}>{p.goal} · {p.email} · Added {p.date}</div></div>
<div style={{display:"flex",gap:7}}>
<button onClick={()=>onPromote(p)} style={{background:"#E8C54722",color:"#E8C547",border:"1px solid #E8C54744",borderRadius:7,padding:"5px 11px",cursor:"pointer",fontSize:12,fontWeight:600}}>Promote</button>
<button onClick={()=>setWaitlist(w=>w.filter(x=>x.id!==p.id))} style={{background:"transparent",border:"none",color:"#333",cursor:"pointer",fontSize:14}}>✕</button>
</div>
</div>)}
{adding&&<div style={{background:"#111",border:"1px solid #2a2a2a",borderRadius:12,padding:16,marginTop:10}}>
{[{l:"Name",k:"name",t:"text"},{l:"Email",k:"email",t:"email"}].map(({l,k,t})=><div key={k} style={{marginBottom:10}}><div style={{fontSize:10,color:"#555",fontFamily:"monospace",marginBottom:4}}>{l.toUpperCase()}</div><input type={t} value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} style={{width:"100%",background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:8,padding:"7px 9px",color:"#fff",fontSize:13,outline:"none",boxSizing:"border-box"}}/></div>)}
<div style={{marginBottom:12}}><div style={{fontSize:10,color:"#555",fontFamily:"monospace",marginBottom:4}}>GOAL</div><select value={form.goal} onChange={e=>setForm(f=>({...f,goal:e.target.value}))} style={{width:"100%",background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:8,padding:"7px 9px",color:"#fff",fontSize:13,outline:"none"}}>{Object.keys(GOAL_COLORS).map(g=><option key={g}>{g}</option>)}</select></div>
<div style={{display:"flex",gap:8}}><button onClick={add} style={{flex:1,background:"#E8C547",color:"#000",border:"none",borderRadius:8,padding:"9px 0",fontWeight:800,fontSize:13,cursor:"pointer",fontFamily:"'Bebas Neue',sans-serif",letterSpacing:1}}>ADD</button><button onClick={()=>setAdding(false)} style={{flex:1,background:"#1e1e1e",color:"#888",border:"none",borderRadius:8,padding:"9px 0",cursor:"pointer",fontSize:13}}>Cancel</button></div>
</div>}
</div>);
}

// ── Add Progress Modal ────────────────────────────────────────────────────────
function AddProgress({client,onSave,onClose}){
const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const last=client.progress?.at(-1)||{};
const [form,setForm]=useState({date:months[new Date().getMonth()],weight:client.weight,benchPress:last.benchPress||0,squat:last.squat||0,deadlift:last.deadlift||0,ohp:last.ohp||0,waist:last.waist||0,chest:last.chest||0,arms:last.arms||0,bodyFat:last.bodyFat||0});
return(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
<div style={{background:"#111",border:"1px solid #2a2a2a",borderRadius:16,padding:26,width:"100%",maxWidth:380,maxHeight:"90vh",overflowY:"auto"}}>
<div style={{fontSize:18,fontFamily:"'Bebas Neue',sans-serif",letterSpacing:1,marginBottom:4}}>LOG PROGRESS</div>
<div style={{color:"#555",fontSize:12,marginBottom:16}}>{client.name}</div>
<div style={{fontSize:10,color:"#444",fontFamily:"monospace",marginBottom:5}}>MONTH</div>
<select value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={{width:"100%",background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:8,padding:"7px 9px",color:"#fff",fontSize:13,outline:"none",marginBottom:12}}>
{months.map(m=><option key={m}>{m}</option>)}
</select>
<div style={{fontSize:10,color:"#444",fontFamily:"monospace",marginBottom:8}}>BODYWEIGHT (kg) & LIFTS (kg)</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
{[{l:"Weight",k:"weight"},{l:"Bench Press",k:"benchPress"},{l:"Squat",k:"squat"},{l:"Deadlift",k:"deadlift"},{l:"OHP",k:"ohp"}].map(({l,k})=><div key={k}><div style={{fontSize:10,color:"#555",marginBottom:3}}>{l}</div><input type="number" value={form[k]} onChange={e=>setForm(f=>({...f,[k]:Number(e.target.value)}))} style={{width:"100%",background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:8,padding:"6px 8px",color:"#fff",fontSize:13,outline:"none",boxSizing:"border-box"}}/></div>)}
</div>
<div style={{fontSize:10,color:"#444",fontFamily:"monospace",marginBottom:8}}>MEASUREMENTS</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:18}}>
{[{l:"Waist (in)",k:"waist"},{l:"Chest (in)",k:"chest"},{l:"Arms (in)",k:"arms"},{l:"Body Fat %",k:"bodyFat"}].map(({l,k})=><div key={k}><div style={{fontSize:10,color:"#555",marginBottom:3}}>{l}</div><input type="number" step="0.5" value={form[k]} onChange={e=>setForm(f=>({...f,[k]:Number(e.target.value)}))} style={{width:"100%",background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:8,padding:"6px 8px",color:"#fff",fontSize:13,outline:"none",boxSizing:"border-box"}}/></div>)}
</div>
<div style={{display:"flex",gap:8}}><button onClick={()=>onSave(form)} style={{flex:1,background:client.color,color:"#000",border:"none",borderRadius:8,padding:"10px 0",fontWeight:800,fontSize:13,cursor:"pointer",fontFamily:"'Bebas Neue',sans-serif",letterSpacing:1}}>SAVE</button><button onClick={onClose} style={{flex:1,background:"#1e1e1e",color:"#888",border:"none",borderRadius:8,padding:"10px 0",cursor:"pointer",fontSize:13}}>Cancel</button></div>
</div>
</div>);
}

// ── Add Client Modal ──────────────────────────────────────────────────────────
function AddClient({onSave,onClose}){
const [form,setForm]=useState({name:"",age:"",goal:"Muscle Gain",weight:"",color:COLORS[0]});
return(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}}>
<div style={{background:"#111",border:"1px solid #2a2a2a",borderRadius:16,padding:26,width:340}}>
<div style={{fontSize:20,fontFamily:"'Bebas Neue',sans-serif",letterSpacing:1,marginBottom:18}}>NEW CLIENT</div>
{[{l:"Full Name",k:"name",t:"text"},{l:"Age",k:"age",t:"number"},{l:"Starting Weight (kg)",k:"weight",t:"number"}].map(({l,k,t})=><div key={k} style={{marginBottom:11}}><div style={{fontSize:10,color:"#555",fontFamily:"monospace",letterSpacing:1,marginBottom:3}}>{l.toUpperCase()}</div><input type={t} value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} style={{width:"100%",background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:8,padding:"7px 9px",color:"#fff",fontSize:13,outline:"none",boxSizing:"border-box"}}/></div>)}
<div style={{marginBottom:11}}><div style={{fontSize:10,color:"#555",fontFamily:"monospace",letterSpacing:1,marginBottom:3}}>GOAL</div><select value={form.goal} onChange={e=>setForm(f=>({...f,goal:e.target.value}))} style={{width:"100%",background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:8,padding:"7px 9px",color:"#fff",fontSize:13,outline:"none"}}>{Object.keys(GOAL_COLORS).map(g=><option key={g}>{g}</option>)}</select></div>
<div style={{marginBottom:18}}><div style={{fontSize:10,color:"#555",fontFamily:"monospace",letterSpacing:1,marginBottom:7}}>COLOR</div><div style={{display:"flex",gap:7,flexWrap:"wrap"}}>{COLORS.map(c=><div key={c} onClick={()=>setForm(f=>({...f,color:c}))} style={{width:26,height:26,borderRadius:"50%",background:c,cursor:"pointer",border:form.color===c?"3px solid #fff":"3px solid transparent"}}/>)}</div></div>
<div style={{display:"flex",gap:8}}><button onClick={()=>form.name&&onSave(form)} style={{flex:1,background:form.color,color:"#000",border:"none",borderRadius:8,padding:"10px 0",fontWeight:800,fontSize:13,cursor:"pointer",fontFamily:"'Bebas Neue',sans-serif",letterSpacing:1}}>ADD CLIENT</button><button onClick={onClose} style={{flex:1,background:"#1e1e1e",color:"#888",border:"none",borderRadius:8,padding:"10px 0",cursor:"pointer",fontSize:13}}>Cancel</button></div>
</div>
</div>);
}

// ── PDF Export ────────────────────────────────────────────────────────────────
function exportPDF(client){
const p=client.progress||[]; const m=client.measurements||{}; const prog=client.program;
const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${client.name} Report</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;600;700&display=swap');
body{font-family:'DM Sans',sans-serif;background:#fff;color:#111;margin:0;padding:32px;max-width:800px;}
h1{font-family:'Bebas Neue',sans-serif;font-size:42px;letter-spacing:2px;margin:0 0 6px;}
h2{font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:1px;margin:28px 0 10px;border-bottom:2px solid #eee;padding-bottom:4px;}
h3{font-family:'Bebas Neue',sans-serif;font-size:15px;letter-spacing:1px;margin:14px 0 6px;color:#444;}
.tag{display:inline-block;background:#f0f0f0;padding:2px 10px;border-radius:20px;font-size:12px;font-weight:600;margin-right:6px;}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px;}
.card{background:#f8f8f8;border-radius:8px;padding:12px 14px;}
.card .v{font-family:'Bebas Neue',sans-serif;font-size:22px;}
.card .l{font-size:10px;color:#888;letter-spacing:1px;margin-top:2px;}
table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:14px;}
th{background:#f0f0f0;padding:7px 10px;text-align:left;font-size:10px;letter-spacing:1px;color:#666;}
td{padding:7px 10px;border-bottom:1px solid #f0f0f0;}
.ex{display:flex;justify-content:space-between;padding:6px 10px;background:#fafafa;border-radius:6px;margin-bottom:4px;font-size:13px;}
.wh{background:#111;color:#fff;padding:7px 12px;border-radius:6px;font-family:'Bebas Neue',sans-serif;font-size:14px;letter-spacing:1px;margin:10px 0 5px;}
.nb{background:#f8f8f8;border-radius:8px;padding:12px 16px;font-size:13px;color:#444;line-height:1.6;}
.footer{margin-top:40px;font-size:11px;color:#bbb;border-top:1px solid #eee;padding-top:12px;}
</style></head><body>
<h1>${client.name}</h1>
<div style="margin-bottom:18px"><span class="tag">${client.goal}</span><span class="tag">Age ${client.age}</span><span class="tag">${client.weight} kg</span><span class="tag">Since ${client.joinDate}</span></div>
${p.length>0?`<h2>Progress History</h2><table><tr><th>MONTH</th><th>WEIGHT</th><th>BENCH</th><th>SQUAT</th><th>DEADLIFT</th><th>OHP</th><th>BODY FAT</th></tr>${p.map(r=>`<tr><td>${r.date}</td><td>${r.weight}kg</td><td>${r.benchPress||"—"}</td><td>${r.squat||"—"}</td><td>${r.deadlift||"—"}</td><td>${r.ohp||"—"}</td><td>${r.bodyFat||"—"}%</td></tr>`).join("")}</table>`:""}
${Object.keys(m).length>0?`<h2>Measurements</h2><div class="grid">${Object.entries(m).map(([k,v])=>`<div class="card"><div class="v">${v||"—"}</div><div class="l">${k.toUpperCase()}</div></div>`).join("")}</div>`:""}
${client.notes?`<h2>Coach Notes</h2><div class="nb">${client.notes}</div>`:""}
${prog?`<h2>Program: ${prog.name}</h2><p style="font-size:12px;color:#888">${prog.totalWeeks} Weeks · ${prog.days.length} Days/Week</p>${prog.days.map(d=>`<h3>${d.name}</h3>${d.exercises.map(ex=>`<div class="ex"><span>${ex.name}</span><span style="color:#888">${ex.numSets}×${ex.reps}</span></div>`).join("")}`).join("")}${prog.weekLogs&&prog.weekLogs.some(w=>w.days.some(d=>d.date||d.notes))?`<h2>Session Logs</h2>${prog.weekLogs.map((wk,wi)=>`<div class="wh">WEEK ${wi+1}</div>${wk.days.map(d=>{const has=d.date||d.notes||d.sessionData.some(e=>e.sets.some(s=>s.weight));if(!has)return"";return`<div style="margin-bottom:12px"><strong>${d.name}</strong>${d.date?` <span style="color:#888;font-size:12px">· ${d.date}</span>`:""}<table><tr><th>EXERCISE</th><th>S1</th><th>S2</th><th>S3</th><th>S4</th><th>S5</th></tr>${d.sessionData.map(ex=>`<tr><td>${ex.name}</td>${ex.sets.map(s=>`<td>${s.weight?`${s.weight}×${s.reps||"?"}`:""}</td>`).join("")}${Array(Math.max(0,5-ex.sets.length)).fill("<td></td>").join("")}</tr>`).join("")}</table>${d.metrics?.maxHR||d.metrics?.kcal?`<div style="font-size:11px;color:#888">HR: ${d.metrics.maxHR||"?"}/${d.metrics.avgHR||"?"} bpm · Kcal: ${d.metrics.kcal||"?"}</div>`:""}${d.notes?`<div style="font-size:12px;color:#666;font-style:italic;margin-top:4px">${d.notes}</div>`:""}</div>`;}).join("")}`).join("")}`:""}` :""}
<div class="footer">Generated by PT Tracker · ${new Date().toLocaleDateString()}</div>
</body></html>`;
const w=window.open("","_blank");w.document.write(html);w.document.close();setTimeout(()=>w.print(),600);
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App(){
const [clients,setClients]=useState([]);
const [waitlist,setWaitlist]=useState(WAITLIST);
const [selected,setSelected]=useState(null);
const [appView,setAppView]=useState("clients");
const [tab,setTab]=useState("overview");
const [modal,setModal]=useState(null);
const [recapSession,setRecapSession]=useState(null);
const photoRef=useRef();
const createdClientColors=useRef({});
const sc=clients.find(c=>c.id===selected);
const fetchClients = async () => {
  const [{ data: clientsData, error: clientsError }, { data: clientDataRows, error: clientDataError }] = await Promise.all([
    supabase.from("clients").select("*").order("created_at", { ascending: true }),
    supabase.from("client_data").select("*"),
  ]);
  if(clientsError){ console.error("Supabase fetch clients error:", clientsError); return; }
  if(clientDataError){ console.error("Supabase fetch client_data error:", clientDataError); }
  if(clientsData) {
    setClients(clientsData.map(row => {
      const client = mapDbClient(row);
      const merged = mergeClientDataIntoClient(client, clientDataRows?.filter(r => r.client_id === row.id));
      const override = createdClientColors.current[row.id];
      if(override) merged.color = override;
      return merged;
    }));
  }
};
const createClientOnDb = async (data) => {
  const selectedColor = data.color || getClientColor(data.goal, data.name);
  const payload = {
    name: data.name,
    goal: data.goal,
    age: Number(data.age),
    weight_kg: Number(data.weight),
    phone: data.phone || "",
    email: data.email || "",
    injuries: Array.isArray(data.injuries) ? data.injuries.join(";") : data.injuries || "",
    notes: data.notes || "",
    sessions_booked: Number(data.sessionsBooked || 0),
    sessions_conducted: Number(data.sessions || 0),
    trials: Number(data.trials || 0),
  };
  const { data: created, error } = await supabase.from("clients").insert(payload).select();
  if(error){ console.error("Supabase insert error:", error); return; }
  if(created?.[0]?.id){ createdClientColors.current[created[0].id] = selectedColor; }
  await fetchClients();
};
const updateClientOnDb = async (id, updates) => {
  const payload = {};
  if(updates.name != null) payload.name = updates.name;
  if(updates.goal != null) payload.goal = updates.goal;
  if(updates.age != null) payload.age = Number(updates.age);
  if(updates.weight != null) payload.weight_kg = Number(updates.weight);
  if(updates.phone != null) payload.phone = updates.phone;
  if(updates.email != null) payload.email = updates.email;
  if(updates.injuries != null) payload.injuries = Array.isArray(updates.injuries) ? updates.injuries.join(";") : updates.injuries;
  if(updates.notes != null) payload.notes = updates.notes;
  if(updates.sessions != null) payload.sessions_conducted = Number(updates.sessions);
  if(updates.sessionsBooked != null) payload.sessions_booked = Number(updates.sessionsBooked);
  if(updates.trials != null) payload.trials = Number(updates.trials);
  if(Object.keys(payload).length === 0) return;
  const { error } = await supabase.from("clients").update(payload).eq("id", id);
  if(error){ console.error("Supabase update error:", error); return; }
  await fetchClients();
};
const deleteClient = async (id) => {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if(error){ console.error("Supabase delete error:", error); return; }
  await fetchClients();
};
const patch = async (id, p) => {
  let updatedClient;
  setClients(prev=>prev.map(c=>c.id===id?updatedClient={...c,...p}:c));
  if(!updatedClient?.id){
    console.error("Unable to persist client_data: missing client id", id, p);
  }
  await Promise.all([
    updateClientOnDb(id, p),
    updatedClient ? persistClientDataSections(updatedClient, p) : Promise.resolve(),
  ]);
};
useEffect(()=>{ fetchClients(); }, []);
const openClient=id=>{setSelected(id);setAppView("client");setTab("overview");};
const goBack=()=>{setAppView("clients");setSelected(null);};
const saveProgram=async prog=>{
  const weekLogs = Array.from({length:prog.totalWeeks},(_,i)=>makeWeek(i+1,prog.days));
  const program = {...prog,weekLogs};
  patch(selected,{program});
  const client = clients.find(x=>x.id===selected);
  if(client?.id) await saveClientDataSection(client.id, "program", program);
  setModal(null);
};
const saveAI=async prog=>{
  patch(selected,{program:prog});
  const client = clients.find(x=>x.id===selected);
  if(client?.id) await saveClientDataSection(client.id, "program", prog);
  setModal(null);
};
const updateProgram=async p=>{
  patch(selected,{program:p});
  const client = clients.find(x=>x.id===selected);
  if(client?.id) await saveClientDataSection(client.id, "program", p);
};
const saveProgress=async entry=>{
  const c=clients.find(x=>x.id===selected);
  if(!c) return;
  const updatedProgress=[...(c.progress||[]),entry];
  const updatedMeasurements={...(c.measurements||{}),waist:entry.waist||c.measurements?.waist,chest:entry.chest||c.measurements?.chest,arms:entry.arms||c.measurements?.arms,bodyFat:entry.bodyFat||c.measurements?.bodyFat};
  const updatedData={
    progress: updatedProgress,
    measurements: updatedMeasurements,
    weight: entry.weight,
    sessions: (c.sessions||0)+1,
  };
  patch(selected,{progress:updatedProgress,weight:entry.weight,sessions:(c.sessions||0)+1,measurements:updatedMeasurements});
  if(c.id) await saveClientDataSection(c.id, "progress", updatedData);
  setModal(null);
};
const saveSchedule=async p=>{
  const c = clients.find(x=>x.id===selected);
  if(!c) return;
  patch(selected,p);
  await saveClientDataSection(c.id, "sessions", {
    schedule: p.schedule ?? c.schedule ?? [],
    sessions: p.sessions ?? c.sessions ?? 0,
    sessionsBooked: p.sessionsBooked ?? c.sessionsBooked ?? 0,
    trials: p.trials ?? c.trials ?? 0,
    checkIns: p.checkIns ?? c.checkIns ?? [],
  });
};
const saveMeasurements=async m=>{
  const c = clients.find(x=>x.id===selected);
  if(!c) return;
  patch(selected,{measurements:m});
  await saveClientDataSection(c.id, "progress", {
    progress: c.progress ?? [],
    measurements: m,
    weight: c.weight ?? 0,
    sessions: c.sessions ?? 0,
    sessionsBooked: c.sessionsBooked ?? 0,
    trials: c.trials ?? 0,
  });
};
const savePhotos=async photos=>{
  const c = clients.find(x=>x.id===selected);
  if(!c) return;
  patch(selected,{photos});
  await saveClientDataSection(c.id, "details", {
    notes: c.notes || "",
    injuries: c.injuries || [],
    photo: c.photo || null,
    packages: c.packages || [],
    photos: photos || [],
  });
};
const savePackages=async pkgs=>{
  const c = clients.find(x=>x.id===selected);
  if(!c) return;
  patch(selected,{packages:pkgs});
  await saveClientDataSection(c.id, "details", {
    notes: c.notes || "",
    injuries: c.injuries || [],
    photo: c.photo || null,
    packages: pkgs || [],
  });
};
const saveNotes=async notes=>{
  const c = clients.find(x=>x.id===selected);
  if(!c) return;
  patch(selected,{notes});
  await saveClientDataSection(c.id, "details", {
    notes: notes || "",
    injuries: c.injuries || [],
    photo: c.photo || null,
    packages: c.packages || [],
  });
};
const saveInjuries=async injuries=>{
  const c = clients.find(x=>x.id===selected);
  if(!c) return;
  patch(selected,{injuries});
  await saveClientDataSection(c.id, "details", {
    notes: c.notes || "",
    injuries: injuries || [],
    photo: c.photo || null,
    packages: c.packages || [],
  });
};
const saveProfilePhoto=async photoData=>{
  const c = clients.find(x=>x.id===selected);
  if(!c) return;
  patch(selected,{photo:photoData});
  await saveClientDataSection(c.id, "details", {
    notes: c.notes || "",
    injuries: c.injuries || [],
    photo: photoData || null,
    packages: c.packages || [],
  });
};
const addClient=async data=>{
  const payload = {
    name: data.name,
    goal: data.goal,
    age: Number(data.age),
    weight_kg: Number(data.weight),
    phone: data.phone || "",
    email: data.email || "",
    injuries: Array.isArray(data.injuries) ? data.injuries.join(";") : data.injuries || "",
    notes: data.notes || "",
    sessions_booked: Number(data.sessionsBooked || 0),
    sessions_conducted: Number(data.sessions || 0),
    trials: Number(data.trials || 0),
  };
  const { error } = await supabase.from("clients").insert(payload);
  if(error){ console.error("Supabase insert error:", error); return; }
  await fetchClients();
  setModal(null);
};
const handlePhoto=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>saveProfilePhoto(ev.target.result);r.readAsDataURL(f);};
const promoteFromWaitlist=async p=>{const color=COLORS[Math.floor(Math.random()*COLORS.length)];await createClientOnDb({name:p.name,age:0,goal:p.goal,weight:0,color,phone:"",email:p.email,injuries:[],notes:p.email,sessions:0,sessionsBooked:0,trials:0});setWaitlist(w=>w.filter(x=>x.id!==p.id));};
const totalRev=clients.flatMap(c=>c.packages||[]).filter(p=>p.paid).reduce((a,p)=>a+p.price,0);
const totalSessions=clients.reduce((a,c)=>a+(c.sessions||0),0);
const bookedSessions=clients.reduce((a,c)=>a+(c.schedule?.length||0),0);
const outstanding=clients.flatMap(c=>c.packages||[]).filter(p=>!p.paid).reduce((a,p)=>a+p.price,0);
const getLatestSession=()=>{
if(!sc?.program?.weekLogs)return null;
for(let wi=sc.program.weekLogs.length-1;wi>=0;wi--){
for(let di=sc.program.days.length-1;di>=0;di--){
const d=sc.program.weekLogs[wi]?.days[di];
if(d&&(d.date||d.sessionData.some(e=>e.sets.some(s=>s.weight))))return d;
}
}
return null;
};
return(<>
<style>{`
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
body{background:#0a0a0a;font-family:'DM Sans',sans-serif;color:#fff;}
::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-track{background:#111;}::-webkit-scrollbar-thumb{background:#2a2a2a;border-radius:2px;}
input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;}
input[type=date]::-webkit-calendar-picker-indicator{filter:invert(0.4);}
input[type=time]::-webkit-calendar-picker-indicator{filter:invert(0.4);}
`}</style>
<input ref={photoRef} type="file" accept="image/*" style={{display:"none"}} onChange={handlePhoto}/>
<div style={{minHeight:"100vh",background:"#0a0a0a",maxWidth:920,margin:"0 auto",padding:20}}>
{appView==="clients"&&(<>
<div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",marginBottom:28}}>
<div><div style={{fontSize:11,color:"#444",letterSpacing:3,fontFamily:"monospace",marginBottom:3}}>PERSONAL TRAINING</div><div style={{fontSize:46,fontFamily:"'Bebas Neue',sans-serif",letterSpacing:2,lineHeight:1}}>MY CLIENTS</div></div>
<div style={{display:"flex",gap:8}}>
<button onClick={()=>setAppView("waitlist")} style={{background:"#1a1a1a",border:"1px solid #2a2a2a",color:"#888",borderRadius:9,padding:"10px 14px",cursor:"pointer",fontSize:12,fontWeight:600,position:"relative"}}>Trials{waitlist.length>0&&<span style={{position:"absolute",top:-6,right:-6,background:"#FF6B6B",borderRadius:"50%",width:18,height:18,fontSize:10,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>{waitlist.length}</span>}</button>
<button onClick={()=>setAppView("revenue")} style={{background:"#1a1a1a",border:"1px solid #2a2a2a",color:"#888",borderRadius:9,padding:"10px 14px",cursor:"pointer",fontSize:12,fontWeight:600}}>💰 Sessions Conducted</button>
<button onClick={()=>setModal("addClient")} style={{background:"#E8C547",color:"#000",border:"none",borderRadius:9,padding:"10px 18px",fontWeight:800,fontSize:13,cursor:"pointer",fontFamily:"'Bebas Neue',sans-serif",letterSpacing:1}}>+ NEW CLIENT</button>
</div>
</div>
<div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:24}}>
{[{l:"Clients",v:clients.length},{l:"Total Sessions",v:totalSessions},{l:"Sessions Conducted",v:totalSessions},{l:"Booked Sessions",v:bookedSessions,warn:bookedSessions>0}].map(({l,v,warn})=><div key={l} style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:12,padding:"14px 16px"}}><div style={{fontSize:24,fontFamily:"'Bebas Neue',sans-serif",color:warn?"#FF6B6B":"#fff"}}>{v}</div><div style={{fontSize:10,color:"#555",letterSpacing:1,fontFamily:"monospace"}}>{l.toUpperCase()}</div></div>)}
</div>
<div style={{display:"flex",flexDirection:"column",gap:8}}>
{clients.map(c=>{
const delta=c.progress.length>=2?c.progress.at(-1).weight-c.progress.at(-2).weight:0;
const pkg=c.packages?.find(p=>p.used<p.total);
const rem=pkg?pkg.total-pkg.used:null;
const hasInj=c.injuries?.length>0;
return(<div key={c.id} onClick={()=>openClient(c.id)} style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:13,padding:"14px 18px",cursor:"pointer",transition:"all 0.15s",display:"grid",gridTemplateColumns:"auto 1fr auto auto",gap:14,alignItems:"center"}} onMouseEnter={e=>{e.currentTarget.style.border=`1px solid ${c.color}44`;e.currentTarget.style.background="#141414";}} onMouseLeave={e=>{e.currentTarget.style.border="1px solid #1e1e1e";e.currentTarget.style.background="#111";}}>
<div style={{width:46,height:46,borderRadius:"50%",overflow:"hidden",border:`2px solid ${c.color}`,flexShrink:0}}>
{c.photo?<img src={c.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<div style={{width:"100%",height:"100%",background:c.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:13,color:c.color,fontFamily:"'Bebas Neue',sans-serif"}}>{c.avatar}</div>}
</div>
<div>
<div style={{display:"flex",alignItems:"center",gap:7}}>
<span style={{fontWeight:700,fontSize:14}}>{c.name}</span>
{hasInj&&<span title={c.injuries.join(", ")} style={{fontSize:11,color:"#FF6B6B"}}>⚠</span>}
{c.packages?.some(p=>!p.paid)&&<span style={{fontSize:10,background:"#FF6B6B22",color:"#FF6B6B",padding:"1px 7px",borderRadius:20,fontWeight:600}}>UNPAID</span>}
</div>
<div style={{display:"flex",gap:7,marginTop:3,flexWrap:"wrap"}}>
<span style={{fontSize:11,color:"#555"}}>Age {c.age}</span>
<span style={{fontSize:11,background:GOAL_COLORS[c.goal]+"22",color:GOAL_COLORS[c.goal],padding:"1px 8px",borderRadius:20,fontWeight:600}}>{c.goal}</span>
{rem!=null&&<span style={{fontSize:11,color:"#555"}}>{rem} sessions left</span>}
{c.program&&<span style={{fontSize:11,color:"#444"}}>📋 {c.program.name}</span>}
</div>
</div>
<div style={{opacity:.7}}><Spark data={c.progress} field="weight" color={c.color}/></div>
<div style={{textAlign:"right"}}>
<div style={{fontSize:19,fontFamily:"'Bebas Neue',sans-serif"}}>{c.weight}<span style={{fontSize:11,color:"#555"}}> kg</span></div>
{delta!==0&&<div style={{fontSize:11,color:delta<0?"#4ECDC4":"#FF6B6B",fontWeight:600}}>{delta>0?"+":""}{delta.toFixed(1)} kg</div>}
</div>
</div>);
})}
</div>
</>)}
{appView==="revenue"&&(<>
<div style={{display:"flex",alignItems:"center",gap:14,marginBottom:24}}>
<button onClick={()=>setAppView("clients")} style={{background:"#1a1a1a",border:"1px solid #2a2a2a",color:"#888",borderRadius:8,padding:"7px 13px",cursor:"pointer",fontSize:18}}>←</button>
<div style={{fontSize:34,fontFamily:"'Bebas Neue',sans-serif",letterSpacing:1}}>SESSIONS DASHBOARD</div>
</div>
<RevenueDash clients={clients}/>
</>) }
{appView==="waitlist"&&(<>
<div style={{display:"flex",alignItems:"center",gap:14,marginBottom:24}}>
<button onClick={()=>setAppView("clients")} style={{background:"#1a1a1a",border:"1px solid #2a2a2a",color:"#888",borderRadius:8,padding:"7px 13px",cursor:"pointer",fontSize:18}}>←</button>
<div style={{fontSize:34,fontFamily:"'Bebas Neue',sans-serif",letterSpacing:1}}>TRIALS</div>
</div>
<WaitlistPanel waitlist={waitlist} setWaitlist={setWaitlist} onPromote={promoteFromWaitlist}/>
</>)}
{appView==="client"&&sc&&(<>
<div style={{display:"flex",alignItems:"center",gap:14,marginBottom:22}}>
<button onClick={goBack} style={{background:"#1a1a1a",border:"1px solid #2a2a2a",color:"#888",borderRadius:8,padding:"7px 13px",cursor:"pointer",fontSize:18}}>←</button>
<div onClick={()=>photoRef.current.click()} title="Click to upload photo" style={{width:54,height:54,borderRadius:"50%",overflow:"hidden",border:`2px solid ${sc.color}`,cursor:"pointer",flexShrink:0,position:"relative"}}>
{sc.photo?<img src={sc.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<div style={{width:"100%",height:"100%",background:sc.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:15,color:sc.color,fontFamily:"'Bebas Neue',sans-serif"}}>{sc.avatar}</div>}
</div>
<div style={{flex:1}}>
<div style={{display:"flex",alignItems:"center",gap:8}}>
<div style={{fontSize:26,fontFamily:"'Bebas Neue',sans-serif",letterSpacing:1}}>{sc.name}</div>
{sc.injuries?.length>0&&<span title={sc.injuries.join(", ")} style={{fontSize:12,color:"#FF6B6B",cursor:"help"}}>⚠ Injury flag</span>}
</div>
<div style={{display:"flex",gap:7,marginTop:2,flexWrap:"wrap"}}>
<span style={{fontSize:11,color:"#555"}}>Age {sc.age}</span>
<span style={{fontSize:11,background:GOAL_COLORS[sc.goal]+"22",color:GOAL_COLORS[sc.goal],padding:"1px 8px",borderRadius:20,fontWeight:600}}>{sc.goal}</span>
</div>
</div>
<div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
<button onClick={()=>exportPDF(sc)} style={{background:"#1a1a1a",border:"1px solid #2a2a2a",color:"#aaa",borderRadius:8,padding:"8px 12px",cursor:"pointer",fontSize:12,fontWeight:600}}>⬇ PDF</button>
{sc.program&&<button onClick={()=>{const s=getLatestSession();if(s)setRecapSession(s);}} style={{background:"#A78BFA22",border:"1px solid #A78BFA44",color:"#A78BFA",borderRadius:8,padding:"8px 12px",cursor:"pointer",fontSize:12,fontWeight:600}}>✦ Recap</button>}
<button onClick={()=>setModal("progress")} style={{background:sc.color,color:"#000",border:"none",borderRadius:8,padding:"8px 14px",fontWeight:800,fontSize:12,cursor:"pointer",fontFamily:"'Bebas Neue',sans-serif",letterSpacing:1}}>+ LOG</button>
</div>
</div>
{sc.injuries?.length>0&&<div style={{background:"#1a0808",border:"1px solid #FF6B6B33",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#FF6B6B"}}>⚠ {sc.injuries.join(" · ")}</div>}
<div style={{display:"flex",gap:3,marginBottom:18,background:"#111",border:"1px solid #1e1e1e",borderRadius:10,padding:3,overflowX:"auto"}}>
{["overview","progress","body","photos","program","schedule","packages","notes"].map(t=><button key={t} onClick={()=>setTab(t)} style={{flex:1,minWidth:70,background:tab===t?sc.color:"transparent",color:tab===t?"#000":"#555",border:"none",borderRadius:7,padding:"7px 4px",cursor:"pointer",fontWeight:700,fontSize:10,fontFamily:"'Bebas Neue',sans-serif",letterSpacing:.5,transition:"all 0.15s",whiteSpace:"nowrap"}}>{t.toUpperCase()}</button>)}
</div>
{tab==="overview"&&<div>
<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
{[{l:"Weight",v:`${sc.weight} kg`},{l:"Sessions",v:sc.sessions||0},{l:"Streak",v:(() => { let s=0; const ci=sc.checkIns||[]; for(let i=ci.length-1;i>=0;i--){if(ci[i])s++;else break;} return `${s} 🔥`; })()}].map(({l,v})=><div key={l} style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:12,padding:"13px 15px"}}><div style={{fontSize:22,fontFamily:"'Bebas Neue',sans-serif"}}>{v}</div><div style={{fontSize:10,color:"#555",fontFamily:"monospace",letterSpacing:1}}>{l.toUpperCase()}</div></div>)}
</div>
{sc.progress.length>0&&<div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:14}}>
{LIFT_FIELDS.map(({key,label})=>{const val=sc.progress.at(-1)[key];const prev=sc.progress.length>=2?sc.progress.at(-2)[key]:null;const d=val&&prev?val-prev:0;const prs=getPRs(sc.progress);const isPR=val&&val>=prs[key];return(<div key={key} style={{background:"#111",border:`1px solid ${isPR?sc.color+"44":"#1e1e1e"}`,borderRadius:12,padding:"13px 15px",display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontSize:20,fontFamily:"'Bebas Neue',sans-serif",color:sc.color}}>{val||"—"}<span style={{fontSize:11,color:"#555"}}> kg</span></div><div style={{fontSize:11,color:"#555"}}>{label}{isPR&&<span style={{marginLeft:6,color:"#E8C547",fontSize:10}}>🏆 PR</span>}</div></div>{d!==0&&<div style={{fontSize:12,color:d>0?"#6EE7B7":"#FF6B6B",fontWeight:700}}>{d>0?"+":""}{d}</div>}</div>);})}
</div>}
{sc.progress.length>=2&&<div style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:12,padding:18}}><div style={{fontSize:10,color:"#555",fontFamily:"monospace",letterSpacing:1,marginBottom:10}}>WEIGHT TREND</div><Spark data={sc.progress} field="weight" color={sc.color}/></div>}
</div>}
{tab==="progress"&&<div style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:12,padding:22}}>
<div style={{fontSize:10,color:"#555",fontFamily:"monospace",letterSpacing:1,marginBottom:14}}>PROGRESS CHARTS</div>
<Chart data={sc.progress} color={sc.color}/>
{sc.progress.length>0&&<div style={{marginTop:22}}>
<div style={{fontSize:10,color:"#555",fontFamily:"monospace",letterSpacing:1,marginBottom:8}}>HISTORY</div>
{[...sc.progress].reverse().map((p,i)=><div key={i} style={{display:"grid",gridTemplateColumns:"55px repeat(5,1fr)",gap:6,padding:"7px 10px",background:"#161616",borderRadius:8,fontSize:12,marginBottom:4}}>
<span style={{color:"#555"}}>{p.date}</span><span>{p.weight}kg</span><span style={{color:"#777"}}>B:{p.benchPress||"—"}</span><span style={{color:"#777"}}>S:{p.squat||"—"}</span><span style={{color:"#777"}}>D:{p.deadlift||"—"}</span><span style={{color:"#777"}}>BF:{p.bodyFat||"—"}%</span>
</div>)}
</div>}
</div>}
{tab==="body"&&<BodyTab client={sc} onUpdate={saveMeasurements}/>}
{tab==="photos"&&<PhotosTab client={sc} onUpdate={p=>savePhotos(p.photos||[])}/>}
{tab==="program"&&<div>
{sc.program?(<>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
<div><div style={{fontSize:20,fontFamily:"'Bebas Neue',sans-serif",letterSpacing:1}}>{sc.program.name}</div><div style={{fontSize:11,color:"#555",fontFamily:"monospace"}}>{sc.program.totalWeeks} WEEKS · {sc.program.days.length} DAYS/WEEK</div></div>
<div style={{display:"flex",gap:7}}>
<button onClick={()=>setModal("aiProgram")} style={{background:"#1a1a1a",border:`1px solid ${sc.color}44`,color:sc.color,borderRadius:8,padding:"7px 12px",cursor:"pointer",fontSize:12,fontWeight:600}}>✦ Regenerate</button>
<button onClick={()=>setModal("program")} style={{background:"#1a1a1a",border:"1px solid #2a2a2a",color:"#888",borderRadius:8,padding:"7px 12px",cursor:"pointer",fontSize:12}}>Edit</button>
</div>
</div>
<SessionTracker client={sc} onUpdate={updateProgram}/>
</>):(<div style={{textAlign:"center",padding:"60px 0"}}>
<div style={{fontSize:44,marginBottom:14}}>📋</div>
<div style={{fontSize:15,fontWeight:600,marginBottom:7}}>No program yet</div>
<div style={{color:"#555",fontSize:13,marginBottom:22}}>Build manually or generate with AI</div>
<div style={{display:"flex",gap:10,justifyContent:"center"}}>
<button onClick={()=>setModal("aiProgram")} style={{background:sc.color,color:"#000",border:"none",borderRadius:10,padding:"11px 22px",fontWeight:800,fontSize:14,cursor:"pointer",fontFamily:"'Bebas Neue',sans-serif",letterSpacing:1}}>✦ AI GENERATE</button>
<button onClick={()=>setModal("program")} style={{background:"#1a1a1a",border:"1px solid #2a2a2a",color:"#888",borderRadius:10,padding:"11px 22px",fontWeight:700,fontSize:13,cursor:"pointer"}}>Build Manually</button>
</div>
</div>)}
</div>}
{tab==="schedule"&&<ScheduleTab client={sc} onUpdate={saveSchedule}/>}
{tab==="packages"&&<PackagesTab client={sc} onUpdate={savePackages}/>}
{tab==="notes"&&<div style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:12,padding:22}}>
<div style={{fontSize:10,color:"#555",fontFamily:"monospace",letterSpacing:1,marginBottom:10}}>COACH NOTES</div>
<div style={{marginBottom:14}}>
<div style={{fontSize:11,color:"#555",marginBottom:6}}>Injuries / Limitations</div>
{(sc.injuries||[]).map((inj,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 10px",background:"#1a0808",border:"1px solid #FF6B6B22",borderRadius:8,marginBottom:5,fontSize:12,color:"#FF6B6B"}}>{inj}<button onClick={()=>saveInjuries(sc.injuries.filter((_,j)=>j!==i))} style={{background:"transparent",border:"none",color:"#FF6B6B44",cursor:"pointer",fontSize:14}}>✕</button></div>)}
<div style={{display:"flex",gap:7,marginTop:6}}>
<input id="injInput" placeholder="Add injury or limitation..." style={{flex:1,background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:8,padding:"7px 9px",color:"#fff",fontSize:12,outline:"none"}} onKeyDown={e=>{if(e.key==="Enter"&&e.target.value){saveInjuries([...(sc.injuries||[]),e.target.value]);e.target.value=""}}}/>
</div>
</div>
<textarea value={sc.notes} onChange={e=>patch(selected,{notes:e.target.value})} placeholder="Coaching notes, observations, goals..." style={{width:"100%",minHeight:240,background:"#161616",border:"1px solid #222",borderRadius:10,padding:14,color:"#ccc",fontSize:14,lineHeight:1.6,outline:"none",resize:"vertical",fontFamily:"'DM Sans',sans-serif"}}/>
</div>}
</>)}
</div>
{modal==="addClient"&&<AddClient onSave={addClient} onClose={()=>setModal(null)}/>}
{modal==="progress"&&sc&&<AddProgress client={sc} onSave={saveProgress} onClose={()=>setModal(null)}/>}
{modal==="program"&&sc&&<ProgramBuilder client={sc} onSave={saveProgram} onClose={()=>setModal(null)}/>}
{modal==="aiProgram"&&sc&&<AIProgram client={sc} onSave={saveAI} onClose={()=>setModal(null)}/>}
{recapSession&&sc&&<AIRecap client={sc} session={recapSession} onClose={()=>setRecapSession(null)}/>}
</>);
}