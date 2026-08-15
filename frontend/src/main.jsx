import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import App from "./App.jsx"
import { registerServiceWorker } from "./lib/pwa"

// Register PWA service worker
registerServiceWorker()

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
)
