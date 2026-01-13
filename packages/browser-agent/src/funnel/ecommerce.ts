/**
 * Ecommerce Funnel Events
 *
 * Standard funnel events compatible with Meta Pixel and Google Analytics 4.
 * These events enable correlation between conversion funnels and frustration signals.
 */

import { emitSessionEvent } from '../events';

/**
 * Funnel stages for ecommerce
 */
export type FunnelStage =
  | 'awareness'
  | 'interest'
  | 'cart'
  | 'checkout'
  | 'payment'
  | 'conversion';

/**
 * Content/product item for ecommerce events
 */
export interface ContentItem {
  id: string;
  name?: string;
  category?: string;
  variant?: string;
  brand?: string;
  price?: number;
  quantity?: number;
}

/**
 * Maps funnel events to stages
 */
const FUNNEL_STAGE_MAP: Record<string, FunnelStage> = {
  view_content: 'awareness',
  view_item_list: 'awareness',
  search: 'awareness',
  select_item: 'interest',
  add_to_wishlist: 'interest',
  add_to_cart: 'cart',
  remove_from_cart: 'cart',
  view_cart: 'cart',
  begin_checkout: 'checkout',
  add_shipping_info: 'checkout',
  add_payment_info: 'payment',
  purchase: 'conversion',
  refund: 'conversion',
};

/**
 * Track when a user views content/product
 * Meta: ViewContent | GA4: view_item
 */
export function trackViewContent(params: {
  contentId: string;
  contentName?: string;
  contentType?: string;
  contentCategory?: string;
  value?: number;
  currency?: string;
}): void {
  emitSessionEvent({
    name: 'funnel.view_content',
    attributes: {
      'event.category': 'funnel.ecommerce',
      'funnel.event': 'view_content',
      'funnel.stage': FUNNEL_STAGE_MAP['view_content'],
      'content.id': params.contentId,
      'content.name': params.contentName,
      'content.type': params.contentType,
      'content.category': params.contentCategory,
      'content.value': params.value,
      'content.currency': params.currency,
      'meta.event': 'ViewContent',
      'ga4.event': 'view_item',
    },
  });
}

/**
 * Track when a user views a list of products
 * Meta: (custom) | GA4: view_item_list
 */
export function trackViewItemList(params: {
  listId?: string;
  listName?: string;
  items: ContentItem[];
}): void {
  emitSessionEvent({
    name: 'funnel.view_item_list',
    attributes: {
      'event.category': 'funnel.ecommerce',
      'funnel.event': 'view_item_list',
      'funnel.stage': FUNNEL_STAGE_MAP['view_item_list'],
      'list.id': params.listId,
      'list.name': params.listName,
      'items.count': params.items.length,
      'items.ids': params.items.map(i => i.id).join(','),
      'ga4.event': 'view_item_list',
    },
  });
}

/**
 * Track when a user searches
 * Meta: Search | GA4: search
 */
export function trackSearch(params: {
  searchTerm: string;
  searchCategory?: string;
}): void {
  emitSessionEvent({
    name: 'funnel.search',
    attributes: {
      'event.category': 'funnel.ecommerce',
      'funnel.event': 'search',
      'funnel.stage': FUNNEL_STAGE_MAP['search'],
      'search.term': params.searchTerm,
      'search.category': params.searchCategory,
      'meta.event': 'Search',
      'ga4.event': 'search',
    },
  });
}

/**
 * Track when a user selects/clicks on a product
 * Meta: (custom) | GA4: select_item
 */
export function trackSelectItem(params: {
  contentId: string;
  contentName?: string;
  contentCategory?: string;
  listId?: string;
  listName?: string;
  index?: number;
  value?: number;
  currency?: string;
}): void {
  emitSessionEvent({
    name: 'funnel.select_item',
    attributes: {
      'event.category': 'funnel.ecommerce',
      'funnel.event': 'select_item',
      'funnel.stage': FUNNEL_STAGE_MAP['select_item'],
      'content.id': params.contentId,
      'content.name': params.contentName,
      'content.category': params.contentCategory,
      'list.id': params.listId,
      'list.name': params.listName,
      'item.index': params.index,
      'content.value': params.value,
      'content.currency': params.currency,
      'ga4.event': 'select_item',
    },
  });
}

/**
 * Track when a user adds to wishlist
 * Meta: AddToWishlist | GA4: add_to_wishlist
 */
export function trackAddToWishlist(params: {
  contentId: string;
  contentName?: string;
  contentCategory?: string;
  value?: number;
  currency?: string;
}): void {
  emitSessionEvent({
    name: 'funnel.add_to_wishlist',
    attributes: {
      'event.category': 'funnel.ecommerce',
      'funnel.event': 'add_to_wishlist',
      'funnel.stage': FUNNEL_STAGE_MAP['add_to_wishlist'],
      'content.id': params.contentId,
      'content.name': params.contentName,
      'content.category': params.contentCategory,
      'content.value': params.value,
      'content.currency': params.currency,
      'meta.event': 'AddToWishlist',
      'ga4.event': 'add_to_wishlist',
    },
  });
}

/**
 * Track when a user adds to cart
 * Meta: AddToCart | GA4: add_to_cart
 */
export function trackAddToCart(params: {
  contentId: string;
  contentName?: string;
  contentCategory?: string;
  value: number;
  currency: string;
  quantity?: number;
}): void {
  emitSessionEvent({
    name: 'funnel.add_to_cart',
    attributes: {
      'event.category': 'funnel.ecommerce',
      'funnel.event': 'add_to_cart',
      'funnel.stage': FUNNEL_STAGE_MAP['add_to_cart'],
      'content.id': params.contentId,
      'content.name': params.contentName,
      'content.category': params.contentCategory,
      'content.value': params.value,
      'content.currency': params.currency,
      'content.quantity': params.quantity ?? 1,
      'meta.event': 'AddToCart',
      'ga4.event': 'add_to_cart',
    },
  });
}

