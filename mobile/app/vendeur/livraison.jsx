import { Redirect } from 'expo-router';
/* La livraison se règle avec le reste de la boutique : deux écrans pour
   quatre champs feraient chercher lequel porte quoi. */
export default function Livraison() { return <Redirect href="/vendeur/reglages" />; }
