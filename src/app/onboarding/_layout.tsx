import { Stack } from 'expo-router';

/** Pantallas del onboarding, entre la bienvenida y el login. */
export default function LayoutOnboarding() {
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
