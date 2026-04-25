import IntroFlashClient from "./IntroFlashClient";

/** Keep the original flash experience available at /intro. */
export default function IntroPage() {
  return <IntroFlashClient appType="accounting" />;
}
