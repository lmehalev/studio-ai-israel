import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Data (avatars, voices, projects) lives in the Lovable Supabase project
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://fyfqyeouyxotohtxlbdg.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5ZnF5ZW91eXhvdG9odHhsYmRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0OTU3NTAsImV4cCI6MjA4OTA3MTc1MH0.B7btRSTaJqvvtVK0QWfmof9XVTShJWjVYE8nTEWxCcE";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Edge functions are deployed on our project (yfezjihpwlooktxyxfdt)
// Data stays on the Lovable project — only function calls are redirected
const FUNCTIONS_URL = import.meta.env.DEV
  ? "http://localhost:3001/functions/v1"
  : "https://yfezjihpwlooktxyxfdt.supabase.co/functions/v1";

// Force-override — functions are deployed on yfezjihpwlooktxyxfdt
try {
  (supabase as any).functions.url = FUNCTIONS_URL;
} catch {
  // ignore if property is not writable
}