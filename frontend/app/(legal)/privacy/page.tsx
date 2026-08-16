import type { Metadata } from "next";
import Link from "next/link";
import LegalDoc, { List, Fill, type Clause } from "@/components/legal/LegalDoc";
import { LEGAL_EFFECTIVE, LEGAL_VERSION } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What VentureGenesis collects, why, who it reaches, and how long it is kept.",
};

const A = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} className="text-text underline underline-offset-4 transition-colors hover:text-text-mute">
    {children}
  </Link>
);

/** A processor and the reason it exists, set as a real table rather than chips. */
function Processors() {
  const rows: [string, string, string][] = [
    ["Clerk", "Authentication and account management", "Email, name, sign-in metadata"],
    ["Vercel", "Application hosting and delivery", "Request logs, IP address"],
    ["Model providers", "Running the reasoning agents", "The business text you submit for analysis"],
    ["[analytics provider]", "Product analytics, if enabled", "Page views, coarse device and region"],
  ];
  return (
    <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className="pb-3 pr-4 font-medium text-text">Who</th>
            <th scope="col" className="pb-3 pr-4 font-medium text-text">Why</th>
            <th scope="col" className="pb-3 font-medium text-text">What reaches them</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([who, why, what]) => (
            <tr key={who} className="border-b border-line last:border-0">
              <td className="py-3 pr-4 align-top text-text-dim">
                {who.startsWith("[") ? <Fill>{who}</Fill> : who}
              </td>
              <td className="py-3 pr-4 align-top text-text-mute">{why}</td>
              <td className="py-3 align-top text-text-mute">{what}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const CLAUSES: Clause[] = [
  {
    id: "who-we-are",
    heading: "Who is responsible",
    body: (
      <>
        <p>
          <Fill>[registered entity name]</Fill>, of <Fill>[registered address]</Fill>, is the controller of the personal
          data described here. Reach us about anything on this page at <Fill>[privacy@yourdomain]</Fill>.
        </p>
        <p>
          This policy covers the VentureGenesis website and application. It sits alongside the{" "}
          <A href="/terms">Terms of Service</A>.
        </p>
      </>
    ),
  },
  {
    id: "what-we-collect",
    heading: "What we collect",
    body: (
      <>
        <p>Three kinds of data, and no more than we need for each.</p>
        <List
          items={[
            <>
              <span className="font-medium text-text">Account data.</span> Your email address, your name if you give it,
              and the sign-in metadata our authentication provider records. This is how we know who you are.
            </>,
            <>
              <span className="font-medium text-text">The figures you enter.</span> Revenue, burn, headcount, runway,
              your description of the business, and everything else in the questionnaire. This is the input the models
              run on, and it is the reason the product exists.
            </>,
            <>
              <span className="font-medium text-text">Technical data.</span> IP address, browser and device type, and
              request logs, collected automatically when you use the service.
            </>,
          ]}
        />
        <p>
          We do not ask for special-category data, payment card numbers (a payment provider handles those directly), or
          anything about people other than you. Please do not enter it.
        </p>
      </>
    ),
  },
  {
    id: "why",
    heading: "Why we use it, and on what basis",
    body: (
      <>
        <List
          items={[
            <>
              To provide the platform: running your figures through the models and returning the readings.{" "}
              <span className="text-text-mute">Basis: performance of our contract with you.</span>
            </>,
            <>
              To keep the service secure, debug failures, and prevent abuse.{" "}
              <span className="text-text-mute">Basis: our legitimate interest in a working, safe service.</span>
            </>,
            <>
              To improve the product in aggregate, using measurements that do not identify you.{" "}
              <span className="text-text-mute">Basis: legitimate interest.</span>
            </>,
            <>
              To meet legal, accounting and tax obligations.{" "}
              <span className="text-text-mute">Basis: legal obligation.</span>
            </>,
          ]}
        />
        <p>
          We do not sell personal data, we do not share it with advertisers, and we do not use your figures to train our
          own models or anyone else&apos;s.
        </p>
      </>
    ),
  },
  {
    id: "processors",
    heading: "Who else sees it",
    body: (
      <>
        <p>
          The service runs on infrastructure we do not own, so some data necessarily reaches our suppliers. Each is
          bound by a data-processing agreement and may only act on our instructions.
        </p>
        <Processors />
        <p>
          The reasoning agents send the business text you submit to a language-model provider to be analysed. Under our
          agreements that content is processed to return your result and is not used to train their models. If that is
          not acceptable for a particular piece of information, do not enter it.
        </p>
      </>
    ),
  },
  {
    id: "transfers",
    heading: "Where it goes",
    body: (
      <p>
        Our suppliers operate internationally, so your data may be processed outside{" "}
        <Fill>[your region]</Fill>. Where it is, the transfer is covered by an adequacy decision or by standard
        contractual clauses, and we hold copies of those safeguards. Ask us for them at <Fill>[privacy@yourdomain]</Fill>.
      </p>
    ),
  },
  {
    id: "retention",
    heading: "How long we keep it",
    body: (
      <>
        <List
          items={[
            "Account data: for as long as your account is open, then up to 30 days after closure.",
            "The figures you enter, and the readings produced from them: until you delete them, or 30 days after account closure.",
            "Request and security logs: up to 12 months.",
            "Billing records: for as long as tax and accounting law requires, typically six to seven years.",
          ]}
        />
        <p>Anything kept beyond those windows is aggregated so it no longer identifies you.</p>
      </>
    ),
  },
  {
    id: "your-rights",
    heading: "Your rights",
    body: (
      <>
        <p>Depending on where you live, you can ask us to:</p>
        <List
          items={[
            "Give you a copy of the personal data we hold about you, in a portable format.",
            "Correct anything inaccurate.",
            "Delete your data, where we have no overriding obligation to keep it.",
            "Restrict or object to a particular use, including any based on legitimate interest.",
            "Withdraw a consent you previously gave, without affecting what was done before you withdrew it.",
          ]}
        />
        <p>
          Write to <Fill>[privacy@yourdomain]</Fill> and we will answer within one month. If you are unhappy with the
          answer you can complain to your data protection authority. In the UK that is the Information
          Commissioner&apos;s Office.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    heading: "Cookies",
    body: (
      <>
        <p>
          We use the cookies the product needs to work: a session cookie so you stay signed in, and a preference cookie
          remembering whether you chose the light or dark surface. Neither tracks you across other sites.
        </p>
        <p>
          If analytics are enabled on your deployment, they are described at <Fill>[analytics provider]</Fill> above and
          are set only where the law requires consent and you have given it.
        </p>
      </>
    ),
  },
  {
    id: "security",
    heading: "Security",
    body: (
      <p>
        Data is encrypted in transit, access to production systems is limited to the people who need it, and
        authentication is delegated to a specialist provider rather than rolled by hand. No system is perfectly secure;
        if a breach affects your rights we will notify you and the relevant authority within the statutory deadline.
      </p>
    ),
  },
  {
    id: "changes",
    heading: "Changes to this policy",
    body: (
      <p>
        The version and effective date at the top of this page always describe the current text. Where a change
        materially affects how we handle your data we will tell you by email or in the app before it takes effect.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalDoc
      title="Privacy Policy"
      summary="What we collect, why we hold it, who else it reaches, and how to get it back or have it deleted."
      effective={LEGAL_EFFECTIVE}
      version={LEGAL_VERSION}
      clauses={CLAUSES}
    />
  );
}
