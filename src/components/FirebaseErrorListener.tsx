"use client";

import React, { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { useToast } from '@/hooks/use-toast';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handlePermissionError = (error: FirestorePermissionError) => {
      console.error("Caught Firestore Permission Error:", error.toString());
      
      const context = error.context as SecurityRuleContext;
      const deniedRequest = {
        path: context.path,
        method: context.operation,
        auth: error.auth, 
        resource: context.requestResourceData,
      };

      toast({
        variant: "destructive",
        title: "Permission Denied",
        description: (
          <div className="text-xs">
            <p>Your request to Firestore was denied by security rules.</p>
            <pre className="mt-2 w-full rounded-md bg-slate-950 p-4">
              <code className="text-white">{JSON.stringify(deniedRequest, null, 2)}</code>
            </pre>
          </div>
        ),
      });

      // Throwing the error so it's surfaced in the Next.js dev overlay
      throw error;
    };

    errorEmitter.on('permission-error', handlePermissionError);

    return () => {
      errorEmitter.off('permission-error', handlePermissionError);
    };
  }, [toast]);

  return null;
}
