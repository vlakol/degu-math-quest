import { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabaseClient";
import "./App.css";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { mathTaskSchema } from "./schemas";
import { ValidatedInput } from "./components/ValidatedInput";
import { Auth } from "./components/Auth";
import confetti from "canvas-confetti";
import useSWR from "swr";
import { motion, AnimatePresence, useSpring, useTransform } from "framer-motion";

const getRandomPhrase = (phrasesArray) => {
  return phrasesArray[Math.floor(Math.random() * phrasesArray.length)];
};

const fetchPhrases = async () => {
  const { data, error } = await supabase.from("degu_phrases").select("*");
  if (error) throw error;
  return data.reduce((acc, row) => {
    if (!acc[row.category]) acc[row.category] = [];
    acc[row.category].push(row.phrase_text);
    return acc;
  }, {});
};

// --- AUDIO ENGINE ---
let audioCtx = null;

const playGeigerClick = () => {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    if (audioCtx.state === "suspended") return;

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(
      100 + Math.random() * 200,
      audioCtx.currentTime,
    );

    gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.001,
      audioCtx.currentTime + 0.02,
    );

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.02);
  } catch {
    // Silent catch
  }
};

// --- COMPONENTS ---
const Typewriter = ({ text }) => {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    setDisplayedText(""); 
    let currentIndex = 0;
    let currentString = "";
    
    const timer = setInterval(() => {
      if (currentIndex >= text.length) {
        clearInterval(timer);
        return;
      }
      currentString += text.charAt(currentIndex);
      setDisplayedText(currentString);

      if (currentIndex % 3 === 0) {
        playGeigerClick(); 
      }
      currentIndex++;
    }, 40);

    return () => clearInterval(timer);
  }, [text]);

  return (
    <span>
      {displayedText}
      <span className="cursor"></span>
    </span>
  );
};

const AnimatedNumber = ({ value }) => {
  const spring = useSpring(value, { mass: 1, stiffness: 75, damping: 15 });
  const display = useTransform(spring, (current) => Math.round(current));

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  return <motion.span>{display}</motion.span>;
};

const DEGU_TEAM = {
  geometry: { name: "Кокосик", img: "/coconut.png" },
  word_problems: { name: "Уголек", img: "/coal.png" },
  units: { name: "По", img: "/po.png" },
  default: { name: "Инженер-Беззубик", img: "/toothless.jpg" },
};

// --- ALPHA ENERGY PARTICLES COMPONENT ---
const AlphaParticles = () => {
  // Create an array of 20 empty items to map over
  const particles = Array.from({ length: 20 });

  return (
    <div className="particles-container">
      {particles.map((_, i) => {
        // Randomize starting positions, sizes, and animation speeds
        const randomX = Math.random() * 100; // Random horizontal start (0 to 100vw)
        const randomDelay = Math.random() * 5; // Start at different times
        const randomDuration = 5 + Math.random() * 5; // Float up over 5 to 10 seconds
        const size = Math.random() * 6 + 4; // Size between 4px and 10px

        return (
          <motion.div
            key={i}
            className="alpha-particle"
            // Start below the screen, invisible
            initial={{ y: "100vh", x: `${randomX}vw`, opacity: 0 }}
            // Float up past the top of the screen, fading in and out
            animate={{ 
              y: "-10vh", 
              x: [`${randomX}vw`, `${randomX + (Math.random() * 10 - 5)}vw`, `${randomX}vw`], // Slight horizontal drifting
              opacity: [0, 1, 0] 
            }}
            transition={{
              duration: randomDuration,
              repeat: Infinity, // Loop forever!
              delay: randomDelay,
              ease: "linear"
            }}
            style={{ width: size, height: size }}
          />
        );
      })}
    </div>
  );
};



