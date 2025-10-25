"use server";

import { validateCaptchaEntry } from "@/ai/flows/validate-captcha-entry";

export async function validateUserCaptchaEntry(
  captchaImage: string,
  userEntry: string
) {
  try {
    const result = await validateCaptchaEntry({
      captchaImage,
      userEntry,
    });
    return result;
  } catch (error) {
    console.error("Error validating captcha:", error);
    return { isValid: false };
  }
}
