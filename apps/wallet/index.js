import { registerRootComponent } from "expo";
import App from "./App";

// Point d'entrée local (plutôt que "expo/AppEntry" directement) : dans ce monorepo npm
// workspaces, le paquet "expo" est hissé à la racine, or expo/AppEntry.js importe l'app
// via un chemin relatif ("../../App") qui suppose qu'il se trouve deux niveaux sous la
// racine du projet — une fois hissé, ce chemin pointe vers la racine du monorepo au lieu
// de apps/wallet/App.tsx. Un point d'entrée local évite cette hypothèse fragile.
registerRootComponent(App);
