import { supabase } from './supabaseClient'
import './App.css'

function App() {
  return (
    <div className="control-room">
      <h1>Драконий Центр Связи</h1>
      <h2>Дежурная смена: инженеры-дегу</h2>
      
      <div className="terminal">
        <p>Статус: Ожидание зашифрованных сигналов...</p>
        <p>Канал связи с Беззубиком: Не установлен</p>
      </div>
    </div>
  )
}

export default App