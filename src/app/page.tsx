import {
  Navbar,
  Hero,
  Features,
  HowItWorks,
  Packages,
  Testimonials,
  FAQ,
  CTA,
  Footer,
} from "@/components/landing";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950">
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <Packages />
      <Testimonials />
      <FAQ />
      <CTA />
      <Footer />
    </main>
  );
}
