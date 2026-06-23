/**
 * Premium static iPhone Pro Max–style device frame.
 * Three visual layers: outer shell → screen viewport → content safe area.
 *
 * @param {{ children: import('react').ReactNode, className?: string }} props
 */
export function PhoneDeviceFrame({ children, className = '' }) {
  return (
    <div className={`phone-device ${className}`} dir="ltr">
      {/* Hardware buttons */}
      <div className="phone-device__btn phone-device__btn--silent" aria-hidden />
      <div className="phone-device__btn phone-device__btn--vol-up" aria-hidden />
      <div className="phone-device__btn phone-device__btn--vol-down" aria-hidden />
      <div className="phone-device__btn phone-device__btn--power" aria-hidden />

      {/* Layer 1 — metallic outer frame */}
      <div className="phone-device__shell">
        <div className="phone-device__bezel">
          {/* Layer 2 — screen viewport */}
          <div className="phone-device__viewport">
            <div className="phone-device__island" aria-hidden>
              <span className="phone-device__island-lens" />
            </div>

            {/* Layer 3 — clipped screen content */}
            <div className="phone-device__screen">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
