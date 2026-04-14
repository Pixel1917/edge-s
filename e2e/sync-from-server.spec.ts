import { expect, test, type Locator } from '@playwright/test';

const extractCounter = async (locator: Locator) => {
	const text = (await locator.innerText()).trim();
	const match = text.match(/(\d+)\s*$/);
	return match ? Number(match[1]) : NaN;
};

test.describe('syncFromServer routes', () => {
	test('renders overview and header navigation', async ({ page }) => {
		await page.goto('/sync-tests');
		await expect(page.getByTestId('sync-overview-description')).toContainText('switch between server-to-client sync test scenarios');
		await expect(page.getByRole('link', { name: 'No layout load' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'With layout + page' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Deep action page' })).toBeVisible();
	});

	test('syncs state on route without own layout via invalidateAll', async ({ page }) => {
		await page.goto('/sync-tests/no-layout');
		await expect(page.getByTestId('case-description')).toContainText('No +layout.server.ts');
		await expect(page.getByTestId('no-layout-scenario')).toContainText('no-layout');

		const before = await page.getByTestId('no-layout-page-counter').innerText();
		await page.getByTestId('no-layout-invalidate').click();
		await expect(page.getByTestId('no-layout-page-counter')).not.toHaveText(before);
	});

	test('keeps no-layout layoutCounter default while pageCounter changes', async ({ page }) => {
		await page.goto('/sync-tests/no-layout');
		await expect(page.getByTestId('no-layout-layout-counter')).toContainText('Layout counter: 0');
		const before = await page.getByTestId('no-layout-page-counter').innerText();
		await page.getByTestId('no-layout-invalidate').click();
		await expect(page.getByTestId('no-layout-layout-counter')).toContainText('Layout counter: 0');
		await expect(page.getByTestId('no-layout-page-counter')).not.toHaveText(before);
	});

	test('shows layout and page state together', async ({ page }) => {
		await page.goto('/sync-tests/with-layout');
		await expect(page.getByTestId('with-layout-description')).toContainText('layout.server.ts');
		await expect(page.getByTestId('with-layout-layout-counter')).toContainText('Layout counter:');
		await expect(page.getByTestId('with-layout-page-counter')).toContainText('Page counter:');
		await expect(page.getByTestId('with-layout-scenario')).toContainText('with-layout');
	});

	test('updates both layout and page counters on with-layout invalidate', async ({ page }) => {
		await page.goto('/sync-tests/with-layout');
		const layoutBefore = await page.getByTestId('with-layout-layout-counter').innerText();
		const pageBefore = await page.getByTestId('with-layout-page-counter').innerText();
		await page.getByTestId('with-layout-invalidate').click();
		await expect(page.getByTestId('with-layout-layout-counter')).not.toHaveText(layoutBefore);
		await expect(page.getByTestId('with-layout-page-counter')).not.toHaveText(pageBefore);
	});

	test('syncs deep action changes into shared layout/page state', async ({ page }) => {
		await page.goto('/sync-tests/with-layout/level-one/level-two');
		await expect(page.getByTestId('level-two-description')).toContainText('Deep nested page');

		const layoutBefore = await page.getByTestId('level-two-layout-counter').innerText();
		const pageBefore = await page.getByTestId('level-two-page-counter').innerText();
		const actionBefore = await page.getByTestId('level-two-action-counter').innerText();

		await page.getByTestId('level-two-bump').click();

		await expect(page.getByTestId('level-two-layout-counter')).not.toHaveText(layoutBefore);
		await expect(page.getByTestId('level-two-page-counter')).not.toHaveText(pageBefore);
		await expect(page.getByTestId('level-two-action-counter')).not.toHaveText(actionBefore);
		await expect(page.getByTestId('level-two-action-payload')).toContainText('bump-');
	});

	test('syncs undefined payload from deep action', async ({ page }) => {
		await page.goto('/sync-tests/with-layout/level-one/level-two');
		await page.getByTestId('level-two-bump').click();
		await expect(page.getByTestId('level-two-action-payload')).toContainText('bump-');

		await page.getByTestId('level-two-undefined').click();
		await expect(page.getByTestId('level-two-action-payload')).toContainText('undefined');
	});

	test('recovers payload from undefined back to string on next bump', async ({ page }) => {
		await page.goto('/sync-tests/with-layout/level-one/level-two');
		await page.getByTestId('level-two-undefined').click();
		await expect(page.getByTestId('level-two-action-payload')).toContainText('undefined');
		await page.getByTestId('level-two-bump').click();
		await expect(page.getByTestId('level-two-action-payload')).toContainText('bump-');
	});

	test('handles fast repeated action attempts without sync breakage', async ({ page }) => {
		await page.goto('/sync-tests/with-layout/level-one/level-two');
		const counterLocator = page.getByTestId('level-two-action-counter');
		const before = await extractCounter(counterLocator);

		await Promise.all([page.getByTestId('level-two-bump').click(), page.getByTestId('level-two-bump').click()]);

		await expect.poll(async () => extractCounter(counterLocator)).toBeGreaterThan(before);
		await expect(page.getByTestId('level-two-action-payload')).toContainText('bump-');
	});

	test('stays consistent across rapid route switches and invalidations', async ({ page }) => {
		await page.goto('/sync-tests/no-layout');
		await page.getByTestId('no-layout-invalidate').click();
		await expect(page.getByTestId('no-layout-scenario')).toContainText('no-layout');

		await page.getByRole('link', { name: 'With layout + page' }).click();
		await expect(page.getByTestId('with-layout-scenario')).toContainText('with-layout');
		await page.getByTestId('with-layout-invalidate').click();
		await expect(page.getByTestId('with-layout-page-counter')).toContainText('Page counter:');

		await page.getByRole('link', { name: 'Deep action page' }).click();
		await expect(page.getByTestId('level-two-description')).toContainText('Deep nested page');
		await page.getByTestId('level-two-bump').click();
		await expect(page.getByTestId('level-two-action-counter')).toContainText('Action counter:');

		await page.getByRole('link', { name: 'No layout load' }).click();
		await expect(page.getByTestId('no-layout-scenario')).toContainText('no-layout');
	});

	test('preserves shared scenario while navigating nested with-layout routes', async ({ page }) => {
		await page.goto('/sync-tests/with-layout');
		await expect(page.getByTestId('with-layout-scenario')).toContainText('with-layout');
		await page.getByRole('link', { name: 'Level one', exact: true }).click();
		await expect(page.getByTestId('with-layout-scenario')).toContainText('with-layout');
		await page.getByRole('link', { name: 'Level two action' }).click();
		await expect(page.getByTestId('with-layout-scenario')).toContainText('with-layout');
		await page.getByRole('link', { name: 'Root' }).click();
		await expect(page.getByTestId('with-layout-scenario')).toContainText('with-layout');
	});

	test('syncs action counters before explicit invalidateAll on level-two', async ({ page }) => {
		await page.goto('/sync-tests/with-layout/level-one/level-two');
		const before = await page.getByTestId('level-two-action-counter').innerText();
		await page.getByTestId('level-two-bump').click();
		await expect(page.getByTestId('level-two-action-counter')).not.toHaveText(before);
		const afterAction = await page.getByTestId('level-two-action-counter').innerText();
		await page.getByTestId('level-two-invalidate').click();
		await expect(page.getByTestId('level-two-action-counter')).toHaveText(afterAction);
	});
});
