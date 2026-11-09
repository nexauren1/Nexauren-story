import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const uid = process.argv[2];
if (!uid) {
  console.error("Uso: npm run grant:admin -- FIREBASE_USER_UID");
  process.exit(1);
}
initializeApp({ credential: applicationDefault() });
const auth = getAuth();
const user = await auth.getUser(uid);
await auth.setCustomUserClaims(uid, { ...(user.customClaims ?? {}), admin: true });
console.log("Permissão de administrador atribuída a:", uid);
console.log("Termina a sessão e volta a entrar para atualizar o token.");
