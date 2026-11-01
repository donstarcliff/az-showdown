const express=require("express");
const http=require("http");
const {WebSocketServer}=require("ws");
const crypto=require("crypto");
const app=express(),server=http.createServer(app),wss=new WebSocketServer({server});
app.use(express.static("public"));
app.get("/health",(_,res)=>res.json({ok:true,app:"A-Z Showdown"}));
const rooms=new Map(),letters="ABCDEFGHIJKLMNOPQRSTUVWXYZ",cats=["Name","Animal","Place","Food","Thing"];
const questions=[
["Which planet is known as the Red Planet?",["Venus","Mars","Jupiter","Mercury"],1],
["What is the capital of Ghana?",["Accra","Lagos","Dakar","Lome"],0],
["How many sides does a hexagon have?",["Five","Six","Seven","Eight"],1],
["Which ocean is the largest?",["Atlantic","Indian","Arctic","Pacific"],3],
["Who wrote Romeo and Juliet?",["Charles Dickens","William Shakespeare","Jane Austen","Chinua Achebe"],1]
];
const send=(ws,type,data={})=>ws.readyState===1&&ws.send(JSON.stringify({type,...data}));
const snapshot=r=>({code:r.code,hostId:r.hostId,mode:r.mode,status:r.status,round:r.round,totalRounds:r.totalRounds,letter:r.letter,deadline:r.deadline,question:r.question&&{question:r.question[0],options:r.question[1]},players:[...r.players.values()].map(p=>({id:p.id,name:p.name,score:p.score,submitted:p.submitted})),results:r.results,winner:r.winner});
function broadcast(r,type="state"){for(const p of r.players.values())send(p.ws,type,{room:snapshot(r),you:p.id})}
function endRound(r){
 if(r.status!=="playing")return;clearTimeout(r.timer);const rows=[];
 if(r.mode==="trivia"){
  const correct=[...r.submissions.values()].filter(s=>s.answer===r.question[2]).sort((a,b)=>a.at-b.at),fast=correct[0];
  for(const p of r.players.values()){const s=r.submissions.get(p.id),points=s&&s.answer===r.question[2]?10+(fast?.id===p.id?5:0):0;p.score+=points;rows.push({name:p.name,answer:s?r.question[1][s.answer]:"No answer",points})}
 }else{
  cats.forEach((category,i)=>{const entries=[...r.submissions.values()].map(s=>({id:s.id,name:s.name,answer:s.answers[i],at:s.at})).filter(x=>x.answer.trim());const groups=new Map();entries.forEach(e=>{const k=e.answer.toLowerCase().trim();groups.set(k,[...(groups.get(k)||[]),e])});const unique=[];for(const g of groups.values())g.length>1?g.forEach(e=>unique.push({...e,points:-10,outcome:"duplicate"})):unique.push({...g[0],points:0,outcome:"unique"});const valid=unique.filter(e=>e.outcome==="unique"&&e.answer.toUpperCase().startsWith(r.letter)).sort((a,b)=>a.at-b.at);valid.forEach((e,n)=>e.points=n===0?25:n===1?10:5);unique.forEach(e=>{r.players.get(e.id).score+=e.points;rows.push({category,name:e.name,answer:e.answer,points:e.points,outcome:e.points===0?"wrong-letter":e.outcome})})})
 }
 r.results=rows;r.status="results";r.deadline=null;broadcast(r,"results")
}
function nextRound(r){
 r.round++;r.results=null;r.submissions=new Map();r.players.forEach(p=>p.submitted=false);r.status="playing";r.deadline=Date.now()+(r.mode==="trivia"?15000:30000);
 r.question=r.mode==="trivia"?questions[(r.round-1)%questions.length]:null;r.letter=r.mode==="trivia"?null:letters[crypto.randomInt(26)];
 broadcast(r,"round");r.timer=setTimeout(()=>endRound(r),r.mode==="trivia"?15000:30000)
}
wss.on("connection",ws=>ws.on("message",raw=>{
 let m;try{m=JSON.parse(raw)}catch{return}
 if(m.type==="create"){const code=crypto.randomBytes(4).toString("hex").slice(0,6).toUpperCase(),id=crypto.randomUUID(),r={code,hostId:id,mode:["classic","trivia","team"].includes(m.mode)?m.mode:"classic",status:"lobby",round:0,totalRounds:[5,10,15].includes(+m.totalRounds)?+m.totalRounds:10,players:new Map(),submissions:new Map(),results:null};r.players.set(id,{id,name:String(m.name||"Player").slice(0,18),score:0,submitted:false,ws});rooms.set(code,r);ws.room=code;ws.pid=id;send(ws,"joined",{room:snapshot(r),you:id});return}
 const r=rooms.get(ws.room),p=r&&r.players.get(ws.pid);if(!r||!p)return;
 if(m.type==="join"){if(r.status!=="lobby"||r.players.size>=8)return send(ws,"error",{message:"Room unavailable or full"});const id=crypto.randomUUID();r.players.set(id,{id,name:String(m.name||"Player").slice(0,18),score:0,submitted:false,ws});ws.room=r.code;ws.pid=id;send(ws,"joined",{room:snapshot(r),you:id});broadcast(r);return}
 if(m.type==="start"&&p.id===r.hostId&&r.status==="lobby"&&r.players.size>=2){r.round=0;r.players.forEach(x=>x.score=0);nextRound(r)}
 if(m.type==="submit"&&r.status==="playing"&&!p.submitted&&Date.now()<=r.deadline){const answer=m.answer;if(r.mode==="trivia"){if(!Number.isInteger(answer)||answer<0||answer>3)return;r.submissions.set(p.id,{id:p.id,name:p.name,answer,at:Date.now()})}else{const answers=cats.map((_,i)=>String((m.answers||[])[i]||"").trim().slice(0,60));r.submissions.set(p.id,{id:p.id,name:p.name,answers,at:Date.now()})}p.submitted=true;broadcast(r);if(r.submissions.size===r.players.size)endRound(r)}
 if(m.type==="next"&&p.id===r.hostId&&r.status==="results"){if(r.round>=r.totalRounds){r.status="finished";r.winner=[...r.players.values()].sort((a,b)=>b.score-a.score)[0]?.name;broadcast(r,"finished")}else nextRound(r)}
 if(m.type==="rematch"&&p.id===r.hostId&&r.status==="finished"){r.players.forEach(x=>x.score=0);r.round=0;nextRound(r)}
}));
const PORT=process.env.PORT||3000;server.listen(PORT,()=>console.log("A-Z Showdown listening on "+PORT));
