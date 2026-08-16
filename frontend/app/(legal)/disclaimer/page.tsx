import type { Metadata } from "next";
import Link from "next/link";
import LegalDoc, { List, Fill, type Clause } from "@/components/legal/LegalDoc";
import { LEGAL_EFFECTIVE, LEGAL_VERSION } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Disclaimer",
  description:
    "VentureGenesis produces model estimates, not advice. What the numbers are, what they are not, and where they break.",
};

const A = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} className="text-text underline underline-offset-4 transition-colors hover:text-text-mute">
    {children}
  </Link>
);

const CLAUSES: Clause[] = [
  {
    id: "not-advice",
    heading: "This is not advice",
    body: (
      <>
        <p>
          VentureGenesis is an analysis tool. It is not a financial adviser, an investment adviser, a broker, an
          accountant, a lawyer or a tax agent, and nothing it produces is regulated advice of any kind.
        </p>
        <p>
          No output creates an adviser relationship between you and us. No output is a recommendation to raise money,
          spend money, hire, fire, sell, buy, incorporate, wind down, or take any other step. Where a reading looks like
          a recommendation (a board memo saying &ldquo;extend runway&rdquo;, a verdict reading &ldquo;at risk&rdquo;), that
          is a model output phrased in plain English, not counsel.
        </p>
        <p>
          Before acting on anything here, take advice from someone qualified and regulated to give it, who knows your
          actual circumstances.
        </p>
      </>
    ),
  },
  {
    id: "estimates",
    heading: "Every figure is an estimate",
    body: (
      <>
        <p>
          The health score, the twelve-month failure probability, the revenue forecast and the funding-readiness score
          are all produced by statistical models. They are estimates with error bars, not measurements.
        </p>
        <p>
          A failure probability of 41% does not mean your company will fail, and it does not mean it will not. It means
          that among the historical companies the model was fitted on, ones with a similar profile failed at roughly
          that rate. Your company is not that population. It is one company, with facts the model never saw.
        </p>
        <p>
          The model confidence figure shown next to a prediction tells you how much to trust that prediction. Read it.
          A confident-looking number with low confidence behind it is the most dangerous thing on the screen.
        </p>
      </>
    ),
  },
  {
    id: "inputs",
    heading: "The output is only as good as your input",
    body: (
      <>
        <p>
          Everything is computed from the figures you entered. Nothing is verified against your bank, your ledger or any
          external record, and nothing is invented to fill a gap.
        </p>
        <p>
          A mistyped burn rate produces a confidently wrong runway. An optimistic revenue figure produces an optimistic
          forecast. Stale numbers produce a reading of a company that no longer exists. If a reading surprises you, check
          the inputs before you believe the output.
        </p>
      </>
    ),
  },
  {
    id: "limits",
    heading: "Where the models break",
    body: (
      <>
        <p>Known limits, stated plainly:</p>
        <List
          items={[
            "Training data reflects the past. Models fitted on historical companies degrade when conditions shift (a funding winter, a rate change, a new technology), and they cannot tell you that they have.",
            "Rare cases are modelled worst. The further your business sits from the typical company in the training set, the wider the real error.",
            "Forecasts extrapolate. A time-series projection continues a pattern; it does not know about your contract renewal, your lawsuit, or your competitor's launch.",
            "Language-model agents can be wrong fluently. The written analyses, the competitor mapping and the board debate are generated text. They can state something false in a confident sentence, and they can miss something obvious.",
            "Outputs are not reproducible run to run. The same inputs can produce differently-worded analysis, and retrained models can move a score you have not touched.",
          ]}
        />
      </>
    ),
  },
  {
    id: "no-guarantee",
    heading: "No guarantee of outcome",
    body: (
      <>
        <p>
          Past performance, whether yours or that of the companies in the training data, does not predict future
          results. We do not warrant that any reading is accurate, complete, current or fit for a particular purpose.
        </p>
        <p>
          We do not promise that acting on a reading will improve your position, and we do not promise that ignoring one
          will harm it.
        </p>
      </>
    ),
  },
  {
    id: "third-party",
    heading: "Third-party and market information",
    body: (
      <p>
        Where an agent cites market sizes, competitors, funding rounds or other external facts, that information may
        come from a language model&apos;s training data or a web search, and it may be out of date, misattributed or
        wrong. Verify anything you intend to put in front of an investor, a board or a regulator.
      </p>
    ),
  },
  {
    id: "your-decision",
    heading: "The decision is yours",
    body: (
      <>
        <p>
          You remain solely responsible for every decision you take about your business. By using the platform you
          accept that you do so at your own risk, and that we are not liable for losses arising from decisions made on
          the basis of its output. The limits and exclusions in the <A href="/terms">Terms of Service</A> apply in full
          to everything on this page.
        </p>
        <p>
          Nothing in this disclaimer excludes liability that cannot be excluded by law.
        </p>
      </>
    ),
  },
  {
    id: "regulated",
    heading: "If you are regulated",
    body: (
      <p>
        If you operate in a regulated sector, or intend to include platform output in a prospectus, an investor update,
        a statutory filing or any regulated communication, take professional advice first. VentureGenesis output has not
        been prepared to any reporting, audit or regulatory standard. Questions go to <Fill>[legal@yourdomain]</Fill>.
      </p>
    ),
  },
];

export default function DisclaimerPage() {
  return (
    <LegalDoc
      title="Disclaimer"
      summary="What the platform's figures are, what they are not, and the conditions under which they are wrong."
      lead="These are model estimates, not advice."
      leadNote="Nothing VentureGenesis produces is financial, investment, legal or tax advice, and no reading is a prediction of what will happen to your company."
      effective={LEGAL_EFFECTIVE}
      version={LEGAL_VERSION}
      clauses={CLAUSES}
    />
  );
}
