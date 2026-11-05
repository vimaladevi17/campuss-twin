import Hero from "../components/Hero";
import Stats from "../components/Stats";
import Features from "../components/Features";
import Footer from "../components/Footer";
import QuickAccess from "../components/QuickAccess";
import News from "../components/News";
import Gallery from "../components/Gallery";
import Announcement from "../components/Announcement";
function Home() {
  return (
    <>
      <Announcement/>
      <Hero />
      <QuickAccess />
      <Stats />
      <Features />
      <News />
      <Gallery/>
      <Footer />
    </>
  );
}

export default Home;