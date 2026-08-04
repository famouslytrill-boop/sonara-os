"use strict";

// The longer-form guidance behind the three product tutorials.
//
// Written here rather than pasted from anywhere. The subject matter came from
// a set of infographics -- digital products and where they sell, growth work
// organised by job, protecting focused time -- but those were watermarked
// works belonging to the people who made them, several of them lead magnets.
// Facts and methods are not ownable; a particular expression of them is. So
// the topics are used and none of the wording, layout, or ordering is.
//
// House rules this copy is written to:
//
//   Plain customer-facing language. No engine names, and nothing described as
//   AI -- these are ordinary tools and checklists and the product does not
//   claim otherwise.
//
//   No revenue promises. The earnings disclaimer is not a footnote to work
//   around; a guide that implies income is a guide that contradicts it. Every
//   channel note below says what the channel is for, not what it will pay.
//
//   Nothing that needs setup is described as if it already works.
//
// Each guide is a list of [heading, body] pairs. The tutorial route renders
// them under the numbered steps, so a page reads as "here is the sequence,
// and here is what you actually need to know".

const GUIDES = {
  "/tutorials/business-builder": [
    [
      "Decide what the business owes its customer",
      "Before pricing or tooling, write one sentence: who this is for, what they get, and by when. If that sentence needs a paragraph to make sense, the offer is still two offers. Splitting it now costs an afternoon; splitting it after you have customers costs a refund."
    ],
    [
      "Price from the job, not from the hours",
      "Work out what the result is worth to the customer and what it costs you to deliver, then set a price between the two. Hourly pricing punishes you for getting faster. If you cannot name the delivery cost, you are not ready to quote — you are ready to run one at cost and measure it."
    ],
    [
      "Protect the hours the work actually happens in",
      "Most operating work fails on attention, not ability. Pick the two hours a day when you think most clearly and put the hardest task there, before messages. Everything reactive — enquiries, admin, follow-up — batches into a later block. A day with two protected hours beats a day with eight interrupted ones."
    ],
    [
      "Take enquiries in one place",
      "Enquiries scattered across text messages, email and social are enquiries you will lose. One intake route means one place to look, one record per customer, and a real answer to \"what did we agree?\" months later. That record is also what makes support, disputes and repeat business possible."
    ],
    [
      "Get the money path working before you promote anything",
      "Payments, bookings and confirmations either work end to end or they do not. Test the whole path yourself — as a customer, with a real card, through to the receipt — before any campaign. Finding out at the checkout that a step is missing costs you the customer, not just the sale."
    ],
    [
      "Keep the records that answer questions later",
      "What was quoted, what was agreed, what was delivered, what was paid. These are dull until the week you need them, and then they are the whole difference between a conversation and an argument. Write them as you go; nobody reconstructs them accurately afterwards."
    ],
    [
      "Review weekly, on a fixed day",
      "One short review beats constant checking. What came in, what closed, what is stuck, and what is the single most useful thing to do next week. A fixed slot stops the review being the thing that gets dropped when the week is busy — which is exactly the week you need it."
    ]
  ],

  "/tutorials/creator-studio": [
    [
      "What actually sells as a digital product",
      "Things people can use immediately: workbooks and guides, planners and schedules, document and portfolio templates, printable art, educational material, and card or invitation sets. The pattern is narrow and finished. A broad, general product competes with everything; a specific one competes with almost nothing."
    ],
    [
      "Make one thing well before making ten",
      "A catalogue of thin products sells worse than a single good one, and it costs far more to maintain. Build one, put it in front of real buyers, and fix what they actually complain about. The second product is much easier once you know which part of the first one people valued."
    ],
    [
      "Where these get sold, and what each place is for",
      "Your own storefront keeps the customer relationship and the margin, and asks you to bring the audience. Marketplaces bring browsing traffic and take a cut. Print-on-demand services handle physical fulfilment so you never hold stock. Education marketplaces reach teachers specifically. None of these guarantees sales — each is a different trade between reach, margin, and how much of the work you keep."
    ],
    [
      "Read the terms before you list, not after",
      "Every channel has rules about exclusivity, what may be listed, refunds, and who owns what you upload. They differ, and they change. Ten minutes on the terms before your first listing is cheaper than finding out at the point a listing is removed or a payout is held."
    ],
    [
      "Only sell what you have the rights to sell",
      "Fonts, images, icons, templates and audio all carry licences, and \"free to use\" often means free for personal use only. Commercial resale is a separate permission. Keep a note of where each asset came from and what its licence allows — for your own work you will want that record, and if a marketplace asks, having it is the difference between a fast answer and a removed listing."
    ],
    [
      "Price for the buyer's alternative",
      "The comparison is not your effort, it is what the buyer would otherwise do: pay someone, use a worse free version, or go without. Price against that. Very low prices do not reliably drive volume, and they set an expectation that is hard to move later."
    ],
    [
      "Write the listing for someone deciding in eight seconds",
      "State what it is, who it is for, what is included, and what format they receive. Show the actual contents rather than a styled mock-up. Most abandoned purchases are not price objections — they are the buyer failing to work out what they would be getting."
    ],
    [
      "Keep the source files organised from day one",
      "Editable originals, exported versions, licences, and the version you actually published. You will revisit this the first time a buyer reports a typo, a channel needs a different size, or you want to refresh a product two years on."
    ]
  ],

  "/tutorials/growth-studio": [
    [
      "Pick one outcome, not five",
      "Sign-ups, enquiries, bookings or repeat purchases — choose the one that matters this quarter. Campaigns that chase several outcomes at once cannot be judged, because any result can be explained as progress on something. One outcome makes the campaign either working or not."
    ],
    [
      "Fix the page before buying traffic",
      "Paid traffic to a page that does not convert is a fast way to learn what you already suspected. Make the offer and the next action unmistakable, cut the fields nobody needs, and check it on a phone. Doubling the conversion rate is usually cheaper than doubling the spend."
    ],
    [
      "Write to one person",
      "Copy aimed at everyone reads as aimed at nobody. Name the situation the reader is in and what changes for them. The specific version usually feels too narrow when you write it and performs better than the general one."
    ],
    [
      "Follow up like a person, and only where you are welcome",
      "Most enquiries are lost to silence rather than rejection. A short, useful, well-timed follow-up recovers a lot of them. Send it only to people who asked to hear from you, keep the record of when and how they agreed, and make leaving easy and immediate — the reputational cost of getting this wrong is far larger than the campaign."
    ],
    [
      "Measure what you can act on",
      "Impressions and followers rarely change a decision. Enquiries, bookings, cost per customer and repeat rate do. Pick the few numbers you would actually act on, and be honest that attribution is an estimate — people see you in several places before they buy, and no tool untangles that perfectly."
    ],
    [
      "Change one thing at a time",
      "Testing the headline, the price and the image at once tells you the combination moved and nothing about why. Run one change, give it enough volume to mean anything, and write down what you expected beforehand so you cannot rewrite the prediction afterwards."
    ],
    [
      "Keep every outbound action under your approval",
      "Sending, publishing and spending are the actions you cannot take back. Whatever you automate, keep a human approval in front of those three. The time it costs is small; the cost of an unreviewed send to the wrong list is not."
    ],
    [
      "Do more of what worked, and stop the rest",
      "The hardest part of growth work is ending things that are merely busy. Review on a fixed schedule, keep what produced the outcome you chose, and cut the rest without ceremony. Effort already spent is not a reason to continue."
    ]
  ]
};

function getGuide(route) {
  return GUIDES[route] || [];
}

module.exports = { GUIDES, getGuide };
