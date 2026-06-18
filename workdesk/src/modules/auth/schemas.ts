import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Login Schema
// ─────────────────────────────────────────────────────────────────────────────

export const LoginSchema = z.object({
  email: z
    .string({ message: "Email is required." })
    .email("Invalid email format.")
    .toLowerCase()
    .trim(),
  password: z
    .string({ message: "Password is required." })
    .min(1, "Password is required."),
  rememberMe: z.boolean().optional().default(false),
});

export type LoginInput = z.infer<typeof LoginSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Change Password Schema
// ─────────────────────────────────────────────────────────────────────────────

export const ChangePasswordSchema = z
  .object({
    currentPassword: z
      .string({ message: "Current password is required." })
      .min(1, "Current password is required."),
    newPassword: z
      .string({ message: "New password is required." })
      .min(8, "Password must be at least 8 characters.")
      .max(72, "Password must be at most 72 characters.") // bcrypt limit
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter.")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter.")
      .regex(/[0-9]/, "Password must contain at least one number."),
    confirmPassword: z.string({ message: "Please confirm your new password." }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must differ from the current password.",
    path: ["newPassword"],
  });

export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Admin: Update User Schema
// ─────────────────────────────────────────────────────────────────────────────

export const UpdateUserSchema = z
  .object({
    status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
    role: z.enum(["MEMBER", "ADMIN"]).optional(),
  })
  .refine((data) => data.status !== undefined || data.role !== undefined, {
    message: "At least one field (status or role) must be provided.",
  });

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// User ID Path Param Schema
// ─────────────────────────────────────────────────────────────────────────────

export const UserIdParamSchema = z.object({
  id: z.string().uuid("Invalid user ID format."),
});

export type UserIdParam = z.infer<typeof UserIdParamSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Update Profile Schema
// ─────────────────────────────────────────────────────────────────────────────

export const UpdateProfileSchema = z
  .object({
    name: z.string().min(1, "Name is required.").max(100).optional(),
    email: z.string().email("Invalid email address.").toLowerCase().trim().optional(),
    themePreference: z.enum(["dark"]).optional(),
  })
  .refine((d) => d.name !== undefined || d.email !== undefined || d.themePreference !== undefined, {
    message: "At least one field must be provided.",
  });

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Forgot / Reset Password Schemas
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Sign Up Schema
// ─────────────────────────────────────────────────────────────────────────────

export const SignUpSchema = z
  .object({
    name: z
      .string({ message: "Full name is required." })
      .min(2, "Name must be at least 2 characters.")
      .max(100, "Name must be at most 100 characters.")
      .trim(),
    phone: z
      .string({ message: "Phone number is required." })
      .min(7, "Enter a valid phone number.")
      .max(20, "Phone number is too long.")
      .regex(/^[+\d\s\-().]+$/, "Phone number contains invalid characters.")
      .trim(),
    email: z
      .string({ message: "Email is required." })
      .email("Invalid email address.")
      .toLowerCase()
      .trim(),
    password: z
      .string({ message: "Password is required." })
      .min(8, "Password must be at least 8 characters.")
      .max(72, "Password must be at most 72 characters.")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter.")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter.")
      .regex(/[0-9]/, "Password must contain at least one number."),
    confirmPassword: z.string({ message: "Please confirm your password." }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type SignUpInput = z.infer<typeof SignUpSchema>;

export const ForgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address.").toLowerCase().trim(),
});

export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

export const ResetPasswordSchema = z
  .object({
    token: z.string().min(1, "Token is required."),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(72)
      .regex(/[A-Z]/, "Must contain an uppercase letter.")
      .regex(/[a-z]/, "Must contain a lowercase letter.")
      .regex(/[0-9]/, "Must contain a number."),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
