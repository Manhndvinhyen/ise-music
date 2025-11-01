import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const supabaseUrl = 'https://lezswjtnlsmznkgrzgmu.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlenN3anRubHNtem5rZ3J6Z211Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1Nzc2MjYsImV4cCI6MjA3NjE1MzYyNn0.7EcHV5IK8r5stTF0uohhFShbWLIaK4A4VEAxYnZG3Vk'

// Sửa thành cách này:
const supabase = createClient(supabaseUrl, supabaseKey)
window.supabase = supabase;  
export { supabase }