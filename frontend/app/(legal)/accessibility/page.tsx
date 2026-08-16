import type { Metadata } from "next";
import LegalDoc, { List, Fill, type Clause } from "@/components/legal/LegalDoc";
import { LEGAL_EFFECTIVE, LEGAL_VERSION } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Accessibility",
  description:
    "How VentureGenesis is built for assistive technology, what already conforms, and what does not yet.",
};

const CLAUSES: Clause[] = [
  {
    id: "commitment",
    heading: "What we are aiming at",
    body: (
      <>
        <p>
          VentureGenesis targets conformance with the Web Content Accessibility Guidelines (WCAG) 2.1 at level AA. That
          is the aim, and the sections below say honestly how far we have got.
        </p>
        <p>
          This statement covers the VentureGenesis web application and marketing site. It is reviewed whenever the
          interface changes materially.
        </p>
      </>
    ),
  },
  {
    id: "what-works",
    heading: "What conforms today",
    body: (
      <List
        items={[
          "Contrast. Body, muted and faint text all clear 4.5:1 against the surface they sit on, in both the light and the dark theme. The faint tone was raised specifically to meet this.",
          "Keyboard. Every control (navigation, filters, the sort menu, the pin buttons, the search field) is reachable and operable by keyboard, with a visible focus ring at 2px offset from the control.",
          "Reduced motion. prefers-reduced-motion is honoured globally: shimmer, pulse, count-ups, hover lifts and the landing ornaments all stop.",
          "Content is never hidden behind an animation. Text and controls render at full opacity on the first paint; no section depends on a scroll reveal or a script to become visible.",
          "Pending state. While a reading is being computed its card is marked aria-busy and reads as \"Computing\" rather than as an empty value, and the placeholder bars themselves are hidden from screen readers as decoration.",
          "Semantics. Landmarks, heading order, form labels and table headers are marked up properly rather than simulated with styling.",
          "Both themes. Light and dark are real, separately-checked palettes, not one inverted with a filter.",
        ]}
      />
    ),
  },
  {
    id: "known-gaps",
    heading: "What does not conform yet",
    body: (
      <>
        <p>Stated plainly, because a statement that claims full conformance is usually not true:</p>
        <List
          items={[
            "Charts and card visuals convey their reading visually. Each carries a text label and the same figure is repeated as text on the card, but the SVG shapes themselves are marked decorative rather than described in full.",
            "The executive report renders as fixed-width printed sheets. It reflows poorly below roughly 380px and at very high zoom.",
            "Some third-party surfaces, including the authentication screens and any embedded provider widget, are outside our markup, and their conformance is the provider's.",
            "Long agent output is not chunked with headings in every case, which makes screen-reader navigation of a full board debate slower than it should be.",
          ]}
        />
        <p>These are tracked as defects, not accepted as permanent.</p>
      </>
    ),
  },
  {
    id: "compatibility",
    heading: "What we test with",
    body: (
      <>
        <p>
          The interface is checked against current versions of Chrome, Firefox, Safari and Edge, with VoiceOver on macOS
          and iOS, and with keyboard-only navigation. It is not yet routinely tested with JAWS, NVDA or Dragon.
        </p>
        <p>
          It should work with browser zoom to 200% and with your own font-size and contrast preferences applied.
        </p>
      </>
    ),
  },
  {
    id: "feedback",
    heading: "Telling us something is broken",
    body: (
      <>
        <p>
          If any part of the product blocks you, tell us and we will fix it. Reports of an access barrier are
          prioritised above feature work.
        </p>
        <p>
          Write to <Fill>[accessibility@yourdomain]</Fill> with the page, what you were trying to do, and the assistive
          technology and browser you were using. We aim to acknowledge within{" "}
          <Fill>[response window, e.g. 3 working days]</Fill> and to give a fix or a timetable.
        </p>
        <p>
          If you need a reading in another format, a plain-text export of a report for instance, ask and we will provide
          it.
        </p>
      </>
    ),
  },
  {
    id: "photosensitivity",
    heading: "Motion and photosensitivity",
    body: (
      <p>
        Nothing in the interface flashes more than three times a second, and there is no strobing, parallax-heavy or
        auto-playing video content. The only movement is a slow shimmer on loading placeholders, a count-up on figures
        as they land, and gentle drift on the landing page. All of it stops entirely when your system is set to reduce
        motion.
      </p>
    ),
  },
];

export default function AccessibilityPage() {
  return (
    <LegalDoc
      title="Accessibility"
      summary="How the product is built for assistive technology, what already meets WCAG 2.1 AA, what does not yet, and how to tell us when something blocks you."
      effective={LEGAL_EFFECTIVE}
      version={LEGAL_VERSION}
      clauses={CLAUSES}
    />
  );
}
