"use server";

import { pushEndpointSchema, pushSubscriptionSchema } from "@/lib/validation";
import type { ActionResult } from "@/types/kairos";
import { requireUserId } from "@/server/auth";
import { runAction } from "@/server/actions/helpers";
import {
  sendTestToDevice,
  subscribeDevice,
  unsubscribeDevice,
  type PushDevice,
} from "@/server/services/push";

/**
 * Switching the daily reminder on and off for one device.
 *
 * Every entry point derives the account from the verified session. A `userId`
 * in the body would be a way to attach a device to somebody else's account, or
 * to silence the reminders of an account that is not yours, so there is not one.
 * The endpoint identifies the device, and the scoped client decides whether it
 * belongs to the caller.
 */

export async function subscribeToPushAction(input: unknown): Promise<ActionResult<PushDevice>> {
  return runAction(async () => {
    const userId = await requireUserId();
    const values = pushSubscriptionSchema.parse(input);
    return subscribeDevice(userId, values);
  });
}

export async function unsubscribeFromPushAction(
  input: unknown,
): Promise<ActionResult<{ removed: boolean }>> {
  return runAction(async () => {
    const userId = await requireUserId();
    const { endpoint } = pushEndpointSchema.parse(input);
    return { removed: await unsubscribeDevice(userId, endpoint) };
  });
}

/**
 * Send the reminder now, to this device, so the whole path can be checked
 * without waiting for the nightly run. Nothing about the account changes, so
 * there is no reason to refresh the page afterwards.
 */
export async function sendTestPushAction(input: unknown): Promise<ActionResult<undefined>> {
  return runAction(
    async () => {
      const userId = await requireUserId();
      const { endpoint } = pushEndpointSchema.parse(input);
      await sendTestToDevice(userId, endpoint);
      return undefined;
    },
    { revalidate: false },
  );
}
