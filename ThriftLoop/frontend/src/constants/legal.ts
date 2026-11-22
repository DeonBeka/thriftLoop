/**
 * Legal documents shown in the app. Written for the ThriftLoop hackathon MVP — have a lawyer
 * review them before a public launch, and update LAST_UPDATED whenever they change.
 */
export const LAST_UPDATED = '21 November 2026';

export type LegalDocId = 'terms' | 'privacy' | 'seller' | 'delivery';

interface LegalSection {
  heading: string;
  body: string;
}

export interface LegalDoc {
  title: string;
  summary: string;
  sections: LegalSection[];
}

export const LEGAL: Record<LegalDocId, LegalDoc> = {
  terms: {
    title: 'Terms of Service',
    summary: 'The rules for using ThriftLoop to buy and sell second-hand clothing.',
    sections: [
      {
        heading: '1. About ThriftLoop',
        body: 'ThriftLoop is a marketplace that connects people who want to sell second-hand clothing with people who want to buy it. ThriftLoop is not the seller of any item and is not a party to the sale between a buyer and a seller.',
      },
      {
        heading: '2. Your account',
        body: 'You must be at least 16 years old to create an account. Keep your password private and tell us if you think someone else has accessed your account. You are responsible for everything done through your account. One person may hold one account.',
      },
      {
        heading: '3. Roles',
        body: 'Every new account is a Viewer and can browse, save, message and buy. To list items you must apply to become a Seller and be approved by a ThriftLoop administrator after identity verification. We may refuse or remove seller access at any time, for example if verification fails or these Terms are broken.',
      },
      {
        heading: '4. Listings',
        body: 'Sellers must only list items they own and are allowed to sell, describe them honestly (including size, condition and any flaws) and use their own photos. Counterfeit goods, stolen goods, underwear that has been worn, and items that are illegal or unsafe are not allowed. We may remove any listing without notice.',
      },
      {
        heading: '5. Buying and payment',
        body: 'Purchases are paid in cash to the seller on delivery, or by card where offered (test mode in this demo), under the Order & Payment Terms. Prices are set by sellers and shown in euro. Placing an order is a commitment to buy: please only order if you intend to pay and receive the item.',
      },
      {
        heading: '6. Behaviour',
        body: 'Be respectful in messages. Do not harass, scam, spam, or try to move payments off the agreed method to defraud someone. Do not misuse the service, including sending automated or excessive requests; we limit request rates to keep ThriftLoop fast and safe.',
      },
      {
        heading: '7. Our responsibility',
        body: 'We work to keep ThriftLoop safe, but we do not inspect items and cannot guarantee the quality, safety or legality of items listed, or that buyers and sellers will complete a sale. To the extent allowed by law, ThriftLoop is not liable for losses arising from transactions between users.',
      },
      {
        heading: '8. Ending your account',
        body: 'You can stop using ThriftLoop at any time. We may suspend or close accounts that break these Terms or put other users at risk.',
      },
      {
        heading: '9. Changes',
        body: 'We may update these Terms. If the changes are important we will ask you to accept them again in the app. Continuing to use ThriftLoop after an update means you accept the new Terms.',
      },
      {
        heading: '10. Contact',
        body: 'Questions about these Terms can be sent to the ThriftLoop team through the app.',
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    summary: 'What data ThriftLoop collects, why, and the choices you have.',
    sections: [
      {
        heading: 'What we collect',
        body: 'Account data (username, email, password stored only as a secure hash), profile data you choose to add (photo, bio), your listings and photos, favorites, messages, and orders. For delivery we collect the name, phone number, address and, if you choose, the map location you provide. For seller verification we collect your full name, phone, city, a selfie and, optionally, a photo of an ID document.',
      },
      {
        heading: 'Why we use it',
        body: 'To run your account and the marketplace, to let buyers and sellers communicate and complete orders, to verify sellers and prevent fraud, to keep the service secure (for example by limiting excessive requests), and to meet legal obligations.',
      },
      {
        heading: 'Verification photos',
        body: 'Selfies and ID photos are stored privately. They are never shown on your public profile and are only accessible to ThriftLoop administrators reviewing your seller application. We keep them only as long as needed to verify you and to handle fraud reports.',
      },
      {
        heading: 'Who can see what',
        body: 'Your username, profile photo, bio, join date and listings are public. Messages are visible only to the people in the conversation. Delivery details from an order are shared only with the seller of that order. We do not sell your personal data.',
      },
      {
        heading: 'Location',
        body: 'ThriftLoop only uses your device location when you tap “Use my location” while entering a delivery address. You can always type your address instead and can turn location access off in iOS Settings.',
      },
      {
        heading: 'Security',
        body: 'Passwords are hashed, sessions use signed tokens stored in the iOS Keychain, and access to the service is rate-limited. No system is perfectly secure, so please use a unique password.',
      },
      {
        heading: 'Your rights',
        body: 'You can view and edit your profile at any time, delete your listings, and ask us to access, correct or delete your personal data. Depending on where you live (for example under the GDPR) you may have additional rights, including to object to processing and to complain to a data protection authority.',
      },
      {
        heading: 'Changes',
        body: 'We will update this policy when our practices change and show the date of the latest version at the top.',
      },
    ],
  },
  seller: {
    title: 'Seller Terms',
    summary: 'Extra rules that apply when you apply to sell and once you are an approved seller.',
    sections: [
      {
        heading: 'Identity verification',
        body: 'To sell, you must submit your real full name, a phone number, your city, a live selfie taken in the app, and a clear photo of an official photo ID: an ID card, a driver’s licence or a passport. An administrator checks that your selfie matches the ID and your details, then approves or rejects your application. Verification photos are stored privately and only administrators can see them. Submitting someone else’s photo or false details will get your account closed.',
      },
      {
        heading: 'Your obligations',
        body: 'List only items you own; describe them accurately; respond to buyers within a reasonable time; keep reserved items aside for the buyer; deliver orders you confirm; and accept cash payment on delivery as agreed.',
      },
      {
        heading: 'Prohibited items',
        body: 'Counterfeits, stolen goods, worn underwear or swimwear without hygiene protection, items with offensive content, weapons, and anything illegal to sell where you live.',
      },
      {
        heading: 'Taxes and law',
        body: 'You are responsible for any taxes and for following consumer law that applies to your sales.',
      },
      {
        heading: 'Losing seller access',
        body: 'Administrators may remove listings or revoke seller access for fake listings, repeated cancellations, complaints or breaking these terms. When seller access is revoked your active listings are taken down.',
      },
    ],
  },
  delivery: {
    title: 'Order & Payment Terms',
    summary: 'How ordering works on ThriftLoop, paying in cash on delivery or by card.',
    sections: [
      {
        heading: 'Placing an order',
        body: 'When you place an order the item is reserved for you and removed from the marketplace. You provide a delivery name, phone number and address (typed or picked on a map). The seller receives these details to arrange delivery.',
      },
      {
        heading: 'Payment',
        body: 'With cash on delivery you pay the listed price in cash directly to the seller or their courier when you receive the item. Have the exact amount ready if possible. ThriftLoop does not charge buyers a fee.',
      },
      {
        heading: 'Card payments (test mode)',
        body: 'You can also pay by card on Stripe’s secure payment page. ThriftLoop never sees or stores your card details. This version of ThriftLoop is a demo and uses Stripe test mode: no real money is charged, and only Stripe’s test cards (such as 4242 4242 4242 4242) work. Your order is only placed once Stripe confirms the payment. If an item sells to someone else while you are paying, you are refunded in full. If a card-paid order is cancelled, that item’s price is refunded to the card.',
      },
      {
        heading: 'Order status',
        body: 'Pending → the seller has not confirmed yet. Confirmed → the seller is arranging delivery. Delivered → the item was handed over and paid for. You can cancel while an order is pending; the seller can cancel before delivery. Cancelled items go back on sale.',
      },
      {
        heading: 'Checking the item',
        body: 'Check the item when it arrives. If it is significantly different from the listing you may refuse it before paying. Disputes should first be raised with the seller in the chat; you can report serious problems to ThriftLoop.',
      },
      {
        heading: 'Delivery costs',
        body: 'Any delivery cost is agreed between buyer and seller in the chat before the order is confirmed.',
      },
    ],
  },
};
