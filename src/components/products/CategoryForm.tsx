import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { Button, Input, Label } from '@/components/ui';
import { fieldError } from '@/lib/api';
import {
  categoryFormSchema,
  type CategoryFormValues,
} from '@/lib/catalog/validation';
import type { Category } from '@/types';

export function CategoryForm({
  category,
  pending,
  serverError,
  submitLabel,
  onSubmit,
}: {
  category?: Category | null;
  pending: boolean;
  serverError: unknown;
  submitLabel: string;
  onSubmit: (values: CategoryFormValues) => void;
}) {
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: category?.name ?? '',
      description: category?.description ?? '',
    },
  });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;
  const busy = pending || isSubmitting;

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit((values) => {
          if (!busy) onSubmit(values);
        })(event);
      }}
      className="space-y-4"
      noValidate
    >
      <div className="space-y-1.5">
        <Label htmlFor="category-name" required>
          Name
        </Label>
        <Input
          id="category-name"
          autoComplete="off"
          maxLength={100}
          disabled={busy}
          error={errors.name?.message ?? fieldError(serverError, 'name')}
          {...register('name')}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="category-description">Description</Label>
        <Input
          id="category-description"
          autoComplete="off"
          maxLength={500}
          disabled={busy}
          error={
            errors.description?.message ?? fieldError(serverError, 'description')
          }
          {...register('description')}
        />
      </div>

      <Button type="submit" disabled={busy} className="w-full sm:w-auto">
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {submitLabel}
      </Button>
    </form>
  );
}
