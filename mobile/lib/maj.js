import { useEffect, useState } from 'react';
import * as Updates from 'expo-updates';

/* ══════════════════════════════════════════════════════════════════════════
   LES MISES À JOUR À L'AIR (OTA)

   Pourquoi elles comptent ici plus qu'ailleurs : l'application vit sur le
   téléphone d'un commerçant de Mboppi qui ne rouvrira pas le Play Store. Une
   correction poussée par magasin met des jours à se répandre, et il faut
   qu'il accepte la mise à jour. Une mise à jour à l'air arrive au prochain
   démarrage, sans rien lui demander.

   La règle de prudence, en revanche, est stricte : on ne recharge JAMAIS
   l'application au milieu de quelque chose. Un vendeur a trente secondes pour
   répondre à un appel à disponibilité, et un client attend devant son
   comptoir — redémarrer à ce moment-là lui fait perdre la vente et lui
   apprend à se méfier de l'application.

   Donc : on télécharge en silence, et on propose. Le seul rechargement
   automatique est celui du tout premier plan, avant qu'il ait commencé quoi
   que ce soit.
   ══════════════════════════════════════════════════════════════════════════ */

export function useMiseAJour() {
  const [prete, setPrete] = useState(false);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    // En développement, le module d'update n'est pas actif : inutile
    // d'interroger le serveur et de polluer la console.
    if (__DEV__ || !Updates.isEnabled) return;

    let vivant = true;
    (async () => {
      try {
        const res = await Updates.checkForUpdateAsync();
        if (!res.isAvailable || !vivant) return;
        await Updates.fetchUpdateAsync();
        if (vivant) setPrete(true);
      } catch (e) {
        // Une mise à jour ratée n'est pas une panne : l'application continue
        // avec la version qu'elle a. On garde l'erreur pour l'écran de
        // réglages, on ne la montre pas au comptoir.
        if (vivant) setErreur(e?.message || String(e));
      }
    })();

    return () => { vivant = false; };
  }, []);

  return {
    prete,
    erreur,
    appliquer: () => Updates.reloadAsync(),
    version: Updates.updateId ? Updates.updateId.slice(0, 8) : 'intégrée',
    canal: Updates.channel || 'développement',
  };
}
