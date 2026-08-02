import Navbar from "../components/Navbar/Navbar";
import Hero from "../components/Hero/Hero";
import Stats from "../components/Stats/Stats";
import Features from "../components/Features/Features";
import HowItWorks from "../components/HowItWorks/HowItWorks";
import Testimonials from "../components/Testimonials/Testimonials";
import Privacy from "../components/Privacy/Privacy";
import CTA from "../components/CTA/CTA";
import Footer from "../components/Footer/Footer";

function Home() {
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <Navbar />
      <main id="main">
        <Hero />
        <Stats />
        <Features />
        <HowItWorks />
        <Testimonials />
        <Privacy />
        <CTA />
      </main>
      <Footer />
    </>
  );
}

export default Home;
