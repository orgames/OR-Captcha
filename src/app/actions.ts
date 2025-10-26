"use server";

import { validateCaptchaEntry } from "@/ai/flows/validate-captcha-entry";
import { getFirebaseAdmin } from "@/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

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


export async function sendOra(recipientEmail: string, amount: number): Promise<{success: boolean; error?: string}> {
  const { auth, firestore } = getFirebaseAdmin();

  try {
      const currentUser = await auth.verifyIdToken(
          (await auth.getRequestHeaders())?.get('x-firebase-auth') || ''
      );

      if (!currentUser) {
          return { success: false, error: "You must be logged in to send coins." };
      }

      const senderUid = currentUser.uid;

      const recipientQuery = await firestore.collection('users').where('email', '==', recipientEmail).limit(1).get();

      if (recipientQuery.empty) {
          return { success: false, error: 'Recipient not found.' };
      }
      const recipientDoc = recipientQuery.docs[0];
      const recipientUid = recipientDoc.id;
      
      if (senderUid === recipientUid) {
          return { success: false, error: 'You cannot send coins to yourself.' };
      }

      await firestore.runTransaction(async (transaction) => {
          const senderRef = firestore.doc(`users/${senderUid}`);
          const recipientRef = firestore.doc(`users/${recipientUid}`);

          const senderDoc = await transaction.get(senderRef);

          if (!senderDoc.exists) {
              throw new Error("Sender's document does not exist.");
          }

          const senderBalance = senderDoc.data()?.coinBalance || 0;
          if (senderBalance < amount) {
              throw new Error('Insufficient funds.');
          }

          transaction.update(senderRef, { coinBalance: FieldValue.increment(-amount) });
          transaction.update(recipientRef, { coinBalance: FieldValue.increment(amount) });
          
          const senderTransactionRef = senderRef.collection('transactions').doc();
          transaction.set(senderTransactionRef, {
              type: 'send',
              amount: amount,
              to: recipientEmail,
              timestamp: FieldValue.serverTimestamp(),
          });

          const recipientTransactionRef = recipientRef.collection('transactions').doc();
          transaction.set(recipientTransactionRef, {
              type: 'receive',
              amount: amount,
              from: currentUser.email,
              timestamp: FieldValue.serverTimestamp(),
          });
      });
      
      return { success: true };
  } catch (error: any) {
      console.error('Transaction failed: ', error);
      return { success: false, error: error.message || 'An unexpected error occurred.' };
  }
}