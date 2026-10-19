import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webPush from 'https://esm.sh/web-push@10.1.1'

// We will set these in the Supabase Dashboard later
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!

webPush.setVapidDetails(
  'mailto:your-email@example.com', // Replace with your email
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

serve(async (req) => {
  try {
    // 1. Initialize Supabase client with admin rights
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // 2. Call our SQL function to get lazy users
    const { data: users, error } = await supabase.rpc('get_users_to_notify')
    
    if (error) throw error;
    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ message: "Everyone solved their tasks!" }), { status: 200 });
    }

    // 3. Send a push notification to each user
    const notifications = users.map((user) => {
      const payload = JSON.stringify({
        title: "🔥 Стрик в опасности!",
        body: `Кокосик скучает! Твой стрик (${user.streak} дн.) сгорит, если ты не расшифруешь сигналы сегодня!`,
        icon: "/pwa-192x192.png", // Must match the icon we put in the public folder
        url: "/" // Where to go when clicked
      });

      // Send to Apple/Google
      return webPush.sendNotification(user.subscription, payload)
        .catch(err => console.error(`Failed to send to user ${user.user_id}:`, err));
    });

    await Promise.all(notifications);

    return new Response(JSON.stringify({ message: `Sent ${notifications.length} reminders.` }), { status: 200 })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})