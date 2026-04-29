import "./globals.css";

export const metadata = {
  title: "CityCraft App",
  description:
    "Economia, propiedades, mercado y foro publico para una ciudad de Minecraft Bedrock."
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
