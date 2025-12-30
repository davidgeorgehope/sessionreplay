import { describe, it, expect, beforeEach } from 'vitest';
import { DeadClickDetector, isInteractiveElement, type DeadClickEvent } from './dead-click';

describe('DeadClickDetector', () => {
  let detector: DeadClickDetector;
  let detectedEvents: DeadClickEvent[];

  beforeEach(() => {
    detectedEvents = [];
    detector = new DeadClickDetector({
      onDeadClick: (event) => detectedEvents.push(event),
    });
  });

  describe('isInteractiveElement', () => {
    it('should return true for buttons', () => {
      const button = createElement('button');
      expect(isInteractiveElement(button)).toBe(true);
    });

    it('should return true for anchor tags with href', () => {
      const link = createElement('a', { href: '/page' });
      expect(isInteractiveElement(link)).toBe(true);
    });

    it('should return false for anchor tags without href', () => {
      const link = createElement('a');
      expect(isInteractiveElement(link)).toBe(false);
    });

    it('should return true for input elements', () => {
      const input = createElement('input', { type: 'text' });
      expect(isInteractiveElement(input)).toBe(true);
    });

    it('should return true for select elements', () => {
      const select = createElement('select');
      expect(isInteractiveElement(select)).toBe(true);
    });

    it('should return true for textarea elements', () => {
      const textarea = createElement('textarea');
      expect(isInteractiveElement(textarea)).toBe(true);
    });

    it('should return true for elements with role="button"', () => {
      const div = createElement('div', { role: 'button' });
      expect(isInteractiveElement(div)).toBe(true);
    });

    it('should return true for elements with role="link"', () => {
      const span = createElement('span', { role: 'link' });
      expect(isInteractiveElement(span)).toBe(true);
    });

    it('should return true for elements with tabindex', () => {
      const div = createElement('div', { tabindex: '0' });
      expect(isInteractiveElement(div)).toBe(true);
    });

    it('should return true for elements with onclick', () => {
      const div = createElement('div', { onclick: 'doSomething()' });
      expect(isInteractiveElement(div)).toBe(true);
    });

    it('should return false for plain divs', () => {
      const div = createElement('div');
      expect(isInteractiveElement(div)).toBe(false);
    });

    it('should return false for plain spans', () => {
      const span = createElement('span');
      expect(isInteractiveElement(span)).toBe(false);
    });

    it('should return false for paragraphs', () => {
      const p = createElement('p');
      expect(isInteractiveElement(p)).toBe(false);
    });

    it('should return false for disabled buttons', () => {
      const button = createElement('button', { disabled: 'true' });
      expect(isInteractiveElement(button)).toBe(false);
    });

    it('should return false for disabled inputs', () => {
      const input = createElement('input', { disabled: 'true' });
      expect(isInteractiveElement(input)).toBe(false);
    });
  });

  describe('dead click detection', () => {
    it('should detect click on non-interactive element', () => {
      const div = createElement('div');

      detector.recordClick(div);

      expect(detectedEvents).toHaveLength(1);
      expect(detectedEvents[0].element).toBe(div);
    });

    it('should not detect click on button', () => {
      const button = createElement('button');

      detector.recordClick(button);

      expect(detectedEvents).toHaveLength(0);
    });

    it('should not detect click on link with href', () => {
      const link = createElement('a', { href: '/page' });

      detector.recordClick(link);

      expect(detectedEvents).toHaveLength(0);
    });

    it('should detect click on link without href', () => {
      const link = createElement('a');

      detector.recordClick(link);

      expect(detectedEvents).toHaveLength(1);
    });

    it('should detect click on disabled button', () => {
      const button = createElement('button', { disabled: 'true' });

      detector.recordClick(button);

      expect(detectedEvents).toHaveLength(1);
    });

    it('should not detect click on element with role="button"', () => {
      const div = createElement('div', { role: 'button' });

      detector.recordClick(div);

      expect(detectedEvents).toHaveLength(0);
    });
  });

  describe('event details', () => {
    it('should include element tag name', () => {
      const div = createElement('div');

      detector.recordClick(div);

      expect(detectedEvents[0].elementTag).toBe('div');
    });

    it('should include element id if present', () => {
      const div = createElement('div', { id: 'my-div' });

      detector.recordClick(div);

      expect(detectedEvents[0].elementId).toBe('my-div');
    });

    it('should include timestamp', () => {
      const div = createElement('div');
      const before = Date.now();

      detector.recordClick(div);

      expect(detectedEvents[0].timestamp).toBeGreaterThanOrEqual(before);
    });

    it('should include frustration score', () => {
      const div = createElement('div');

      detector.recordClick(div);

      expect(detectedEvents[0].score).toBeGreaterThan(0);
      expect(detectedEvents[0].score).toBeLessThanOrEqual(1);
    });

    it('should include reason for dead click', () => {
      const div = createElement('div');

      detector.recordClick(div);

      expect(detectedEvents[0].reason).toBe('non_interactive');
    });

    it('should indicate disabled state in reason', () => {
      const button = createElement('button', { disabled: 'true' });

      detector.recordClick(button);

      expect(detectedEvents[0].reason).toBe('disabled');
    });
  });

  describe('lookClickable detection', () => {
    it('should have higher score for elements that look clickable', () => {
      // Element with cursor: pointer styling would look clickable
      const div = createElement('div', { 'data-looks-clickable': 'true' });

      detector.recordClick(div, { looksClickable: true });

      expect(detectedEvents[0].score).toBeGreaterThan(0.5);
      expect(detectedEvents[0].looksClickable).toBe(true);
    });

    it('should have lower score for plain elements', () => {
      const div = createElement('div');

      detector.recordClick(div, { looksClickable: false });

      expect(detectedEvents[0].score).toBeLessThan(0.5);
    });
  });

  describe('parent traversal', () => {
    it('should check parent elements for interactivity', () => {
      const button = createElement('button');
      const span = createElement('span');
      span.getAttribute = (name: string) => {
        if (name === 'data-parent') return 'button';
        return null;
      };
      // Simulate span inside button
      Object.defineProperty(span, 'parentElement', {
        value: button,
        configurable: true,
      });

      detector.recordClick(span, { checkParents: true });

      // Should not be a dead click because parent is interactive
      expect(detectedEvents).toHaveLength(0);
    });
  });
});

// Helper to create mock elements
function createElement(
  tagName: string,
  attributes: Record<string, string> = {}
): Element {
  const element = {
    tagName: tagName.toUpperCase(),
    id: attributes.id || '',
    getAttribute: (name: string) => attributes[name] || null,
    hasAttribute: (name: string) => name in attributes,
    parentElement: null,
  } as unknown as Element;
  return element;
}
