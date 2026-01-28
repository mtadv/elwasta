import Link from "next/link";

export default function HeaderPublic() {
  return (
    <header className="border-b border-black">
    <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
  
      {/* Logo */}
      <Link href="/" className="flex items-center">
        <img
          src="/elwasta-logo.png"
          alt="Elwasta"
          className="h-10 md:h-12"
        />
      </Link>
  
        {/* Navigation */}
        <nav className="flex items-center gap-6 text-sm">

          <Link href="/about" className="hover:underline">
            About
          </Link>

          <Link href="/contact" className="hover:underline">
            Contact
          </Link>

          <Link href="/candidate/onboard" className="hover:underline">
            Find a job
          </Link>

          <Link
            href="/login"
            className="bg-black text-white px-4 py-2 rounded"
          >
            Start hiring
          </Link>

        </nav>
      </div>
    </header>
  );
}
