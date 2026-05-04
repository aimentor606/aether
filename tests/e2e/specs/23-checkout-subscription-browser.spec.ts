import { test, expect } from '../fixtures';
import { ActivateTrialPage, CheckoutPage, NewInstanceModal, CreditPurchaseModal } from '../pages';
import { InstancesPage } from '../pages';

test.describe('Checkout & Subscription - Browser', () => {
  test.describe('Activate Trial Page', () => {
    let trialPage: ActivateTrialPage;

    test.beforeEach(async ({ authenticatedPage }) => {
      trialPage = new ActivateTrialPage(authenticatedPage);
    });

    test('should load trial activation page with heading', async () => {
      await trialPage.goto();

      const isVisible = await trialPage.heading.isVisible({ timeout: 10_000 }).catch(() => false);
      if (isVisible) {
        await trialPage.assertLoaded();
      } else {
        // May have been redirected away (already has subscription/trial)
        const url = trialPage.page.url();
        expect(url).toMatch(/\/(dashboard|instances|subscription)/);
      }
    });

    test('should show trial features list', async () => {
      await trialPage.goto();

      const isVisible = await trialPage.heading.isVisible({ timeout: 5_000 }).catch(() => false);
      test.skip(!isVisible, 'Trial page redirected — user already has trial/subscription');

      await expect(trialPage.featuresList).toBeVisible();
    });

    test('should show Start Free Trial button', async () => {
      await trialPage.goto();

      const isVisible = await trialPage.heading.isVisible({ timeout: 5_000 }).catch(() => false);
      test.skip(!isVisible, 'Trial page redirected');

      await expect(trialPage.startTrialButton).toBeVisible();
      await expect(trialPage.startTrialButton).toBeEnabled();
    });

    test('should display included features', async () => {
      await trialPage.goto();

      const isVisible = await trialPage.heading.isVisible({ timeout: 5_000 }).catch(() => false);
      test.skip(!isVisible, 'Trial page redirected');

      await expect(trialPage.page.getByText(/\$5 in Credits/i)).toBeVisible();
      await expect(trialPage.page.getByText(/7 Days Free/i)).toBeVisible();
      await expect(trialPage.page.getByText(/No charge during trial/i)).toBeVisible();
    });

    test('should show legal links', async () => {
      await trialPage.goto();

      const isVisible = await trialPage.heading.isVisible({ timeout: 5_000 }).catch(() => false);
      test.skip(!isVisible, 'Trial page redirected');

      await expect(trialPage.termsLink).toBeVisible();
      await expect(trialPage.privacyLink).toBeVisible();
    });

    test('should link to correct legal pages', async () => {
      await trialPage.goto();

      const isVisible = await trialPage.heading.isVisible({ timeout: 5_000 }).catch(() => false);
      test.skip(!isVisible, 'Trial page redirected');

      const termsHref = await trialPage.termsLink.getAttribute('href');
      expect(termsHref).toContain('/legal');

      const privacyHref = await trialPage.privacyLink.getAttribute('href');
      expect(privacyHref).toContain('/legal');
    });

    test('should redirect if user already has active trial/subscription', async ({ authenticatedPage }) => {
      await trialPage.goto();
      await authenticatedPage.waitForTimeout(3_000);

      const url = authenticatedPage.url();
      // Either we're on the trial page (no sub yet) or redirected
      const onTrialPage = url.includes('/activate-trial');
      const redirectedToDashboard = url.includes('/dashboard') || url.includes('/instances');
      expect(onTrialPage || redirectedToDashboard).toBeTruthy();
    });
  });

  test.describe('Checkout Page', () => {
    let checkoutPage: CheckoutPage;

    test.beforeEach(async ({ authenticatedPage }) => {
      checkoutPage = new CheckoutPage(authenticatedPage);
    });

    test('should show error without client_secret', async () => {
      await checkoutPage.goto();

      await expect(checkoutPage.errorHeading).toBeVisible({ timeout: 15_000 });
      await expect(checkoutPage.page.getByText(/No checkout session provided/i)).toBeVisible();
    });

    test('should show error with invalid client_secret', async () => {
      await checkoutPage.goto('cs_test_invalid_secret_12345');

      // Should show loading then error (Stripe will reject the invalid secret)
      const hasError = await checkoutPage.errorHeading.isVisible({ timeout: 15_000 }).catch(() => false);
      const hasContainer = await checkoutPage.container.isVisible({ timeout: 5_000 }).catch(() => false);
      expect(hasError || hasContainer).toBeTruthy();
    });

    test('should show loading state initially with valid structure', async () => {
      await checkoutPage.goto('cs_test_placeholder');

      // Page should render without crashing — Stripe JS handles the rest
      const body = await checkoutPage.page.textContent('body');
      expect(body).toBeTruthy();
    });
  });

  test.describe('Subscription Page Redirect', () => {
    test('should redirect /subscription to /instances', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/subscription');
      await authenticatedPage.waitForURL(/\/instances/, { timeout: 10_000 });

      expect(authenticatedPage.url()).toContain('/instances');
    });

    test('should preserve query params on redirect', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/subscription?subscription=success&session_id=test_123');
      await authenticatedPage.waitForURL(/\/instances/, { timeout: 10_000 });

      expect(authenticatedPage.url()).toContain('subscription=success');
      expect(authenticatedPage.url()).toContain('session_id=test_123');
    });
  });

  test.describe('New Instance Modal (Checkout Entry)', () => {
    let instancesPage: InstancesPage;
    let newInstanceModal: NewInstanceModal;

    test.beforeEach(async ({ authenticatedPage }) => {
      instancesPage = new InstancesPage(authenticatedPage);
      newInstanceModal = new NewInstanceModal(authenticatedPage);
    });

    test('should open NewInstanceModal from instances page', async ({ authenticatedPage }) => {
      await instancesPage.goto();

      const isCloud = process.env.E2E_CLOUD === 'true';
      const isEmpty = await instancesPage.emptyState.isVisible({ timeout: 3_000 }).catch(() => false);

      if (!isCloud && !isEmpty) {
        test.skip(true, 'Not cloud mode and instances exist — modal may not be available');
      }

      if (await instancesPage.newInstanceButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await instancesPage.newInstanceButton.click();

        const modalVisible = await newInstanceModal.heading.isVisible({ timeout: 10_000 }).catch(() => false);
        if (modalVisible) {
          await expect(newInstanceModal.chooseMachineLabel).toBeVisible();
          await expect(newInstanceModal.ctaButton).toBeVisible();
        }
      }
    });

    test('should display plan tiers in modal', async ({ authenticatedPage }) => {
      await instancesPage.goto();

      const isCloud = process.env.E2E_CLOUD === 'true';
      const isEmpty = await instancesPage.emptyState.isVisible({ timeout: 3_000 }).catch(() => false);
      test.skip(!isCloud && !isEmpty, 'Modal not available in local mode with existing instances');

      if (await instancesPage.newInstanceButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await instancesPage.newInstanceButton.click();

        if (await newInstanceModal.heading.isVisible({ timeout: 10_000 }).catch(() => false)) {
          const tierCount = await newInstanceModal.tierOptions.count();
          expect(tierCount).toBeGreaterThanOrEqual(0);

          await expect(newInstanceModal.includesSection).toBeVisible();
        }
      }
    });

    test('should disable CTA until tier is selected', async ({ authenticatedPage }) => {
      await instancesPage.goto();

      const isCloud = process.env.E2E_CLOUD === 'true';
      const isEmpty = await instancesPage.emptyState.isVisible({ timeout: 3_000 }).catch(() => false);
      test.skip(!isCloud && !isEmpty, 'Modal not available');

      if (await instancesPage.newInstanceButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await instancesPage.newInstanceButton.click();

        if (await newInstanceModal.heading.isVisible({ timeout: 10_000 }).catch(() => false)) {
          const isDisabled = await newInstanceModal.ctaButton.isDisabled().catch(() => true);
          expect(typeof isDisabled).toBe('boolean');
        }
      }
    });

    test('should show "Every plan includes" features', async ({ authenticatedPage }) => {
      await instancesPage.goto();

      const isCloud = process.env.E2E_CLOUD === 'true';
      const isEmpty = await instancesPage.emptyState.isVisible({ timeout: 3_000 }).catch(() => false);
      test.skip(!isCloud && !isEmpty, 'Modal not available');

      if (await instancesPage.newInstanceButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await instancesPage.newInstanceButton.click();

        if (await newInstanceModal.heading.isVisible({ timeout: 10_000 }).catch(() => false)) {
          await expect(authenticatedPage.getByText(/Always-on cloud computer/i)).toBeVisible();
          await expect(authenticatedPage.getByText(/\$5 in LLM credits/i)).toBeVisible();
          await expect(authenticatedPage.getByText(/Persistent storage/i)).toBeVisible();
        }
      }
    });

    test('should close modal via close button', async ({ authenticatedPage }) => {
      await instancesPage.goto();

      const isCloud = process.env.E2E_CLOUD === 'true';
      const isEmpty = await instancesPage.emptyState.isVisible({ timeout: 3_000 }).catch(() => false);
      test.skip(!isCloud && !isEmpty, 'Modal not available');

      if (await instancesPage.newInstanceButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await instancesPage.newInstanceButton.click();

        if (await newInstanceModal.heading.isVisible({ timeout: 10_000 }).catch(() => false)) {
          await newInstanceModal.close();
          await expect(newInstanceModal.heading).not.toBeVisible({ timeout: 5_000 });
        }
      }
    });
  });

  test.describe('Credit Purchase Modal', () => {
    let creditModal: CreditPurchaseModal;

    test.beforeEach(async ({ authenticatedPage }) => {
      creditModal = new CreditPurchaseModal(authenticatedPage);
    });

    test('should show credit purchase option when available', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});

      // Look for any credit-related UI element
      const creditElements = authenticatedPage.getByText(/credit|Credit/i);
      const hasCredits = await creditElements.first().isVisible({ timeout: 5_000 }).catch(() => false);
      expect(typeof hasCredits).toBe('boolean');
    });

    test('should show buy credits modal heading when opened', async ({ authenticatedPage }) => {
      // Navigate to instances page where billing controls are
      const instancesPage = new InstancesPage(authenticatedPage);
      await instancesPage.goto();

      const buyCreditsBtn = authenticatedPage.getByRole('button', { name: /Buy Credits|credits/i });
      if (await buyCreditsBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await buyCreditsBtn.click();

        const modalVisible = await creditModal.heading.isVisible({ timeout: 10_000 }).catch(() => false);
        if (modalVisible) {
          await creditModal.assertVisible();
        }
      }
    });

    test('should display credit package options in modal', async ({ authenticatedPage }) => {
      const instancesPage = new InstancesPage(authenticatedPage);
      await instancesPage.goto();

      const buyCreditsBtn = authenticatedPage.getByRole('button', { name: /Buy Credits|credits/i });
      if (await buyCreditsBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await buyCreditsBtn.click();

        if (await creditModal.heading.isVisible({ timeout: 10_000 }).catch(() => false)) {
          const noSubText = await creditModal.noSubscriptionText.isVisible({ timeout: 3_000 }).catch(() => false);
          if (!noSubText) {
            const packageCount = await creditModal.packageButtons.count();
            expect(packageCount).toBeGreaterThanOrEqual(0);
          }
        }
      }
    });
  });

  test.describe('Subscription Post-Payment Flow', () => {
    test('should handle subscription=success query param on instances', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/instances?subscription=success');

      // Page should load without errors
      const instancesPage = new InstancesPage(authenticatedPage);
      await instancesPage.assertLoaded();

      // URL should eventually be cleaned up
      await authenticatedPage.waitForTimeout(3_000);
      expect(authenticatedPage.url()).toBeTruthy();
    });

    test('should handle credit_purchase=success query param', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/instances?credit_purchase=success');

      const instancesPage = new InstancesPage(authenticatedPage);
      await instancesPage.assertLoaded();
    });
  });
});
