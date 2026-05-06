import { describe, expect, it } from 'vitest';
import { createPresenter, createPresenterFactory, createStore } from './Provider.js';

describe('Provider diagnostics', () => {
	it('throws a readable error on cyclic presenter dependencies', () => {
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

		expect(() => useA()).toThrow('Circular provider dependency detected: CycleA -> CycleB -> CycleA');
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

	it('allows presenter factory consumers to receive local dependencies', () => {
		const createAppPresenter = createPresenterFactory({
			prefix: 'app'
		});

		const useChildPresenter = createPresenter('FactoryChildPresenter', () => ({
			label: 'child'
		}));

		const usePresenter = createAppPresenter(
			'FactoryPresenterWithLocalDeps',
			({ prefix, child }: { prefix: string; child: () => { label: string } }) => ({
				label: `${prefix}:${child().label}`
			}),
			{
				child: useChildPresenter
			}
		);

		expect(usePresenter().label).toBe('app:child');
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
