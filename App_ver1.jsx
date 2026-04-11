import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import "./App.css";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { mathTaskSchema } from "./schemas"; // Предполагаем, что схемы вынесены
import { ValidatedInput } from "./components/ValidatedInput";

function App() {
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  // Инициализируем форму
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(mathTaskSchema),
  });

  // Функция, которая вызовется ТОЛЬКО если данные прошли валидацию Zod
  const onSubmit = (data) => {
    console.log("Валидные данные готовы к отправке в Supabase:", data.answer);
    // Здесь позже будет вызов нашего RPC для проверки ответа в БД
  };

  useEffect(() => {
      async function fetchTask() {
        // Вызываем наш строгий API-контракт
        const { data, error } = await supabase.rpc('get_next_task');

        if (error) {
          console.error("Ошибка загрузки:", error.message);
        } else {
          setTask(data);
        }
        setLoading(false);
      }

      fetchTask();
    }, []);

  return (
    <div className="control-room">
      <h1>Драконий Центр Связи</h1>
      <h2>Дежурная смена: инженеры-дегу</h2>

      <div className="terminal">
        {loading ? (
          <p>Сканирование эфира...</p>
        ) : task ? (
          <>
            <p className="signal-header">
              {">>>"} ПЕРЕХВАЧЕН СИГНАЛ: {task.title}
            </p>
            <p>{task.content}</p>
            <div className="input-area">
              <span>КОД РАСШИФРОВКИ: </span>
              {/* <input type="text" placeholder="..." className="math-input" /> */}
              <form onSubmit={handleSubmit(onSubmit)} className="task-form">
                {/* Используем наш универсальный компонент */}
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
            {task.metadata.hero === "Toothless" && (
              <p className="hint">
                Подсказка: Ищи ответ в таблице умножения на 9!
              </p>
            )}
          </>
        ) : (
          <p>Сигналов не обнаружено.</p>
        )}
      </div>
    </div>
  );
}

export default App;