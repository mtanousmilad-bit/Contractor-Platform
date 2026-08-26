export const metadata = {
  title: "Terms of Service | ContractorHub",
  description: "ContractorHub Terms of Service",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-4xl font-bold tracking-tight">Terms of Service</h1>
        <p className="mt-3 text-sm text-slate-500">Effective: 24 August 2026</p>

        <div className="mt-10 space-y-8 leading-7 text-slate-700">
          <section>
            <h2 className="text-xl font-semibold text-slate-900">1. About ContractorHub</h2>
            <p className="mt-2">ContractorHub is an online platform that helps customers connect with independent construction contractors, communicate about projects, manage invoices and make payments for agreed services.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">2. Accounts and acceptable use</h2>
            <p className="mt-2">You must provide accurate information, keep your account secure and use the platform lawfully. You must not misuse the service, attempt unauthorised access, interfere with platform security, impersonate another person, submit fraudulent information or use the platform for unlawful activity.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">3. Independent contractors</h2>
            <p className="mt-2">Contractors using ContractorHub are independent service providers and are not employees or agents of ContractorHub. Customers and contractors are responsible for agreeing the scope, price, timing, quality and other terms of the underlying construction or trade services.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">4. Payments and platform fees</h2>
            <p className="mt-2">Payments are processed through Stripe. ContractorHub may charge a platform fee when an invoice is paid. The applicable amount or fee information is presented through the platform or payment flow. Stripe may apply its own terms, verification requirements, fees, payment rules and dispute procedures.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">5. Refunds, disputes and chargebacks</h2>
            <p className="mt-2">Refunds and payment disputes may be handled through ContractorHub and Stripe. Where a cardholder dispute or chargeback occurs, funds may be withheld, reversed or recovered in accordance with Stripe rules and the payment flow used by the platform. Users must provide truthful information and cooperate with reasonable requests relating to a payment dispute.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">6. User content</h2>
            <p className="mt-2">You remain responsible for information, messages, project details, documents and other content you submit. You give ContractorHub permission to host, process and use that content as reasonably necessary to operate, secure and improve the platform and provide the requested services.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">7. Platform availability</h2>
            <p className="mt-2">We aim to keep ContractorHub available and reliable, but we do not guarantee uninterrupted or error-free operation. Features may change, be suspended or be unavailable from time to time for maintenance, security, legal, technical or business reasons.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">8. Responsibility for services</h2>
            <p className="mt-2">ContractorHub provides the platform and payment-related tools but does not perform the underlying construction work. To the extent permitted by law, ContractorHub is not responsible for the quality, safety, legality, licensing, timing or completion of services supplied by independent contractors.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">9. Suspension or termination</h2>
            <p className="mt-2">We may restrict or suspend access where reasonably necessary to protect users, investigate fraud or misuse, comply with legal obligations, address security risks or enforce these Terms.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">10. Changes to these Terms</h2>
            <p className="mt-2">We may update these Terms from time to time. The updated version will be posted on this page with a revised effective date.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">11. Contact</h2>
            <p className="mt-2">For support or questions about these Terms, contact <a className="font-medium underline" href="mailto:mtanousmilad@gmail.com">mtanousmilad@gmail.com</a>.</p>
          </section>
        </div>
      </div>
    </main>
  );
}