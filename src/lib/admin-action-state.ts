export type AdminActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export const initialAdminActionState: AdminActionState = { status: "idle" };
