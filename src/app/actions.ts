'use server';

import { validateCaptchaEntry } from "@/ai/flows/validate-captcha-entry";

export async function validateUserCaptchaEntry(
  captchaImage: string,
  userEntry: string
) {
  const result = await validateCaptchaEntry({ captchaImage, userEntry });
  return result;
}
