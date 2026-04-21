import { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabaseClient";
import "./App.css";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { mathTaskSchema } from "./schemas";
import { ValidatedInput } from "./components/ValidatedInput";
import { Auth } from "./components/Auth";
import confetti from "canvas-confetti"; // Импортируем салют
import useSWR from "swr";
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from "framer-motion";

// НОВЫЙ ХЕЛПЕР (ЖИВЕТ ВНЕ КОМПОНЕНТА APP)
const getRandomPhrase = (phrasesArray) => {
  return phrasesArray[Math.floor(Math.random() * phrasesArray.length)];
};

const fetchPhrases = async () => {
  const { data, error } = await supabase.from("degu_phrases").select("*");
  if (error) throw error;
  // Группируем для удобства: { success: [...], error: [...], neutral: [...] }
  return data.reduce((acc, row) => {
    if (!acc[row.category]) acc[row.category] = [];
    acc[row.category].push(row.phrase_text);
    return acc;
  }, {});
};

// --- ЗВУКОВОЙ ДВИЖОК (Счетчик Гейгера / Печать) ---

// 1. Глобальная переменная (Singleton) — создаем только один раз!
let audioCtx = null;

const playGeigerClick = () => {
  try {
    // 2. Инициализируем контекст лениво, только при первом вызове
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    // 3. Если браузер заблокировал звук (до первого клика на странице), пытаемся его разбудить
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }

    // Если контекст все еще заблокирован (клика не было), прерываем функцию,
    // чтобы не плодить ошибки в консоли
    if (audioCtx.state === "suspended") return;

    // 4. Генерируем сам щелчок
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
    // Тихо перехватываем любые другие сбои аудио
  }
};

// Компонент эффекта "Печатной машинки"
const Typewriter = ({ text }) => {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    // 1. Сбрасываем текст при получении новой задачи
    setDisplayedText(""); 
    
    // 2. Создаем локальные переменные для жесткого контроля
    let currentIndex = 0;
    let currentString = "";
    
    const timer = setInterval(() => {
      // Если текст закончился - останавливаем таймер
      if (currentIndex >= text.length) {
        clearInterval(timer);
        return;
      }

      // Собираем строку локально, избегая асинхронных багов React
      currentString += text.charAt(currentIndex);
      setDisplayedText(currentString);

      // ЗВУК: Щелкаем на каждую 3-ю букву
      if (currentIndex % 3 === 0) {
        // Убедись, что playGeigerClick объявлена выше или импортирована
        playGeigerClick(); 
      }

      currentIndex++;
    }, 40); // Скорость печати (в миллисекундах)

    // 3. Жесткая очистка таймера при размонтировании или смене текста
    return () => clearInterval(timer);
  }, [text]);

  return (
    <span>
      {displayedText}
      <span className="cursor"></span>
    </span>
  );
};

const DEGU_TEAM = {
  geometry: { name: "Кокосик", img: "/coconut.png" },
  word_problems: { name: "Уголек", img: "/coal.png" },
  units: { name: "По", img: "/po.png" },
  default: { name: "Инженер-Беззубик", img: "/toothless.jpg" },
};

