import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { createThemeProvider } from "./components/theme-provider";

// Create theme provider before rendering the app
createThemeProvider();

createRoot(document.getElementById("root")!).render(<App />);