/**
 * Track when a user removes from cart
 * Meta: (custom) | GA4: remove_from_cart
 */
export function trackRemoveFromCart(params: {
  contentId: string;
  contentName?: string;
  value: number;
  currency: string;
  quantity?: number;
}): void {
  emitSessionEvent({
    name: 'funnel.remove_from_cart',
    attributes: {
      'event.category': 'funnel.ecommerce',
      'funnel.event': 'remove_from_cart',
      'funnel.stage': FUNNEL_STAGE_MAP['remove_from_cart'],
      'content.id': params.contentId,
      'content.name': params.contentName,
      'content.value': params.value,
      'content.currency': params.currency,
      'content.quantity': params.quantity ?? 1,
      'ga4.event': 'remove_from_cart',
    },
  });
}

/**
 * Track when a user views their cart
 * Meta: (custom) | GA4: view_cart
 */
export function trackViewCart(params: {
  value: number;
  currency: string;
  items: ContentItem[];
}): void {
  emitSessionEvent({
    name: 'funnel.view_cart',
    attributes: {
      'event.category': 'funnel.ecommerce',
      'funnel.event': 'view_cart',
      'funnel.stage': FUNNEL_STAGE_MAP['view_cart'],
      'cart.value': params.value,
      'cart.currency': params.currency,
      'cart.items_count': params.items.length,
      'cart.item_ids': params.items.map(i => i.id).join(','),
      'ga4.event': 'view_cart',
    },
  });
}

/**
 * Track when a user initiates checkout
 * Meta: InitiateCheckout | GA4: begin_checkout
 */
export function trackInitiateCheckout(params: {
  value: number;
  currency: string;
  numItems: number;
  contentIds?: string[];
  coupon?: string;
}): void {
  emitSessionEvent({
    name: 'funnel.initiate_checkout',
    attributes: {
      'event.category': 'funnel.ecommerce',
      'funnel.event': 'initiate_checkout',
      'funnel.stage': FUNNEL_STAGE_MAP['begin_checkout'],
      'checkout.value': params.value,
      'checkout.currency': params.currency,
      'checkout.items_count': params.numItems,
      'checkout.item_ids': params.contentIds?.join(','),
      'checkout.coupon': params.coupon,
      'meta.event': 'InitiateCheckout',
      'ga4.event': 'begin_checkout',
    },
  });
}

/**
 * Track when a user adds shipping info
 * Meta: (custom) | GA4: add_shipping_info
 */
export function trackAddShippingInfo(params: {
  value: number;
  currency: string;
  shippingTier?: string;
  coupon?: string;
}): void {
  emitSessionEvent({
    name: 'funnel.add_shipping_info',
    attributes: {
      'event.category': 'funnel.ecommerce',
      'funnel.event': 'add_shipping_info',
      'funnel.stage': FUNNEL_STAGE_MAP['add_shipping_info'],
      'checkout.value': params.value,
      'checkout.currency': params.currency,
      'shipping.tier': params.shippingTier,
      'checkout.coupon': params.coupon,
      'ga4.event': 'add_shipping_info',
    },
  });
}

/**
 * Track when a user adds payment info
 * Meta: AddPaymentInfo | GA4: add_payment_info
 */
export function trackAddPaymentInfo(params: {
  value: number;
  currency: string;
  paymentType?: string;
  coupon?: string;
}): void {
  emitSessionEvent({
    name: 'funnel.add_payment_info',
    attributes: {
      'event.category': 'funnel.ecommerce',
      'funnel.event': 'add_payment_info',
      'funnel.stage': FUNNEL_STAGE_MAP['add_payment_info'],
      'checkout.value': params.value,
      'checkout.currency': params.currency,
      'payment.type': params.paymentType,
      'checkout.coupon': params.coupon,
      'meta.event': 'AddPaymentInfo',
      'ga4.event': 'add_payment_info',
    },
  });
}

/**
 * Track when a user completes a purchase
 * Meta: Purchase | GA4: purchase
 */
export function trackPurchase(params: {
  transactionId: string;
  value: number;
  currency: string;
  contentIds?: string[];
  numItems?: number;
  coupon?: string;
  shipping?: number;
  tax?: number;
}): void {
  emitSessionEvent({
    name: 'funnel.purchase',
    attributes: {
      'event.category': 'funnel.ecommerce',
      'funnel.event': 'purchase',
      'funnel.stage': FUNNEL_STAGE_MAP['purchase'],
      'transaction.id': params.transactionId,
      'transaction.value': params.value,
      'transaction.currency': params.currency,
      'transaction.item_ids': params.contentIds?.join(','),
      'transaction.items_count': params.numItems,
      'transaction.coupon': params.coupon,
      'transaction.shipping': params.shipping,
      'transaction.tax': params.tax,
      'meta.event': 'Purchase',
      'ga4.event': 'purchase',
    },
  });
}

/**
 * Track when a refund occurs
 * Meta: (custom) | GA4: refund
 */
export function trackRefund(params: {
  transactionId: string;
  value: number;
  currency: string;
  contentIds?: string[];
}): void {
  emitSessionEvent({
    name: 'funnel.refund',
    attributes: {
      'event.category': 'funnel.ecommerce',
      'funnel.event': 'refund',
      'funnel.stage': FUNNEL_STAGE_MAP['refund'],
      'transaction.id': params.transactionId,
      'transaction.value': params.value,
      'transaction.currency': params.currency,
      'transaction.item_ids': params.contentIds?.join(','),
      'ga4.event': 'refund',
    },
  });
}
