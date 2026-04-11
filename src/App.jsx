import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import "./App.css";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { mathTaskSchema } from "./schemas";
import { ValidatedInput } from "./components/ValidatedInput";
import { Auth } from "./components/Auth"; // Импортируем наш компонент

function App() {
  const [session, setSession] = useState(null); // Состояние сессии
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(mathTaskSchema),
  });

  // 1. Отслеживание состояния авторизации
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Загрузка задачи (теперь вызывается только если есть сессия)
  useEffect(() => {
    async function fetchTask() {
      if (!session) return; // Не пытаемся грузить, если нет сессии
      
      const { data, error } = await supabase.rpc('get_next_task');
      if (error) console.error("Ошибка загрузки:", error.message);
      else setTask(data);
      
      setLoading(false);
    }

    fetchTask();
  }, [session]); // Зависимость от session

  const onSubmit = async (data) => {
    const { data: isCorrect, error } = await supabase.rpc('submit_answer', {
      p_task_id: task.id,
      p_user_answer: data.answer
    });

    if (error) {
      setFeedback({ type: 'error', text: 'Сбой связи. Инженеры-дегу уже чинят!' });
      return;
    }

    if (isCorrect) {
      setFeedback({ type: 'success', text: '✅ Сигнал расшифрован! Код верный.' });
      reset();
    } else {
      setFeedback({ type: 'error', text: '❌ Код неверный. Попробуй пересчитать!' });
    }
  };

  // Функция выхода
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // 3. Условный рендеринг: если нет сессии, показываем экран входа
  if (!session) {
    return (
      <div className="control-room">
        <h1>Драконий Центр Связи</h1>
        <Auth />
      </div>
    );
  }

  // Если сессия есть, показываем основной терминал
  return (
    <div className="control-room">
      <div className="header-bar">
        <h1>Драконий Центр Связи</h1>
        {/* Кнопка выхода */}
        <button onClick={handleLogout} className="logout-btn">Отключиться</button>
      </div>
      <h2>Дежурная смена: инженеры-дегу ({session.user.email})</h2>

      <div className="terminal">
        {loading ? (
          <p>Сканирование эфира...</p>
        ) : task ? (
          <>
            <p className="signal-header">{">>>"} ПЕРЕХВАЧЕН СИГНАЛ: {task.title}</p>
            <p>{task.content}</p>

            <div className="input-area">
              <span>КОД РАСШИФРОВКИ: </span>
              <form onSubmit={handleSubmit(onSubmit)} className="task-form">
                <ValidatedInput
                  name="answer"
                  placeholder="..."
                  register={register}
                  error={errors.answer}
                />
                <button type="submit" className="submit-btn">Отправить код</button>
              </form>
            </div>

            {feedback && <p className={`feedback-msg ${feedback.type}`}>{feedback.text}</p>}
          </>
        ) : (
          <p>Сигналов не обнаружено.</p>
        )}
      </div>
    </div>
  );
}

export default App;