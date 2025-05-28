import { toast } from "sonner";

export const showSuccess = (message: string) => {
  toast.success(message);
};

export const showError = (message: string) => {
  toast.error(message);
};

export const showLoading = (message: string) => {
  return toast.loading(message);
};

export const dismissToast = (toastId: string) => {
  toast.dismiss(toastId);
};

// Add a generic showToast function
export const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info', duration?: number) => {
  // Map the type to sonner's options
  const options: any = { duration }; // Use 'any' for duration as it's optional in sonner's type
  if (type !== 'info') {
    options.type = type;
  }

  toast(message, options);
};