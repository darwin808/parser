import { AuthProvider } from "@/lib/AuthContext";
import "./globals.css";

export const metadata: any = {
  title: "Invoice Parser",
  description: "AI-powered invoice parsing",
};

export default function RootLayout({ children }: any) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
