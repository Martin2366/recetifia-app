import { Stack } from 'expo-router';

/** Pantallas del onboarding, entre la bienvenida y el login. */
export default function LayoutOnboarding() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      {/* Despues de la celebracion, el tour aparece con un fundido, sin empujon */}
      <Stack.Screen name="tour" options={{ animation: 'fade', animationDuration: 450 }} />
    </Stack>
  );
}