function App() {
  const [session, setSession] = useState(null);
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);
  const [stats, setStats] = useState({ tokens: 0, streak: 0 });
  const [isGlitching, setIsGlitching] = useState(false);
  const [progress, setProgress] = useState({ solved: 0, total: 0 });
  
  const { data: phrasesDB } = useSWR("degu-phrases", fetchPhrases, {
    revalidateOnFocus: false,
  });
  const [deguPhrase, setDeguPhrase] = useState("Настраиваю антенну...");

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(mathTaskSchema),
  });

  const fetchProfile = useCallback(async () => {
    if (!session) return;
    const { data: profileStats, error } = await supabase.rpc("get_profile_stats");
    if (!error && profileStats) {
      setStats(profileStats);
    }
    const { data: progData } = await supabase.rpc("get_mission_progress");
    if (progData) setProgress(progData);
  }, [session]);

  const handleNextTask = async () => {
    setLoading(true);
    setFeedback(null);
    reset();

    if (phrasesDB?.neutral) {
      setDeguPhrase(getRandomPhrase(phrasesDB.neutral));
    }

    const { data, error } = await supabase.rpc("get_next_task");
    if (!error) setTask(data);
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) =>
      setSession(session),
    );
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    async function fetchTask() {
      if (!session) return;
      const { data, error } = await supabase.rpc("get_next_task");
      if (!error) setTask(data);
      await fetchProfile();
      setLoading(false);
    }
    fetchTask();
  }, [session, fetchProfile]);

  const onSubmit = async (data) => {
    const { data: isCorrect, error } = await supabase.rpc("submit_answer", {
      p_task_id: task.id,
      p_user_answer: data.answer,
    });

    if (error) {
      setFeedback({ type: "error", text: "Сбой связи!" });
      return;
    }

    if (isCorrect) {
      if (phrasesDB?.success) {
        setDeguPhrase(getRandomPhrase(phrasesDB.success));
      }

      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#81c784", "#ffd54f", "#ffffff"],
      });

      setFeedback({ type: "success", text: "✅ Сигнал расшифрован! Код верный." });
      reset();
      await fetchProfile();
    } else {
      if (phrasesDB?.error) {
        setDeguPhrase(getRandomPhrase(phrasesDB.error));
      }
      setIsGlitching(true);
      setFeedback({ type: "error", text: "❌ Код неверный. Обнаружена радиационная помеха!" });
      setTimeout(() => setIsGlitching(false), 600); 
    }
  };

  const handleLogout = async () => await supabase.auth.signOut();

  const currentDegu = task ? DEGU_TEAM[task.category] || DEGU_TEAM.default : DEGU_TEAM.default;

  // HARDCODED for testing the reactor sequence. Change to actual logic later:
  const isQuotaMet = progress.total > 0 && progress.solved >= progress.total;
  //const isQuotaMet = true; 

  // --- BUG 1 FIXED: Restored the Auth component for logged-out users ---
  if (!session) {
    return (
      <div className="control-room">
        <h1>Драконий Центр Связи</h1>
        <Auth />
      </div>
    );
  }

  // --- BUG 2 FIXED: Main wrapper is now a <motion.div> ---
  return (
    <motion.div 
      className="control-room"
      animate={{
        background: isQuotaMet 
          // The Victory State: Deep violet and bright cyan (Alpha Toothless)
          ? "linear-gradient(rgba(10, 0, 30, 0.8), rgba(0, 212, 255, 0.45)), url('/dragon-bg.jpg')" 
          // The Tense State: Dark blue (Original)
          : "linear-gradient(rgba(15, 32, 39, 0.85), rgba(44, 83, 100, 0.85)), url('/dragon-bg.jpg')" 
      }}
      style={{
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
        position: "relative"
      }}
      transition={{ duration: 2.5, ease: "easeInOut" }}
    >
      {/* If the quota is met, unleash the Alpha Energy Particles! */}
      {isQuotaMet && <AlphaParticles />}

      <div className="header-bar" style={{ position: "relative", zIndex: 2 }}>
        <h1>Драконий Центр Связи</h1>
        <button onClick={handleLogout} className="logout-btn">
          Отключиться
        </button>
      </div>

      <div className="user-info-bar">
        <h2>Дежурная смена: инженеры-дегу ({session.user.email})</h2>
        <div className="stats-container">
            <div className="stat-badge streak-badge">
              <span className="stat-icon">🔥</span>
              <span className="stat-value">
                <AnimatedNumber value={stats.streak} /> дн. на вахте
              </span>
            </div>
            <div className="stat-badge token-badge">
              <span className="stat-icon">🪙</span>
              <span className="stat-value">
                <AnimatedNumber value={stats.tokens} /> жетонов
              </span>
            </div>
        </div>
      </div>

      <NotificationSetup session={session} />

      {progress && (
        <div className="geiger-container">
          <div className="geiger-label">РАДИАЦИОННЫЙ ФОН ЭФИРА</div>
          <div className="geiger-screen">
            <div
              className={`geiger-bar ${progress.solved >= progress.total ? 'quota-met-bar' : ''}`}
              style={{ width: `${progress.percentage}%` }}
            ></div>
            <div className={`geiger-text ${progress.solved >= progress.total ? 'quota-met-text' : ''}`}>
              {progress.solved >= progress.total 
                ? `План перевыполнен! (${progress.solved}/${progress.total}) Эфир чист 🐉` 
                : `План на смену: ${progress.solved} / ${progress.total} сигналов`
              }
            </div>
          </div>
        </div>
      )}

      <div className="terminal">
        <div className="degu-avatar-container">
          <img src={currentDegu.img} alt={currentDegu.name} className="degu-avatar" />
          <div className="speech-bubble">
            <strong>{currentDegu.name}:</strong>
            <br />
            {deguPhrase}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="loading-state">
              <p>Сканирование эфира...</p>
            </motion.div>
          ) : task ? (
            <motion.div key={task.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 1.3 }} style={{ width: "100%" }}>
              <p className="signal-header">{">>>"} ПЕРЕХВАЧЕН СИГНАЛ: {task.title}</p>
              <p className="task-content">
                <Typewriter text={task.content} />
              </p>

              {feedback && <p className={`feedback-msg ${feedback.type}`}>{feedback.text}</p>}

              {feedback?.type === "success" ? (
                <motion.button
                  onClick={handleNextTask}
                  className="submit-btn next-task-btn"
                  whileHover={{ scale: 1.02, boxShadow: "0px 0px 20px rgba(76, 175, 80, 0.8)" }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                >
                  📡 Искать следующий сигнал
                </motion.button>
              ) : (
                <div className={`input-area ${isGlitching ? "radiation-glitch" : ""}`}> 
                  <span>КОД: </span>
                  <form onSubmit={handleSubmit(onSubmit)} className="task-form">
                    <ValidatedInput
                      name="answer"
                      placeholder="..."
                      register={register}
                      error={errors.answer}
                    />
                    {/* --- BUG 3 FIXED: Added motion.button and physics --- */}
                    <motion.button 
                      type="submit" 
                      className="submit-btn"
                      whileHover={{ scale: 1.05, boxShadow: "0px 0px 20px rgba(246, 185, 59, 0.8)" }}
                      whileTap={{ scale: 0.9 }}
                      transition={{ type: "spring", stiffness: 400, damping: 10 }}
                    >
                      Отправить код
                    </motion.button>
                  </form>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
             key="cleared"
              initial={{ opacity: 0, scale: 0.8, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", bounce: 0.5, duration: 1 }}
              className="all-cleared"
            >
              <div className="all-cleared-icon">🐉🔋</div>
              <h3>Реактор стабилизирован!</h3>
              <p style={{ fontSize: "1.2rem", lineHeight: "1.6" }}>
                Отличная работа! Ты расшифровал все сигналы на сегодня. 
                <br />
                Уровень радиации в норме. Инженеры-дегу отправляются грызть орешки!
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default App;