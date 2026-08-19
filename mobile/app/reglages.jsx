import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useSession } from '../lib/session';
import { useMiseAJour } from '../lib/maj';
import { enregistrerPourNotifications } from '../lib/notifications';
import { C, S } from '../lib/theme';

/* Un écran de service, pas une page de préférences. Trois questions
   auxquelles il faut pouvoir répondre quand quelque chose ne marche pas :
   quelle version tourne, les notifications passent-elles, et comment sortir. */

export default function Reglages() {
  const { user, vendor, deconnecter } = useSession();
  const { prete, erreur, appliquer, version, canal } = useMiseAJour();
  const router = useRouter();
  const [notif, setNotif] = useState(null);
  const [busy, setBusy] = useState(false);

  const tester = async () => {
    setBusy(true);
    const res = await enregistrerPourNotifications(vendor?.id);
    setNotif(res);
    setBusy(false);
  };

  const RAISONS = {
    emulateur: 'Émulateur : pas de notification possible, c’est normal.',
    refuse: 'Refusées. Autorise-les dans les réglages Android de Buyticle Store.',
    projet_absent: 'Projet EAS non configuré dans cette version.',
    erreur: 'Erreur au moment de demander le jeton.',
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <View style={[S.carte, { gap: 6 }]}>
        <Text style={S.etiquette}>Compte</Text>
        <Text style={{ fontSize: 15, color: C.encre }}>
          {vendor?.shop_name || user?.email || '—'}
        </Text>
        <Text style={S.sousTitre}>
          {vendor ? 'Ce compte tient un comptoir.' : 'Compte client.'}
        </Text>
      </View>

      <View style={[S.carte, { gap: 8 }]}>
        <Text style={S.etiquette}>Notifications</Text>
        <Text style={S.sousTitre}>
          Sans elles, tu ne sauras pas qu’un voisin cherche un article que tu
          as. Trente secondes pour répondre : c’est ce délai qui décide de ce
          que le rayon te rapporte.
        </Text>
        <Pressable onPress={tester} disabled={busy}
          style={[S.boutonSombre, busy && { opacity: 0.4 }]}>
          <Text style={S.boutonSombreTexte}>
            {busy ? '…' : 'Vérifier les notifications'}
          </Text>
        </Pressable>
        {notif && (
          <Text style={{
            fontSize: 13,
            color: notif.jeton ? C.vert : C.ambre,
          }}>
            {notif.jeton
              ? 'Actives. Ton téléphone est enregistré.'
              : RAISONS[notif.raison] || 'Indisponibles.'}
          </Text>
        )}
      </View>

      <View style={[S.carte, { gap: 8 }]}>
        <Text style={S.etiquette}>Version</Text>
        <Text style={S.sousTitre}>
          Application {Constants.expoConfig?.version || '—'} · canal {canal} ·
          mise à jour {version}
        </Text>
        {prete ? (
          <Pressable onPress={appliquer} style={S.bouton}>
            <Text style={S.boutonTexte}>Appliquer la mise à jour</Text>
          </Pressable>
        ) : (
          <Text style={{ fontSize: 12, color: C.gris }}>
            À jour. Les corrections arrivent toutes seules au démarrage — tu
            n’as jamais à repasser par le Play Store.
          </Text>
        )}
        {!!erreur && (
          <Text style={{ fontSize: 11, color: C.ambre }}>
            Dernière vérification en échec : {erreur}
          </Text>
        )}
      </View>

      <Pressable
        onPress={() => deconnecter().then(() => router.replace('/connexion'))}
        style={{ paddingVertical: 12 }}>
        <Text style={{ color: C.prix, fontSize: 14, textAlign: 'center', fontWeight: '600' }}>
          Se déconnecter
        </Text>
      </Pressable>
    </ScrollView>
  );
}
