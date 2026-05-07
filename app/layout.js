import "sileo/styles.css";
import "./globals.css";
import { GlobalNavigation } from "../components/navigation/GlobalNavigation";
import { Providers } from "./providers";

const themeScript = `
try {
  var theme = window.localStorage.getItem("citycraft-theme");
  if (theme === "light" || theme === "dark") {
    document.documentElement.dataset.theme = theme;
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
} catch (error) {}
`;

export const metadata = {
  title: "CityCraft App",
  description:
    "Economia, propiedades, mercado y foro publico para una ciudad de Minecraft Bedrock."
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>
          <GlobalNavigation />
          <div className="app-shell">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
