import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://yfezjihpwlooktxyxfdt.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmZXpqaWhwd2xvb2t0eHl4ZmR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNjcxODIsImV4cCI6MjA5MTk0MzE4Mn0.Iq387cWyTJKBy3z6JWXDolwQcnktkPGsm996yMQky5c";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});

// In local dev, route to the local Node.js server (port 3001)
// In production (Lovable / HTTPS), use Supabase Edge Functions directly
if (import.meta.env.DEV && (supabase as any).functions?.url !== undefined) {
  (supabase as any).functions.url = "http://localhost:3001/functions/v1";
}