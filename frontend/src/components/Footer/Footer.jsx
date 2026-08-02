import { Leaf, Camera, AtSign, Briefcase, Globe } from "lucide-react";
import "./Footer.css";

const COLUMNS = [
  {
    title: "Product",
    links: ["AI Chat", "Mood Tracker", "Daily Journal", "Focus Timer"],
  },
  {
    title: "Resources",
    links: ["Help Center", "Emergency Resources", "Community", "Guides"],
  },
  {
    title: "Company",
    links: ["About Us", "Careers", "Blog", "Contact"],
  },
  {
    title: "Legal",
    links: ["Privacy Policy", "Terms of Service", "Cookie Policy"],
  },
];

const SOCIALS = [
  { icon: Camera, label: "Instagram" },
  { icon: AtSign, label: "Twitter" },
  { icon: Briefcase, label: "LinkedIn" },
  { icon: Globe, label: "Facebook" },
];

function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div className="footer__top">
          <div className="footer__brand">
            <span className="footer__logo">
              <Leaf size={18} aria-hidden="true" />
              MindEase
            </span>
            <p className="footer__tagline">
              A calmer place to land, one small step at a time.
            </p>
            <div className="footer__socials">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href="#top"
                  className="footer__social"
                  aria-label={s.label}
                >
                  <s.icon size={16} aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>

          <div className="footer__columns">
            {COLUMNS.map((col) => (
              <div key={col.title} className="footer__column">
                <h4 className="footer__column-title">{col.title}</h4>
                <ul>
                  {col.links.map((link) => (
                    <li key={link}>
                      <a href="#top" className="footer__link">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="footer__bottom">
          <p>&copy; {new Date().getFullYear()} MindEase. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
