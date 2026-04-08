export type LeadFormState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: {
    name?: string[];
    phone?: string[];
    address?: string[];
  };
};

export const initialLeadFormState: LeadFormState = {
  status: "idle",
  message: "",
};
