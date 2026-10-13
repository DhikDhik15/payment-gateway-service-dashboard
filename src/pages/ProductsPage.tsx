import { useState } from 'react';
import { Package, Search, Filter, Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import {
  PageHeader,
  Card,
  CardContent,
  DataTable,
  Badge,
  Button,
  SkeletonRow,
  EmptyState,
  ErrorState,
  Dialog,
} from '@/components/ui';
import { ProductImage } from '@/components/products/ProductImage';
import { ProductForm, type ProductFormSubmit } from '@/components/products/ProductForm';
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, useToggleProductActive } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { errorMessage, isErrorCode } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useSettings } from '@/hooks/useSettings';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { listTotalPages, type Product } from '@/types';

function productListErrorCopy(error: unknown): { title: string; description: string } {
  const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 0;
  if (status === 401) return { title: 'Session expired', description: 'Your session is no longer valid. Please sign in again.' };
  if (status === 403) return { title: 'Permission denied', description: 'You do not have permission to view products.' };
  if (status === 404) return { title: 'Products unavailable', description: 'The products resource could not be found.' };
  if (status === 429) return { title: 'Rate limit reached', description: 'Too many requests were made. Wait briefly before trying again.' };
  if (status >= 500) return { title: 'Unable to load products', description: 'The service is temporarily unavailable. Please try again.' };
  return { title: 'Unable to load products', description: errorMessage(error, 'Something went wrong while loading products.') };
}

type EditorState = { mode: 'create' } | { mode: 'edit'; product: Product };

