import { describe, expect, it } from 'vitest';
import { createPresenter, createStore } from './Provider.js';

describe('Provider diagnostics', () => {
	it('does not throw on cyclic presenter dependencies', () => {
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

		expect(() => useA()).not.toThrow();
		expect(useA().label).toBe('a');
	});

	it('allows eager provider instance injection without diagnostics throw', () => {
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

		expect(createConsumer).not.toThrow();
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

	it('does not throw on duplicate named store keys', () => {
		const createDuplicateStores = () => {
			createStore('DuplicateStore', () => ({ value: 1 }));
			createStore('DuplicateStore', () => ({ value: 2 }));
		};

		expect(createDuplicateStores).not.toThrow();
	});

	it('does not throw on duplicate named presenter/store cross-kind keys', () => {
		const createCrossKindDuplicate = () => {
			createPresenter('SharedKey', () => ({ value: 1 }));
			createStore('SharedKey', () => ({ value: 2 }));
		};

		expect(createCrossKindDuplicate).not.toThrow();
	});
});
