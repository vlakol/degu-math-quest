// src/components/Auth.jsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { authSchema } from '../schemas';
import { ValidatedInput } from './ValidatedInput';
import { supabase } from '../supabaseClient';

export function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(authSchema)
  });

  const onSubmit = async (data) => {
    setLoading(true);
    setErrorMsg(null);

    let result;
    if (isLogin) {
      // Авторизация
      result = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
    } else {
      // Регистрация
      result = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            // Передаем имя пользователя (пока просто часть email до @),
            // чтобы наш SQL-триггер записал его в таблицу profiles
            username: data.email.split('@')[0] 
          }
        }
      });
    }

    if (result.error) {
      setErrorMsg(result.error.message);
    }
    setLoading(false);
  };

  return (
    <div className="terminal auth-terminal">
      <p className="signal-header">
        {">>>"} ТРЕБУЕТСЯ АВТОРИЗАЦИЯ ДОСТУПА
      </p>
      
      <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
        <ValidatedInput
          name="email"
          type="email"
          placeholder="Позывной (email)"
          register={register}
          error={errors.email}
        />
        
        <ValidatedInput
          name="password"
          type="password"
          placeholder="Секретный ключ (пароль)"
          register={register}
          error={errors.password}
        />

        {errorMsg && <p className="error-text">❌ Ошибка: {errorMsg}</p>}

        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? 'Установка связи...' : (isLogin ? 'Войти в систему' : 'Запросить доступ')}
        </button>
      </form>

      <button 
        className="toggle-btn" 
        onClick={() => setIsLogin(!isLogin)}
        type="button"
      >
        {isLogin ? 'Нет позывного? Регистрация' : 'Уже есть доступ? Войти'}
      </button>
    </div>
  );
}