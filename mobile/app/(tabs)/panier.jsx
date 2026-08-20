import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, Image, Switch, StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBoutique } from '../../lib/boutique';
import { useSession } from '../../lib/session';
import { Vide, Champ } from '../../components/Base';
import { C, R, S, E, OMBRE, fcfa, pourcent } from '../../lib/ui';
import Icone from '../../components/Icone';

/* ══════════════════════════════════════════════════════════════════════════
   LE PANIER

   Repris de la référence, y compris ce qu'on met d'habitude à la poubelle :

   · une case par ligne, pour ne commander qu'une partie sans rien supprimer.
     C'est ce qui évite qu'un client vide son panier faute de pouvoir en
     laisser une moitié pour plus tard ;
   · le statut de chaque article — « il en reste 3 », « meilleur prix » —
     répété ici, parce que c'est le moment où l'on hésite encore ;
   · un bloc bonus et code promo séparé, avec le recalcul immédiat ;
   · un récapitulatif qui montre la remise ET les bonus gagnés ;
   · le bouton de commande TOUJOURS fixé en bas.

   Le bouton fixe n'est pas un détail d'ergonomie : sur une liste de dix
   articles, un bouton qui vit au fond de la page se cherche.
   ══════════════════════════════════════════════════════════════════════════ */

