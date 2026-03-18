import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/database.types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mntgqhalophnizruoysx.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1udGdxaGFsb3Bobml6cnVveXN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MzE2ODYsImV4cCI6MjA4OTMwNzY4Nn0.ZJvu96D1yJF408KvzrCmsuSZKEisguovbateJQAqc0Q';

export const isSupabaseConfigured = true;

export function createClient() {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
}
