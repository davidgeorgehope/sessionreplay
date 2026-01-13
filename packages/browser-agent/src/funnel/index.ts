/**
 * Funnel Tracking Module
 *
 * Standard funnel events compatible with Meta Pixel and Google Analytics 4.
 * Use these to track conversion funnels and correlate with frustration signals.
 */

// Ecommerce funnel events
export {
  trackViewContent,
  trackViewItemList,
  trackSearch,
  trackSelectItem,
  trackAddToWishlist,
  trackAddToCart,
  trackRemoveFromCart,
  trackViewCart,
  trackInitiateCheckout,
  trackAddShippingInfo,
  trackAddPaymentInfo,
  trackPurchase,
  trackRefund,
} from './ecommerce';

export type { FunnelStage, ContentItem } from './ecommerce';

// Lead generation funnel events
export {
  trackLead,
  trackCompleteRegistration,
  trackContact,
  trackStartTrial,
  trackSubmitApplication,
  trackSubscribe,
  trackSchedule,
  trackFindLocation,
  trackDonate,
  trackCustomizeProduct,
} from './lead';