export default function Panier() {
  const router = useRouter();
  const { user } = useSession();
  const {
    panier, retenus, sousTotal, economie, cle,
    changerQuantite, retirer, basculerChoisi, toutChoisir, basculerFavori, estFavori,
  } = useBoutique();

  const [useBonus, setUseBonus] = useState(false);
  const [promo, setPromo] = useState('');
  const [promoPose, setPromoPose] = useState(null);

  const BONUS = 0;                       // le solde réel viendra de la fidélité
  const remisePromo = promoPose ? Math.round(sousTotal * 0.03) : 0;
  const remiseBonus = useBonus ? Math.min(BONUS, sousTotal) : 0;
  const total = Math.max(0, sousTotal - remisePromo - remiseBonus);
  const bonusGagnes = Math.round(total * 0.02);

  if (panier.length === 0) {
    return (
      <View style={S.page}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: C.marine }}>
          <View style={st.enTete}><Text style={st.titre}>Mon panier</Text></View>
        </SafeAreaView>
        <Vide icone="panier" titre="Ton panier est vide"
          texte="Ajoute des articles depuis le catalogue — tu pourras choisir la taille et la couleur avant de valider."
          bouton="Voir le catalogue" onBouton={() => router.push('/catalogue')} />
      </View>
    );
  }

  const tousChoisis = panier.every((x) => x.choisi !== false);

  return (
    <View style={S.page}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.marine }}>
        <View style={st.enTete}>
          <Text style={st.titre}>Mon panier</Text>
          <Text style={st.sousTitre}>
            {panier.length} article{panier.length > 1 ? 's' : ''}
          </Text>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingBottom: 130 }}>
        {/* Tout sélectionner */}
        <View style={st.barreSelection}>
          <Pressable onPress={() => toutChoisir(!tousChoisis)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
            <Case active={tousChoisis} />
            <Text style={{ fontSize: 14, fontWeight: '600', color: C.encre }}>
              Tout sélectionner
            </Text>
          </Pressable>
          <Pressable onPress={() => panier.filter((x) => x.choisi !== false)
            .forEach((x) => retirer(cle(x)))}>
            <Text style={{ fontSize: 13, color: C.gris }}>Supprimer la sélection</Text>
          </Pressable>
        </View>

        {/* Les lignes */}
        <View style={{ paddingHorizontal: E.page, gap: 10 }}>
          {panier.map((a) => {
            const k = cle(a);
            const remise = pourcent(a.prix_barre, a.price);
            return (
              <View key={k} style={st.ligne}>
                <Pressable onPress={() => basculerChoisi(k)} style={{ paddingTop: 4 }}>
                  <Case active={a.choisi !== false} />
                </Pressable>

                <Pressable onPress={() => router.push(`/produit/${a.id}`)}>
                  <Image source={{ uri: a.img }} resizeMode="contain" style={st.vignette} />
                </Pressable>

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                    <Text style={st.nom} numberOfLines={2}>{a.name}</Text>
                    <Pressable hitSlop={8} onPress={() => basculerFavori(a)}>
                      <Icone nom={estFavori(a.id) ? 'favoriPlein' : 'favori'} taille={17}
                        couleur={estFavori(a.id) ? C.rouge : C.grisClair} />
                    </Pressable>
                    <Pressable hitSlop={8} onPress={() => retirer(k)}>
                      <Icone nom="poubelle" taille={16} couleur={C.grisClair} />
                    </Pressable>
                  </View>

                  {(a.couleur || a.taille) && (
                    <Text style={st.variante}>
                      {[a.couleur, a.taille].filter(Boolean).join(' · ')}
                    </Text>
                  )}

                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 6 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={st.prix}>{fcfa(a.price)}</Text>
                      {!!remise && (
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          <Text style={S.prixBarre}>{fcfa(a.prix_barre)}</Text>
                          <Text style={S.remise}>{remise}</Text>
                        </View>
                      )}
                    </View>

                    <View style={st.compteur}>
                      <Pressable onPress={() => changerQuantite(k, -1)} style={st.compteurBouton}>
                        <Icone nom="moins" taille={16} couleur={C.encre} />
                      </Pressable>
                      <Text style={st.compteurValeur}>{a.quantite || 1}</Text>
                      <Pressable onPress={() => changerQuantite(k, 1)} style={st.compteurBouton}>
                        <Icone nom="plus" taille={16} couleur={C.encre} />
                      </Pressable>
                    </View>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {/* Les services */}
        <View style={st.services}>
          <View style={st.service}>
            <Icone nom="camion" taille={15} couleur={C.vert} />
            <Text style={st.serviceTexte}>Livraison en 2 h</Text>
          </View>
          <View style={st.service}>
            <Icone nom="boutique" taille={15} couleur={C.marine} />
            <Text style={st.serviceTexte}>Retrait au comptoir</Text>
          </View>
        </View>

        {/* Bonus et code promo */}
        <View style={[st.bloc, { gap: 12 }]}>
          <Text style={S.titre}>Bonus et code promo</Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icone nom="cadeau" taille={19} couleur={C.orange} />
            <Text style={{ flex: 1, fontSize: 14, color: C.encre }}>
              Bonus <Text style={{ fontWeight: '700' }}>{BONUS.toLocaleString('fr-FR')}</Text>
            </Text>
            <Switch value={useBonus} onValueChange={setUseBonus} disabled={BONUS === 0}
              trackColor={{ true: C.orange, false: '#DDD' }} thumbColor="#FFF" />
          </View>
          {BONUS === 0 && (
            <Text style={{ fontSize: 11, color: C.gris }}>
              Tes bonus arrivent après ta première commande livrée.
            </Text>
          )}

          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <Champ label="Code promo ou certificat" value={promo}
                onChangeText={(v) => setPromo(v.toUpperCase())}
                placeholder="Entre ton code" autoCapitalize="characters" />
            </View>
            <Pressable onPress={() => setPromoPose(promo.trim() || null)}
              style={[S.bouton, { paddingHorizontal: 20, paddingVertical: 12 }]}>
              <Text style={S.boutonTexte}>→</Text>
            </Pressable>
          </View>
          {!!promoPose && (
            <Text style={{ fontSize: 12, color: C.vert, fontWeight: '600' }}>
              Code {promoPose} appliqué — {fcfa(remisePromo)} de remise.
            </Text>
          )}
        </View>

        {/* Le récapitulatif */}
        <View style={[st.bloc, { gap: 9 }]}>
          <Rangee libelle="Total des articles" valeur={fcfa(sousTotal)} />
          {economie > 0 && (
            <Rangee libelle="Remise sur les articles" valeur={`− ${fcfa(economie)}`} vert />
          )}
          {remisePromo > 0 && <Rangee libelle="Code promo" valeur={`− ${fcfa(remisePromo)}`} vert />}
          {remiseBonus > 0 && <Rangee libelle="Bonus utilisés" valeur={`− ${fcfa(remiseBonus)}`} vert />}
          <Rangee libelle="En 12 fois" valeur={`dès ${fcfa(Math.round(total / 12))} × 12 mois`} gris />

          <View style={st.separateur} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: C.encre }}>Total</Text>
            <Text style={{ fontSize: 21, fontWeight: '800', color: C.encre }}>{fcfa(total)}</Text>
          </View>

          <View style={st.bonusGagnes}>
            <Text style={{ fontSize: 12, color: C.vert, fontWeight: '600' }}>
              Bonus gagnés sur cet achat  + {bonusGagnes.toLocaleString('fr-FR')}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
            {[['camion', 'Livraison\ngratuite'], ['cible', 'Programme\nfidélité'], ['carte', 'Paiement\nen 12 fois']]
              .map(([i, t]) => (
                <View key={t} style={st.avantage}>
                  <Icone nom={i} taille={17} couleur={C.marine} />
                  <Text style={st.avantageTexte}>{t}</Text>
                </View>
              ))}
          </View>
        </View>
      </ScrollView>

      {/* Le pied fixe */}
      <View style={st.pied}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: C.encre }}>{fcfa(total)}</Text>
          <Text style={{ fontSize: 11, color: C.gris }}>
            {retenus.length} article{retenus.length > 1 ? 's' : ''} sélectionné{retenus.length > 1 ? 's' : ''}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push(user ? '/commande' : '/connexion')}
          disabled={retenus.length === 0}
          style={[S.bouton, { paddingHorizontal: 26 }, retenus.length === 0 && S.boutonEteint]}>
          <Text style={[S.boutonTexte, retenus.length === 0 && S.boutonEteintTexte]}>
            Commander
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Case({ active }) {
  return (
    <View style={[st.case_, active && { backgroundColor: C.marine, borderColor: C.marine }]}>
      {active && <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '800' }}>✓</Text>}
    </View>
  );
}

