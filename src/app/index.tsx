import { Redirect } from 'expo-router';

import { useAuth } from '@/lib/auth';

/** Punto de entrada: reparte segun haya sesion o no. */
export default function Index() {
  const { session } = useAuth();
  return <Redirect href={session ? '/(tabs)' : '/login'} />;
}
