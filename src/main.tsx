import { createRoot } from "react-dom/client";
import App from "./App";
import { migrateFromLocalStorage, requestPersistentStorage } from "@/lib/storage";
import "./index.css";

Promise.all([migrateFromLocalStorage(), requestPersistentStorage()]).then(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});
