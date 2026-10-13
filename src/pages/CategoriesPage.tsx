import { useState } from 'react';
import { FolderOpen, Plus, Pencil, Trash2 } from 'lucide-react';
import {
  PageHeader,
  Card,
  CardContent,
  DataTable,
  Button,
  SkeletonRow,
  EmptyState,
  ErrorState,
  Dialog,
} from '@/components/ui';
import { CategoryForm } from '@/components/products/CategoryForm';
import type { CategoryFormValues } from '@/lib/catalog/validation';
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from '@/hooks/useCategories';
import { errorMessage, isErrorCode } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useSettings } from '@/hooks/useSettings';
import { formatDateTime } from '@/lib/utils';
import type { Category } from '@/types';

function categoryListErrorCopy(error: unknown): { title: string; description: string } {
  const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 0;
  if (status === 401) return { title: 'Session expired', description: 'Your session is no longer valid. Please sign in again.' };
  if (status === 403) return { title: 'Permission denied', description: 'You do not have permission to view categories.' };
  if (status === 404) return { title: 'Categories unavailable', description: 'The categories resource could not be found.' };
  if (status === 429) return { title: 'Rate limit reached', description: 'Too many requests were made. Wait briefly before trying again.' };
  if (status >= 500) return { title: 'Unable to load categories', description: 'The service is temporarily unavailable. Please try again.' };
  return { title: 'Unable to load categories', description: errorMessage(error, 'Something went wrong while loading categories.') };
}

type EditorState = { mode: 'create' } | { mode: 'edit'; category: Category };

export function CategoriesPage() {
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);
  const { user } = useAuth();
  const { data: merchant } = useSettings();
  const canMutate = user?.role === 'OWNER' || user?.role === 'ADMIN';
  const merchantActive = merchant?.status === 'ACTIVE';

  const { data, isLoading, isError, error, refetch } = useCategories();
  const categories = data?.data ?? [];

  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();

  const closeEditor = () => {
    if (createMutation.isPending || updateMutation.isPending) return;
    setEditor(null);
    createMutation.reset();
    updateMutation.reset();
  };

  const submitEditor = (values: CategoryFormValues) => {
    const body = {
      name: values.name.trim(),
      ...(values.description.trim() ? { description: values.description.trim() } : {}),
    };
    if (editor?.mode === 'edit') {
      updateMutation.mutate(
        { categoryId: editor.category.id, body },
        { onSuccess: () => setEditor(null) },
      );
    } else {
      createMutation.mutate({ body }, { onSuccess: () => setEditor(null) });
    }
  };

  const confirmDelete = () => {
    if (!pendingDelete || deleteMutation.isPending) return;
    deleteMutation.mutate(
      { categoryId: pendingDelete.id },
      { onSuccess: () => setPendingDelete(null) },
    );
  };

  const columns = [
    {
      key: 'name',
      header: 'Category',
      render: (c: Category) => (
        <div>
          <p className="font-medium">{c.name}</p>
          {c.description ? <p className="text-xs text-muted-foreground">{c.description}</p> : null}
        </div>
      ),
    },
    {
      key: 'updated_at',
      header: 'Updated',
      render: (c: Category) => <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(c.updated_at)}</span>,
    },
    {
      key: 'actions',
      header: '',
      headerClassName: 'w-24',
      render: (c: Category) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            title="Edit category"
            aria-label={`Edit ${c.name}`}
            disabled={!canMutate}
            onClick={() => setEditor({ mode: 'edit', category: c })}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Delete category"
            aria-label={`Delete ${c.name}`}
            disabled={!canMutate}
            onClick={() => setPendingDelete(c)}
          >
            <Trash2 className="h-4 w-4 text-danger" aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ];

  const errorCopy = isError ? categoryListErrorCopy(error) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        description="Group products into categories for your catalog."
        actions={
          canMutate && merchantActive ? (
            <Button onClick={() => setEditor({ mode: 'create' })}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Add category
            </Button>
          ) : (
            <Button disabled title={!canMutate ? 'OWNER or ADMIN role required' : 'Merchant is not active'}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Add category
            </Button>
          )
        }
      />

      <Card>
        <CardContent className="border-t-0 p-0">
          {isLoading ? <div className="space-y-2 p-4"><SkeletonRow /><SkeletonRow /><SkeletonRow /></div> : isError && errorCopy ? <ErrorState title={errorCopy.title} description={errorCopy.description} onRetry={() => void refetch()} /> : categories.length > 0 ? (
            <DataTable columns={columns} data={categories} getRowKey={(category) => category.id} className="border-0 rounded-none" />
          ) : <EmptyState title="No categories found" description="Create your first category to organize products." icon={<FolderOpen className="h-8 w-8 text-muted-foreground" aria-hidden="true" />} />}
        </CardContent>
      </Card>

      <Dialog
        open={editor !== null}
        onClose={closeEditor}
        title={editor?.mode === 'edit' ? 'Edit category' : 'Add category'}
        maxWidth="max-w-md"
      >
        {editor?.mode === 'edit' ? (
          <CategoryForm
            category={editor.category}
            pending={updateMutation.isPending}
            serverError={updateMutation.error}
            submitLabel="Save changes"
            onSubmit={submitEditor}
          />
        ) : editor ? (
          <CategoryForm
            pending={createMutation.isPending}
            serverError={createMutation.error}
            submitLabel="Create category"
            onSubmit={submitEditor}
          />
        ) : null}
      </Dialog>

      <Dialog
        open={pendingDelete !== null}
        onClose={() => {
          if (!deleteMutation.isPending) {
            setPendingDelete(null);
            deleteMutation.reset();
          }
        }}
        title="Delete category"
        description="Products in this category keep their rows with the category link removed."
        maxWidth="max-w-md"
      >
        {pendingDelete && (
          <div className="space-y-4">
            <p className="text-sm">
              Delete category <span className="font-medium">{pendingDelete.name}</span>?
            </p>
            {deleteMutation.isError && (
              <p role="alert" className="text-sm font-medium text-danger">
                {isErrorCode(deleteMutation.error, 'RESOURCE_NOT_FOUND')
                  ? 'This category was already deleted.'
                  : errorMessage(deleteMutation.error, 'Could not delete the category.')}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" disabled={deleteMutation.isPending} onClick={() => { setPendingDelete(null); deleteMutation.reset(); }}>
                Cancel
              </Button>
              <Button variant="danger" disabled={deleteMutation.isPending} onClick={confirmDelete}>
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
