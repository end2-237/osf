import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSession } from '../lib/session';
import { C } from '../lib/theme';

/* L'aiguillage. Un seul compte par boutique : ou bien ce compte a une
   boutique et l'application ouvre sur le comptoir, ou bien il n'en a pas et
   elle ouvre sur le relais du client. Aucun sélecteur de rôle à traverser —
   le vendeur ouvre son téléphone pour répondre à un appel, pas pour choisir
   qui il est. */
export default function Index() {
  const { user, vendor, charge } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (charge) return;
    if (!user) router.replace('/connexion');
    else if (vendor) router.replace('/comptoir');
    else router.replace('/relais');
  }, [charge, user, vendor]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 3, color: C.gris }}>
        BUYTICLE
      </Text>
      <ActivityIndicator color={C.encre} />
    </View>
  );
}
