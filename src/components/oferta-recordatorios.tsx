import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BotonOnboarding } from '@/components/onboarding/boton';
import { Colors, Marca, Radios, Tipografia } from '@/constants/theme';
import { exito } from '@/lib/haptica';
import { notificacionesDisponibles, pedirPermiso, reprogramarRecordatorios } from '@/lib/notificaciones';
import { guardarRecordatorios, HORAS_COCINA, leerRecordatorios, tocaOfrecerRecordatorios, type HoraCocina } from '@/lib/preferencias';
import { alGuardarReceta } from '@/lib/recetas';

/**
 * Tras guardar la primera receta: "¿Te recuerdo cocinarla?". El permiso de
 * notificaciones se pide aqui, cuando se entiende para que sirve, y una sola
 * vez. Despues se cambia desde Perfil.
 */
export function OfertaRecordatorios() {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [hora, setHora] = useState<HoraCocina>('tarde');

  useEffect(
    () =>
      alGuardarReceta(async () => {
        if (!notificacionesDisponibles() || (await leerRecordatorios()).activos) return;
        if (!(await tocaOfrecerRecordatorios())) return;
        // Que primero se vea la receta guardada
        setTimeout(() => setVisible(true), 1800);
      }),
    []
  );

  async function activar() {
    setVisible(false);
    if (!(await pedirPermiso())) return;
    exito();
    await guardarRecordatorios({ activos: true, hora });
    reprogramarRecordatorios();
  }

  return (
    <Modal transparent visible={visible} animationType="slide" statusBarTranslucent onRequestClose={() => setVisible(false)}>
      <Pressable style={estilos.velo} onPress={() => setVisible(false)} accessibilityLabel="Cerrar" />
      <View style={[estilos.hoja, { paddingBottom: insets.bottom + 16 }]}>
        <Text style={estilos.emoji}>🔔</Text>
        <Text style={estilos.titulo}>¿Te recuerdo cocinarla?</Text>
        <Text style={estilos.texto}>
          Lo que se guarda se olvida. Te avisamos 4 días a la semana con una receta que guardaste, a la hora en que sueles cocinar.
        </Text>
        <View style={estilos.horas}>
          {HORAS_COCINA.map((h) => {
            const elegida = hora === h.id;
            return (
              <Pressable
                key={h.id}
                onPress={() => setHora(h.id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: elegida }}
                style={[estilos.hora, elegida && estilos.horaElegida]}>
                <Text style={estilos.emojiHora}>{h.emoji}</Text>
                <Text style={[estilos.textoHora, elegida && { color: Marca.primarioTexto }]}>{h.texto}</Text>
              </Pressable>
            );
          })}
        </View>
        <BotonOnboarding texto="Sí, recuérdame" alPulsar={activar} />
        <Pressable onPress={() => setVisible(false)} hitSlop={8} accessibilityRole="button">
          <Text style={estilos.ahoraNo}>Ahora no</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  velo: { flex: 1, backgroundColor: 'rgba(26, 15, 10, 0.45)' },
  hoja: {
    gap: 14,
    paddingHorizontal: 22,
    paddingTop: 24,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: '#FFFFFF',
  },
  emoji: { fontSize: 40, textAlign: 'center' },
  titulo: { fontFamily: Tipografia.display, fontSize: 26, textAlign: 'center', color: Colors.light.text },
  texto: { fontFamily: Tipografia.regular, fontSize: 15, lineHeight: 22, textAlign: 'center', color: Colors.light.textSecondary },
  horas: { flexDirection: 'row', gap: 10 },
  hora: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    borderRadius: Radios.medio,
    borderWidth: 1.5,
    borderColor: Colors.light.borde,
  },
  horaElegida: { borderColor: Marca.primario, backgroundColor: '#FFF7F3' },
  emojiHora: { fontSize: 22 },
  textoHora: { fontFamily: Tipografia.media, fontSize: 13, color: Colors.light.text },
  ahoraNo: { fontFamily: Tipografia.media, fontSize: 15, textAlign: 'center', color: Colors.light.textSecondary, paddingVertical: 4 },
});