function App() {
  const [session, setSession] = useState(null);
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);

  // ВМЕСТО: const [tokens, setTokens] = useState(0);
  const [stats, setStats] = useState({ tokens: 0, streak: 0 });

  // Новое состояние для контроля анимации ошибки
  const [isShaking, setIsShaking] = useState(false);

  // НОВОЕ СОСТОЯНИЕ для фраз дегу

  // SWR загрузит фразы ОДИН раз, закэширует их в памяти браузера
  // и будет отдавать мгновенно при любых рендерах.
  const { data: phrasesDB } = useSWR("degu-phrases", fetchPhrases, {
    revalidateOnFocus: false, // Не дергать базу, когда пользователь переключает вкладки
  });

  // Задаем начальную фразу, пока данные грузятся
  const [deguPhrase, setDeguPhrase] = useState("Настраиваю антенну...");

  // НОВОЕ СОСТОЯНИЕ для прогресс бара
  const [progress, setProgress] = useState({ solved: 0, total: 0 });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(mathTaskSchema),
  });

  const fetchProfile = useCallback(async () => {
    if (!session) return;

    // Используем новую функцию, которая возвращает и жетоны, и стрик
    const { data: profileStats, error } =
      await supabase.rpc("get_profile_stats");
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
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => setSession(session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) =>
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

      setFeedback({
        type: "success",
        text: "✅ Сигнал расшифрован! Код верный.",
      });
      reset();
      await fetchProfile();
    } else {
      if (phrasesDB?.error) {
        setDeguPhrase(getRandomPhrase(phrasesDB.error));
      }

      setIsShaking(true);
      setFeedback({
        type: "error",
        text: "❌ Код неверный. Проверь вычисления!",
      });
      setTimeout(() => setIsShaking(false), 500);
    }
  };

  const handleLogout = async () => await supabase.auth.signOut();
  // Получаем текущего инженера на основе категории задачи
  const currentDegu = task
    ? DEGU_TEAM[task.category] || DEGU_TEAM.default
    : DEGU_TEAM.default;

  if (!session) {
    return (
      <div className="control-room">
        <h1>Драконий Центр Связи</h1>
        <Auth />
      </div>
    );
  }

  return (
    <div className="control-room">
      <div className="header-bar">
        <h1>Драконий Центр Связи</h1>
        <button onClick={handleLogout} className="logout-btn">
          Отключиться
        </button>
      </div>

      <div className="user-info-bar">
        <h2>Дежурная смена: инженеры-дегу ({session.user.email})</h2>
        <div className="stats-container">
          {/* Стрики (Дни на вахте) */}
          <div className="stat-badge streak-badge">
            <span className="stat-icon">🔥</span>
            <span className="stat-value">{stats.streak} дн. на вахте</span>
          </div>

          {/* Жетоны */}
          <div className="stat-badge token-badge">
            <span className="stat-icon">🪙</span>
            <span className="stat-value">{stats.tokens} жетонов</span>
          </div>
        </div>
      </div>

      {/* СЧЕТЧИК ГЕЙГЕРА (ПРОГРЕСС МИССИИ) */}
{/*}      <div className="geiger-container">
        <div className="geiger-label">План на смену (РАД/Ч)</div>
        <div className="geiger-screen">
          <div
            className="geiger-bar"
            style={{
              width:
                progress.total > 0
                  ? `${(progress.solved / progress.total) * 100}%`
                  : "0%",
            }}
          ></div>
          <div className="geiger-text">
            {progress.solved} / {progress.total} СИГНАЛОВ
          </div>
        </div>
      </div>
*/}


{/* Прогресс-бар (План на смену) */}
      {progress && (
        <div className="geiger-container">
          <div className="geiger-label">РАДИАЦИОННЫЙ ФОН ЭФИРА</div>
          <div className="geiger-screen">
            {/* Оставляем geiger-bar для высоты, и накидываем quota-met-bar для золотого цвета */}
            <div
              className={`geiger-bar ${progress.solved >= progress.total ? 'quota-met-bar' : ''}`}
              style={{ width: `${progress.percentage}%` }}
            ></div>
            
            {/* Оставляем geiger-text для центрирования, и накидываем quota-met-text для свечения */}
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
        {/* --- ВОЗВРАЩАЕМ АВАТАР НА МЕСТО --- */}
        <div className="degu-avatar-container">
          <img
            src={currentDegu.img}
            alt={currentDegu.name}
            className="degu-avatar"
          />
          <div className="speech-bubble">
            <strong>{currentDegu.name}:</strong>
            <br />
            {deguPhrase}
          </div>
        </div>
        {/* ОБОРАЧИВАЕМ ВСЕ СОСТОЯНИЯ В ANIMATE PRESENCE */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="loading-state"
            >
              <p>Сканирование эфира...</p>
            </motion.div>
          ) : task ? (
            <motion.div
              key={
                task.id
              } /* Уникальный ключ заставляет React анимировать смену задач */
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 1.3 }}
              style={{ width: "100%" }}
            >
              <p className="signal-header">
                {">>>"} ПЕРЕХВАЧЕН СИГНАЛ: {task.title}
              </p>

              {/* ИСПОЛЬЗУЕМ ЭФФЕКТ ПЕЧАТНОЙ МАШИНКИ */}
              <p className="task-content">
                <Typewriter text={task.content} />
              </p>

              {feedback && (
                <p className={`feedback-msg ${feedback.type}`}>
                  {feedback.text}
                </p>
              )}

              {feedback?.type === "success" ? (
                <button
                  onClick={handleNextTask}
                  className="submit-btn next-task-btn"
                >
                  📡 Искать следующий сигнал
                </button>
              ) : (
                /* ДОБАВЛЯЕМ КЛАСС ТРЯСКИ ЕСЛИ isShaking = true */
                <div className={`input-area ${isShaking ? "shake" : ""}`}>
                  <span>КОД: </span>
                  <form onSubmit={handleSubmit(onSubmit)} className="task-form">
                    <ValidatedInput
                      name="answer"
                      placeholder="..."
                      register={register}
                      error={errors.answer}
                    />
                    <button type="submit" className="submit-btn">
                      Отправить код
                    </button>
                  </form>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="cleared"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="all-cleared"
            >
              <h3>🎉 Эфир чист!</h3>
              <p>
                Ты расшифровал все доступные сигналы. Инженеры-дегу могут
                отдохнуть и погрызть орешки.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default App;
