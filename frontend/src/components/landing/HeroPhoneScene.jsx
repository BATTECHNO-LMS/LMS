import { BattechnoPhoneApp } from './BattechnoPhoneApp.jsx';

/**
 * Hero phone scene — ambient glow behind a static device frame.
 */
export function HeroPhoneScene() {
  return (
    <div className="landing-phone-scene">
      <div className="landing-phone-scene__ambient" aria-hidden>
        <div className="landing-phone-scene__glow" />
        <div className="landing-phone-scene__orb landing-phone-scene__orb--gold" />
        <div className="landing-phone-scene__orb landing-phone-scene__orb--navy" />
      </div>

      <div className="landing-phone-scene__stage">
        <div className="landing-phone-scene__device">
          <BattechnoPhoneApp variant="device" />
        </div>
      </div>
    </div>
  );
}
