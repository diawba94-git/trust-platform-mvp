import { Platform } from "react-native";
import { isRunningInExpoGo } from "expo";
import { getDocTypeLabel } from "@trustwedge/shared";
import { syncDocuments, getLocalDocuments } from "./documentService";

type NotificationsModule = typeof import("expo-notifications");

// Depuis SDK 53, le simple fait de charger `expo-notifications` sur Android dans Expo Go fait
// planter tout le JS (erreur fatale "[runtime not ready]") : le module a un fichier d'effet de
// bord (DevicePushTokenAutoRegistration.fx.js) qui appelle addPushTokenListener() dès son
// évaluation, laquelle lève une exception — et cette exception est interceptée par le
// gestionnaire d'erreurs GLOBAL de React Native (guardedLoadModule) avant même qu'un try/catch
// local (y compris autour d'un require() paresseux) ne puisse l'attraper. La seule protection
// fiable est de ne JAMAIS déclencher le chargement du module dans ce contexte précis — on
// reproduit exactement la même détection que la lib utilise en interne (isRunningInExpoGo +
// Platform.OS === "android") pour décider d'appeler require() ou non.
let notificationsModule: NotificationsModule | null | undefined;

function getNotifications(): NotificationsModule | null {
  if (notificationsModule !== undefined) return notificationsModule;

  if (Platform.OS === "android" && isRunningInExpoGo()) {
    console.warn(
      "Notifications désactivées : expo-notifications sur Android n'est pas supporté dans Expo Go depuis SDK 53 (nécessite un dev build)."
    );
    notificationsModule = null;
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("expo-notifications") as NotificationsModule;
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: true,
      }),
    });
    notificationsModule = mod;
  } catch (error) {
    console.warn("Notifications indisponibles dans cet environnement :", error);
    notificationsModule = null;
  }
  return notificationsModule;
}

/**
 * Il n'y a pas d'infrastructure push (APNs/FCM) côté backend — c'est une vraie limite
 * d'infra, pas un choix du wallet : ajouter le push nécessiterait un service dédié côté
 * TrustWedge (device tokens, etc.), hors périmètre de ce chantier. En attendant, on notifie
 * localement à chaque resynchronisation (ouverture de l'app / pull-to-refresh / poll en
 * arrière-plan léger) quand un nouveau tokenId apparaît dans /documents/my.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  const Notifications = getNotifications();
  if (!Notifications) return false;

  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Degya",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    return status === "granted";
  } catch (error) {
    console.warn("Permission de notification indisponible dans cet environnement :", error);
    return false;
  }
}

export async function syncAndNotifyNewDocuments(): Promise<void> {
  const { documents, newTokenIds } = await syncDocuments();
  if (newTokenIds.length === 0) return;

  const Notifications = getNotifications();
  if (!Notifications) return;

  const newDocs = documents.filter((d) => newTokenIds.includes(d.tokenId));
  for (const doc of newDocs) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Nouvelle attestation",
          body: `${getDocTypeLabel(doc.docType)} · ${doc.docKey} reçu(e) dans votre wallet Degya.`,
          data: { tokenId: doc.tokenId },
        },
        trigger: null, // immédiat
      });
    } catch (error) {
      console.warn("Échec de la notification locale :", error);
    }
  }
}

export async function hasAnyLocalDocuments(): Promise<boolean> {
  const docs = await getLocalDocuments();
  return docs.length > 0;
}
