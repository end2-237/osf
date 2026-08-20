import { Redirect } from 'expo-router';
/* Le parrainage et la fidélité répondent à la même question — « qu'est-ce que
   je gagne à rester ? » — et vivent donc sur le même écran. */
export default function Parrainage() { return <Redirect href="/fidelite" />; }
