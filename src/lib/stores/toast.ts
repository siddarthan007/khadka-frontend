import { writable } from "svelte/store";

export type ToastType = "success" | "error" | "info";
export type Toast = {
  id: number;
  title?: string;
  message: string;
  type?: ToastType;
  timeout?: number;
};

export const toasts = writable<Toast[]>([]);

let idCounter = 1;

export function showToast(
  message: string,
  opts?: { title?: string; type?: ToastType; timeout?: number },
) {
  const id = idCounter++;
  const toast: Toast = {
    id,
    message,
    title: opts?.title,
    type: opts?.type ?? "success",
    timeout: opts?.timeout ?? 2500,
  };
  toasts.update((arr) => [...arr, toast]);
  setTimeout(() => {
    toasts.update((arr) => arr.filter((t) => t.id !== id));
  }, toast.timeout);
}
