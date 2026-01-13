/**
 * Lead Generation Funnel Events
 *
 * Standard funnel events for lead generation, compatible with Meta Pixel.
 * These events track user engagement through the lead gen funnel.
 */

import { emitSessionEvent } from '../events';

/**
 * Track when a user submits a lead form
 * Meta: Lead | GA4: generate_lead
 */
export function trackLead(params: {
  value?: number;
  currency?: string;
  leadType?: string;
  leadSource?: string;
}): void {
  emitSessionEvent({
    name: 'funnel.lead',
    attributes: {
      'event.category': 'funnel.lead',
      'funnel.event': 'lead',
      'funnel.stage': 'lead',
      'lead.value': params.value,
      'lead.currency': params.currency,
      'lead.type': params.leadType,
      'lead.source': params.leadSource,
      'meta.event': 'Lead',
      'ga4.event': 'generate_lead',
    },
  });
}

/**
 * Track when a user completes registration
 * Meta: CompleteRegistration | GA4: sign_up
 */
export function trackCompleteRegistration(params: {
  method?: string;
  value?: number;
  currency?: string;
  status?: string;
}): void {
  emitSessionEvent({
    name: 'funnel.complete_registration',
    attributes: {
      'event.category': 'funnel.lead',
      'funnel.event': 'complete_registration',
      'funnel.stage': 'registration',
      'registration.method': params.method,
      'registration.value': params.value,
      'registration.currency': params.currency,
      'registration.status': params.status,
      'meta.event': 'CompleteRegistration',
      'ga4.event': 'sign_up',
    },
  });
}

/**
 * Track when a user contacts the business
 * Meta: Contact | GA4: (custom)
 */
export function trackContact(params: {
  contactMethod?: string;
  subject?: string;
}): void {
  emitSessionEvent({
    name: 'funnel.contact',
    attributes: {
      'event.category': 'funnel.lead',
      'funnel.event': 'contact',
      'funnel.stage': 'contact',
      'contact.method': params.contactMethod,
      'contact.subject': params.subject,
      'meta.event': 'Contact',
    },
  });
}

/**
 * Track when a user starts a free trial
 * Meta: StartTrial | GA4: (custom)
 */
export function trackStartTrial(params: {
  trialType?: string;
  value?: number;
  currency?: string;
  predictedLtv?: number;
}): void {
  emitSessionEvent({
    name: 'funnel.start_trial',
    attributes: {
      'event.category': 'funnel.lead',
      'funnel.event': 'start_trial',
      'funnel.stage': 'trial',
      'trial.type': params.trialType,
      'trial.value': params.value,
      'trial.currency': params.currency,
      'trial.predicted_ltv': params.predictedLtv,
      'meta.event': 'StartTrial',
    },
  });
}

/**
 * Track when a user submits an application
 * Meta: SubmitApplication | GA4: (custom)
 */
export function trackSubmitApplication(params: {
  applicationType?: string;
  applicationId?: string;
}): void {
  emitSessionEvent({
    name: 'funnel.submit_application',
    attributes: {
      'event.category': 'funnel.lead',
      'funnel.event': 'submit_application',
      'funnel.stage': 'application',
      'application.type': params.applicationType,
      'application.id': params.applicationId,
      'meta.event': 'SubmitApplication',
    },
  });
}

/**
 * Track when a user subscribes
 * Meta: Subscribe | GA4: (custom)
 */
export function trackSubscribe(params: {
  subscriptionType?: string;
  value?: number;
  currency?: string;
  predictedLtv?: number;
}): void {
  emitSessionEvent({
    name: 'funnel.subscribe',
    attributes: {
      'event.category': 'funnel.lead',
      'funnel.event': 'subscribe',
      'funnel.stage': 'subscription',
      'subscription.type': params.subscriptionType,
      'subscription.value': params.value,
      'subscription.currency': params.currency,
      'subscription.predicted_ltv': params.predictedLtv,
      'meta.event': 'Subscribe',
    },
  });
}

/**
 * Track when a user schedules an appointment
 * Meta: Schedule | GA4: (custom)
 */
export function trackSchedule(params: {
  appointmentType?: string;
  appointmentDate?: string;
}): void {
  emitSessionEvent({
    name: 'funnel.schedule',
    attributes: {
      'event.category': 'funnel.lead',
      'funnel.event': 'schedule',
      'funnel.stage': 'schedule',
      'appointment.type': params.appointmentType,
      'appointment.date': params.appointmentDate,
      'meta.event': 'Schedule',
    },
  });
}

/**
 * Track when a user finds a location
 * Meta: FindLocation | GA4: (custom)
 */
export function trackFindLocation(params: {
  searchQuery?: string;
  locationFound?: string;
}): void {
  emitSessionEvent({
    name: 'funnel.find_location',
    attributes: {
      'event.category': 'funnel.lead',
      'funnel.event': 'find_location',
      'funnel.stage': 'location',
      'location.search_query': params.searchQuery,
      'location.found': params.locationFound,
      'meta.event': 'FindLocation',
    },
  });
}

/**
 * Track when a user makes a donation
 * Meta: Donate | GA4: (custom)
 */
export function trackDonate(params: {
  value: number;
  currency: string;
  donationType?: string;
  campaignId?: string;
}): void {
  emitSessionEvent({
    name: 'funnel.donate',
    attributes: {
      'event.category': 'funnel.lead',
      'funnel.event': 'donate',
      'funnel.stage': 'donation',
      'donation.value': params.value,
      'donation.currency': params.currency,
      'donation.type': params.donationType,
      'donation.campaign_id': params.campaignId,
      'meta.event': 'Donate',
    },
  });
}

/**
 * Track when a user customizes a product
 * Meta: CustomizeProduct | GA4: (custom)
 */
export function trackCustomizeProduct(params: {
  contentId: string;
  contentName?: string;
  customizations?: string[];
}): void {
  emitSessionEvent({
    name: 'funnel.customize_product',
    attributes: {
      'event.category': 'funnel.lead',
      'funnel.event': 'customize_product',
      'funnel.stage': 'customization',
      'content.id': params.contentId,
      'content.name': params.contentName,
      'customization.options': params.customizations?.join(','),
      'meta.event': 'CustomizeProduct',
    },
  });
}
