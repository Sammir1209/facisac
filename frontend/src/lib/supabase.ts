import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vkfdjqiogngpdvxmtqbh.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_acttJ906Z40-dGcKpIwfiw_fnlFeVPQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
