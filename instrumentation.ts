export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { recoverAcceptedCaptures } = await import("./lib/commerce/payment/provider-store");
    recoverAcceptedCaptures();
  }
}
