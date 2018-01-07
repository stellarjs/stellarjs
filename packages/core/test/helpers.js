import _ from 'lodash';

function expectMethodMocksToHaveBeeenCalled(instance, ...expectedFns) {
  const fnNames = _.functions(instance);
  for (let i = 0; i < fnNames.length; i++) {
    const fnName = fnNames[i];
    const expectedFn = _.find(expectedFns, expectedFn => expectedFn.name === fnName);
    if (expectedFn) {
      expect(instance[fnName]).toHaveBeenCalled(); // `Expected transport.${fnName} to have been called`
      if (expectedFn.numCalls) {
        expect(instance[fnName].mock.calls).toHaveLength(expectedFn.numCalls); // `Expected transport.${fnName} to have been called ${expectedFn.args[i]} times, not ${instance.transport[fnName].mock.calls} times`
      }
      if (expectedFn.args) {
        for (let i = 0; i < expectedFn.args.length; ++i) {
          expect(instance[fnName].mock.calls[i]).toEqual(expectedFn.args[i]); // , `Expected transport.${fnName} call ${i} to have been called with ${expectedFn.args[i]}, not ${instance.transport[fnName].mock.calls[i]}`
        }
      }

      continue;
    }

    expect(instance[fnName]).not.toHaveBeenCalled(); // `Expected transport.${fnName} not to have been called with ${instance.transport[fnName].mock.calls[i]}`
  }
}

export { expectMethodMocksToHaveBeeenCalled };
