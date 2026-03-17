import LandingPage from "@/components/LandingPage";

export default function Home() {
  const heroVideoUrl = process.env.NEXT_PUBLIC_HERO_VIDEO_URL || "";
  return <LandingPage heroVideoUrl={heroVideoUrl} />;
}
