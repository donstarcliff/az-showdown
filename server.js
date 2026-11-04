
const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
app.use(express.static("public"));
app.get("/health", (_, res) => res.json({ ok: true, app: "A-Z Showdown" }));

const rooms = new Map();
const ROUND_SECONDS = 60;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const CATEGORIES = ["Name", "Animal", "Place", "Food", "Thing"];
const GENERAL_WORDS = new Set(fs.readFileSync(path.join(__dirname, "node_modules", "word-list", "words.txt"), "utf8")
  .split(/\r?\n/)
  .map(normalizeDictionaryWord)
  .filter(Boolean));
const WORD_DICTIONARY = {
  Name: [
    "abigail","ada","adanna","ade","adekunle","adekemi","adeola","adesuwa","adunni","aisha","amara",
    "amina","ayodele","blessing","chinedu","chidi","chioma","daniel","ebuka","emeka","femi","folake",
    "funke","halima","ibrahim","ifeanyi","ifeyinwa","ifeoluwa","james","kemi","kunle","mary","moses",
    "ngozi","nneka","obi","obinna","olamide","oluwaseun","oluwatoyin","onome","segun","suleiman",
    "tunde","uche","victor","yemi","zainab","zara","john","michael","fatima","grace","david","sarah",
    "ayo","babatunde","babajide","bamidele","bola","bose","bukola","bunmi","chukwudi","chukwuka",
    "ekene","ekemini","eze","gbenga","iyabo","iyke","jide","kofoworola","lola","modupe","moyinoluwa",
    "nnamdi","nnenna","nonso","olabisi","olakunle","oluchi","onyeka","osaze","ronke","shade","shola",
    "taiwo","temitope","tolulope","tope","wuraola","yakubu","yetunde"
  ],
  Animal: [
    "ant","antelope","ape","badger","bat","bear","beaver","bee","buffalo","cat","camel","cheetah",
    "chicken","chimpanzee","cow","crocodile","dog","dolphin","duck","eagle","elephant","fish","fox",
    "frog","goat","gorilla","horse","hyena","kangaroo","lion","lizard","monkey","mouse","octopus",
    "owl","panda","pig","rabbit","rat","shark","sheep","snake","tiger","tortoise","turtle","whale","zebra",
    "grasscutter","bushbaby","groundhog","aardvark","wild dog","monitor lizard","pangolin","python",
    "alligator","alpaca","antelope","baboon","boar","bison","bull","butterfly","deer","donkey",
    "ferret","flamingo","gazelle","giraffe","goose","hedgehog","hippopotamus","hornbill","hyena",
    "iguana","jackal","jaguar","koala","leopard","mongoose","mosquito","orangutan","ostrich","panther",
    "parrot","peacock","penguin","porcupine","raccoon","reindeer","rhinoceros","seal","snail","spider",
    "squirrel","swan","walrus","wolf","woodpecker","warthog","vulture"
  ],
  Place: [
    "abuja","abia","adamawa","akwa ibom","benue","borno","delta","edo","enugu","gombe","imo","jigawa",
    "kaduna","kano","katsina","kebbi","kogi","kwara","lagos","nasarawa","niger","ogun","ondo","osun","oyo",
    "plateau","rivers","sokoto","taraba","yobe","zamfara","accra","africa","america","china","egypt",
    "ghana","india","japan","kenya","london","nigeria","paris","south africa","united kingdom",
    "benin city","calabar","enugu","ibadan","ilorin","jos","maiduguri","minna","port harcourt","uyo",
    "abeokuta","aba","awka","bauchi","birnin kebbi","damaturu","dutse","asaba","jalingo","makurdi",
    "owerri","suleja","warri","yola","australia","brazil","cameroon","canada","france","germany",
    "ireland","italy","mali","mexico","morocco","namibia","new york","niger republic","scotland",
    "spain","togo","uganda","zimbabwe"
  ],
  Food: [
    "apple","amala","banana","beans","bread","burger","cake","cheese","chicken","chin chin","coconut",
    "cucumber","dodo","eba","egusi","fish","fried rice","garri","groundnut","jollof rice","kilishi",
    "moi moi","noodles","ofada rice","okpa","onion","okra soup","pounded yam","rice","salad","samosa",
    "soup","suya","tuwo","ugali","yam","zobo","mango","orange","pasta","pizza",
    "akara","abacha","agidi","aji","banga soup","bean cake","bitter leaf soup","coconut rice","corn",
    "cornmeal","edikaikong","ewa agoyin","fufu","fish pepper soup","fried plantain","kunu","masa",
    "nkwobi","ogbono soup","pepper soup","plantain","porridge","stew","wheat","white soup"
  ],
  Thing: [
    "alarm","bag","bicycle","bottle","book","box","chair","clock","computer","cup","door","fan","hat",
    "house","key","lamp","mirror","phone","radio","shoe","spoon","table","telephone","television","watch",
    "calabash","guitar","mat","pot","umbrella","wrapper","ankara","island","broom","bucket","plate","vase",
    "basket","bed","blanket","blender","brush","camera","candle","clothes","cushion","desk","drum",
    "engine","fork","fridge","frying pan","generator","glass","iron","knife","ladder","laptop",
    "market","mop","needle","oven","pillow","rug","scissors","socket","stove","towel","wallet"
  ]
};
function normalizeDictionaryWord(s) {
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase().replace(/[^\p{L}\p{N} ]/gu, "").replace(/\s+/g, " ").trim();
}
function recognizedWord(answer, category) {
  const word = normalizeDictionaryWord(answer);
  const categoryName = CATEGORIES[category];
  const curated = WORD_DICTIONARY[categoryName].map(normalizeDictionaryWord).includes(word);
  if (curated) return true;
  if (!word || word.length > 40) return false;
  if (/[^a-z ]/.test(word)) return false;
  if (categoryName === "Name") return /^[a-z][a-z'-]{1,39}$/i.test(answer.trim());
  const words = word.split(" ");
  if (categoryName === "Food" || categoryName === "Thing") {
    return words.every(part => GENERAL_WORDS.has(part));
  }
  if (categoryName === "Place") {
    return words.every(part => GENERAL_WORDS.has(part) || /^[a-z]+(land|stan|burg|shire|ville|polis|grad|abad|garh|pur|ton|ford|port|town)$/.test(part));
  }
  if (categoryName === "Animal") {
    return words.every(part => GENERAL_WORDS.has(part)) ||
      /(fish|bird|cat|dog|eagle|lion|ox|ape|bull|seal|worm|rat|hog|horse|bear|deer|moth|bee|bat)$/.test(word);
  }
  return false;
}
const TRIVIA = [
  ["Which planet is known as the Red Planet?", ["Venus","Mars","Jupiter","Mercury"], 1, "Science"],
  ["What is the capital of Ghana?", ["Accra","Lagos","Dakar","Lomé"], 0, "Geography"],
  ["How many sides does a hexagon have?", ["Five","Six","Seven","Eight"], 1, "General knowledge"],
  ["Which ocean is the largest?", ["Atlantic","Indian","Arctic","Pacific"], 3, "Geography"],
  ["Who wrote 'Romeo and Juliet'?", ["Charles Dickens","William Shakespeare","Jane Austen","Chinua Achebe"], 1, "Literature"],
  ["What gas do plants absorb from the atmosphere?", ["Oxygen","Nitrogen","Carbon dioxide","Hydrogen"], 2, "Science"],
  ["Which country hosted the 2016 Summer Olympics?", ["China","Brazil","Japan","UK"], 1, "Sports"],
  ["What is the chemical symbol for gold?", ["Ag","Gd","Au","Go"], 2, "Science"],
  ["Which is the smallest prime number?", ["0","1","2","3"], 2, "Math"],
  ["In football, how many players from one team are on the pitch at kickoff?", ["9","10","11","12"], 2, "Sports"],
  ["Which continent is the Sahara Desert in?", ["Asia","Africa","Australia","South America"], 1, "Geography"],
  ["What is the fastest land animal?", ["Lion","Cheetah","Horse","Leopard"], 1, "Nature"],
  ["Which instrument has keys, pedals and strings?", ["Violin","Flute","Piano","Drum"], 2, "Arts"],
  ["What is the boiling point of water at sea level in °C?", ["50","75","100","125"], 2, "Science"],
  ["Which Nigerian city is known as the Centre of Excellence state's capital?", ["Abuja","Lagos","Kano","Enugu"], 1, "Geography"]
];

function code() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  do { out = Array.from({length:6}, () => chars[crypto.randomInt(chars.length)]).join(""); }
  while (rooms.has(out));
  return out;
}
function cleanName(s) { return String(s || "").trim().slice(0,18) || "Player"; }
function publicRoom(room) {
  return {
    code: room.code, hostId: room.hostId, mode: room.mode, status: room.status,
    round: room.round, totalRounds: room.totalRounds, letter: room.letter,
    deadline: room.deadline, triviaQuestion: room.triviaQuestion ? {
      question: room.triviaQuestion[0], options: room.triviaQuestion[1], category: room.triviaQuestion[3]
    } : null,
    players: [...room.players.values()].map(p => ({
      id:p.id, name:p.name, score:p.score, team:p.team, connected:p.connected, submitted:p.submitted
    })),
    teams: room.teams, results: room.results, winner: room.winner,
    settings: { totalRounds: room.totalRounds, timer: ROUND_SECONDS }
  };
}
function send(ws, type, payload={}) {
  if (ws.readyState === 1) ws.send(JSON.stringify({type, ...payload}));
}
function broadcast(room, type="state") {
  const state = publicRoom(room);
  for (const p of room.players.values()) if (p.ws && p.ws.readyState === 1) send(p.ws, type, {room:state, you:p.id});
}
function roomOf(ws) { return ws.roomCode && rooms.get(ws.roomCode); }
function playerOf(room, ws) { return room && room.players.get(ws.playerId); }
function startRound(room) {
  clearTimeout(room.timer);
  room.round++;
  room.results = null;
  room.winner = null;
  room.submissions = new Map();
  room.players.forEach(p => { p.submitted = false; });
  room.status = "playing";
  room.deadline = Date.now() + ROUND_SECONDS * 1000;
  if (room.mode === "trivia") {
    room.triviaQuestion = TRIVIA[(room.round - 1) % TRIVIA.length];
    room.letter = null;
  } else {
    room.letter = LETTERS[crypto.randomInt(LETTERS.length)];
    room.triviaQuestion = null;
  }
  broadcast(room, "round");
  room.timer = setTimeout(() => finishRound(room), ROUND_SECONDS * 1000);
}
function randomLetter(room) {
  if (!room || room.status !== "playing" || room.mode === "trivia") return;
  let letter;
  do { letter = LETTERS[crypto.randomInt(LETTERS.length)]; } while (letter === room.letter && LETTERS.length > 1);
  room.letter = letter;
  room.submissions.clear();
  room.players.forEach(p => { p.submitted = false; });
  broadcast(room, "round");
}
function normalize(s) { return String(s || "").trim().toLocaleLowerCase().replace(/\s+/g," "); }
function finishRound(room) {
  if (!room || room.status !== "playing") return;
  clearTimeout(room.timer);
  const submissions = [...room.submissions.values()];
  const resultRows = [];
  if (room.mode === "trivia") {
    const q = room.triviaQuestion;
    const correct = submissions.filter(s => s.answer === q[2]).sort((a,b)=>a.at-b.at);
    const fastest = correct[0];
    for (const p of room.players.values()) {
      const s = room.submissions.get(p.id);
      let points = s && s.answer === q[2] ? 10 + (fastest && fastest.id === p.id ? 5 : 0) : 0;
      p.score += points;
      resultRows.push({playerId:p.id, name:p.name, answer:s ? q[1][s.answer] : "No answer", correct:!!s && s.answer===q[2], points, total:p.score});
    }
  } else {
    for (let c=0;c<CATEGORIES.length;c++) {
      const entries = submissions.map(s => ({id:s.id,name:s.name,answer:s.answers[c],at:s.at}))
        .filter(s => normalize(s.answer));
      const groups = new Map();
      for (const e of entries) {
        const key = normalize(e.answer);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(e);
      }
      const uniqueEntries = [];
      for (const group of groups.values()) {
        if (group.length > 1) {
          for (const e of group) uniqueEntries.push({...e, points:-10, outcome:"duplicate"});
        } else {
          uniqueEntries.push({...group[0], points:0, outcome:"unique"});
        }
      }
      const validUnique = uniqueEntries.filter(e => e.outcome==="unique"
        && recognizedWord(e.answer,c)
        && e.answer.trim().toUpperCase().startsWith(room.letter));
      validUnique.sort((a,b)=>a.at-b.at);
      validUnique.forEach((e,i)=>{ e.points = i===0 ? 25 : i===1 ? 10 : 5; });
      for (const e of uniqueEntries) {
        const p = room.players.get(e.id);
        if (p) p.score += e.points;
        const recognized = recognizedWord(e.answer,c);
        resultRows.push({category:CATEGORIES[c], playerId:e.id, name:e.name, answer:e.answer,
          points:e.points, outcome:e.outcome==="duplicate"?"duplicate":(!recognized?"not-in-dictionary":(e.points===0?"wrong-letter":"unique")),
          rank:e.outcome==="unique" && e.points>0 ? validUnique.findIndex(x=>x.id===e.id)+1 : null});
      }
    }
    for (const p of room.players.values()) {
      if (!submissions.some(s=>s.id===p.id)) resultRows.push({playerId:p.id,name:p.name,answer:"No submission",points:0,outcome:"no-submit"});
    }
  }
  room.results = resultRows;
  room.status = "results";
  room.deadline = null;
  broadcast(room, "results");
}
function startMatch(room) {
  room.round = 0;
  room.players.forEach(p => { p.score=0; p.submitted=false; });
  room.teams = { A:0, B:0 };
  const list = [...room.players.values()];
  list.forEach((p,i)=>p.team = room.mode==="team" ? (i%2===0?"A":"B") : null);
  startRound(room);
}
wss.on("connection", ws => {
  ws.on("message", raw => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    const room = roomOf(ws);
    if (msg.type === "create") {
      const id = crypto.randomUUID(), c = code();
      const r = {code:c,hostId:id,mode:["classic","trivia","team"].includes(msg.mode)?msg.mode:"classic",
        status:"lobby",round:0,totalRounds:[5,10,15].includes(Number(msg.totalRounds))?Number(msg.totalRounds):10,
        letter:null,deadline:null,players:new Map(),submissions:new Map(),results:null,teams:{A:0,B:0}};
      r.players.set(id,{id,name:cleanName(msg.name),score:0,team:null,connected:true,submitted:false,ws});
      rooms.set(c,r); ws.roomCode=c; ws.playerId=id;
      send(ws,"joined",{room:publicRoom(r),you:id});
    } else if (msg.type === "join") {
      const r=rooms.get(String(msg.code||"").toUpperCase());
      if (!r) return send(ws,"error",{message:"Room not found. Check the code and try again."});
      if (r.status!=="lobby") return send(ws,"error",{message:"This game has already started."});
      if (r.players.size>=8) return send(ws,"error",{message:"This room is full (8 players maximum)."});
      const id=crypto.randomUUID();
      r.players.set(id,{id,name:cleanName(msg.name),score:0,team:null,connected:true,submitted:false,ws});
      ws.roomCode=r.code; ws.playerId=id;
      send(ws,"joined",{room:publicRoom(r),you:id}); broadcast(r);
    } else if (room) {
      const p=playerOf(room,ws);
      if (!p) return;
      if (msg.type==="start") {
        if (p.id!==room.hostId) return send(ws,"error",{message:"Only the host can start."});
        if (room.status!=="lobby") return;
        if (room.players.size<2) return send(ws,"error",{message:"At least two players are required."});
        room.mode=["classic","trivia","team"].includes(msg.mode)?msg.mode:room.mode;
        room.totalRounds=[5,10,15].includes(Number(msg.totalRounds))?Number(msg.totalRounds):room.totalRounds;
        startMatch(room);
      } else if (msg.type==="submit" && room.status==="playing" && !p.submitted && Date.now()<=room.deadline) {
        if (room.mode==="trivia") {
          const answer=Number(msg.answer);
          if (!Number.isInteger(answer) || answer<0 || answer>3) return;
          room.submissions.set(p.id,{id:p.id,name:p.name,answer,at:Date.now()});
        } else {
          const answers=CATEGORIES.map((_,i)=>String((msg.answers||[])[i]||"").trim().slice(0,60));
          room.submissions.set(p.id,{id:p.id,name:p.name,answers,at:Date.now()});
        }
        p.submitted=true;
        broadcast(room);
        if (room.submissions.size===room.players.size) finishRound(room);
      } else if (msg.type==="next" && room.status==="results") {
        if (room.round>=room.totalRounds) {
          room.status="finished";
          const scores=[...room.players.values()].sort((a,b)=>b.score-a.score);
          room.winner=room.mode==="team" ? (scores.reduce((acc,p)=>{if(p.team)acc[p.team]+=p.score;return acc;},{A:0,B:0}).A >= scores.reduce((acc,p)=>{if(p.team)acc[p.team]+=p.score;return acc;},{A:0,B:0}).B ? "Team A":"Team B") : scores[0]?.name;
          broadcast(room,"finished");
        } else startRound(room);
      } else if (msg.type==="random-letter" && room.status==="playing" && p.id===room.hostId && room.mode!=="trivia") {
        randomLetter(room);
      } else if (msg.type==="rematch" && room.status==="finished" && p.id===room.hostId) {
        startMatch(room);
      }
    }
  });
  ws.on("close", () => {
    const r=roomOf(ws); if (!r) return;
    const p=playerOf(r,ws); if (p) { p.connected=false; p.ws=null; }
    if (r.status==="lobby" && p && p.id===r.hostId) {
      const next=[...r.players.values()].find(x=>x.connected);
      if (next) r.hostId=next.id;
    }
    broadcast(r);
  });
});
setInterval(() => {
  for (const [c,r] of rooms) {
    if (r.players.size===0 || (r.status==="lobby" && [...r.players.values()].every(p=>!p.connected))) rooms.delete(c);
  }
}, 60000).unref();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`A–Z Showdown running on port ${PORT}`));
