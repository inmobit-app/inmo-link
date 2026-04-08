import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://icqfdlbhvhpftjqokuxz.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_V8-IP_98H_M9tjYll3tgAw_4I16mZiE";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
