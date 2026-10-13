import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import { ProductDetailsCard } from './ProductDetailsCard.tsx';
import type { DashboardPaymentOrderItem } from '@/types';

const kopi: DashboardPaymentOrderItem = {
  product_name: 'Kopi Arabika',
  unit_price: 35000,
  quantity: 2,
  subtotal: 70000,
};
const teh: DashboardPaymentOrderItem = {
  product_name: 'Teh Hijau',
  unit_price: 20000,
  quantity: 1,
  subtotal: 20000,
};

function render(
  items: DashboardPaymentOrderItem[],
  paymentTotal: number,
): string {
  return renderToStaticMarkup(
    <ProductDetailsCard
      items={items}
      currency="IDR"
      paymentTotal={paymentTotal}
    />,
  );
}

test('single product renders name, unit price, quantity, and subtotal', () => {
  const markup = render([kopi], 70000);

  assert.match(markup, /Product Details/);
  assert.match(markup, /Kopi Arabika/);
  assert.match(markup, /Rp[\s\u00a0]35\.000/);
  assert.match(markup, />2</);
  assert.match(markup, /Rp[\s\u00a0]70\.000/);
  assert.match(markup, /Product subtotal/);
});

test('multiple products sum stored subtotals and show a differing total', () => {
  const markup = render([kopi, teh], 100000);

  assert.match(markup, /Kopi Arabika/);
  assert.match(markup, /Teh Hijau/);
  assert.match(markup, /Rp[\s\u00a0]90\.000/);
  assert.match(markup, /Payment total/);
  assert.match(markup, /Rp[\s\u00a0]100\.000/);
  assert.match(markup, /authoritative/);
});

test('matching payment total is not duplicated', () => {
  const markup = render([kopi, teh], 90000);

  assert.match(markup, /Product subtotal/);
  assert.match(markup, /Rp[\s\u00a0]90\.000/);
  assert.doesNotMatch(markup, /Payment total/);
});

test('no items renders nothing (legacy payments keep the current UI)', () => {
  assert.equal(render([], 50000), '');
});

test('long product names render without breaking the table', () => {
  const long =
    'Extraordinarily Long Product Name That Must Not Break The Layout';
  const markup = render(
    [{ product_name: long, unit_price: 1000, quantity: 1, subtotal: 1000 }],
    1000,
  );

  assert.match(markup, new RegExp(long));
  assert.match(markup, /break-words/);
  assert.match(markup, /overflow-x-auto/);
});
