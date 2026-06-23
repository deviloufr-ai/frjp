import { useState, useEffect, useRef, useCallback } from "react";

// ── VOICE ENGINE ─────────────────────────────────────────
let audioUnlocked = false;
let pendingSpeak = null;

function stripForTTS(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1")
    .replace(/\([^)]*\)/g, "")
    .replace(/[^\x00-\x7FÀ-ÿ\s]/g, "")
    .replace(/[#>~`]/g, "").replace(/\s+/g, " ").trim();
}

function getBestFrenchVoice() {
  if (!window.speechSynthesis) return null;
  const v = window.speechSynthesis.getVoices();
  return v.find(x => x.name === "Google français")
    || v.find(x => x.name.toLowerCase().includes("french"))
    || v.find(x => x.lang === "fr-FR")
    || v.find(x => x.lang.startsWith("fr")) || null;
}

function unlockAudio() {
  if (audioUnlocked || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(" ");
  u.volume = 0; u.lang = "fr-FR";
  window.speechSynthesis.speak(u);
  audioUnlocked = true;
  if (pendingSpeak) {
    const { text, onStart, onEnd } = pendingSpeak;
    pendingSpeak = null;
    setTimeout(() => doSpeak(text, onStart, onEnd), 300);
  }
}

function doSpeak(text, onStart, onEnd) {
  if (!window.speechSynthesis) { if (onEnd) onEnd(); return; }
  window.speechSynthesis.cancel();
  const clean = stripForTTS(text);
  if (!clean) { if (onEnd) onEnd(); return; }
  const utter = new SpeechSynthesisUtterance(clean);
  utter.lang = "fr-FR"; utter.rate = 0.82; utter.pitch = 0.75; utter.volume = 1.0;
  const voice = getBestFrenchVoice();
  if (voice) utter.voice = voice;
  utter.onstart = () => { if (onStart) onStart(); };
  utter.onend = () => { if (onEnd) onEnd(); };
  utter.onerror = () => { if (onEnd) onEnd(); };
  window.speechSynthesis.speak(utter);
  setTimeout(() => { if (window.speechSynthesis.speaking) window.speechSynthesis.resume(); }, 150);
}

function speakFrench(text, onStart, onEnd) {
  if (!window.speechSynthesis) { if (onEnd) onEnd(); return; }
  if (!audioUnlocked) { pendingSpeak = { text, onStart, onEnd }; return; }
  doSpeak(text, onStart, onEnd);
}

function stopAudio() {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  pendingSpeak = null;
}

// ── LEVELS ────────────────────────────────────────────────
const LEVELS = [
  {
    id: 1, name: "Débutant", jp: "初心者", icon: "🌱", xpRequired: 0, xpReward: 20,
    color: "#4CAF50", maxTurns: 3, theme: "Salutations",
    description: "Dire bonjour et se présenter",
    systemSuffix: `
NIVEAU 1 — 3 échanges max.
Tour 1 : Dis "Bonjour !" et demande-lui de répéter.
Tour 2 : Dis "Je m'appelle Tokiya." et demande son prénom.
Tour 3 : Félicite et enseigne "Enchanté(e) !". Termine la session.
Réponds en 1-2 phrases courtes. Attends qu'elle parle.`,
  },
  {
    id: 2, name: "Novice", jp: "初級", icon: "🌸", xpRequired: 40, xpReward: 25,
    color: "#E91E8C", maxTurns: 4, theme: "Comment ça va ?",
    description: "Demander et répondre à des questions basiques",
    systemSuffix: `
NIVEAU 2 — 4 échanges max.
Objectif : "Comment ça va ?" / "Ça va bien, merci !"
Guide-la étape par étape. 1-2 phrases par message. Fais-la parler.`,
  },
  {
    id: 3, name: "Apprenti", jp: "中級", icon: "⭐", xpRequired: 100, xpReward: 30,
    color: "#FF9800", maxTurns: 5, theme: "J'aime / Je n'aime pas",
    description: "Exprimer ses goûts avec anime et jeux vidéo",
    systemSuffix: `
NIVEAU 3 — 5 échanges. Objectif : "J'aime/J'adore/Je n'aime pas + nom".
Utilise anime et jeux comme exemples. Corrige le genre des noms.`,
  },
  {
    id: 4, name: "Intermédiaire", jp: "上級", icon: "💫", xpRequired: 200, xpReward: 40,
    color: "#9C27B0", maxTurns: 6, theme: "Ma journée",
    description: "Raconter au passé composé",
    systemSuffix: `
NIVEAU 4 — 6 échanges. Objectif : passé composé (j'ai + participe / je suis allé(e)).
Utilise le contexte UtaPri. Corrige les auxiliaires et accords.`,
  },
  {
    id: 5, name: "Avancé", jp: "上達", icon: "🏆", xpRequired: 350, xpReward: 50,
    color: "#F44336", maxTurns: 8, theme: "Conversation libre",
    description: "Discussion naturelle avec connecteurs",
    systemSuffix: `
NIVEAU 5 — 8 échanges. Conversation naturelle avec parce que/donc/mais.
Pousse à argumenter ses opinions. Reste dans le personnage.`,
  },
];

const IDOLS = [
  { id: "tokiya", name: "Tokiya", color: "#6B7FD7", emoji: "🎵",
    personality: "perfectionniste et sérieux, légèrement distant mais bienveillant" },
  { id: "otoya",  name: "Otoya",  color: "#E05C5C", emoji: "🎸",
    personality: "chaleureux, enthousiaste, toujours positif et encourageant" },
  { id: "masato", name: "Masato", color: "#4A90C4", emoji: "🎹",
    personality: "formel, rigoureux, méthodique" },
  { id: "ren",    name: "Ren",    color: "#D4A017", emoji: "✨",
    personality: "charmeur, romantique — dit que le français est la langue de l'amour" },
];

function buildSystem(idol, level, turn) {
  return `Tu es ${idol.name} d'Uta no Prince-sama — ${idol.personality}.
Tu enseignes le français à une fan japonaise (anime, jeux vidéo, UtaPri).
RÈGLES : texte plain sans markdown, japonais entre parenthèses pour les mots nouveaux,
corriger doucement, faire parler l'élève, messages courts.
Échange ${turn}/${level.maxTurns}.${turn >= level.maxTurns ? " Dernier échange : félicite et résume en 1 phrase." : ""}
${level.systemSuffix}`;
}

function renderText(text) {
  return text.split("\n").map((line, i, arr) => (
    <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
  ));
}

function loadProgress() {
  try {
    const s = localStorage.getItem("utapri_v2");
    return s ? JSON.parse(s) : { xp: 0, unlocked: [1] };
  } catch { return { xp: 0, unlocked: [1] }; }
}
function saveProgress(p) {
  try { localStorage.setItem("utapri_v2", JSON.stringify(p)); } catch {}
}

// ── APP ───────────────────────────────────────────────────
export default function FrenchApp() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [screen, setScreen] = useState("home");
  const [idol, setIdol] = useState(IDOLS[0]);
  const [progress, setProgress] = useState(loadProgress);
  const [activeLevel, setActiveLevel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [turnCount, setTurnCount] = useState(0);
  const [sessionDone, setSessionDone] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);
  const [sessionXP, setSessionXP] = useState(0);
  const [micAvailable, setMicAvailable] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");

  const recognitionRef = useRef(null);
  const chatEndRef = useRef(null);
  const ac = idol.color;

  useEffect(() => {
    // Check if SpeechRecognition is available (requires HTTPS or localhost)
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setMicAvailable(!!SR);

    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
    return () => stopAudio();
  }, []);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const speak = useCallback((text, id) => {
    setSpeakingId(id);
    speakFrench(text, () => setSpeaking(true), () => { setSpeaking(false); setSpeakingId(null); });
  }, []);

  const handleUnlock = useCallback(() => {
    unlockAudio();
    setIsUnlocked(true);
  }, []);

  const startSession = useCallback(async (level) => {
    setActiveLevel(level);
    setMessages([]);
    setTurnCount(0);
    setSessionDone(false);
    setSessionXP(0);
    setInput("");
    setInterimText("");
    setScreen("session");
    setLoading(true);
    try {
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: buildSystem(idol, level, 0),
          messages: [{ role: "user", content: "Commence." }],
        }),
      });
      const data = await res.json();
      const reply = data.content?.find(b => b.type === "text")?.text || "Bonjour !";
      const msg = { role: "idol", text: reply, id: Date.now() };
      setMessages([msg]);
      setLoading(false);
      speak(reply, msg.id);
    } catch {
      const msg = { role: "idol", text: "Bonjour ! Commençons !", id: Date.now() };
      setMessages([msg]);
      setLoading(false);
      speak(msg.text, msg.id);
    }
  }, [idol, speak]);

  const sendMessage = useCallback(async (text) => {
    const txt = (text || input).trim();
    if (!txt || loading || sessionDone) return;
    setInput(""); setInterimText("");
    const newTurn = turnCount + 1;
    setTurnCount(newTurn);
    const userMsg = { role: "user", text: txt, id: Date.now() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);
    const isLast = newTurn >= activeLevel.maxTurns;
    try {
      const history = newMessages.slice(-20).map(m => ({
        role: m.role === "user" ? "user" : "assistant", content: m.text,
      }));
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6", max_tokens: 1000,
          system: buildSystem(idol, activeLevel, newTurn),
          messages: history,
        }),
      });
      const data = await res.json();
      const reply = data.content?.find(b => b.type === "text")?.text || "...";
      const idolMsg = { role: "idol", text: reply, id: Date.now() + 1 };
      setMessages([...newMessages, idolMsg]);
      setLoading(false);
      speak(reply, idolMsg.id);
      if (isLast) {
        const earned = activeLevel.xpReward + newTurn * 3;
        setSessionXP(earned);
        const newXP = progress.xp + earned;
        const newUnlocked = [...progress.unlocked];
        LEVELS.forEach(l => { if (newXP >= l.xpRequired && !newUnlocked.includes(l.id)) newUnlocked.push(l.id); });
        const np = { xp: newXP, unlocked: newUnlocked };
        setProgress(np); saveProgress(np);
        setTimeout(() => setSessionDone(true), 2500);
      }
    } catch {
      setMessages(prev => [...prev, { role: "idol", text: "Désolé, réessaie !", id: Date.now() + 1 }]);
      setLoading(false);
    }
  }, [input, loading, sessionDone, messages, turnCount, activeLevel, idol, speak, progress]);

  // ── SPEECH RECOGNITION ────────────────────────────────
  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    stopAudio(); setSpeaking(false);
    const r = new SR();
    r.lang = "fr-FR";
    r.interimResults = true;
    r.continuous = false;
    recognitionRef.current = r;
    r.onstart = () => { setIsListening(true); setInterimText(""); };
    r.onend = () => { setIsListening(false); setInterimText(""); recognitionRef.current = null; };
    r.onerror = () => { setIsListening(false); setInterimText(""); recognitionRef.current = null; };
    r.onresult = (e) => {
      const transcript = Array.from(e.results).map(x => x[0].transcript).join("");
      setInterimText(transcript);
      if (e.results[e.results.length - 1].isFinal) {
        r.stop();
        setInterimText("");
        setTimeout(() => { if (transcript.trim()) sendMessage(transcript.trim()); }, 100);
      }
    };
    r.start();
  }, [sendMessage]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
    setIsListening(false); setInterimText("");
  }, []);

  // XP bar
  const nextLevel = LEVELS.find(l => l.xpRequired > progress.xp);
  const prevXP = nextLevel ? (LEVELS[nextLevel.id - 2]?.xpRequired || 0) : LEVELS[4].xpRequired;
  const xpPct = nextLevel ? ((progress.xp - prevXP) / (nextLevel.xpRequired - prevXP)) * 100 : 100;

  // ══════════════════════════════════════════════════════
  // SPLASH
  // ══════════════════════════════════════════════════════
  if (!isUnlocked) return (
    <div onClick={handleUnlock} style={{
      minHeight:"100vh", background:"linear-gradient(160deg,#1a0a2e 0%,#2d1b4e 50%,#1a0a2e 100%)",
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      fontFamily:"'Segoe UI',sans-serif", color:"#fff", cursor:"pointer", textAlign:"center", padding:32,
    }}>
      <div style={{ fontSize:72, marginBottom:24 }}>🎵</div>
      <h1 style={{ fontSize:26, fontWeight:800, margin:"0 0 8px",
        background:"linear-gradient(90deg,#f0c4ff,#ffd6e7,#c4d8ff)",
        WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
        フランス語レッスン
      </h1>
      <div style={{ color:"#d4b0ff", fontSize:14, marginBottom:48 }}>Uta no Prince-sama</div>
      <div style={{
        background:`linear-gradient(135deg,${IDOLS[0].color},${IDOLS[0].color}aa)`,
        borderRadius:28, padding:"20px 40px", fontSize:18, fontWeight:700,
        animation:"pulse 2s ease-in-out infinite",
      }}>タップして始める 🔊</div>
      <div style={{ color:"#7a5a9a", fontSize:12, marginTop:20 }}>Appuie pour activer le son</div>
      <style>{`@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}`}</style>
    </div>
  );

  // ══════════════════════════════════════════════════════
  // HOME
  // ══════════════════════════════════════════════════════
  if (screen === "home") return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(160deg,#1a0a2e 0%,#2d1b4e 100%)",
      fontFamily:"'Segoe UI',sans-serif", color:"#fff", paddingBottom:32 }}>
      <div style={{ padding:"28px 20px 16px", textAlign:"center" }}>
        <div style={{ fontSize:11, letterSpacing:4, color:"#c9a0ff", textTransform:"uppercase", marginBottom:4 }}>✦ Uta no Prince-sama ✦</div>
        <h1 style={{ fontSize:24, fontWeight:800, margin:"0 0 16px",
          background:"linear-gradient(90deg,#f0c4ff,#ffd6e7,#c4d8ff)",
          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
          フランス語レッスン
        </h1>
        {/* XP bar */}
        <div style={{ background:"rgba(255,255,255,0.06)", borderRadius:14, padding:"12px 16px", marginBottom:8 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6, fontSize:12 }}>
            <span>⭐ {progress.xp} XP</span>
            {nextLevel && <span style={{ color:"#c9a0ff" }}>→ Niv.{nextLevel.id} : {nextLevel.xpRequired} XP</span>}
          </div>
          <div style={{ background:"rgba(255,255,255,0.1)", borderRadius:8, height:7 }}>
            <div style={{ height:"100%", width:`${Math.min(xpPct,100)}%`,
              background:`linear-gradient(90deg,${ac},#c9a0ff)`, borderRadius:8, transition:"width .5s" }} />
          </div>
        </div>
        {/* Mic warning if not HTTPS */}
        {!micAvailable && (
          <div style={{ background:"rgba(255,160,0,0.15)", border:"1px solid rgba(255,160,0,0.3)",
            borderRadius:12, padding:"8px 14px", fontSize:12, color:"#ffb74d", marginBottom:8 }}>
            ⚠️ Micro non disponible en fichier local.<br/>
            Déploie sur <strong>Netlify</strong> pour activer la voix.<br/>
            <span style={{ color:"#a0a0a0" }}>Tu peux écrire tes réponses en attendant.</span>
          </div>
        )}
      </div>
      {/* Idol picker */}
      <div style={{ padding:"0 20px 16px" }}>
        <div style={{ fontSize:11, color:"#c9a0ff", marginBottom:8, textAlign:"center" }}>Professeur</div>
        <div style={{ display:"flex", gap:8, overflowX:"auto" }}>
          {IDOLS.map(i => (
            <button key={i.id} onClick={() => setIdol(i)} style={{
              flexShrink:0, borderRadius:14, padding:"10px 14px",
              border:`2px solid ${idol.id===i.id ? i.color : "transparent"}`,
              background: idol.id===i.id ? `${i.color}33` : "rgba(255,255,255,0.06)",
              cursor:"pointer", textAlign:"center", minWidth:68,
            }}>
              <div style={{ fontSize:22, marginBottom:3 }}>{i.emoji}</div>
              <div style={{ fontSize:11, color:"#fff", fontWeight: idol.id===i.id ? 700 : 400 }}>{i.name}</div>
            </button>
          ))}
        </div>
      </div>
      {/* Levels */}
      <div style={{ padding:"0 20px" }}>
        <div style={{ fontSize:11, color:"#c9a0ff", marginBottom:10, textAlign:"center" }}>NIVEAUX</div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {LEVELS.map(level => {
            const unlocked = progress.unlocked.includes(level.id);
            return (
              <button key={level.id} onClick={() => unlocked && startSession(level)} disabled={!unlocked}
                style={{
                  background: unlocked ? `linear-gradient(135deg,${level.color}22,${level.color}11)` : "rgba(255,255,255,0.03)",
                  border:`1px solid ${unlocked ? level.color+"44" : "rgba(255,255,255,0.07)"}`,
                  borderRadius:16, padding:"14px 16px", cursor: unlocked ? "pointer" : "default",
                  display:"flex", alignItems:"center", gap:12, textAlign:"left", opacity: unlocked ? 1 : 0.45,
                }}>
                <div style={{ fontSize:26 }}>{unlocked ? level.icon : "🔒"}</div>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2 }}>
                    <span style={{ color:"#fff", fontWeight:700, fontSize:14 }}>Niv.{level.id} — {level.name}</span>
                    <span style={{ fontSize:10, color:level.color, background:`${level.color}22`,
                      borderRadius:8, padding:"1px 7px" }}>{level.jp}</span>
                  </div>
                  <div style={{ color:"#c9a0ff", fontSize:12 }}>{level.description}</div>
                  <div style={{ color:"#7a5a9a", fontSize:11, marginTop:2 }}>
                    {unlocked ? `${level.maxTurns} échanges · +${level.xpReward} XP` : `Requis : ${level.xpRequired} XP`}
                  </div>
                </div>
                {unlocked && <div style={{ color:level.color, fontSize:18 }}>›</div>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════
  // SESSION
  // ══════════════════════════════════════════════════════
  if (screen === "session" && activeLevel) {
    const pct = Math.round((turnCount / activeLevel.maxTurns) * 100);
    const lastMsg = messages[messages.length - 1];
    const waitingForUser = !loading && lastMsg?.role === "idol" && !sessionDone;

    return (
      <div style={{ height:"100vh", background:"linear-gradient(160deg,#1a0a2e 0%,#2d1b4e 100%)",
        color:"#fff", fontFamily:"'Segoe UI',sans-serif", display:"flex", flexDirection:"column" }}>

        {/* Header */}
        <div style={{ padding:"12px 16px", borderBottom:"1px solid rgba(255,255,255,0.08)",
          display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
          <button onClick={() => { stopAudio(); setScreen("home"); }} style={{
            background:"none", border:"none", color:"#c9a0ff", fontSize:22, cursor:"pointer" }}>←</button>
          <div style={{ fontSize:22 }}>{idol.emoji}</div>
          <div style={{ flex:1 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontWeight:700, fontSize:14 }}>{idol.name}</span>
              <span style={{ fontSize:10, color:activeLevel.color, background:`${activeLevel.color}22`,
                borderRadius:8, padding:"2px 7px" }}>{activeLevel.icon} Niv.{activeLevel.id}</span>
            </div>
            <div style={{ fontSize:11, color:"#c9a0ff" }}>{activeLevel.theme}</div>
          </div>
          <div style={{ fontSize:12, color:"#7a5a9a" }}>{turnCount}/{activeLevel.maxTurns}</div>
        </div>

        {/* Progress */}
        <div style={{ height:3, background:"rgba(255,255,255,0.08)", flexShrink:0 }}>
          <div style={{ height:"100%", width:`${pct}%`,
            background:`linear-gradient(90deg,${activeLevel.color},#c9a0ff)`, transition:"width .4s" }} />
        </div>

        {/* Messages */}
        <div style={{ flex:1, overflowY:"auto", padding:"14px 16px",
          display:"flex", flexDirection:"column", gap:10 }}>
          {messages.map(msg => (
            <div key={msg.id} style={{ display:"flex",
              justifyContent: msg.role==="user" ? "flex-end" : "flex-start",
              alignItems:"flex-end", gap:6 }}>
              {msg.role==="idol" && <div style={{ fontSize:18, flexShrink:0 }}>{idol.emoji}</div>}
              <div style={{ maxWidth:"82%", display:"flex", flexDirection:"column",
                alignItems: msg.role==="user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  padding:"10px 14px",
                  borderRadius: msg.role==="user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  background: msg.role==="user"
                    ? `linear-gradient(135deg,${ac},${ac}bb)` : "rgba(255,255,255,0.1)",
                  fontSize:14, lineHeight:1.55,
                }}>
                  {renderText(msg.text)}
                </div>
                {msg.role==="idol" && (
                  <button onClick={() => speak(msg.text, msg.id)} style={{
                    marginTop:3, background:"none", border:"none",
                    color: speakingId===msg.id ? ac : "#7a5a9a",
                    cursor:"pointer", fontSize:11, paddingLeft:2,
                  }}>
                    {speakingId===msg.id ? "🔊 lecture..." : "🔁 répéter"}
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Interim voice text */}
          {interimText && (
            <div style={{ display:"flex", justifyContent:"flex-end" }}>
              <div style={{ maxWidth:"82%", padding:"10px 14px", borderRadius:"18px 18px 4px 18px",
                background:"rgba(255,255,255,0.05)", border:`1px dashed ${ac}66`,
                fontSize:14, color:"rgba(255,255,255,0.6)", fontStyle:"italic" }}>
                {interimText}...
              </div>
            </div>
          )}

          {loading && (
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ fontSize:18 }}>{idol.emoji}</div>
              <div style={{ background:"rgba(255,255,255,0.08)", borderRadius:18,
                padding:"10px 16px", display:"flex", gap:5, alignItems:"center" }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ width:7, height:7, borderRadius:"50%", background:ac,
                    animation:`bounce 1s ease-in-out ${i*0.2}s infinite` }} />
                ))}
              </div>
            </div>
          )}

          {sessionDone && (
            <div style={{ textAlign:"center", padding:"20px 16px",
              background:"rgba(255,255,255,0.04)", borderRadius:20, margin:"8px 0" }}>
              <div style={{ fontSize:48, marginBottom:8 }}>🌟</div>
              <div style={{ fontSize:18, fontWeight:700, marginBottom:4 }}>Session terminée !</div>
              <div style={{ color:activeLevel.color, fontSize:24, fontWeight:800, marginBottom:4 }}>
                +{sessionXP} XP
              </div>
              <div style={{ color:"#c9a0ff", fontSize:13, marginBottom:16 }}>よくできました！</div>
              <button onClick={() => setScreen("home")} style={{
                background:`linear-gradient(135deg,${ac},${ac}aa)`,
                border:"none", borderRadius:20, padding:"12px 28px",
                color:"#fff", fontSize:15, fontWeight:700, cursor:"pointer",
              }}>Voir ma progression →</button>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input bar */}
        {!sessionDone && (
          <div style={{ padding:"8px 16px 24px", flexShrink:0 }}>
            {/* Prompt hint */}
            {waitingForUser && (
              <div style={{ textAlign:"center", fontSize:12, color:"#7a5a9a", marginBottom:8 }}>
                {micAvailable ? "🎙️ Appuie sur le micro et réponds en français !" : "✏️ Écris ta réponse en français"}
              </div>
            )}

            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              {/* Mic button — only shown if HTTPS */}
              {micAvailable && (
                <button onClick={isListening ? stopListening : startListening} disabled={loading}
                  style={{
                    width:52, height:52, borderRadius:26, border:"none", flexShrink:0,
                    background: isListening
                      ? "linear-gradient(135deg,#e05c5c,#c0392b)"
                      : `linear-gradient(135deg,${ac},${ac}bb)`,
                    boxShadow: isListening ? "0 0 20px #e05c5c88" : `0 0 12px ${ac}44`,
                    color:"#fff", cursor:"pointer", fontSize:22,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    animation: isListening ? "micpulse 1s ease-in-out infinite" : "none",
                  }}>
                  {isListening ? "⏹" : "🎙️"}
                </button>
              )}

              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key==="Enter" && sendMessage()}
                placeholder={isListening ? "J'écoute... 🎙️" : "Écris ta réponse en français..."}
                style={{
                  flex:1, background:"rgba(255,255,255,0.07)",
                  border:`1px solid ${isListening ? "#e05c5c55" : "rgba(255,255,255,0.12)"}`,
                  borderRadius:24, padding:"12px 16px", color:"#fff", fontSize:14, outline:"none",
                }}
              />

              <button onClick={() => sendMessage()} disabled={loading || !input.trim()} style={{
                width:46, height:46, borderRadius:23, border:"none",
                background: input.trim() ? `linear-gradient(135deg,${ac},${ac}bb)` : "rgba(255,255,255,0.08)",
                color:"#fff", cursor:"pointer", fontSize:17, flexShrink:0,
                display:"flex", alignItems:"center", justifyContent:"center",
              }}>➤</button>
            </div>

            {/* Netlify deploy hint when no mic */}
            {!micAvailable && (
              <div style={{ textAlign:"center", marginTop:8, fontSize:11, color:"#5a4a7a" }}>
                Pour activer le micro → déploie sur netlify.com/drop
              </div>
            )}
          </div>
        )}

        <style>{`
          @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
          @keyframes micpulse{0%,100%{box-shadow:0 0 12px #e05c5c88}50%{box-shadow:0 0 28px #e05c5ccc}}
        `}</style>
      </div>
    );
  }

  return null;
}
