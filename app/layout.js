import "sileo/styles.css";
import "./globals.css";
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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
