'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { Button } from '@/components/ui/button';

type DialogType = 'alert' | 'confirm';

interface DialogState {
  isOpen: boolean;
  type: DialogType;
  message: string;
  resolve?: (value: boolean) => void;
}

interface DialogContextValue {
  alert: (message: string) => Promise<void>;
  confirm: (message: string) => Promise<boolean>;
}

const DialogContext = createContext<DialogContextValue | undefined>(undefined);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialogState, setDialogState] = useState<DialogState>({
    isOpen: false,
    type: 'alert',
    message: '',
  });

  const alert = useCallback((message: string): Promise<void> => {
    return new Promise((resolve) => {
      setDialogState({
        isOpen: true,
        type: 'alert',
        message,
        resolve: () => resolve(),
      });
    });
  }, []);

  const confirm = useCallback((message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialogState({
        isOpen: true,
        type: 'confirm',
        message,
        resolve,
      });
    });
  }, []);

  const handleClose = (value: boolean) => {
    if (dialogState.resolve) {
      dialogState.resolve(value);
    }
    setDialogState((prev) => ({ ...prev, isOpen: false }));
  };

  return (
    <DialogContext.Provider value={{ alert, confirm }}>
      {children}
      {dialogState.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => handleClose(false)}
          />
          {/* Modal */}
          <div className="relative bg-card border border-border shadow-xl rounded-xl p-6 max-w-sm w-full mx-4 flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-foreground mb-2">
              {dialogState.type === 'alert' ? 'Notification' : 'Please Confirm'}
            </h3>
            <p className="text-muted-foreground text-sm mb-6 whitespace-pre-wrap">
              {dialogState.message}
            </p>
            <div className="flex gap-3 w-full">
              {dialogState.type === 'confirm' && (
                <Button 
                  onClick={() => handleClose(false)} 
                  variant="outline" 
                  className="flex-1"
                >
                  Cancel
                </Button>
              )}
              <Button 
                onClick={() => handleClose(true)} 
                variant={dialogState.type === 'confirm' ? 'default' : 'default'}
                className="flex-1"
              >
                {dialogState.type === 'confirm' ? 'Confirm' : 'OK'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
}
