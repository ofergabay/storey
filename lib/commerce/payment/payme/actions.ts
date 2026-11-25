"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { preparePaymeCheckout } from "@/lib/commerce/payment/payme/apply";
import { readWorkspace } from "@/lib/workspace/store";

export async function startPaymeCheckout(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const prepared = await preparePaymeCheckout(id);
  const order = readWorkspace().orders.find((item) => item.id === id);
  if (order) revalidatePath(`/track/${order.token}`);
  if ("redirectUrl" in prepared) redirect(prepared.redirectUrl);
}
