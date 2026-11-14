import { z } from 'zod';

const optionalNumericRange = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .refine((val) => val === '' || !Number.isNaN(Number(val)), {
      message: `${label} debe ser un número válido`,
    })
    .refine((val) => val === '' || (Number(val) >= min && Number(val) <= max), {
      message: `${label} debe estar entre ${min} y ${max}`,
    });

export const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres.')
    .max(120, 'El nombre no puede superar los 120 caracteres.'),
  email: z.string().trim().email('Ingresá un email válido.'),
  age: optionalNumericRange(10, 120, 'La edad'),
  weight: optionalNumericRange(20, 500, 'El peso'),
  targetWeight: optionalNumericRange(20, 500, 'La meta de peso'),
  height: optionalNumericRange(100, 250, 'La altura'),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

export const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Ingresá tu contraseña actual.'),
    newPassword: z
      .string()
      .min(6, 'La nueva contraseña debe tener al menos 6 caracteres.'),
    confirmPassword: z.string().min(1, 'Confirmá tu nueva contraseña.'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Las contraseñas nuevas no coinciden.',
    path: ['confirmPassword'],
  });

export type PasswordFormValues = z.infer<typeof passwordSchema>;
