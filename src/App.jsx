import { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabaseClient";
import "./App.css";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { mathTaskSchema } from "./schemas";
import { ValidatedInput } from "./components/ValidatedInput";
import { Auth } from "./components/Auth";
import confetti from "canvas-confetti"; // Импортируем салют

// --- БАЗА ЗНАНИЙ ДЕГУ ---
const SUCCESS_PHRASES = [
  "Отличная работа! Бегу за орешком!",
  "Матрица взломана! Ты супер-инженер!",
  "Ура! Мои усики так и дрожали от нетерпения!",
  "Код принят! Плюс 10 жетонов в нашу копилку!",
];

const ERROR_PHRASES = [
  "Ой, я чуть не уронил осциллограф... Давай пересчитаем!",
  "Хмм... транзисторы пищат, что тут ошибка.",
  "Где-то короткое замыкание. Попробуй еще раз!",
  "Не беда! Настоящие инженеры всегда проверяют расчеты.",
];

const NEUTRAL_PHRASES = [
  "Жду ввода данных, капитан!",
  "Сигнал пойман. Приступаем к расшифровке!",
  "Готов к вычислениям на максимальной скорости!",
];

// НОВЫЙ ХЕЛПЕР (ЖИВЕТ ВНЕ КОМПОНЕНТА APP)
const getRandomPhrase = (phrasesArray) => {
  return phrasesArray[Math.floor(Math.random() * phrasesArray.length)];
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
    setDisplayedText(""); // Сбрасываем текст при смене задачи
    let i = 0;
    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplayedText((prev) => prev + text.charAt(i));

        // ЗВУК: Щелкаем на каждую 3-ю букву, чтобы звук не сливался в сплошной гул
        if (i % 3 === 0) {
          playGeigerClick();
        }
        i++;
      } else {
        clearInterval(timer);
      }
    }, 40); // Скорость печати (в миллисекундах)

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
  default: { name: "Инженер-дегу", img: "/coconut.png" },
};

function App() {
  const [session, setSession] = useState(null);
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);
  const [tokens, setTokens] = useState(0);

  // Новое состояние для контроля анимации ошибки
  const [isShaking, setIsShaking] = useState(false);

  // НОВОЕ СОСТОЯНИЕ для фраз дегу
  const [deguPhrase, setDeguPhrase] = useState(NEUTRAL_PHRASES[0]);

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
    const { data: balance, error } = await supabase.rpc("get_my_balance");
    if (!error) setTokens(balance);

    // НОВОЕ: Запрашиваем прогресс миссии
    const { data: progData } = await supabase.rpc("get_mission_progress");
    if (progData) setProgress(progData);
  }, [session]);

  const handleNextTask = async () => {
    setLoading(true);
    setFeedback(null);
    reset();

    // Дегу комментирует новую задачу
    setDeguPhrase(getRandomPhrase(NEUTRAL_PHRASES));
    // setDeguPhrase(randomNeutral);

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
      // Выбираем случайную фразу успеха через хелпер
      setDeguPhrase(getRandomPhrase(SUCCESS_PHRASES));
      // setDeguPhrase(randomSuccess);

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
      // Выбираем случайную фразу ошибки через хелпер
      setDeguPhrase(getRandomPhrase(ERROR_PHRASES));
      // setDeguPhrase(randomError);

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
        <div className="token-display">
          <span className="token-icon">🪙</span>
          <span className="token-count">{tokens} жетонов</span>
        </div>
      </div>

      {/* СЧЕТЧИК ГЕЙГЕРА (ПРОГРЕСС МИССИИ) */}
      <div className="geiger-container">
        <div className="geiger-label">УРОВЕНЬ ДЕШИФРОВКИ (РАД/Ч)</div>
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

      <div className="terminal">
        {/* АВАТАР ДЕГУ */}
        {/* АВАТАР ДЕГУ И ЕГО РЕПЛИКИ */}
        <div className="degu-avatar-container">
          <img
            src={currentDegu.img}
            alt={currentDegu.name}
            className="degu-avatar"
          />

          {/* ОБЛАЧКО ДИАЛОГА */}
          <div className="speech-bubble">
            <strong>{currentDegu.name}:</strong>
            <br />
            {deguPhrase}
          </div>
        </div>
        {loading ? (
          <p>Сканирование эфира...</p>
        ) : task ? (
          <>
            <p className="signal-header">
              {">>>"} ПЕРЕХВАЧЕН СИГНАЛ: {task.title}
            </p>

            {/* ИСПОЛЬЗУЕМ ЭФФЕКТ ПЕЧАТНОЙ МАШИНКИ */}
            <p className="task-content">
              <Typewriter text={task.content} />
            </p>

            {feedback && (
              <p className={`feedback-msg ${feedback.type}`}>{feedback.text}</p>
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
          </>
        ) : (
          <div className="all-cleared">
            <h3>🎉 Эфир чист!</h3>
            <p>
              Ты расшифровал все доступные сигналы. Инженеры-дегу могут
              отдохнуть и погрызть орешки.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
