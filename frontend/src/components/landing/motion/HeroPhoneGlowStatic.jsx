/**
 * Static ambient glow behind the hero phone — no animation.
 */
export function HeroPhoneGlowStatic() {
  return (
    <div
      className="pointer-events-none absolute -inset-5 rounded-[3.5rem] opacity-[0.72] blur-2xl sm:-inset-6 sm:blur-3xl"
      style={{
        background:
          'radial-gradient(circle at 48% 38%, rgba(201, 162, 39, 0.16), transparent 54%), radial-gradient(circle at 62% 68%, rgba(201, 162, 39, 0.12), transparent 50%)',
      }}
      aria-hidden
    />
  );
}
