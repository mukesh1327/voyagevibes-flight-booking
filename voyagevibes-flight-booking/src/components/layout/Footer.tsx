/**
 * Footer Component
 */

import React from 'react';
import './Footer.css';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-container">
        {/* Footer Content */}
        <div className="footer-grid">
          {/* About */}
          <div className="footer-section">
            <h3>About VoyageVibes</h3>
            <ul>
              <li><a href="#about">About Us</a></li>
              <li><a href="#careers">Careers</a></li>
              <li><a href="#press">Press</a></li>
            </ul>
          </div>

          {/* Support */}
          <div className="footer-section">
            <h3>Support</h3>
            <ul>
              <li><a href="#help">Help Center</a></li>
              <li><a href="#contact">Contact Us</a></li>
              <li><a href="#faq">FAQ</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div className="footer-section">
            <h3>Legal</h3>
            <ul>
              <li><a href="#privacy">Privacy Policy</a></li>
              <li><a href="#terms">Terms & Conditions</a></li>
              <li><a href="#refund">Refund Policy</a></li>
            </ul>
          </div>

          {/* Follow */}
          <div className="footer-section">
            <h3>Follow Us</h3>
            <div className="social-links">
              <a href="#twitter" title="Twitter">𝕏</a>
              <a href="#facebook" title="Facebook">f</a>
              <a href="#instagram" title="Instagram">📷</a>
              <a href="#linkedin" title="LinkedIn">in</a>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="footer-bottom">
          <p>&copy; {currentYear} VoyageVibes. All rights reserved.</p>
          <p>Made with ✈️ for travelers</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
