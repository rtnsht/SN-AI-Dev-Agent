import LandingPage from "@/components/LandingPage";
import HomePageLanding from "@/components/HomePageLanding";

/**
 * Toggle via NEXT_PUBLIC_LANDING_MODE in .env:
 *   "home"    → minimal home page with welcome intro modal
 *   "landing" → classic marketing landing page (default)
 */
export default function Home() {
  const isHomePage = process.env.NEXT_PUBLIC_LANDING_MODE === "home";
  return isHomePage ? <HomePageLanding /> : <LandingPage />;
}
