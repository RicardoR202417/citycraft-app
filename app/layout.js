import "sileo/styles.css";
import "./globals.css";
import { GlobalNavigation } from "../components/navigation/GlobalNavigation";
import { Providers } from "./providers";

export const metadata = {
  title: "CityCraft App",
  description:
    "Economia, propiedades, mercado y foro publico para una ciudad de Minecraft Bedrock."
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <Providers>
          <GlobalNavigation />
          <div className="app-shell">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
