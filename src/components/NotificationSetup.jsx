// src/components/NotificationSetup.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { motion } from 'framer-motion';

// Cryptography utility: Browsers require the public key to be a specific array type
const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export function NotificationSetup({ session }) {
  const [isSubscribed, setIsSubscribed] = useState(true);

  // Check if they already allowed notifications
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setIsSubscribed(Notification.permission === 'granted');
    }
  }, []);

  const handleSubscribe = async () => {
    try {
      // 1. Ask the user for permission (shows the native iOS/Chrome popup)
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert("Уведомления заблокированы в настройках браузера.");
        return;
      }

      // 2. Get the Service Worker registration
      const registration = await navigator.serviceWorker.ready;

      // 3. YOUR VAPID PUBLIC KEY (Paste the Public Key you generated earlier here)
      const VAPID_PUBLIC_KEY = "BEZOt4lPGP_gQ7czVKzaBb_5za8mv5PE2BWb4xlEV6ksvBv0tLI5XkEysjN9NNmHBb8uYRjRd7ta-fsnHrjBC6w";

      // 4. Request the unique subscription token from Apple/Google
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      // 5. Save the token to our Supabase database so the Cron Job can find it
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({ 
          user_id: session.user.id, 
          subscription: subscription 
        });

      if (error) throw error;
      
      setIsSubscribed(true);
      alert("Связь установлена! Мы напомним, если стрик будет в опасности.");
      
    } catch (error) {
      console.error("Ошибка подписки:", error);
    }
  };

  // Hide the button if they already subscribed
  if (isSubscribed) return null;

  return (
    <motion.button 
      onClick={handleSubscribe}
      className="submit-btn"
      style={{ background: 'linear-gradient(45deg, #aa3bff, #00d4ff)', width: '100%', marginBottom: '20px' }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      🔔 Включить напоминания о вахте
    </motion.button>
  );
}