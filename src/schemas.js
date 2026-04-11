import { z } from 'zod';

// Схема для нашей текущей задачи (только цифры)
export const mathTaskSchema = z.object({
  answer: z.string()
    .min(1, "Дегу ждут твой ответ!")
    .regex(/^\d+$/, "Сигнал поврежден: вводи только цифры!")
    .max(4, "Слишком большое число")
});

// Задел на будущее (например, если захотим менять имя профиля)
export const profileSchema = z.object({
  username: z.string()
    .min(3, "Имя должно быть длиннее 3 букв")
    .max(20, "Слишком длинное имя")
});

// НОВАЯ СХЕМА ДЛЯ АВТОРИЗАЦИИ
export const authSchema = z.object({
  email: z.email("Неверный формат сигнала (нужен email)"),
  password: z.string().min(6, "Ключ шифрования должен быть от 6 символов")
});