import { getSecret, getSetting } from "@/lib/system-settings";
import type {
  PaymentProvider,
  InitCheckoutInput,
  InitCheckoutResult,
  VerifyInput,
  VerifyResult,
} from "./provider";

/**
 * bKash tokenized (hosted) checkout. Flow: grant token → create payment →
 * (user pays on bKash) → callback → execute payment → credit. The paymentID
 * returned by "create" is stored as the deposit's gatewayRef so the callback
 * can look the deposit up and run "execute".
 *
 * Note: bKash settles in BDT. Sandbox accepts the raw amount; a production
 * deployment should convert USD→BDT before initCheckout.
 */
async function creds() {
  const appKey = await getSecret("BKASH_APP_KEY", "bkash.appKey");
  const appSecret = await getSecret("BKASH_APP_SECRET", "bkash.appSecret");
  const username = await getSecret("BKASH_USERNAME", "bkash.username");
  const password = await getSecret("BKASH_PASSWORD", "bkash.password");
  const sandbox = process.env.BKASH_SANDBOX !== "false";
  const base = sandbox
    ? "https://tokenized.sandbox.bka.sh/v1.2.0-beta"
    : "https://tokenized.pay.bka.sh/v1.2.0-beta";
  return { appKey, appSecret, username, password, base };
}

async function grantToken(): Promise<{ token: string; appKey: string; base: string }> {
  const { appKey, appSecret, username, password, base } = await creds();
  if (!appKey || !appSecret || !username || !password) {
    throw new Error("bKash not configured");
  }
  const res = await fetch(`${base}/tokenized/checkout/token/grant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      username,
      password,
    },
    body: JSON.stringify({ app_key: appKey, app_secret: appSecret }),
  });
  const data = await res.json();
  if (!data?.id_token) throw new Error(data?.statusMessage || "bKash token failed");
  return { token: data.id_token, appKey, base };
}

export const bkash: PaymentProvider = {
  key: "bkash",
  label: "bKash",

  async isConfigured() {
    const { appKey, appSecret, username, password } = await creds();
    return !!appKey && !!appSecret && !!username && !!password;
  },

  async initCheckout(input: InitCheckoutInput): Promise<InitCheckoutResult> {
    const { token, appKey, base } = await grantToken();
    const callbackURL = `${input.appUrl}/api/deposits/gateway/callback?provider=bkash`;
    // bKash settles in BDT — convert the USD deposit amount at the admin-set rate
    // (default ~123 BDT/$). Without this the user is charged the raw USD number
    // in taka (~123x undercharge).
    const rate = Number(await getSetting<number>("bkash.usdToBdtRate", 123)) || 123;
    const amountBdt = Math.max(1, Math.round(input.amount * rate));
    const res = await fetch(`${base}/tokenized/checkout/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: token,
        "X-APP-Key": appKey,
      },
      body: JSON.stringify({
        mode: "0011",
        payerReference: input.user.id.slice(0, 12),
        callbackURL,
        amount: String(amountBdt),
        currency: "BDT",
        intent: "sale",
        merchantInvoiceNumber: input.tranId,
      }),
    });
    const data = await res.json();
    if (!data?.bkashURL || !data?.paymentID) {
      throw new Error(data?.statusMessage || "bKash create failed");
    }
    // gatewayRef = paymentID so the callback can find this deposit and execute it.
    return { redirectUrl: data.bkashURL, gatewayRef: data.paymentID };
  },

  async verifyCallback(input: VerifyInput): Promise<VerifyResult> {
    const paymentID = input.params.paymentID ?? "";
    const status = input.params.status ?? "";
    if (!paymentID || (status && status.toLowerCase() !== "success")) {
      return { success: false, gatewayRef: paymentID };
    }
    // Execute the payment to actually capture the funds.
    try {
      const { token, appKey, base } = await grantToken();
      const res = await fetch(`${base}/tokenized/checkout/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: token,
          "X-APP-Key": appKey,
        },
        body: JSON.stringify({ paymentID }),
      });
      const data = await res.json();
      const ok = data?.transactionStatus === "Completed" || data?.statusCode === "0000";
      // Report what bKash says was actually paid, so the callback route can
      // cross-check it against the deposit we recorded. Omitting it is not
      // neutral: `amountOk` treats an absent amount as "nothing to compare"
      // and credits the stored amount unverified, which silently switches off
      // the one check standing between a tampered payment and a credited
      // wallet.
      //
      // Converted back to USD at the SAME rate `initCheckout` charged in,
      // because the route compares against the deposit's USD amount. Returning
      // the raw taka figure would make every honest bKash deposit look like a
      // ~123x overpayment and get rejected.
      //
      // If an admin changes `bkash.usdToBdtRate` between create and execute,
      // the comparison fails and the deposit is rejected rather than credited.
      // That is the right direction to fail: a rejected deposit can be fixed by
      // hand, a wrongly credited one has already left.
      const paidBdt = Number(data?.amount);
      const rate = Number(await getSetting<number>("bkash.usdToBdtRate", 123)) || 123;
      const paidUsd = paidBdt / rate;
      return {
        success: !!ok,
        gatewayRef: paymentID,
        amount: Number.isFinite(paidUsd) && paidUsd > 0 ? paidUsd : undefined,
        currency: "USD",
      };
    } catch {
      return { success: false, gatewayRef: paymentID };
    }
  },
};