export function ProductsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [status, setStatus] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);
  const { user } = useAuth();
  const { data: merchant } = useSettings();
  const canMutate = user?.role === 'OWNER' || user?.role === 'ADMIN';
  const merchantActive = merchant?.status === 'ACTIVE';

  const { data, isLoading, isError, error, refetch } = useProducts({
    page,
    limit: 10,
    category_id: categoryId || undefined,
    active: status === '' ? undefined : status === 'active',
    search: debouncedSearch || undefined,
  });
  const categoriesQuery = useCategories();
  const categories = categoriesQuery.data?.data ?? [];

  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const deleteMutation = useDeleteProduct();
  const toggleMutation = useToggleProductActive();

  const closeEditor = () => {
    if (createMutation.isPending || updateMutation.isPending) return;
    setEditor(null);
    createMutation.reset();
    updateMutation.reset();
  };

  const submitEditor = (values: ProductFormSubmit) => {
    if (editor?.mode === 'edit') {
      updateMutation.mutate(
        { productId: editor.product.id, body: values },
        { onSuccess: () => setEditor(null) },
      );
    } else {
      createMutation.mutate(
        { body: values },
        { onSuccess: () => setEditor(null) },
      );
    }
  };

  const confirmDelete = () => {
    if (!pendingDelete || deleteMutation.isPending) return;
    deleteMutation.mutate(
      { productId: pendingDelete.id },
      { onSuccess: () => setPendingDelete(null) },
    );
  };

  const toggleActive = (product: Product) => {
    toggleMutation.toggle(product.id, !product.active);
  };

  const columns = [
    {
      key: 'image',
      header: '',
      headerClassName: 'w-14',
      render: (p: Product) => <ProductImage src={p.image_url} alt={p.name} />,
    },
    {
      key: 'name',
      header: 'Product',
      render: (p: Product) => (
        <div>
          <p className="font-medium">{p.name}</p>
          {p.sku ? <p className="font-mono text-xs text-muted-foreground">{p.sku}</p> : null}
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Price',
      render: (p: Product) => formatCurrency(p.price, p.currency),
    },
    {
      key: 'status',
      header: 'Status',
      render: (p: Product) => (
        <Badge variant={p.active ? 'success' : 'default'}>{p.active ? 'Active' : 'Inactive'}</Badge>
      ),
    },
    {
      key: 'updated_at',
      header: 'Updated',
      render: (p: Product) => <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(p.updated_at)}</span>,
    },
    {
      key: 'actions',
      header: '',
      headerClassName: 'w-28',
      render: (p: Product) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            title={p.active ? 'Deactivate' : 'Activate'}
            aria-label={`${p.active ? 'Deactivate' : 'Activate'} ${p.name}`}
            disabled={!canMutate || toggleMutation.isPending}
            onClick={() => toggleActive(p)}
          >
            {p.active ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Edit product"
            aria-label={`Edit ${p.name}`}
            disabled={!canMutate}
            onClick={() => setEditor({ mode: 'edit', product: p })}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Delete product"
            aria-label={`Delete ${p.name}`}
            disabled={!canMutate}
            onClick={() => setPendingDelete(p)}
          >
            <Trash2 className="h-4 w-4 text-danger" aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ];

  const totalPages = listTotalPages(data?.meta);
  const errorCopy = isError ? productListErrorCopy(error) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Manage your product catalog. Products appear in the mobile app for ordering."
        actions={
          canMutate && merchantActive ? (
            <Button onClick={() => setEditor({ mode: 'create' })}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Add product
            </Button>
          ) : (
            <Button disabled title={!canMutate ? 'OWNER or ADMIN role required' : 'Merchant is not active'}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Add product
            </Button>
          )
        }
      />

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <input
                aria-label="Search products"
                placeholder="Search name, SKU, description…"
                maxLength={200}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 pl-9 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={search}
                onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <label htmlFor="product-status" className="sr-only">Filter by status</label>
              <select
                id="product-status"
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={status}
                onChange={(event) => { setStatus(event.target.value); setPage(1); }}
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <label htmlFor="product-category" className="sr-only">Filter by category</label>
              <select
                id="product-category"
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={categoryId}
                onChange={(event) => { setCategoryId(event.target.value); setPage(1); }}
              >
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>

        <CardContent className="border-t p-0">
          {isLoading ? <div className="space-y-2 p-4"><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /></div> : isError && errorCopy ? <ErrorState title={errorCopy.title} description={errorCopy.description} onRetry={() => void refetch()} /> : data && data.data.length > 0 ? (
            <>
              <DataTable columns={columns} data={data.data} getRowKey={(product) => product.id} className="border-0 rounded-none" />
              {totalPages > 1 && <div className="flex items-center justify-between border-t border-border px-4 py-3"><p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div>}
            </>
          ) : <EmptyState title="No products found" description="Add your first product to start selling." icon={<Package className="h-8 w-8 text-muted-foreground" aria-hidden="true" />} />}
        </CardContent>
      </Card>

      <Dialog
        open={editor !== null}
        onClose={closeEditor}
        title={editor?.mode === 'edit' ? 'Edit product' : 'Add product'}
        description={editor?.mode === 'edit' ? 'Only changed fields are updated. Price edits never rewrite existing orders.' : undefined}
      >
        {editor?.mode === 'edit' ? (
          <ProductForm
            key={editor.product.id}
            product={editor.product}
            productId={editor.product.id}
            categories={categories}
            pending={updateMutation.isPending}
            serverError={updateMutation.error}
            submitLabel="Save changes"
            onSubmit={submitEditor}
          />
        ) : editor ? (
          <ProductForm
            key="create"
            categories={categories}
            pending={createMutation.isPending}
            serverError={createMutation.error}
            submitLabel="Create product"
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
        title="Delete product"
        description="Historical orders keep their item and price snapshots. This cannot be undone."
        maxWidth="max-w-md"
      >
        {pendingDelete && (
          <div className="space-y-4">
            <p className="text-sm">
              Delete <span className="font-medium">{pendingDelete.name}</span> from your catalog?
            </p>
            {deleteMutation.isError && (
              <p role="alert" className="text-sm font-medium text-danger">
                {isErrorCode(deleteMutation.error, 'RESOURCE_NOT_FOUND')
                  ? 'This product was already deleted.'
                  : errorMessage(deleteMutation.error, 'Could not delete the product.')}
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
