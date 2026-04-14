import { describe, expect, it } from 'vitest';
import { createPresenter } from './Provider.js';
import { dev } from '../utils/environment.js';

describe('Provider diagnostics', () => {
	it('throws on cyclic presenter dependencies', () => {
		let useA: () => { label: string } = () => ({ label: '' });

		const useB = createPresenter(
			'CycleB',
			({ getA }: { getA: () => { label: string } }) => {
				getA();
				return { label: 'b' };
			},
			{
				getA: () => useA()
			}
		);

		useA = createPresenter(
			'CycleA',
			({ useB }: { useB: () => { label: string } }) => {
				useB();
				return { label: 'a' };
			},
			{
				useB
			}
		);

		expect(() => useA()).toThrow(/Circular provider dependency detected/);
		expect(() => useA()).toThrow(/CycleA -> CycleB -> CycleA/);
	});

	it('throws on eager provider instance injection in dev', () => {
		const useBase = createPresenter('BasePresenter', () => ({ value: 1 }));
		const baseInstance = useBase();

		const createConsumer = () =>
			createPresenter(
				'ConsumerPresenter',
				({ base }: { base: { value: number } }) => ({
					value: base.value
				}),
				{
					base: baseInstance
				}
			)();

		if (dev) {
			expect(createConsumer).toThrow(/Eager provider injection detected/);
		} else {
			expect(createConsumer).not.toThrow();
		}
	});

	it('allows lazy provider function injection', () => {
		const useCounter = createPresenter('CounterPresenter', () => ({ value: 5 }));

		const useConsumer = createPresenter(
			'LazyConsumerPresenter',
			({ useCounter }: { useCounter: () => { value: number } }) => {
				return {
					getValue: () => useCounter().value
				};
			},
			{
				useCounter
			}
		);

		expect(useConsumer().getValue()).toBe(5);
	});
});
