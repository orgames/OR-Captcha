'use server';

/**
 * @fileOverview This file defines the Genkit flow for validating a Captcha entry.
 *
 * It includes:
 * - validateCaptchaEntry: A function to validate the Captcha entry.
 * - ValidateCaptchaEntryInput: The input type for the validateCaptchaEntry function.
 * - ValidateCaptchaEntryOutput: The output type for the validateCaptchaEntry function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ValidateCaptchaEntryInputSchema = z.object({
  captchaImage: z
    .string()
    .describe(
      "A Captcha image, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  userEntry: z.string().describe('The user-entered Captcha text.'),
});
export type ValidateCaptchaEntryInput = z.infer<
  typeof ValidateCaptchaEntryInputSchema
>;

const ValidateCaptchaEntryOutputSchema = z.object({
  isValid: z.boolean().describe('Whether the user-entered Captcha is valid.'),
});
export type ValidateCaptchaEntryOutput = z.infer<
  typeof ValidateCaptchaEntryOutputSchema
>;

export async function validateCaptchaEntry(
  input: ValidateCaptchaEntryInput
): Promise<ValidateCaptchaEntryOutput> {
  return validateCaptchaEntryFlow(input);
}

const validateCaptchaEntryPrompt = ai.definePrompt({
  name: 'validateCaptchaEntryPrompt',
  input: {schema: ValidateCaptchaEntryInputSchema},
  output: {schema: ValidateCaptchaEntryOutputSchema},
  prompt: `You are an AI tasked with validating Captcha entries.  Determine if the user entry matches the Captcha image.

Captcha Image: {{media url=captchaImage}}
User Entry: {{{userEntry}}}

Based on the image, determine if the User Entry matches the Captcha shown in the image. Return true if it matches, false otherwise. Return ONLY a JSON format. Focus on character recognition, not on image content.`,
});

const validateCaptchaEntryFlow = ai.defineFlow(
  {
    name: 'validateCaptchaEntryFlow',
    inputSchema: ValidateCaptchaEntryInputSchema,
    outputSchema: ValidateCaptchaEntryOutputSchema,
  },
  async input => {
    const {output} = await validateCaptchaEntryPrompt(input);
    return output!;
  }
);
