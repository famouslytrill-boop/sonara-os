import { PublicShell } from "../../components/PublicShell";

export default function TermsPage() {
  return (
    <PublicShell>
      <section className="rounded-3xl border border-[#2A2A35] bg-[#171720] p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#22D3EE]">Legal template</p>
        <h1 className="mt-3 text-3xl font-black">Terms of Service Template</h1>
        <div className="mt-4 grid max-w-3xl gap-4 leading-7 text-[#A1A1AA]">
          <p>
            The platform provides separate operating surfaces for creator technology, business operations, community/public
            information, and parent governance. These systems should not be blended into one customer dashboard.
          </p>
          <p>
            The software does not guarantee income, legal outcomes, tax outcomes, deployment approval, emergency delivery,
            official public authority status, copyright clearance, or distribution results.
          </p>
          <p>
            Users are responsible for rights clearance, uploaded content, organization permissions, source review, and human
            approval of high-risk actions.
          </p>
          <p>
            Working brand names, marks, and logos require trademark/domain review and qualified legal review before production
            launch.
          </p>
        </div>
      </section>
    </PublicShell>
  );
}