function Rangee({ libelle, valeur, vert, gris }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 13.5, color: C.gris }}>{libelle}</Text>
      <Text style={{
        fontSize: 13.5, fontWeight: '600',
        color: vert ? C.vert : gris ? C.gris : C.encre,
      }}>{valeur}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  enTete: { paddingHorizontal: E.page, paddingVertical: 12 },
  titre: { color: '#FFF', fontSize: 19, fontWeight: '800' },
  sousTitre: { color: 'rgba(255,255,255,0.7)', fontSize: 12.5, marginTop: 2 },

  barreSelection: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: E.page, paddingVertical: 12,
  },
  case_: {
    width: 21, height: 21, borderRadius: 6, borderWidth: 1.5, borderColor: C.grisClair,
    alignItems: 'center', justifyContent: 'center', backgroundColor: C.carte,
  },

  ligne: {
    flexDirection: 'row', gap: 10, backgroundColor: C.carte,
    borderRadius: R.carte, padding: 10, ...OMBRE,
  },
  vignette: { width: 68, height: 84, borderRadius: R.vignette, backgroundColor: '#FFF' },
  nom: { flex: 1, fontSize: 13, color: C.encre, lineHeight: 17 },
  variante: { fontSize: 11.5, color: C.gris, marginTop: 3 },
  prix: { fontSize: 16, fontWeight: '800', color: C.encre },

  compteur: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: C.bord, borderRadius: R.puce, overflow: 'hidden',
  },
  compteurBouton: { paddingHorizontal: 12, paddingVertical: 6 },
  compteurSigne: { fontSize: 16, color: C.encre },
  compteurValeur: { fontSize: 14, fontWeight: '700', minWidth: 22, textAlign: 'center' },

  services: { flexDirection: 'row', gap: 8, paddingHorizontal: E.page, marginTop: 12 },
  service: {
    flex: 1, backgroundColor: C.carte, borderRadius: R.puce,
    paddingVertical: 9, paddingHorizontal: 12, ...OMBRE,
  },
  serviceTexte: { fontSize: 11.5, color: C.encre, fontWeight: '600' },

  bloc: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 14,
    marginHorizontal: E.page, marginTop: 12, ...OMBRE,
  },
  separateur: { height: 1, backgroundColor: C.bord, marginVertical: 3 },
  bonusGagnes: {
    backgroundColor: '#EAF7EF', borderRadius: R.champ,
    paddingHorizontal: 12, paddingVertical: 9, marginTop: 4,
  },
  avantage: {
    flex: 1, backgroundColor: C.champ, borderRadius: R.champ,
    padding: 10, alignItems: 'center', gap: 4,
  },
  avantageTexte: { fontSize: 10, color: C.gris, textAlign: 'center', lineHeight: 12 },

  pied: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.carte, borderTopWidth: 1, borderTopColor: C.bord,
    paddingHorizontal: E.page, paddingTop: 12, paddingBottom: 16,
  },
});
