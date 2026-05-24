/**
 * Billing disclosures — Sprint C-4
 * Required by: Washington RCW 19.316, FTC Negative Option Rule (2024)
 *
 * Display rules:
 * - Show BEFORE the user clicks the payment/checkout button
 * - Same font size as surrounding text (not fine print)
 * - Not behind a modal, tooltip, or link
 * - Must include: amount, frequency, renewal date notice, cancellation method
 */

export const BILLING_DISCLOSURES = {
  /**
   * Shown directly above/below the checkout CTA on any upgrade or
   * subscription initiation flow. Interpolate plan name and price.
   */
  preCheckout: (planName: string, price: string, interval: 'month' | 'year') =>
    `By continuing, you authorize My Wealth Maps to charge ${price} ` +
    `${interval === 'month' ? 'per month' : 'per year'} for the ${planName} plan, ` +
    `starting today. Your subscription renews automatically until you cancel. ` +
    `Cancel anytime from your account settings — no cancellation fees.`,

  /**
   * Shown on the billing/account page confirming renewal terms for
   * active subscribers.
   */
  activeSubscription: (planName: string, price: string, renewalDate: string) =>
    `Your ${planName} plan renews on ${renewalDate} for ${price}. ` +
    `Cancel anytime before renewal to avoid being charged.`,

  /**
   * Shown in the cancellation confirmation flow.
   */
  cancellationConfirm: (accessThrough: string) =>
    `Your subscription has been cancelled. You will retain access to your ` +
    `plan through ${accessThrough}, after which your account will revert ` +
    `to the free tier. No further charges will be made.`,

  /**
   * Email subject and body for renewal reminder (send 7 days before renewal).
   * Required by FTC Negative Option Rule for subscriptions over $15/month.
   */
  renewalReminderEmail: {
    subject: 'Your My Wealth Maps subscription renews in 7 days',
    body: (planName: string, price: string, renewalDate: string) =>
      `Your ${planName} subscription will automatically renew on ${renewalDate} ` +
      `for ${price}. To cancel before renewal, visit your account settings at ` +
      `https://mywealthmaps.com/billing.`,
  },

  /** Global pricing-page auto-renewal notice (RCW 19.316). */
  pricingPageNotice:
    'All plans renew automatically. Cancel anytime from your account settings. ' +
    'Washington residents: pursuant to RCW 19.316, you will receive a reminder ' +
    'before each renewal. No cancellation fees.',
} as const
