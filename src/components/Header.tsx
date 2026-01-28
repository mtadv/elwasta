"use client";

import { usePathname } from "next/navigation";
import HeaderPublic from "./HeaderPublic";
import HeaderRecruiter from "./HeaderRecruiter";

export default function Header() {
  const pathname = usePathname();

  // Recruiter dashboard
  if (pathname.startsWith("/recruiter")) {
    return <HeaderRecruiter />;
  }

  // Everything else
  return <HeaderPublic />;
}
