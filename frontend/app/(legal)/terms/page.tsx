import type { Metadata } from "next";
import Link from "next/link";
import LegalDoc, { List, Fill, type Clause } from "@/components/legal/LegalDoc";
import { LEGAL_EFFECTIVE, LEGAL_VERSION } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The agreement between you and VentureGenesis for use of the platform.",
};

const A = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} className="text-text underline underline-offset-4 transition-colors hover:text-text-mute">
    {children}
  </Link>
);

const CLAUSES: Clause[] = [
  {
    id: "agreement",
    heading: "The agreement",
    body: (
      <>
        <p>
          These terms are a contract between you and <Fill>[registered entity name]</Fill> (&ldquo;VentureGenesis&rdquo;,
          &ldquo;we&rdquo;, &ldquo;us&rdquo;), registered at <Fill>[registered address]</Fill>. They govern your use of
          the VentureGenesis website and application.
        </p>
        <p>
          By creating an account or using the platform you accept these terms. If you are accepting on behalf of a
          company, you confirm you are authorised to bind that company, and &ldquo;you&rdquo; means that company.
        </p>
        <p>
          If you do not accept these terms, do not use the platform.
        </p>
      </>
    ),
  },
  {
    id: "what-we-provide",
    heading: "What the platform does",
    body: (
      <>
        <p>
          VentureGenesis takes figures you enter about your business and runs them through statistical models and
          language-model agents to produce estimates: a health score, a failure probability, a revenue projection, a
          funding-readiness score, and a set of written analyses.
        </p>
        <p>
          Every output is an estimate produced by software. It is not advice, and it is not a statement of fact about
          your business or its prospects. This is important enough to have its own document: read the{" "}
          <A href="/disclaimer">Disclaimer</A> before you rely on anything the platform tells you.
        </p>
      </>
    ),
  },
  {
    id: "accounts",
    heading: "Your account",
    body: (
      <>
        <p>
          You need an account to use the platform. Authentication is handled by Clerk on our behalf. You are responsible
          for keeping your credentials secure and for everything done through your account.
        </p>
        <List
          items={[
            "You must be at least 18 and able to enter a contract.",
            "The information you register with must be accurate, and kept accurate.",
            "Tell us promptly if you believe your account has been accessed by someone else.",
            "Do not share an account between people. Accounts are for one named user.",
          ]}
        />
      </>
    ),
  },
  {
    id: "your-content",
    heading: "The figures you enter",
    body: (
      <>
        <p>
          The business information you enter stays yours. You grant us only the licence we need to operate the service:
          to store your inputs, process them through our models and the third-party model providers listed in the{" "}
          <A href="/privacy">Privacy Policy</A>, and return the results to you.
        </p>
        <p>
          You confirm that you have the right to submit the information you enter, and that submitting it does not
          breach a confidentiality obligation you owe to somebody else. That is worth pausing on: do not paste in a
          third party&apos;s confidential data, and treat anything you enter as data that leaves your machine.
        </p>
        <p>
          We do not sell your inputs, and we do not use them to train models of our own.
        </p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    heading: "Acceptable use",
    body: (
      <>
        <p>You agree not to:</p>
        <List
          items={[
            "Present platform output as independent financial, investment, legal or tax advice to anyone else.",
            "Use the platform to produce material that is unlawful, defamatory, or infringes someone's rights.",
            "Reverse engineer, scrape, or attempt to extract the models or the prompts behind them.",
            "Probe, load-test or interfere with the service, or circumvent rate limits and access controls.",
            "Resell or white-label the service without a written agreement with us.",
          ]}
        />
        <p>
          We may suspend or close an account that breaches this clause, and where the breach is serious we may do so
          without notice.
        </p>
      </>
    ),
  },
  {
    id: "third-parties",
    heading: "Third-party services",
    body: (
      <>
        <p>
          The platform depends on services we do not control, including authentication, hosting, and the language-model
          providers that run the reasoning agents. Their availability, and their own terms, affect what we can deliver.
        </p>
        <p>
          We choose these providers carefully and list them in the <A href="/privacy">Privacy Policy</A>, but we are not
          responsible for their acts or omissions beyond what the law requires of us.
        </p>
      </>
    ),
  },
  {
    id: "fees",
    heading: "Fees and billing",
    body: (
      <>
        <p>
          Where a paid plan applies, the price, billing period and included usage are those shown at the point of
          purchase. Fees are stated exclusive of tax unless we say otherwise, and you are responsible for any tax that
          applies to you.
        </p>
        <p>
          Subscriptions renew automatically for the same period until cancelled. Cancelling stops the next renewal; it
          does not refund the period already paid for, except where the law gives you a refund right.
        </p>
        <p>
          We may change prices with at least <Fill>[notice period, e.g. 30 days]</Fill> notice before the change takes
          effect for you.
        </p>
      </>
    ),
  },
  {
    id: "availability",
    heading: "Availability and changes",
    body: (
      <>
        <p>
          The platform is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. We do not promise it
          will be uninterrupted or error-free, and we may take it down for maintenance.
        </p>
        <p>
          We develop the product continuously. Models get retrained, agents get rewritten, and readings can change as a
          result, including for inputs you have not touched. Where a change materially reduces what you get on a paid
          plan, we will tell you.
        </p>
      </>
    ),
  },
  {
    id: "liability",
    heading: "Limits on our liability",
    body: (
      <>
        <p>
          Nothing here limits liability that cannot be limited by law: death or personal injury caused by our
          negligence, fraud, or fraudulent misrepresentation.
        </p>
        <p>Subject to that, and to the extent the law allows:</p>
        <List
          items={[
            "We are not liable for business decisions you make on the basis of platform output. The Disclaimer explains why in detail.",
            "We are not liable for lost profits, lost revenue, lost opportunity, lost data, or indirect or consequential loss.",
            "Our total liability arising out of these terms is capped at the greater of the fees you paid us in the twelve months before the claim, or one hundred (100) units of the currency you were billed in.",
          ]}
        />
      </>
    ),
  },
  {
    id: "termination",
    heading: "Ending the agreement",
    body: (
      <>
        <p>
          You can stop using the platform and close your account at any time. We can suspend or close your account if
          you breach these terms, if we are required to by law, or if we discontinue the service. In that last case we
          give reasonable notice.
        </p>
        <p>
          On closure we delete or anonymise your data on the schedule set out in the <A href="/privacy">Privacy Policy</A>.
          Export anything you want to keep before you close the account.
        </p>
      </>
    ),
  },
  {
    id: "law",
    heading: "Governing law",
    body: (
      <>
        <p>
          These terms are governed by the laws of <Fill>[governing jurisdiction]</Fill>, and the courts of{" "}
          <Fill>[courts]</Fill> have exclusive jurisdiction over any dispute. Consumers keep any right they have to bring
          proceedings where they live.
        </p>
        <p>
          If a clause is found unenforceable, the rest stays in force. Our not enforcing a clause is not a waiver of it.
        </p>
      </>
    ),
  },
  {
    id: "changes-contact",
    heading: "Changes, and how to reach us",
    body: (
      <>
        <p>
          We may update these terms. The version and effective date at the top of this page always reflect the current
          text. Where a change materially affects your rights we will give notice by email or in the app before it takes
          effect, and continuing to use the platform after that date means you accept the new version.
        </p>
        <p>
          Questions about these terms go to <Fill>[legal@yourdomain]</Fill>.
        </p>
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalDoc
      title="Terms of Service"
      summary="What you can expect from VentureGenesis, what we expect from you, and where the limits sit. Written to be read, not skimmed past."
      effective={LEGAL_EFFECTIVE}
      version={LEGAL_VERSION}
      clauses={CLAUSES}
    />
  );
}
