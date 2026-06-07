/** Pause or resume consumer Stripe subscriptions during B2B2C connect/disconnect. */

export async function pauseActiveStripeSubscriptionAtPeriodEnd(
  stripeCustomerId: string,
): Promise<{ cancelAt: string | null; ok: boolean }> {
  if (!process.env.STRIPE_SECRET_KEY) {
    return { cancelAt: null, ok: true }
  }

  try {
    const stripeRes = await fetch(
      `https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(stripeCustomerId)}&status=active&limit=1`,
      {
        headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
      },
    )
    const stripeData = (await stripeRes.json()) as {
      data: Array<{ id: string; current_period_end: number }>
    }

    const activeSub = stripeData.data?.[0]
    if (!activeSub) {
      return { cancelAt: null, ok: true }
    }

    const cancelRes = await fetch(`https://api.stripe.com/v1/subscriptions/${activeSub.id}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'cancel_at_period_end=true',
    })
    if (!cancelRes.ok) {
      throw new Error(`Stripe cancel failed: ${cancelRes.status}`)
    }

    return {
      cancelAt: new Date(activeSub.current_period_end * 1000).toISOString(),
      ok: true,
    }
  } catch (err) {
    console.error('pauseActiveStripeSubscriptionAtPeriodEnd:', err)
    return { cancelAt: null, ok: false }
  }
}

export async function resumePausedStripeSubscription(
  stripeCustomerId: string,
): Promise<boolean> {
  if (!process.env.STRIPE_SECRET_KEY) {
    return false
  }

  try {
    const stripeRes = await fetch(
      `https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(stripeCustomerId)}&status=active&limit=1`,
      {
        headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
      },
    )
    const stripeData = (await stripeRes.json()) as {
      data: Array<{ id: string; cancel_at_period_end: boolean }>
    }
    const activeSub = stripeData.data?.[0]
    if (!activeSub?.cancel_at_period_end) {
      return false
    }

    const resumeRes = await fetch(`https://api.stripe.com/v1/subscriptions/${activeSub.id}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'cancel_at_period_end=false',
    })
    return resumeRes.ok
  } catch (err) {
    console.error('resumePausedStripeSubscription:', err)
    return false
  }
}
