import { buildReviewRoom } from "../../lib/sonara/review/reviewRoomEngine";

export function ReviewRoomCard() {
  const review = buildReviewRoom();
  return (
    <section className="rounded-lg border border-[#332A40] bg-[#191522] p-4 text-[#F9FAFB]">
      <p className="text-xs font-black uppercase text-[#FFB454]">Review Room</p>
      <h3 className="mt-2 text-xl font-black">Human approval before risky moves</h3>
      <ul className="mt-3 grid gap-1 text-sm leading-6 text-[#C4BFD0]">
        {review.approvalChecklist.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
