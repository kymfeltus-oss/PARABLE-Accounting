import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import IntroFlashClient from "./intro/IntroFlashClient";

export default async function HomePage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(name: string) { return cookieStore.get(name)?.value; } } }
  );

  // We check for the user but we DO NOT redirect them anymore.
  const { data: { user } } = await supabase.auth.getUser();
  
  let role = 'member';
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    role = profile?.role || 'member';
    
    // Only redirect members if they are logged in and actually have a member role
    if (role !== 'admin' && role !== 'staff') {
        const { redirect } = await import('next/navigation');
        redirect('/member');
    }
  }

  // If not logged in, or if Staff, stay here and show the cinematic flash
  return (
    <IntroFlashClient 
      appType="accounting"
      subtitle="Institutional Command" 
    />
  );
}