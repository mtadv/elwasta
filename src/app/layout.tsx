import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import GoogleAnalytics from "@/components/GoogleAnalytics";
// import { acronym } from "./fonts"; // only if font exists

export const metadata = {
  title: "Elwasta",
  description: "Smart hiring, powered by AI",
  icons: {
    icon: "/icon.png",
  },
};


export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={
          "bg-white text-black min-h-screen flex flex-col"
          // acronym.className  ← enable only if font file exists
        }
      >
        <GoogleAnalytics />
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
